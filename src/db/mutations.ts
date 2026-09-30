// Every write goes to local SQLite first; PowerSync uploads it when there is signal.
// PowerSync does not enforce unique indexes locally, so the checks Postgres would do
// on upload are repeated here so the munshi sees them immediately.
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { getRandomBytes, randomUUID } from 'expo-crypto';

import type { DayStatus } from '@/lib/attendance';
import { today } from '@/lib/dates';
import { makeRefCode } from '@/lib/ref-code';

import { db } from './index';
import { assignment, attendance, ledgerEntry, project, rejectedWrite, worker } from './schema';

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

// ─── Assignments ─────────────────────────────────────────────────────────────

export async function activeAssignment(workerId: string, projectId: string) {
  const rows = await db
    .select()
    .from(assignment)
    .where(and(eq(assignment.worker_id, workerId), eq(assignment.project_id, projectId), eq(assignment.is_active, true)));
  return rows[0] ?? null;
}

export async function assignWorker(ctx: WriteContext, workerId: string, projectId: string, dailyRatePaisa: number) {
  const id = randomUUID();
  await db.insert(assignment).values({
    id,
    worker_id: workerId,
    project_id: projectId,
    daily_rate_paisa: dailyRatePaisa,
    started_on: today(),
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

export type NewEntryKind = 'advance' | 'payment' | 'deduction' | 'bonus';

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

export async function dismissRejected(id: string) {
  await db.delete(rejectedWrite).where(eq(rejectedWrite.id, id));
}
