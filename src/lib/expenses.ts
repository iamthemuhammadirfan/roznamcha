// Project expense totals are never stored; they are summed from the append-only
// expense rows each time. A cancelled expense and its correction both drop out, so
// totals show what was actually spent, on the day it was spent.

export interface ExpenseLike {
  id: string;
  kind: string;
  amount_paisa: number;
  reverses_id: string | null;
  date: string;
  category_id: string;
}

/** Expenses that still count: not corrections, and not cancelled by one. */
export function liveExpenses<E extends ExpenseLike>(rows: E[]): E[] {
  const cancelled = new Set(rows.filter((r) => r.reverses_id).map((r) => r.reverses_id as string));
  return rows.filter((r) => r.kind === 'expense' && !cancelled.has(r.id));
}

export interface ExpenseSummary {
  total: number;
  today: number;
  month: number;
  byCategory: Map<string, number>;
}

/** `today` is a YYYY-MM-DD day; "month" is that day's calendar month. */
export function summarizeExpenses(rows: ExpenseLike[], today: string): ExpenseSummary {
  const month = today.slice(0, 7);
  const out: ExpenseSummary = { total: 0, today: 0, month: 0, byCategory: new Map() };
  for (const e of liveExpenses(rows)) {
    out.total += e.amount_paisa;
    if (e.date === today) out.today += e.amount_paisa;
    if (e.date.startsWith(month)) out.month += e.amount_paisa;
    out.byCategory.set(e.category_id, (out.byCategory.get(e.category_id) ?? 0) + e.amount_paisa);
  }
  return out;
}

/** Ids of expenses already cancelled, so the UI can strike them and block a second cancel. */
export function cancelledIds(rows: ExpenseLike[]): Set<string> {
  return new Set(rows.filter((r) => r.reverses_id).map((r) => r.reverses_id as string));
}

export interface DayRange {
  from: string;
  to: string;
}

export interface RangeSummary {
  total: number;
  byCategory: Map<string, number>;
}

/** Totals for expenses dated from..to (inclusive). Cancelled expenses don't count. */
export function summarizeRange(rows: ExpenseLike[], range: DayRange): RangeSummary {
  const out: RangeSummary = { total: 0, byCategory: new Map() };
  for (const e of liveExpenses(rows)) {
    if (e.date < range.from || e.date > range.to) continue;
    out.total += e.amount_paisa;
    out.byCategory.set(e.category_id, (out.byCategory.get(e.category_id) ?? 0) + e.amount_paisa);
  }
  return out;
}

export function inRange(day: string, range: DayRange): boolean {
  return day >= range.from && day <= range.to;
}

export interface LedgerLike {
  id: string;
  kind: string;
  amount_paisa: number;
  reverses_id: string | null;
  date: string;
}

/**
 * Cash handed to workers: advances and payments that weren't cancelled. Bonuses and
 * deductions move a balance but no cash, so they aren't spending.
 */
export function labourPayments<E extends LedgerLike>(entries: E[]): E[] {
  const cancelled = new Set(entries.filter((e) => e.reverses_id).map((e) => e.reverses_id as string));
  return entries.filter((e) => (e.kind === 'advance' || e.kind === 'payment') && !cancelled.has(e.id));
}

export interface ProjectSpend {
  labour: number;
  site: number;
  total: number;
  /** Site expenses per category id. */
  byCategory: Map<string, number>;
}

/** Everything spent on a project in a period: cash to workers plus site expenses. */
export function projectSpend(expenses: ExpenseLike[], ledger: LedgerLike[], range: DayRange): ProjectSpend {
  const site = summarizeRange(expenses, range);
  const labour = labourPayments(ledger)
    .filter((e) => inRange(e.date, range))
    .reduce((s, e) => s + e.amount_paisa, 0);
  return { labour, site: site.total, total: labour + site.total, byCategory: site.byCategory };
}
