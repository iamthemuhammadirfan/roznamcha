import { toCompilableQuery } from '@powersync/drizzle-driver';
import { useQuery } from '@powersync/react-native';
import { and, asc, desc, eq, getTableColumns } from 'drizzle-orm';

import { type Balance, computeBalance } from '@/lib/balance';

import { db } from './index';
import { appConfig, assignment, attendance, ledgerEntry, project, rejectedWrite, worker } from './schema';
import type { Attendance, LedgerEntry } from './schema';

type Query = Parameters<typeof toCompilableQuery>[0];

function useLive<T>(query: Query): T[] {
  return useQuery(toCompilableQuery(query)).data as T[];
}

/** Balance per assignment id, derived from attendance and the ledger. */
export function balancesByAssignment(att: Attendance[], entries: LedgerEntry[]): Map<string, Balance> {
  const attBy = groupBy(att, (a) => a.assignment_id);
  const entBy = groupBy(entries, (e) => e.assignment_id);
  const ids = new Set([...attBy.keys(), ...entBy.keys()]);
  const out = new Map<string, Balance>();
  for (const id of ids) out.set(id, computeBalance(attBy.get(id) ?? [], entBy.get(id) ?? []));
  return out;
}

function groupBy<T>(rows: T[], key: (r: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const r of rows) {
    const k = key(r);
    const list = m.get(k);
    if (list) list.push(r);
    else m.set(k, [r]);
  }
  return m;
}

// ─── Projects ────────────────────────────────────────────────────────────────

export function useProjects() {
  return useLive<typeof project.$inferSelect>(db.select().from(project).orderBy(asc(project.code)));
}

/** Projects plus whether the first read has finished, so "no projects" never flashes on launch. */
export function useProjectsLoaded() {
  const { data, isLoading } = useQuery(toCompilableQuery(db.select().from(project).orderBy(asc(project.code))));
  return { projects: data as (typeof project.$inferSelect)[], loading: isLoading };
}

export function useProject(id: string | null) {
  const rows = useLive<typeof project.$inferSelect>(db.select().from(project).where(eq(project.id, id ?? '')));
  return rows[0] ?? null;
}

export function useAllAssignments() {
  return useLive<typeof assignment.$inferSelect>(db.select().from(assignment));
}

export function useAllEntries() {
  return useLive<LedgerEntry>(db.select().from(ledgerEntry));
}

export function useAllAttendance() {
  return useLive<Attendance>(db.select().from(attendance));
}

// ─── Project scope ───────────────────────────────────────────────────────────

const assignmentWithWorker = {
  ...getTableColumns(assignment),
  worker_name: worker.name_ur,
  worker_father_name: worker.father_name,
  worker_phone: worker.phone,
  worker_trade: worker.trade,
};

export type AssignmentWithWorker = typeof assignment.$inferSelect & {
  worker_name: string;
  worker_father_name: string | null;
  worker_phone: string | null;
  worker_trade: string | null;
};

export function useProjectAssignments(projectId: string) {
  return useLive<AssignmentWithWorker>(
    db
      .select(assignmentWithWorker)
      .from(assignment)
      .innerJoin(worker, eq(worker.id, assignment.worker_id))
      .where(eq(assignment.project_id, projectId))
      .orderBy(asc(worker.name_ur)),
  );
}

export function useProjectEntries(projectId: string) {
  return useLive<LedgerEntry>(
    db
      .select(getTableColumns(ledgerEntry))
      .from(ledgerEntry)
      .innerJoin(assignment, eq(assignment.id, ledgerEntry.assignment_id))
      .where(eq(assignment.project_id, projectId)),
  );
}

export function useProjectAttendance(projectId: string) {
  return useLive<Attendance>(
    db
      .select(getTableColumns(attendance))
      .from(attendance)
      .innerJoin(assignment, eq(assignment.id, attendance.assignment_id))
      .where(eq(assignment.project_id, projectId)),
  );
}

// ─── Worker scope ────────────────────────────────────────────────────────────

export function useWorkers() {
  return useLive<typeof worker.$inferSelect>(db.select().from(worker).orderBy(asc(worker.name_ur)));
}

