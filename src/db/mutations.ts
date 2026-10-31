// Every write goes to local SQLite first; PowerSync uploads it when there is signal.
// PowerSync does not enforce unique indexes locally, so the checks Postgres would do
// on upload are repeated here so the munshi sees them immediately.
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { getRandomBytes, randomUUID } from 'expo-crypto';

import { clashingMarks, type DayStatus } from '@/lib/attendance';
import { today } from '@/lib/dates';
import { makeRefCode } from '@/lib/ref-code';

import { db } from './index';
import {
  assignment,
  attendance,
  expenseCategory,
  ledgerEntry,
  membership,
  project,
  projectExpense,
  rejectedWrite,
  trade,
  worker,
} from './schema';

export interface WriteContext {
  businessId: string;
  userId: string;
}

function meta(ctx: WriteContext) {
  const now = new Date().toISOString();
  return { business_id: ctx.businessId, created_by: ctx.userId, created_at: now, updated_at: now };
}

function touched() {
  return { updated_at: new Date().toISOString() };
}

// ─── Projects ────────────────────────────────────────────────────────────────

export interface ProjectInput {
  code: string;
  name_ur: string;
  address: string | null;
}

export async function projectCodeTaken(code: string, exceptId?: string) {
  const rows = await db.select({ id: project.id }).from(project).where(eq(project.code, code.trim()));
  return rows.some((r) => r.id !== exceptId);
}

export async function createProject(ctx: WriteContext, input: ProjectInput) {
  const id = randomUUID();
  await db.insert(project).values({
    id,
    code: input.code.trim(),
    name_ur: input.name_ur.trim(),
    address: input.address?.trim() || null,
    started_on: today(),
    is_active: true,
    ...meta(ctx),
  });
  return id;
}

export async function updateProject(id: string, input: ProjectInput) {
  await db
    .update(project)
    .set({ code: input.code.trim(), name_ur: input.name_ur.trim(), address: input.address?.trim() || null, ...touched() })
    .where(eq(project.id, id));
}

export async function setProjectActive(id: string, active: boolean) {
  await db.update(project).set({ is_active: active, ...touched() }).where(eq(project.id, id));
}

// ─── Workers ─────────────────────────────────────────────────────────────────

export interface WorkerInput {
  name_ur: string;
  father_name: string | null;
  phone: string | null;
  cnic_last4: string | null;
  trade: string | null;
}

function clean(input: WorkerInput) {
  return {
    name_ur: input.name_ur.trim(),
    father_name: input.father_name?.trim() || null,
    phone: input.phone?.replace(/[^\d+]/g, '') || null,
    cnic_last4: input.cnic_last4?.trim() || null,
    trade: input.trade?.trim() || null,
  };
}

export async function createWorker(ctx: WriteContext, input: WorkerInput) {
  const id = randomUUID();
  await db.insert(worker).values({ id, ...clean(input), photo_uri: null, is_active: true, ...meta(ctx) });
  return id;
}

export async function updateWorker(id: string, input: WorkerInput) {
  await db.update(worker).set({ ...clean(input), ...touched() }).where(eq(worker.id, id));
}

// ─── Members ─────────────────────────────────────────────────────────────────

/**
 * A member's name and phone. RLS allows it for the owner on their munshis and for anyone
 * on their own row; only these two columns are writable. Call with values already
 * passed through cleanName / cleanPhone (lib/team.ts), so the upload can't be refused.
 */
export async function updateMemberDetails(id: string, name: string, phone: string | null) {
  await db.update(membership).set({ name, phone }).where(eq(membership.id, id));
}

// ─── Trades ──────────────────────────────────────────────────────────────────

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export async function tradeNameTaken(name: string, exceptId?: string) {
  const rows = await db.select({ id: trade.id, name: trade.name }).from(trade);
  return rows.some((r) => r.id !== exceptId && sameName(r.name, name));
}

