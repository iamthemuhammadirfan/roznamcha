// The balance is never stored. It is recomputed from attendance and the append-only
// ledger every time it is shown. Positive = the business owes the worker.

export type AttendanceStatus = 'full' | 'half' | 'absent' | 'overtime';
export type EntryKind = 'advance' | 'payment' | 'deduction' | 'bonus' | 'correction';

export interface AttendanceLike {
  status: AttendanceStatus | string;
  rate_applied_paisa: number;
  overtime_hours: number | null;
}

export interface EntryLike {
  id: string;
  kind: EntryKind | string;
  amount_paisa: number;
  reverses_id: string | null;
}

// Open question in the spec: how overtime is priced. Until he answers, an hour is
// the daily rate ÷ 8.
export const HOURS_PER_DAY = 8;

const DAY_FACTOR: Record<AttendanceStatus, number> = { full: 1, half: 0.5, absent: 0, overtime: 1 };

export function attendanceEarning(a: AttendanceLike): number {
  const factor = DAY_FACTOR[a.status as AttendanceStatus] ?? 0;
  const base = a.rate_applied_paisa * factor;
  const overtime = (a.overtime_hours ?? 0) * (a.rate_applied_paisa / HOURS_PER_DAY);
  return Math.round(base + overtime);
}

/** Effect on the balance of an entry that is not a correction. */
function directEffect(kind: string, amount: number): number {
  switch (kind) {
    case 'bonus':
      return amount;
    case 'advance':
    case 'payment':
    case 'deduction':
      return -amount;
    default:
      return 0;
  }
}

/**
 * Signed effect of each entry, keyed by id. A correction exactly cancels the entry it
 * reverses, whatever that entry's kind was.
 */
export function entryEffects(entries: EntryLike[]): Map<string, number> {
  const byId = new Map(entries.map((e) => [e.id, e]));
  const effects = new Map<string, number>();
  for (const e of entries) {
    if (e.kind === 'correction') {
      const original = e.reverses_id ? byId.get(e.reverses_id) : undefined;
      effects.set(e.id, original ? -directEffect(original.kind, original.amount_paisa) : 0);
    } else {
      effects.set(e.id, directEffect(e.kind, e.amount_paisa));
    }
  }
  return effects;
}

export interface Balance {
  earned: number;
  ledger: number;
  balance: number;
}

export function computeBalance(attendance: AttendanceLike[], entries: EntryLike[]): Balance {
  const earned = attendance.reduce((sum, a) => sum + attendanceEarning(a), 0);
  let ledger = 0;
  for (const v of entryEffects(entries).values()) ledger += v;
  return { earned, ledger, balance: earned + ledger };
}

/** Ids of entries that have already been reversed, so the UI can mark them and block a second reversal. */
export function reversedIds(entries: EntryLike[]): Set<string> {
  return new Set(entries.filter((e) => e.reverses_id).map((e) => e.reverses_id as string));
}
