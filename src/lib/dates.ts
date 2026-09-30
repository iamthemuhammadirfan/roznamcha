// Calendar days are YYYY-MM-DD strings in the phone's local time — never timestamps.

const MONTHS_UR = [
  'جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون',
  'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر',
];
const WEEKDAYS_UR = ['اتوار', 'پیر', 'منگل', 'بدھ', 'جمعرات', 'جمعہ', 'ہفتہ'];
const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const WEEKDAYS_EN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

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

/** "14 September 2026" / "14 ستمبر 2026" — Latin digits either way. */
export function formatDay(day: Day, lang: 'ur' | 'en'): string {
  if (lang === 'ur') return formatDayUr(day);
  const d = parse(day);
  return `${d.getDate()} ${MONTHS_EN[d.getMonth()]} ${d.getFullYear()}`;
}

export function weekday(day: Day, lang: 'ur' | 'en'): string {
  return lang === 'ur' ? weekdayUr(day) : WEEKDAYS_EN[parse(day).getDay()];
}

/** "ستمبر 2026" / "September 2026". `month` is 1–12. */
export function formatMonth(year: number, month: number, lang: 'ur' | 'en'): string {
  return `${(lang === 'ur' ? MONTHS_UR : MONTHS_EN)[month - 1]} ${year}`;
}

/** Column headers for a Monday-first week. */
export function weekdaysShort(lang: 'ur' | 'en'): string[] {
  const names = lang === 'ur' ? WEEKDAYS_UR : WEEKDAYS_EN.map((d) => d.slice(0, 3));
  return [...names.slice(1), names[0]];
}
