-- A worker can't add up to more than one day's work across projects on the same date:
-- full here and anything but absent on another project is a mistake; half and half is
-- fine. The phone checks first (saveAttendance); this catches two phones that marked
-- the same worker on different projects while offline. The second upload is rejected
-- and shows as "not saved" on that phone.
--
-- Additive: a trigger on new and changed marks only. Marks already saved are left as
-- they are, and a change that doesn't add to the day (e.g. full → half) is always
-- allowed, so an existing double mark can still be fixed.

-- How much of a working day a mark is (lib/attendance.ts dayShare). Overtime is a full
-- day plus hours.
create function private.day_share(status text) returns numeric
language sql immutable set search_path = public as $$
  select case when status in ('full', 'overtime') then 1 when status = 'half' then 0.5 else 0 end::numeric;
$$;
revoke execute on function private.day_share(text) from public, anon, authenticated;

create function private.attendance_one_day_check() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  worker uuid;
  taken numeric;
begin
  -- Absent, or a change that adds nothing to the day (full to half), is always fine.
  if private.day_share(new.status) = 0
     or (tg_op = 'UPDATE' and private.day_share(new.status) <= private.day_share(old.status)
         and new.date = old.date and new.assignment_id = old.assignment_id) then
    return new;
  end if;

  select a.worker_id into worker from assignment a where a.id = new.assignment_id;
  -- One check at a time per worker, so two uploads at once can't both pass.
  perform pg_advisory_xact_lock(hashtext('attendance_one_day:' || worker::text));

  select coalesce(sum(private.day_share(at.status)), 0) into taken
    from attendance at
    join assignment a on a.id = at.assignment_id
   where a.worker_id = worker and at.date = new.date and at.assignment_id <> new.assignment_id;

  if private.day_share(new.status) + taken > 1 then
    raise exception 'worker already marked on another project that day' using errcode = '23514';
  end if;
  return new;
end;
$$;
revoke execute on function private.attendance_one_day_check() from public, anon, authenticated;

create trigger attendance_one_day before insert or update of status, date, assignment_id on attendance
  for each row execute function private.attendance_one_day_check();
