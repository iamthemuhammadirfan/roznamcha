-- Settings lists the business's team (owner and munshi). Phones can read membership but
-- not auth.users, so each membership carries a copy of its user's email. Additive: the
-- column is nullable and nothing reads it but the Settings list.

alter table membership add column email text;

update membership m set email = u.email from auth.users u where u.id = m.user_id;

-- New members get their email filled in from auth.users; the client never sends it.
create function private.membership_fill_email() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  select email into new.email from auth.users where id = new.user_id;
  return new;
end;
$$;

create trigger membership_fill_email
  before insert or update of user_id on membership
  for each row execute function private.membership_fill_email();
