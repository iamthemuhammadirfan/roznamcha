-- A member's name and phone, so the owner knows a munshi by name rather than email and
-- the munshi sees their own name. Additive: two nullable columns, no backfill; phones on
-- older app versions don't know the columns and ignore them.
--
-- They are edited from the phone (offline, through PowerSync's upload), so membership
-- gets its first update policy — and with it a column grant, because Supabase grants
-- update on every column by default: without the revoke, a munshi could set their own
-- role to owner. Nothing updated membership from the app before this, so the revoke
-- changes no existing flow; the service role (the `team` Edge Function) is unaffected.

alter table membership
  add column name text check (name is null or length(btrim(name)) between 1 and 80),
  add column phone text check (phone is null or length(phone) between 7 and 20);

revoke update on membership from anon, authenticated;
grant update (name, phone) on membership to authenticated;

-- The owner edits their business's munshis; everyone edits their own row.
create policy membership_update on membership for update
  using (user_id = auth.uid() or (role = 'munshi' and private.is_owner(business_id)))
  with check (user_id = auth.uid() or (role = 'munshi' and private.is_owner(business_id)));
