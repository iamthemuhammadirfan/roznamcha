#!/usr/bin/env python3
"""Write supabase/seed.sql from one business on the live project (read-only).

Usage: local-seed.py "Roznamcha Test" supabase/seed.sql

Only ever point this at the test business: the seed is committed to git. It fetches the
rows through PostgREST with the service-role key from the logged-in Supabase CLI (never
printed), and gives the business's logins a local-only password.
"""
import json
import subprocess
import sys
import urllib.parse
import urllib.request

REF = 'pagnqnthpxdlpfnvtoip'
URL = f'https://{REF}.supabase.co'
PASSWORD = 'roznamcha-local'
# Parents first; within a table, originals before the corrections that reverse them.
TABLES = ['membership', 'project', 'worker', 'trade', 'expense_category', 'assignment',
          'attendance', 'ledger_entry', 'settlement', 'project_expense']

name, out_path = sys.argv[1], sys.argv[2]
if name != 'Roznamcha Test':
    sys.exit('Refusing: only the "Roznamcha Test" business may be copied into the repo.')

keys = json.loads(subprocess.check_output(
    ['supabase', 'projects', 'api-keys', '--project-ref', REF, '-o', 'json'], stderr=subprocess.DEVNULL))
key = next(k['api_key'] for k in keys if k['name'] == 'service_role')
headers = {'apikey': key, 'Authorization': f'Bearer {key}', 'Accept': 'application/json'}


def get(path):
    return json.load(urllib.request.urlopen(urllib.request.Request(f'{URL}{path}', headers=headers)))


business = get(f'/rest/v1/business?name=eq.{urllib.parse.quote(name)}')
assert len(business) == 1, business
bid = business[0]['id']
rows = {t: get(f'/rest/v1/{t}?business_id=eq.{bid}&order=id&limit=100000') for t in TABLES}
member_ids = {m['user_id'] for m in rows['membership']}
users = [u for u in get('/auth/v1/admin/users?per_page=1000')['users'] if u['id'] in member_ids]


def q(s):
    return "'" + str(s).replace("'", "''") + "'"


def insert(table, data):
    data = sorted(data, key=lambda r: r.get('reverses_id') is not None)
    payload = q(json.dumps(data, ensure_ascii=False))
    return f'\ninsert into {table} select * from jsonb_populate_recordset(null::{table}, {payload}::jsonb) on conflict do nothing;\n'


logins = '\n'.join(
    f"--   {u['email']:<24}({next(m['role'] for m in rows['membership'] if m['user_id'] == u['id'])})"
    for u in users)
out = [f"""-- Local playground data: a copy of the live "{name}" business (never a real customer's),
-- loaded by `supabase db reset` after the migrations. Regenerate with
-- ./scripts/local-db.sh seed. Every login uses the local-only password {PASSWORD!r}:
--
{logins}
"""]
for u in users:
    out.append(f"""
insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token,
  email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', {q(u['id'])}, 'authenticated', 'authenticated', {q(u['email'])},
  crypt({q(PASSWORD)}, gen_salt('bf')), now(), '{{"provider":"email","providers":["email"]}}', '{{}}',
  {q(u['created_at'])}, now(), '', '', '', '');
insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
values (gen_random_uuid(), {q(u['id'])}, {q(u['id'])}, 'email',
  jsonb_build_object('sub', {q(u['id'])}, 'email', {q(u['email'])}, 'email_verified', true), now(), now(), now());
""")
out.append(insert('business', business))
out.append(f"""
-- The business's insert triggers just created default trades and expense types with new
-- ids; drop them so the copies below keep the ids that workers and expenses point at.
delete from trade where business_id = {q(bid)};
delete from expense_category where business_id = {q(bid)};
""")
for t in TABLES:
    if rows[t]:
        out.append(insert(t, rows[t]))
open(out_path, 'w').write(''.join(out))
print(f'{out_path}: {sum(len(r) for r in rows.values())} rows from "{name}", {len(users)} logins')