/** Owner only (RLS). Returns false if the name is blank or already in the list. */
export async function addTrade(ctx: WriteContext, name: string) {
  if (!name.trim() || (await tradeNameTaken(name))) return false;
  await db.insert(trade).values({
    id: randomUUID(),
    business_id: ctx.businessId,
    name: name.trim(),
    created_by: ctx.userId,
    created_at: new Date().toISOString(),
  });
  return true;
}

/**
 * Renames a trade and moves the workers who have it to the new name, since a worker
 * stores the name. Returns false if the name is blank or already used by another trade.
 */
export async function renameTrade(id: string, name: string) {
  const next = name.trim();
  if (!next || (await tradeNameTaken(next, id))) return false;
  await db.transaction(async (tx) => {
    const [current] = await tx.select().from(trade).where(eq(trade.id, id));
    if (!current || current.name === next) return;
    await tx.update(trade).set({ name: next }).where(eq(trade.id, id));
    await tx.update(worker).set({ trade: next, ...touched() }).where(eq(worker.trade, current.name));
  });
  return true;
}

/** Workers keep the name they already have; this only removes it from the picker. */
export async function removeTrade(id: string) {
  await db.delete(trade).where(eq(trade.id, id));
}

// ─── Assignments ─────────────────────────────────────────────────────────────

export async function activeAssignment(workerId: string, projectId: string) {
  const rows = await db
    .select()
    .from(assignment)
    .where(and(eq(assignment.worker_id, workerId), eq(assignment.project_id, projectId), eq(assignment.is_active, true)));
  return rows[0] ?? null;
}

export type StartDateProblem = 'future' | 'taken' | 'afterAttendance';

/**
 * Why a start date can't be used, or null if it can. A worker may have been on site
 * before they were entered, so any past day is fine — but not one another stint on this
 * project already started on (Postgres has a unique index on it), and not after
 * attendance that is already marked on this assignment.
 */
export async function startDateProblem(
  workerId: string,
  projectId: string,
  day: string,
  assignmentId?: string,
): Promise<StartDateProblem | null> {
  if (day > today()) return 'future';
  const same = await db
    .select({ id: assignment.id })
    .from(assignment)
    .where(and(eq(assignment.worker_id, workerId), eq(assignment.project_id, projectId), eq(assignment.started_on, day)));
  if (same.some((r) => r.id !== assignmentId)) return 'taken';
  if (assignmentId) {
    const marked = await db.select({ date: attendance.date }).from(attendance).where(eq(attendance.assignment_id, assignmentId));
    if (marked.some((r) => r.date < day)) return 'afterAttendance';
  }
  return null;
}

/** Owner only (RLS). Check `startDateProblem` first. */
export async function changeStartDate(assignmentId: string, day: string) {
  await db.update(assignment).set({ started_on: day, ...touched() }).where(eq(assignment.id, assignmentId));
}

export async function assignWorker(
  ctx: WriteContext,
  workerId: string,
  projectId: string,
  dailyRatePaisa: number,
  startedOn: string = today(),
) {
  const id = randomUUID();
  await db.insert(assignment).values({
    id,
    worker_id: workerId,
    project_id: projectId,
    daily_rate_paisa: dailyRatePaisa,
    started_on: startedOn,
    ended_on: null,
    is_active: true,
    ...meta(ctx),
  });
  return id;
}

/** Only affects attendance marked from now on — each attendance row carries its own rate. */
export async function changeRate(assignmentId: string, dailyRatePaisa: number) {
  await db.update(assignment).set({ daily_rate_paisa: dailyRatePaisa, ...touched() }).where(eq(assignment.id, assignmentId));
}

export async function endAssignment(assignmentId: string) {
  await db.update(assignment).set({ is_active: false, ended_on: today(), ...touched() }).where(eq(assignment.id, assignmentId));
}

// ─── Attendance ──────────────────────────────────────────────────────────────

export interface AttendanceMark {
  assignmentId: string;
  status: DayStatus;
}

/** A mark would put a worker on more than one day's work across projects. */
export class AttendanceClashError extends Error {
  constructor(public assignmentId: string) {
    super('worker already marked on another project that day');
  }
}

