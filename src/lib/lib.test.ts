/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';

import { computeBalance, reversedIds } from './balance';
import { addDays, daysBetween, formatDayUr } from './dates';
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

test('ref codes look like R-YYYY-XXXXXX', () => {
  expect(makeRefCode(2026, new Uint8Array([0, 1, 2, 3, 4, 31]))).toBe('R-2026-23456Z');
  expect(makeRefCode(2026, new Uint8Array(6))).toMatch(/^R-2026-[2-9A-Z]{6}$/);
});
