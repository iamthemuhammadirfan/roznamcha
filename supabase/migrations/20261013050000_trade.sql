-- Worker trades (mason, labourer, ...) become a per-business list the owner manages in
-- Settings, instead of a list baked into the app. worker.trade stays a plain text
-- column holding the trade's name, so removing a trade never changes existing workers.

create table trade (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id),
  name text not null check (length(btrim(name)) > 0),
  -- Null for the defaults seeded below; they were not typed by anyone.
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create unique index trade_business_name_idx on trade (business_id, lower(name));

alter table trade enable row level security;

-- Everyone in the business can read the list (the munshi picks from it); only the owner
-- changes it.
create policy trade_select on trade for select using (private.is_member(business_id));
create policy trade_insert on trade for insert
  with check (private.is_owner(business_id) and created_by = auth.uid());
create policy trade_update on trade for update
  using (private.is_owner(business_id)) with check (private.is_owner(business_id));
create policy trade_delete on trade for delete using (private.is_owner(business_id));

-- The Urdu words match `trade` in src/strings.ur.ts, which is how the app shows an
-- English label for them.
create function private.seed_default_trades(bid uuid) returns void
language sql security definer set search_path = public as $$
  insert into trade (business_id, name, created_by)
  select bid, n, null
  from unnest(array['مستری', 'مزدور', 'بڑھئی', 'سریا والا', 'الیکٹریشن', 'پلمبر', 'رنگ ساز']) as n
  on conflict do nothing;
$$;

create function private.business_seed_trades() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform private.seed_default_trades(new.id);
  return new;
end;
$$;
create trigger business_seed_trades after insert on business
  for each row execute function private.business_seed_trades();

-- Only the trigger calls these; never callable over the API.
revoke execute on function private.seed_default_trades(uuid) from public, anon, authenticated;
revoke execute on function private.business_seed_trades() from public, anon, authenticated;

-- Existing businesses get the same list they had hardcoded before.
select private.seed_default_trades(id) from business;

alter publication powersync add table trade;
