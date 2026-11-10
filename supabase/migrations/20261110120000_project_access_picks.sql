-- Which projects a munshi works on, phase 1 of 2: the data only, enforced nowhere yet.
-- The owner picks "All projects" or a list of projects per munshi (Team), and a munshi
-- who creates a project is given it. Phase 2 (project_access_enforce) makes RLS and the
-- sync rules hide every other project from that munshi.
--
-- Additive: a column with a default and a new table. No policy changes, so every phone,
-- old app or new, keeps working exactly as before. Shipping it first lets the owner set
-- each munshi's projects before phase 2 locks them to those projects.

-- Off for every existing munshi: once phase 2 applies, they see nothing until the owner
-- picks. Owners always see everything and ignore this column.
alter table membership add column all_projects boolean not null default false;

-- Supabase grants update on every column by default; 20261017185905 narrowed it to name
-- and phone. Add all_projects, guarded below so only the owner can change it.
grant update (all_projects) on membership to authenticated;

-- membership_update lets every member edit their own row (name, phone). A munshi must
-- not switch on all_projects for themselves, so only the owner of the business may
-- change it. The service role (the `team` Edge Function, migrations) has no auth.uid().
create function private.membership_all_projects_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and not (old.role = 'munshi' and private.is_owner(old.business_id)) then
    raise exception 'only the owner sets a munshi''s projects' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger membership_all_projects_guard before update of all_projects on membership
  for each row when (old.all_projects is distinct from new.all_projects)
  execute function private.membership_all_projects_guard();

-- One row per project picked for a munshi. It is access control, not a record, so the
-- owner removes a pick by deleting its row. user_id and business_id are copies of the
-- membership's, filled in by the trigger below: the sync rules can't join, and RLS
-- checks business_id.
create table membership_project (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references business(id),
  membership_id uuid not null references membership(id) on delete cascade,
  user_id uuid not null references auth.users(id),
  project_id uuid not null references project(id) on delete cascade,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (membership_id, project_id)
);
create index membership_project_user_idx on membership_project (user_id);
create index membership_project_project_idx on membership_project (project_id);

-- Take user_id and business_id from the membership, whatever the phone sent, and refuse
-- a project of another business.
create function private.membership_project_fill() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  m membership%rowtype;
begin
  select * into m from membership where id = new.membership_id;
  if not found then
    raise exception 'membership not found' using errcode = '23503';
  end if;
  if not exists (select 1 from project where id = new.project_id and business_id = m.business_id) then
    raise exception 'project belongs to another business' using errcode = '23514';
  end if;
  new.user_id := m.user_id;
  new.business_id := m.business_id;
  return new;
end;
$$;
create trigger membership_project_fill before insert on membership_project
  for each row execute function private.membership_project_fill();

alter table membership_project enable row level security;
-- Everyone in the business can see the picks (the owner's Team screen, the munshi's own
-- empty state); only the owner picks, and only for a munshi.
create policy membership_project_select on membership_project for select
  using (private.is_member(business_id));
create policy membership_project_insert on membership_project for insert with check (
  private.is_owner(business_id)
  and exists (select 1 from membership m where m.id = membership_id and m.role = 'munshi')
);
create policy membership_project_delete on membership_project for delete
  using (private.is_owner(business_id));
grant select, insert, delete on membership_project to authenticated;
grant select, insert, update, delete on membership_project to service_role;

-- A munshi who creates a project gets it, so it doesn't vanish from his phone once
-- phase 2 hides projects he wasn't given. Not needed with all_projects on.
create function private.project_grant_creator() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into membership_project (business_id, membership_id, user_id, project_id, created_by)
  select m.business_id, m.id, m.user_id, new.id, new.created_by
  from membership m
  where m.business_id = new.business_id
    and m.user_id = new.created_by
    and m.role = 'munshi'
    and not m.all_projects
  on conflict (membership_id, project_id) do nothing;
  return new;
end;
$$;
create trigger project_grant_creator after insert on project
  for each row execute function private.project_grant_creator();

alter publication powersync add table membership_project;
