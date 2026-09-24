-- Fixes from the Supabase security advisor after the initial schema.

-- Pin search_path so a caller can't shadow the tables these functions touch.
alter function public.touch_updated_at() set search_path = public;
alter function public.ledger_guard() set search_path = public;
alter function public.ledger_reversal_check() set search_path = public;

-- The membership checks are only for RLS policies. Signed-out callers never need them;
-- signed-in users do (policies run as the caller), and they only reveal the caller's
-- own membership.
revoke execute on function public.is_member(uuid) from public, anon;
revoke execute on function public.is_owner(uuid) from public, anon;
grant execute on function public.is_member(uuid) to authenticated;
grant execute on function public.is_owner(uuid) to authenticated;

-- Trigger function: fires from the trigger, never needs to be callable over the API.
revoke execute on function public.audit_attendance() from public, anon, authenticated;
