-- Roznamcha initial schema.
-- Every id is a UUID minted on the phone. Money is bigint paisa. Calendar days are `date`.
-- The ledger is append-only: RLS allows insert + select; the only column anyone may
-- update is receipt_sent_at, and only from null.

create extension if not exists pgcrypto;

-- ─── Access control ──────────────────────────────────────────────────────────

create table business (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table membership (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id),
  user_id uuid not null references auth.users(id),
  role text not null check (role in ('owner', 'munshi')),
  created_at timestamptz not null default now(),
  unique (business_id, user_id)
);

create function is_member(bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membership where business_id = bid and user_id = auth.uid());
$$;

create function is_owner(bid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from membership where business_id = bid and user_id = auth.uid() and role = 'owner');
$$;

-- ─── Shared columns ──────────────────────────────────────────────────────────

create function touch_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ─── Domain tables ───────────────────────────────────────────────────────────

create table project (
  id uuid primary key,
  business_id uuid not null references business(id),
  code text not null,
  name_ur text not null,
  address text,
  started_on date,
  is_active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index project_business_idx on project (business_id);

create table worker (
  id uuid primary key,
  business_id uuid not null references business(id),
  name_ur text not null,
  father_name text,
  phone text,
  cnic_last4 text check (cnic_last4 is null or cnic_last4 ~ '^[0-9]{4}$'),
  trade text,
  photo_uri text,
  is_active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index worker_business_idx on worker (business_id);

create table assignment (
  id uuid primary key,
  business_id uuid not null references business(id),
  worker_id uuid not null references worker(id),
  project_id uuid not null references project(id),
  daily_rate_paisa bigint not null check (daily_rate_paisa >= 0),
  started_on date not null,
  ended_on date,
  is_active boolean not null default true,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (worker_id, project_id, started_on)
);
create index assignment_project_idx on assignment (project_id);

create table attendance (
  id uuid primary key,
  business_id uuid not null references business(id),
  assignment_id uuid not null references assignment(id),
  date date not null,
  status text not null check (status in ('full', 'half', 'absent', 'overtime')),
  overtime_hours double precision not null default 0 check (overtime_hours >= 0),
  rate_applied_paisa bigint not null check (rate_applied_paisa >= 0),
  marked_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, date)
);

create table ledger_entry (
  id uuid primary key,
  business_id uuid not null references business(id),
  assignment_id uuid not null references assignment(id),
  date date not null,
  kind text not null check (kind in ('advance', 'payment', 'deduction', 'bonus', 'correction')),
  amount_paisa bigint not null check (amount_paisa > 0),
  note_ur text,
  ref_code text not null,
  reverses_id uuid references ledger_entry(id),
  receipt_sent_at timestamptz,
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((kind = 'correction') = (reverses_id is not null)),
  unique (business_id, ref_code)
);
create index ledger_entry_assignment_idx on ledger_entry (assignment_id);
-- An entry can be reversed at most once.
create unique index ledger_entry_reverses_once on ledger_entry (reverses_id) where reverses_id is not null;

create table settlement (
  id uuid primary key,
  business_id uuid not null references business(id),
  assignment_id uuid not null references assignment(id),
  period_start date not null,
  period_end date not null,
  wages_earned_paisa bigint not null,
  advances_paisa bigint not null,
  paid_paisa bigint not null,
  carried_forward_paisa bigint not null,
  settled_at timestamptz not null default now(),
  created_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assignment_id, period_start)
);

create table audit_log (
  id bigserial primary key,
  business_id uuid not null,
  table_name text not null,
  row_id uuid not null,
  old_row jsonb,
  new_row jsonb,
  changed_by uuid default auth.uid(),
  changed_at timestamptz not null default now()
);

-- One row. The app compares its own version against min_supported_version on launch.
create table app_config (
  id text primary key default 'default' check (id = 'default'),
  min_supported_version text not null default '1.0.0',
  latest_apk_url text
);
insert into app_config (id) values ('default');

-- ─── Triggers ────────────────────────────────────────────────────────────────

create trigger project_touch before update on project for each row execute function touch_updated_at();
create trigger worker_touch before update on worker for each row execute function touch_updated_at();
create trigger assignment_touch before update on assignment for each row execute function touch_updated_at();
create trigger attendance_touch before update on attendance for each row execute function touch_updated_at();
create trigger settlement_touch before update on settlement for each row execute function touch_updated_at();

