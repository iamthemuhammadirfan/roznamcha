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
  | 'exists'
  | 'failed';

/** Supabase's default minimum; the function enforces the same. */
export const MIN_PASSWORD = 6;

const KNOWN: TeamError[] = ['unauthorized', 'not_owner', 'not_munshi', 'invalid_email', 'weak_password', 'exists'];

async function call(body: Record<string, string>): Promise<TeamError | null> {
  if (!supabase) return 'offline';
  const { error } = await supabase.functions.invoke('team', { body });
  if (!error) return null;
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

export function createMunshi(businessId: string, email: string, password: string) {
  return call({ action: 'create', businessId, email: email.trim(), password });
}

export function resetMunshiPassword(businessId: string, userId: string, password: string) {
  return call({ action: 'reset', businessId, userId, password });
}
