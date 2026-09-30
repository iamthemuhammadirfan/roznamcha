/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';

import { activeOn, coverage, monthWeeks, nextStatus, summarize } from './attendance';
import { attendanceEarning, computeBalance, reversedIds } from './balance';
import { addDays, daysBetween, formatDay, formatDayUr, weekday } from './dates';
import { formatRupees, parseRupees, toWhatsAppNumber } from './money';
import { makeRefCode } from './ref-code';

describe('money', () => {
  test('formats paisa as rupees with separators', () => {
    expect(formatRupees(500000)).toBe('5,000');
    expect(formatRupees(123456789)).toBe('1,234,567.89');
    expect(formatRupees(-120000)).toBe('1,200');
    expect(formatRupees(0)).toBe('0');
  });

  test('parses typed rupees into integer paisa', () => {
    expect(parseRupees('5000')).toBe(500000);
    expect(parseRupees('5,000')).toBe(500000);
    expect(parseRupees('1200.5')).toBe(120050);
    expect(parseRupees('')).toBeNull();
    expect(parseRupees('-5')).toBeNull();
    expect(parseRupees('12.345')).toBeNull();
  });

  test('normalizes Pakistani mobile numbers for WhatsApp', () => {
    expect(toWhatsAppNumber('0300-1234567')).toBe('923001234567');
    expect(toWhatsAppNumber('+92 300 1234567')).toBe('923001234567');
    expect(toWhatsAppNumber('12345')).toBeNull();
  });
});

describe('dates', () => {
  test('day arithmetic stays on calendar days', () => {
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
    expect(daysBetween('2026-09-14', '2026-09-24')).toBe(10);
  });

  test('formats in Urdu with Latin digits', () => {
    expect(formatDayUr('2026-09-14')).toBe('14 ستمبر 2026');
  });

  test('formats in English when the app is in English', () => {
    expect(formatDay('2026-09-14', 'en')).toBe('14 September 2026');
    expect(formatDay('2026-09-14', 'ur')).toBe('14 ستمبر 2026');
    expect(weekday('2026-09-24', 'en')).toBe('Thursday');
    expect(weekday('2026-09-24', 'ur')).toBe('جمعرات');
  });
});

describe('balance', () => {
  const days = [
    { status: 'full', rate_applied_paisa: 120000, overtime_hours: 0 },
    { status: 'half', rate_applied_paisa: 120000, overtime_hours: 0 },
    { status: 'absent', rate_applied_paisa: 120000, overtime_hours: 0 },
    { status: 'overtime', rate_applied_paisa: 120000, overtime_hours: 2 },
  ];

  test('wages accrue from attendance at the rate applied that day', () => {
    // 1200 + 600 + 0 + (1200 + 2 × 150)
    expect(computeBalance(days, []).earned).toBe(330000);
  });

  test('advances and payments subtract; a bonus adds', () => {
    const entries = [
      { id: 'a', kind: 'advance', amount_paisa: 500000, reverses_id: null },
      { id: 'b', kind: 'payment', amount_paisa: 100000, reverses_id: null },
      { id: 'c', kind: 'bonus', amount_paisa: 20000, reverses_id: null },
    ];
    expect(computeBalance(days, entries).balance).toBe(330000 - 500000 - 100000 + 20000);
  });

  test('a correction cancels exactly the entry it reverses', () => {
    const entries = [
      { id: 'a', kind: 'advance', amount_paisa: 500000, reverses_id: null },
      { id: 'b', kind: 'correction', amount_paisa: 500000, reverses_id: 'a' },
    ];
    expect(computeBalance([], entries).balance).toBe(0);
    expect(reversedIds(entries).has('a')).toBe(true);
  });
});

describe('attendance', () => {
  test('a half day pays half the daily wage and an absent day pays nothing', () => {
    expect(attendanceEarning({ status: 'full', rate_applied_paisa: 150000, overtime_hours: 0 })).toBe(150000);
    expect(attendanceEarning({ status: 'half', rate_applied_paisa: 150000, overtime_hours: 0 })).toBe(75000);
    expect(attendanceEarning({ status: 'absent', rate_applied_paisa: 150000, overtime_hours: 0 })).toBe(0);
  });

  test('tapping cycles full → half → absent → full', () => {
    expect(nextStatus('full')).toBe('half');
    expect(nextStatus('half')).toBe('absent');
    expect(nextStatus('absent')).toBe('full');
  });

  test('a worker is only expected on days he was assigned', () => {
    const a = { started_on: '2026-09-10', ended_on: '2026-09-20' };
    expect(activeOn(a, '2026-09-09')).toBe(false);
    expect(activeOn(a, '2026-09-10')).toBe(true);
    expect(activeOn(a, '2026-09-20')).toBe(true);
    expect(activeOn(a, '2026-09-21')).toBe(false);
    expect(activeOn({ started_on: '2026-09-10', ended_on: null }, '2027-01-01')).toBe(true);
  });

  test('coverage says whether a day is fully marked', () => {
    expect(coverage(0, 0)).toBe('none');
    expect(coverage(5, 0)).toBe('missing');
    expect(coverage(5, 3)).toBe('partial');
    expect(coverage(5, 5)).toBe('complete');
  });

  test('summary counts overtime as a full day', () => {
    expect(summarize([{ status: 'full' }, { status: 'overtime' }, { status: 'half' }, { status: 'absent' }])).toEqual({
      full: 2,
      half: 1,
      absent: 1,
    });
  });

  test('month grid starts on Monday and pads to whole weeks', () => {
    // 1 September 2026 is a Tuesday.
    const weeks = monthWeeks(2026, 9);
    expect(weeks[0]).toEqual([null, '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06']);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().filter(Boolean).length).toBe(30);
  });
});

test('ref codes look like R-YYYY-XXXXXX', () => {
  expect(makeRefCode(2026, new Uint8Array([0, 1, 2, 3, 4, 31]))).toBe('R-2026-23456Z');
  expect(makeRefCode(2026, new Uint8Array(6))).toMatch(/^R-2026-[2-9A-Z]{6}$/);
});