/**
 * Saves one day's haazri. One row per (assignment, date): an existing row gets its
 * status changed, otherwise a row is created carrying today's daily wage, so a later
 * rate change never recomputes this day. Changing a half day to full keeps the rate
 * it was first marked at. Rows whose status didn't change are not rewritten.
 */
export async function saveAttendance(ctx: WriteContext, date: string, marks: AttendanceMark[]) {
  if (marks.length === 0) return;
  const ids = marks.map((m) => m.assignmentId);
  await db.transaction(async (tx) => {
    // A worker's marks on other projects that day; together they can't pass one day.
    // The server checks again (attendance_one_day_check), for two phones saving offline.
    const workerOf = new Map(
      (await tx.select({ id: assignment.id, worker_id: assignment.worker_id }).from(assignment).where(inArray(assignment.id, ids))).map(
        (a) => [a.id, a.worker_id],
      ),
    );
    const sameDay = await tx
      .select({ assignment_id: attendance.assignment_id, worker_id: assignment.worker_id, status: attendance.status })
      .from(attendance)
      .innerJoin(assignment, eq(assignment.id, attendance.assignment_id))
      .where(and(eq(attendance.date, date), inArray(assignment.worker_id, [...new Set(workerOf.values())])));
    for (const m of marks) {
      const elsewhere = sameDay.filter((r) => r.worker_id === workerOf.get(m.assignmentId) && r.assignment_id !== m.assignmentId);
      if (clashingMarks(m.status, elsewhere).length > 0) throw new AttendanceClashError(m.assignmentId);
    }

    const existing = await tx
      .select()
      .from(attendance)
      .where(and(eq(attendance.date, date), inArray(attendance.assignment_id, ids)));
    const byAssignment = new Map(existing.map((r) => [r.assignment_id, r]));
    const rates = new Map(
      (await tx.select().from(assignment).where(inArray(assignment.id, ids))).map((a) => [a.id, a.daily_rate_paisa]),
    );
    const now = new Date().toISOString();

    for (const m of marks) {
      const row = byAssignment.get(m.assignmentId);
      if (row) {
        if (row.status === m.status) continue;
        await tx
          .update(attendance)
          .set({ status: m.status, overtime_hours: 0, marked_at: now, updated_at: now })
          .where(eq(attendance.id, row.id));
        continue;
      }
      const rate = rates.get(m.assignmentId);
      if (rate == null) continue;
      await tx.insert(attendance).values({
        id: randomUUID(),
        assignment_id: m.assignmentId,
        date,
        status: m.status,
        overtime_hours: 0,
        rate_applied_paisa: rate,
        marked_at: now,
        ...meta(ctx),
      });
    }
  });
}

// ─── Ledger (append-only) ────────────────────────────────────────────────────

export type NewEntryKind = 'advance' | 'payment' | 'deduction' | 'bonus' | 'repayment';

export interface EntryInput {
  assignmentId: string;
  kind: NewEntryKind;
  amountPaisa: number;
  date: string;
  note: string | null;
}

function refCode(date: string) {
  return makeRefCode(Number(date.slice(0, 4)), getRandomBytes(6));
}

export async function addEntry(ctx: WriteContext, input: EntryInput) {
  const id = randomUUID();
  await db.insert(ledgerEntry).values({
    id,
    assignment_id: input.assignmentId,
    date: input.date,
    kind: input.kind,
    amount_paisa: input.amountPaisa,
    note_ur: input.note?.trim() || null,
    ref_code: refCode(input.date),
    reverses_id: null,
    receipt_sent_at: null,
    ...meta(ctx),
  });
  return id;
}

