// Haazri rules that don't touch the database, so they can be unit-tested. What a day
// pays lives in balance.ts (attendanceEarning); this file decides who is expected on a
// day and how the marking screen cycles.
import type { Day } from './dates';

/** What the marking screen offers. Overtime exists in the schema but waits on the spec's open question. */
export type DayStatus = 'full' | 'half' | 'absent';

const CYCLE: DayStatus[] = ['full', 'half', 'absent'];

/** Tap order on the marking screen: full → half → absent → full. */
export function nextStatus(s: string): DayStatus {
  const i = CYCLE.indexOf(s as DayStatus);
  return CYCLE[(i + 1) % CYCLE.length];
}

export interface AssignmentSpan {
  started_on: string;
  ended_on: string | null;
}

/**
 * Whether a worker was on the project that day. Days before he was assigned are never
 * offered — pre-marking him present there would pay him for work he didn't do.
 */
export function activeOn(a: AssignmentSpan, day: Day): boolean {
  return a.started_on <= day && (!a.ended_on || day <= a.ended_on);
}

export type Coverage = 'none' | 'partial' | 'complete' | 'missing';

/**
 * How much of a day's haazri is marked: `none` when nobody was expected, `missing`
 * when nobody was marked, otherwise `partial` or `complete`.
 */
export function coverage(expected: number, marked: number): Coverage {
  if (expected === 0) return 'none';
  if (marked === 0) return 'missing';
  return marked >= expected ? 'complete' : 'partial';
}

export interface DaySummary {
  full: number;
  half: number;
  absent: number;
}

export function summarize(rows: { status: string }[]): DaySummary {
  const s: DaySummary = { full: 0, half: 0, absent: 0 };
  for (const r of rows) {
    // Overtime is a full day plus hours.
    if (r.status === 'full' || r.status === 'overtime') s.full++;
    else if (r.status === 'half') s.half++;
    else if (r.status === 'absent') s.absent++;
  }
  return s;
}

/**
 * The month as calendar weeks starting Monday, padded with nulls. `month` is 1–12.
 * Rows are in reading order; under RTL a flex row lays them out right to left already.
 */
export function monthWeeks(year: number, month: number): (Day | null)[][] {
  const first = new Date(year, month - 1, 1);
  const days = new Date(year, month, 0).getDate();
  const lead = (first.getDay() + 6) % 7; // Monday = 0
  const cells: (Day | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) {
    cells.push(`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  while (cells.length % 7) cells.push(null);
  const weeks: (Day | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** How much of a working day a mark is. Overtime is a full day plus hours. */
export function dayShare(status: string): number {
  return status === 'full' || status === 'overtime' ? 1 : status === 'half' ? 0.5 : 0;
}

/**
 * A worker can't add up to more than one day across projects on the same date: a full
 * day here and anything but absent there is a mistake (half here and half there is
 * fine). Returns the marks elsewhere that rule `status` out, or none if it's allowed.
 */
export function clashingMarks<M extends { status: string }>(status: string, elsewhere: M[]): M[] {
  const taken = elsewhere.reduce((s, m) => s + dayShare(m.status), 0);
  if (dayShare(status) + taken <= 1) return [];
  return elsewhere.filter((m) => dayShare(m.status) > 0);
}
