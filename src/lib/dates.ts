// Calendar days are YYYY-MM-DD strings in the phone's local time — never timestamps.

const MONTHS_UR = [
  'جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون',
  'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر',
];
const WEEKDAYS_UR = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];

export type Day = string;

export function toDay(d: Date): Day {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function today(): Day {
  return toDay(new Date());
}

function parse(day: Day): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(day: Day, n: number): Day {
  const d = parse(day);
  d.setDate(d.getDate() + n);
  return toDay(d);
}

/** Whole days from `a` to `b` (positive when b is later). */
export function daysBetween(a: Day, b: Day): number {
  return Math.round((parse(b).getTime() - parse(a).getTime()) / 86_400_000);
}

/** "14 ستمبر 2026" — Latin digits, Urdu month. */
export function formatDayUr(day: Day): string {
  const d = parse(day);
  return `${d.getDate()} ${MONTHS_UR[d.getMonth()]} ${d.getFullYear()}`;
}

export function weekdayUr(day: Day): string {
  return WEEKDAYS_UR[parse(day).getDay()];
}
