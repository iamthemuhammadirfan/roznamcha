-- Run once in the Supabase SQL editor AFTER creating the two users in
-- Authentication → Users (and switching public sign-ups off).
-- Replace the emails and business name, then run.

with b as (
  insert into business (name) values ('اپنی کمپنی کا نام') returning id
)
insert into membership (business_id, user_id, role)
select b.id, u.id, case u.email when 'owner@example.com' then 'owner' else 'munshi' end
from b, auth.users u
where u.email in ('owner@example.com', 'munshi@example.com');
