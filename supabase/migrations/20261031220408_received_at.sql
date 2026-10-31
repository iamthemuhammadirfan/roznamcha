-- When an entry really reached the server, so the owner can trust "who entered it, when".
--
-- Who made an entry is already on the row: created_by, which RLS forces to be the
-- signed-in user. When is only the phone's created_at, which is as right as the phone's
-- clock — wrong, or set back on purpose. received_at is stamped by the server on insert
-- and nobody can change it afterwards; the owner's screens show it beside the entry and
-- flag entries made days after their date or uploaded long after they were made.
--
-- Additive: one nullable column on four tables and a trigger; no existing row changes.
-- Entries made before this migration have no received_at (the app falls back to the
-- phone's time and says so). Older app versions don't know the column and ignore it.

alter table project_expense add column received_at timestamptz;
alter table ledger_entry add column received_at timestamptz;
alter table attendance add column received_at timestamptz;
alter table settlement add column received_at timestamptz;

-- Whatever the phone sends is ignored: now() on insert, the old value on update.
create function private.stamp_received_at() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    new.received_at := now();
  else
    new.received_at := old.received_at;
  end if;
  return new;
end;
$$;
revoke execute on function private.stamp_received_at() from public, anon, authenticated;

create trigger project_expense_received before insert or update on project_expense
  for each row execute function private.stamp_received_at();
create trigger ledger_entry_received before insert or update on ledger_entry
  for each row execute function private.stamp_received_at();
create trigger attendance_received before insert or update on attendance
  for each row execute function private.stamp_received_at();
create trigger settlement_received before insert or update on settlement
  for each row execute function private.stamp_received_at();
