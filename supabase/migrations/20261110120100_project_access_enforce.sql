-- Which projects a munshi works on, phase 2 of 2: enforce it. A munshi reads and writes
-- only the projects he has access to: all of them with membership.all_projects on,
-- otherwise the ones in membership_project. Owners keep everything. Shared lists
-- (workers, trades, expense types) stay visible to the whole business.
--
-- Apply this together with the matching sync config (powersync/sync-config.yaml), after
-- the owner has picked each munshi's projects: a munshi with none picked sees no project
-- from then on, and anything he saves on a hidden project is refused ("not saved").
--
-- Every policy below keeps its old condition and adds the project check. Attendance,
-- ledger entries and settlements carry assignment_id, not project_id, so they go
-- through the assignment.

create function private.can_access_project(pid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from project p
    join membership m on m.business_id = p.business_id and m.user_id = auth.uid()
    where p.id = pid
      and (
        m.role = 'owner'
        or m.all_projects
        or exists (select 1 from membership_project mp where mp.membership_id = m.id and mp.project_id = pid)
      )
  );
$$;

create function private.can_access_assignment(aid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select private.can_access_project((select project_id from assignment where id = aid));
$$;

-- project: owner full (unchanged); a munshi sees his projects and may still create one
-- (project_grant_creator gives it to him).
drop policy project_select on project;
create policy project_select on project for select
  using (private.is_member(business_id) and private.can_access_project(id));

drop policy assignment_select on assignment;
create policy assignment_select on assignment for select
  using (private.is_member(business_id) and private.can_access_project(project_id));

drop policy attendance_select on attendance;
drop policy attendance_insert on attendance;
drop policy attendance_update on attendance;
create policy attendance_select on attendance for select
  using (private.is_member(business_id) and private.can_access_assignment(assignment_id));
create policy attendance_insert on attendance for insert with check (
  private.is_member(business_id) and created_by = auth.uid() and private.can_access_assignment(assignment_id)
);
create policy attendance_update on attendance for update
  using (
    private.can_access_assignment(assignment_id)
    and (private.is_owner(business_id) or (private.is_member(business_id) and date >= current_date - 7))
  )
  with check (
    private.can_access_assignment(assignment_id)
    and (private.is_owner(business_id) or (private.is_member(business_id) and date >= current_date - 7))
  );

drop policy ledger_select on ledger_entry;
drop policy ledger_insert on ledger_entry;
drop policy ledger_stamp_receipt on ledger_entry;
create policy ledger_select on ledger_entry for select
  using (private.is_member(business_id) and private.can_access_assignment(assignment_id));
create policy ledger_insert on ledger_entry for insert with check (
  private.is_member(business_id)
  and created_by = auth.uid()
  and (reverses_id is null or private.is_owner(business_id))
  and private.can_access_assignment(assignment_id)
);
create policy ledger_stamp_receipt on ledger_entry for update
  using (private.is_member(business_id) and private.can_access_assignment(assignment_id))
  with check (private.is_member(business_id) and private.can_access_assignment(assignment_id));

drop policy settlement_select on settlement;
drop policy settlement_insert on settlement;
create policy settlement_select on settlement for select
  using (private.is_member(business_id) and private.can_access_assignment(assignment_id));
create policy settlement_insert on settlement for insert with check (
  private.is_member(business_id) and created_by = auth.uid() and private.can_access_assignment(assignment_id)
);

drop policy project_expense_select on project_expense;
drop policy project_expense_insert on project_expense;
create policy project_expense_select on project_expense for select
  using (private.is_member(business_id) and private.can_access_project(project_id));
create policy project_expense_insert on project_expense for insert with check (
  private.is_member(business_id)
  and created_by = auth.uid()
  and (reverses_id is null or private.is_owner(business_id))
  and private.can_access_project(project_id)
  and exists (select 1 from project p where p.id = project_id and p.business_id = project_expense.business_id)
  and exists (select 1 from expense_category c where c.id = category_id and c.business_id = project_expense.business_id)
);