export function useWorker(id: string) {
  const rows = useLive<typeof worker.$inferSelect>(db.select().from(worker).where(eq(worker.id, id)));
  return rows[0] ?? null;
}

export type AssignmentWithProject = typeof assignment.$inferSelect & {
  project_code: string;
  project_name: string;
};

export function useWorkerAssignments(workerId: string) {
  return useLive<AssignmentWithProject>(
    db
      .select({ ...getTableColumns(assignment), project_code: project.code, project_name: project.name_ur })
      .from(assignment)
      .innerJoin(project, eq(project.id, assignment.project_id))
      .where(eq(assignment.worker_id, workerId))
      .orderBy(asc(project.code)),
  );
}

export function useWorkerEntries(workerId: string) {
  return useLive<LedgerEntry>(
    db
      .select(getTableColumns(ledgerEntry))
      .from(ledgerEntry)
      .innerJoin(assignment, eq(assignment.id, ledgerEntry.assignment_id))
      .where(eq(assignment.worker_id, workerId))
      .orderBy(desc(ledgerEntry.date), desc(ledgerEntry.created_at)),
  );
}

export function useWorkerAttendance(workerId: string) {
  return useLive<Attendance>(
    db
      .select(getTableColumns(attendance))
      .from(attendance)
      .innerJoin(assignment, eq(assignment.id, attendance.assignment_id))
      .where(eq(assignment.worker_id, workerId)),
  );
}

// ─── Receipt ─────────────────────────────────────────────────────────────────

export function useReceiptData(entryId: string) {
  const rows = useLive<
    LedgerEntry & {
      worker_id: string;
      worker_name: string;
      worker_father_name: string | null;
      worker_phone: string | null;
      project_code: string;
      project_name: string;
    }
  >(
    db
      .select({
        ...getTableColumns(ledgerEntry),
        worker_id: worker.id,
        worker_name: worker.name_ur,
        worker_father_name: worker.father_name,
        worker_phone: worker.phone,
        project_code: project.code,
        project_name: project.name_ur,
      })
      .from(ledgerEntry)
      .innerJoin(assignment, eq(assignment.id, ledgerEntry.assignment_id))
      .innerJoin(worker, eq(worker.id, assignment.worker_id))
      .innerJoin(project, eq(project.id, assignment.project_id))
      .where(eq(ledgerEntry.id, entryId)),
  );
  const entry = rows[0] ?? null;

  const assignmentEntries = useLive<LedgerEntry>(
    db.select().from(ledgerEntry).where(eq(ledgerEntry.assignment_id, entry?.assignment_id ?? '')),
  );
  const assignmentAttendance = useLive<Attendance>(
    db.select().from(attendance).where(eq(attendance.assignment_id, entry?.assignment_id ?? '')),
  );

  // Running balance as of this entry: everything dated before it, plus same-day
  // entries created no later than it. A parchi re-sent next week still shows the
  // balance the worker agreed to on the day.
  const upTo = assignmentEntries.filter(
    (e) =>
      entry &&
      (e.date < entry.date || (e.date === entry.date && (e.created_at ?? '') <= (entry.created_at ?? ''))),
  );
  const att = assignmentAttendance.filter((a) => entry && a.date <= entry.date);
  const balance = entry ? computeBalance(att, upTo).balance : 0;

  return { entry, balance };
}

// ─── Sync ────────────────────────────────────────────────────────────────────

export function usePendingUploadCount(): number {
  const rows = useQuery<{ n: number }>('SELECT count(*) AS n FROM ps_crud').data;
  return rows[0]?.n ?? 0;
}

export function useRejectedWrites() {
  return useLive<typeof rejectedWrite.$inferSelect>(
    db.select().from(rejectedWrite).orderBy(desc(rejectedWrite.rejected_at)),
  );
}

export function useAssignmentFor(workerId: string, projectId: string) {
  const rows = useLive<typeof assignment.$inferSelect>(
    db
      .select()
      .from(assignment)
      .where(and(eq(assignment.worker_id, workerId), eq(assignment.project_id, projectId), eq(assignment.is_active, true))),
  );
  return rows[0] ?? null;
}

export function useAppConfig() {
  const rows = useLive<typeof appConfig.$inferSelect>(db.select().from(appConfig));
  return rows[0] ?? null;
}
