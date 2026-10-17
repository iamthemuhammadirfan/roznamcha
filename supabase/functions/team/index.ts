// The owner manages munshi accounts from Settings: create a munshi, or set a munshi's
// password. Both need the service-role key, which never ships in the app, so they run
// here. The caller must be the owner of the business named in the request; a reset may
// only target a munshi of that same business — never an owner.
import { createClient } from '@supabase/supabase-js';

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** Supabase's default minimum; the app checks the same before sending. */
const MIN_PASSWORD = 6;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Body =
  | { action: 'create'; businessId: string; email: string; password: string }
  | { action: 'reset'; businessId: string; userId: string; password: string };

/** Error codes the app turns into Urdu/English messages (src/lib/team.ts). */
type Code = 'unauthorized' | 'not_owner' | 'not_munshi' | 'invalid_email' | 'weak_password' | 'exists' | 'bad_request' | 'failed';

function reply(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
const fail = (status: number, error: Code) => reply(status, { error });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return fail(405, 'bad_request');

  // Who is asking: resolve the caller from their own JWT.
  const authorization = req.headers.get('Authorization');
  if (!authorization) return fail(401, 'unauthorized');
  const asCaller = createClient(url, anonKey, { global: { headers: { Authorization: authorization } } });
  const {
    data: { user },
  } = await asCaller.auth.getUser();
  if (!user) return fail(401, 'unauthorized');

  const body = (await req.json().catch(() => null)) as Body | null;
  if (!body || typeof body.businessId !== 'string' || typeof body.password !== 'string') return fail(400, 'bad_request');
  if (body.password.length < MIN_PASSWORD) return fail(400, 'weak_password');

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data: caller } = await admin
    .from('membership')
    .select('role')
    .eq('business_id', body.businessId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (caller?.role !== 'owner') return fail(403, 'not_owner');

  if (body.action === 'create') {
    const email = String(body.email ?? '').trim().toLowerCase();
    if (!EMAIL.test(email)) return fail(400, 'invalid_email');

    const { data, error } = await admin.auth.admin.createUser({ email, password: body.password, email_confirm: true });
    if (error || !data.user) {
      if (error?.code === 'email_exists') return fail(409, 'exists');
      if (error?.code === 'email_address_invalid') return fail(400, 'invalid_email');
      if (error?.code === 'weak_password') return fail(400, 'weak_password');
      console.error('createUser', error);
      return fail(500, 'failed');
    }

    // membership.email is filled in by its insert trigger.
    const { error: joinError } = await admin
      .from('membership')
      .insert({ business_id: body.businessId, user_id: data.user.id, role: 'munshi' });
    if (joinError) {
      // Don't leave an account that belongs to no business.
      await admin.auth.admin.deleteUser(data.user.id);
      console.error('membership insert', joinError);
      return fail(500, 'failed');
    }
    return reply(200, { userId: data.user.id });
  }

  if (body.action === 'reset') {
    if (typeof body.userId !== 'string') return fail(400, 'bad_request');
    const { data: target } = await admin
      .from('membership')
      .select('role')
      .eq('business_id', body.businessId)
      .eq('user_id', body.userId)
      .maybeSingle();
    if (target?.role !== 'munshi') return fail(403, 'not_munshi');
    // Someone who owns any business is never reset from another business's Settings.
    const { count: ownsAny } = await admin
      .from('membership')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', body.userId)
      .eq('role', 'owner');
    if (ownsAny) return fail(403, 'not_munshi');

    const { error } = await admin.auth.admin.updateUserById(body.userId, { password: body.password });
    if (error) {
      if (error.code === 'weak_password') return fail(400, 'weak_password');
      console.error('updateUserById', error);
      return fail(500, 'failed');
    }
    return reply(200, { ok: true });
  }

  return fail(400, 'bad_request');
});
