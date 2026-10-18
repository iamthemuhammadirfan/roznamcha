-- Table access for the API roles, stated explicitly.
--
-- The live project was created when Supabase still granted every privilege on new tables
-- to anon/authenticated/service_role by default, and the migrations only ever took
-- privileges away. Newer Supabase versions grant nothing by default, so a database built
-- from these migrations alone (the local playground, scripts/local-db.sh) could neither
-- read nor write. These grants reproduce exactly what the live project has: there, every
-- statement below is a no-op.
--
-- Row-level security still decides which rows anyone sees or changes. Deliberately not
-- granted here, because earlier migrations removed them: update/delete on the append-only
-- ledger_entry and project_expense (corrections are new rows), and update on membership
-- except name and phone (20261017185905; ledger_entry keeps its receipt_sent_at column
-- grant from init).

grant select, insert, update, delete
  on app_config, assignment, attendance, audit_log, business, expense_category, project, settlement, trade, worker
  to anon, authenticated, service_role;

grant select, insert on ledger_entry, project_expense to anon, authenticated;
grant select, insert, delete on membership to anon, authenticated;

grant select, insert, update, delete on ledger_entry, project_expense, membership to service_role;
