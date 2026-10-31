// Who made an entry and when it reached the server, for the owner's screens.
// Pure helpers only (no React, no database), so they can be unit-tested.
import { daysBetween, toDay } from './dates';

/** A day's entry made more than this many days after the day it's for is "backdated". */
export const BACKDATE_DAYS = 2;
/** Phone time this far after the server's time means the phone's clock is ahead. */
const CLOCK_AHEAD_MS = 10 * 60_000;
/** Reached the server this long after the phone made it: entered offline. */
const LATE_UPLOAD_MS = 6 * 3_600_000;

/**
 * Reads both server timestamps ("2026-10-17 19:07:00+00", as PowerSync sends them) and
 * the phone's ISO strings. Null if it isn't a time at all.
 */
export function parseTimestamp(ts: string | null | undefined): Date | null {
  if (!ts) return null;
  const d = new Date(ts.replace(' ', 'T').replace(/([+-]\d{2})$/, '$1:00'));
  return Number.isNaN(d.getTime()) ? null : d;
}

/** The phone's calendar day of a timestamp; its first ten characters if unreadable. */
export function localDayOf(ts: string): string {
  const d = parseTimestamp(ts);
  return d ? toDay(d) : ts.slice(0, 10);
}

export interface Flags {
  /** Days between the day the entry is for and the day the server got it. */
  backdatedDays: number | null;
  /** Hours between the phone making it and the server getting it. */
  uploadedLateHours: number | null;
  /** The phone's clock was ahead of the server's. */
  clockAhead: boolean;
}

export const NO_FLAGS: Flags = { backdatedDays: null, uploadedLateHours: null, clockAhead: false };

/**
 * What the owner should look twice at, for a newly added row. `day` is the date the
 * entry is for (attendance, money, expense); `phoneAt` is its created_at from the phone;
 * `serverAt` is when the server received it.
 */
export function flagsFor(day: string | null, phoneAt: string | null, serverAt: string): Flags {
  const server = parseTimestamp(serverAt);
  if (!server) return NO_FLAGS;
  const late = day ? daysBetween(day, toDay(server)) : 0;
  const phone = parseTimestamp(phoneAt);
  const drift = phone ? server.getTime() - phone.getTime() : 0;
  return {
    backdatedDays: late > BACKDATE_DAYS ? late : null,
    uploadedLateHours: drift > LATE_UPLOAD_MS ? Math.floor(drift / 3_600_000) : null,
    clockAhead: -drift > CLOCK_AHEAD_MS,
  };
}

export function hasFlags(f: Flags): boolean {
  return f.backdatedDays !== null || f.uploadedLateHours !== null || f.clockAhead;
}
