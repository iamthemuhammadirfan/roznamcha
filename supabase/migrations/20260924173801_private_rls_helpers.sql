-- Keep the RLS helpers out of the API-exposed public schema, so nobody can call them
-- over /rest/v1/rpc. Policies reference functions by OID, so they keep working.
create schema if not exists private;
grant usage on schema private to authenticated;
alter function public.is_member(uuid) set schema private;
alter function public.is_owner(uuid) set schema private;
alter function public.audit_attendance() set schema private;
