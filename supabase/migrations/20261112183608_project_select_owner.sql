-- Fix: the owner couldn't create a project after project_access_enforce.
--
-- The app uploads a new project with INSERT … ON CONFLICT (id), and Postgres checks
-- project_select against the new row. private.can_access_project(id) looks the project
-- up by id, and the row isn't there yet, so every new project was refused (42501). The
-- owner sees every project of his business anyway: check that first, without the lookup.
drop policy project_select on project;
create policy project_select on project for select
  using (private.is_member(business_id) and (private.is_owner(business_id) or private.can_access_project(id)));
