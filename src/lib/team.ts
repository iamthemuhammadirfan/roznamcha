// Owner-only account management, through the `team` Edge Function (it holds the
// service-role key, which never ships in the app). Online only: these change accounts,
// not ledger rows, so there is nothing to queue offline.
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js';

import { supabase } from './supabase';

/** Mirrors the function's codes, plus `offline` when the request never got there. */
export type TeamError =
  | 'offline'
  | 'unauthorized'
  | 'not_owner'
  | 'not_munshi'
  | 'invalid_email'
  | 'weak_password'
  | 'invalid_name'
  | 'invalid_phone'
  | 'exists'
  | 'failed';

/** Supabase's default minimum; the function enforces the same. */
export const MIN_PASSWORD = 6;

const KNOWN: TeamError[] = [
  'unauthorized',
  'not_owner',
  'not_munshi',
  'invalid_email',
  'weak_password',
  'invalid_name',
  'invalid_phone',
  'exists',
];

/** A member's name: trimmed, 1–80 characters (membership's check constraint), or null. */
export function cleanName(name: string) {
  const n = name.trim();
  return n.length >= 1 && n.length <= 80 ? n : null;
}

/**
 * A member's phone: digits and "+" only, 7–20 long (the check constraint). Empty is
 * fine (null); anything else invalid is `false`.
 */
export function cleanPhone(phone: string): string | null | false {
  const p = phone.replace(/[^\d+]/g, '');
  if (!p) return null;
  return p.length >= 7 && p.length <= 20 ? p : false;
}

async function call(body: Record<string, string>): Promise<{ error: TeamError | null; restored?: boolean }> {
  if (!supabase) return { error: 'offline' };
  const { data, error } = await supabase.functions.invoke<{ restored?: boolean }>('team', { body });
  if (!error) return { error: null, restored: Boolean(data?.restored) };
  return { error: await toTeamError(error) };
}

async function toTeamError(error: unknown): Promise<TeamError> {
  if (error instanceof FunctionsFetchError) return 'offline';
  if (error instanceof FunctionsHttpError) {
    const code = await error.context
      .json()
      .then((b: { error?: string }) => b.error)
      .catch(() => undefined);
    return KNOWN.includes(code as TeamError) ? (code as TeamError) : 'failed';
  }
  return 'failed';
}

/** `restored` when the email was a removed munshi, now back with this password. */
export function createMunshi(businessId: string, name: string, phone: string, email: string, password: string) {
  return call({ action: 'create', businessId, name: name.trim(), phone, email: email.trim(), password });
}

export async function resetMunshiPassword(businessId: string, userId: string, password: string) {
  return (await call({ action: 'reset', businessId, userId, password })).error;
}

/** Removes their access to this business; everything they entered stays. */
export async function revokeMunshi(businessId: string, userId: string) {
  return (await call({ action: 'revoke', businessId, userId })).error;
}