create function audit_attendance() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into audit_log (business_id, table_name, row_id, old_row, new_row)
  values (old.business_id, 'attendance', old.id, to_jsonb(old), to_jsonb(new));
  return new;
end;
$$;
create trigger attendance_audit after update on attendance for each row execute function audit_attendance();

-- Belt and braces under the RLS: the ledger can only ever gain receipt_sent_at.
create function ledger_guard() returns trigger language plpgsql as $$
begin
  if old.receipt_sent_at is not null
     or (to_jsonb(new) - 'receipt_sent_at' - 'updated_at') <> (to_jsonb(old) - 'receipt_sent_at' - 'updated_at') then
    raise exception 'ledger_entry is append-only' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger ledger_entry_guard before update on ledger_entry for each row execute function ledger_guard();

-- A correction must sit on the same assignment as the entry it reverses.
create function ledger_reversal_check() returns trigger language plpgsql as $$
begin
  if new.reverses_id is not null and not exists (
    select 1 from ledger_entry where id = new.reverses_id and assignment_id = new.assignment_id and kind <> 'correction'
  ) then
    raise exception 'correction must reverse a non-correction entry on the same assignment' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger ledger_entry_reversal before insert on ledger_entry for each row execute function ledger_reversal_check();

-- ─── Row level security ─────────────────────────────────────────────────────

alter table business enable row level security;
alter table membership enable row level security;
alter table project enable row level security;
alter table worker enable row level security;
alter table assignment enable row level security;
alter table attendance enable row level security;
alter table ledger_entry enable row level security;
alter table settlement enable row level security;
alter table audit_log enable row level security;
alter table app_config enable row level security;

create policy business_select on business for select using (is_member(id));
create policy membership_select on membership for select using (is_member(business_id));
create policy app_config_select on app_config for select to authenticated using (true);
create policy audit_log_select on audit_log for select using (is_owner(business_id));

-- project, worker: owner full; munshi insert + select.
create policy project_select on project for select using (is_member(business_id));
create policy project_insert on project for insert with check (is_member(business_id) and created_by = auth.uid());
create policy project_update on project for update using (is_owner(business_id)) with check (is_owner(business_id));
create policy project_delete on project for delete using (is_owner(business_id));

create policy worker_select on worker for select using (is_member(business_id));
create policy worker_insert on worker for insert with check (is_member(business_id) and created_by = auth.uid());
create policy worker_update on worker for update using (is_owner(business_id)) with check (is_owner(business_id));
create policy worker_delete on worker for delete using (is_owner(business_id));

-- assignment (rates): owner full; munshi select only.
create policy assignment_select on assignment for select using (is_member(business_id));
create policy assignment_insert on assignment for insert with check (is_owner(business_id) and created_by = auth.uid());
create policy assignment_update on assignment for update using (is_owner(business_id)) with check (is_owner(business_id));
create policy assignment_delete on assignment for delete using (is_owner(business_id));

-- attendance: owner insert/update; munshi insert, update within 7 days.
create policy attendance_select on attendance for select using (is_member(business_id));
create policy attendance_insert on attendance for insert with check (is_member(business_id) and created_by = auth.uid());
create policy attendance_update on attendance for update
  using (is_owner(business_id) or (is_member(business_id) and date >= current_date - 7))
  with check (is_owner(business_id) or (is_member(business_id) and date >= current_date - 7));

-- ledger_entry: insert + select; reversals by owner only; no delete for anyone.
create policy ledger_select on ledger_entry for select using (is_member(business_id));
create policy ledger_insert on ledger_entry for insert with check (
  is_member(business_id)
  and created_by = auth.uid()
  and (reverses_id is null or is_owner(business_id))
);
create policy ledger_stamp_receipt on ledger_entry for update using (is_member(business_id)) with check (is_member(business_id));
revoke update, delete, truncate on ledger_entry from authenticated, anon;
grant update (receipt_sent_at, updated_at) on ledger_entry to authenticated;

create policy settlement_select on settlement for select using (is_member(business_id));
create policy settlement_insert on settlement for insert with check (is_member(business_id) and created_by = auth.uid());

-- ─── PowerSync replication ───────────────────────────────────────────────────
-- PowerSync reads changes through logical replication of this publication.
create publication powersync for table
  business, membership, project, worker, assignment, attendance, ledger_entry, settlement, app_config;
