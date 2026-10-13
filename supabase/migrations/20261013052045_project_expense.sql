-- Project expenses: money spent on a site that isn't any worker's wage (diesel, chai,
-- material, transport...). Like the wage ledger they are append-only — a mistake is
-- cancelled with a correction, never edited or deleted — and they never touch a
-- worker's balance.

-- ─── Categories (owner-managed) ─────────────────────────────────────────────
-- Expenses point at a category by id, so a category is hidden rather than deleted,
-- and renaming one relabels its past expenses.

create table expense_category (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id),
  name text not null check (length(btrim(name)) > 0),
  is_active boolean not null default true,
  -- Null for the defaults seeded below; they were not typed by anyone.
  created_by uuid default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index expense_category_business_name_idx on expense_category (business_id, lower(name));
create trigger expense_category_touch before update on expense_category
  for each row execute function touch_updated_at();

alter table expense_category enable row level security;
create policy expense_category_select on expense_category for select using (private.is_member(business_id));
create policy expense_category_insert on expense_category for insert
  with check (private.is_owner(business_id) and created_by = auth.uid());
create policy expense_category_update on expense_category for update
  using (private.is_owner(business_id)) with check (private.is_owner(business_id));

-- ─── Expenses (append-only) ─────────────────────────────────────────────────

create table project_expense (
  id uuid primary key,
  business_id uuid not null references business(id),
  project_id uuid not null references project(id),
  category_id uuid not null references expense_category(id),
  date date not null,
  kind text not null check (kind in ('expense', 'correction')),
  amount_paisa bigint not null check (amount_paisa > 0),
  note text,
  reverses_id uuid references project_expense(id),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'correction') = (reverses_id is not null))
);
create index project_expense_project_idx on project_expense (project_id);
-- An expense can be cancelled at most once.
create unique index project_expense_reverses_once on project_expense (reverses_id) where reverses_id is not null;

alter table project_expense enable row level security;
-- Owner and munshi record expenses; only the owner cancels one. No update or delete.
create policy project_expense_select on project_expense for select using (private.is_member(business_id));
create policy project_expense_insert on project_expense for insert with check (
  private.is_member(business_id)
  and created_by = auth.uid()
  and (reverses_id is null or private.is_owner(business_id))
  and exists (select 1 from project p where p.id = project_id and p.business_id = project_expense.business_id)
  and exists (select 1 from expense_category c where c.id = category_id and c.business_id = project_expense.business_id)
);
revoke update, delete, truncate on project_expense from authenticated, anon;

-- A correction must cancel a non-correction expense on the same project, for the same amount.
create function private.project_expense_reversal_check() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.reverses_id is not null and not exists (
    select 1 from project_expense
    where id = new.reverses_id and project_id = new.project_id and kind = 'expense' and amount_paisa = new.amount_paisa
  ) then
    raise exception 'correction must cancel an expense on the same project' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger project_expense_reversal before insert on project_expense
  for each row execute function private.project_expense_reversal_check();

-- ─── Default categories ─────────────────────────────────────────────────────
-- The Urdu words match `expenseCategory` in src/strings.ur.ts, which is how the app
-- shows an English label for them.

create function private.seed_default_expense_categories(bid uuid) returns void
language sql security definer set search_path = public as $$
  insert into expense_category (business_id, name, created_by)
  select bid, n, null
  from unnest(array['ڈیزل / تیل', 'چائے / مٹھائی', 'سامان', 'کرایہ / ٹرانسپورٹ', 'متفرق']) as n
  on conflict do nothing;
$$;

create function private.business_seed_expense_categories() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform private.seed_default_expense_categories(new.id);
  return new;
end;
$$;
create trigger business_seed_expense_categories after insert on business
  for each row execute function private.business_seed_expense_categories();

-- Only triggers call these; never callable over the API.
revoke execute on function private.project_expense_reversal_check() from public, anon, authenticated;
revoke execute on function private.seed_default_expense_categories(uuid) from public, anon, authenticated;
revoke execute on function private.business_seed_expense_categories() from public, anon, authenticated;

select private.seed_default_expense_categories(id) from business;

alter publication powersync add table expense_category, project_expense;