/** A wrong entry is never edited or deleted — it gets a correction that cancels it. Owner only. */
export async function reverseEntry(ctx: WriteContext, original: typeof ledgerEntry.$inferSelect) {
  const existing = await db.select({ id: ledgerEntry.id }).from(ledgerEntry).where(eq(ledgerEntry.reverses_id, original.id));
  if (existing.length > 0) return existing[0].id;

  const id = randomUUID();
  const date = today();
  await db.insert(ledgerEntry).values({
    id,
    assignment_id: original.assignment_id,
    date,
    kind: 'correction',
    amount_paisa: original.amount_paisa,
    note_ur: original.ref_code,
    ref_code: refCode(date),
    reverses_id: original.id,
    receipt_sent_at: null,
    ...meta(ctx),
  });
  return id;
}

export async function stampReceiptSent(entryId: string) {
  // Only receipt_sent_at is sent, so the upload is a column-limited PATCH the ledger's
  // RLS allows. The first send is the one that counts; re-sends don't re-stamp.
  await db
    .update(ledgerEntry)
    .set({ receipt_sent_at: new Date().toISOString() })
    .where(and(eq(ledgerEntry.id, entryId), isNull(ledgerEntry.receipt_sent_at)));
}

// ─── Project expenses (append-only) ──────────────────────────────────────────

export async function expenseCategoryNameTaken(name: string, exceptId?: string) {
  const rows = await db.select({ id: expenseCategory.id, name: expenseCategory.name }).from(expenseCategory);
  return rows.some((r) => r.id !== exceptId && sameName(r.name, name));
}

/**
 * Owner only (RLS). A hidden category with the same name is shown again rather than
 * duplicated. Returns false if the name is blank or already in the list.
 */
export async function addExpenseCategory(ctx: WriteContext, name: string) {
  const next = name.trim();
  if (!next) return false;
  const hidden = (await db.select().from(expenseCategory).where(eq(expenseCategory.is_active, false))).find((r) =>
    sameName(r.name, next),
  );
  if (hidden) {
    await setExpenseCategoryActive(hidden.id, true);
    return true;
  }
  if (await expenseCategoryNameTaken(next)) return false;
  await db.insert(expenseCategory).values({ id: randomUUID(), name: next, is_active: true, ...meta(ctx) });
  return true;
}

/** Past expenses point at the category by id, so they show the new name too. */
export async function renameExpenseCategory(id: string, name: string) {
  const next = name.trim();
  if (!next || (await expenseCategoryNameTaken(next, id))) return false;
  await db.update(expenseCategory).set({ name: next, ...touched() }).where(eq(expenseCategory.id, id));
  return true;
}

/** Categories are hidden, never deleted: past expenses still point at them. */
export async function setExpenseCategoryActive(id: string, active: boolean) {
  await db.update(expenseCategory).set({ is_active: active, ...touched() }).where(eq(expenseCategory.id, id));
}

export interface ExpenseInput {
  projectId: string;
  categoryId: string;
  amountPaisa: number;
  date: string;
  note: string | null;
}

export async function addExpense(ctx: WriteContext, input: ExpenseInput) {
  const id = randomUUID();
  await db.insert(projectExpense).values({
    id,
    project_id: input.projectId,
    category_id: input.categoryId,
    date: input.date,
    kind: 'expense',
    amount_paisa: input.amountPaisa,
    note: input.note?.trim() || null,
    reverses_id: null,
    ...meta(ctx),
  });
  return id;
}

/** A wrong expense is never edited or deleted — it gets a correction that cancels it. Owner only. */
export async function reverseExpense(ctx: WriteContext, original: typeof projectExpense.$inferSelect) {
  const existing = await db
    .select({ id: projectExpense.id })
    .from(projectExpense)
    .where(eq(projectExpense.reverses_id, original.id));
  if (existing.length > 0) return existing[0].id;

  const id = randomUUID();
  await db.insert(projectExpense).values({
    id,
    project_id: original.project_id,
    category_id: original.category_id,
    date: today(),
    kind: 'correction',
    amount_paisa: original.amount_paisa,
    note: null,
    reverses_id: original.id,
    ...meta(ctx),
  });
  return id;
}

export async function dismissRejected(id: string) {
  await db.delete(rejectedWrite).where(eq(rejectedWrite.id, id));
}
