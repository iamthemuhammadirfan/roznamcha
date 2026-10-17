// The owner manages munshi accounts from Settings → Team: add a munshi, set a munshi's
// password, or remove a munshi's access. All need the service-role key, which never
// ships in the app, so they run here. The caller must be the owner of the business named
// in the request; reset and revoke only ever touch a munshi of that same business who
// owns no business anywhere.
//
// Removing access never deletes the auth user: every row they entered points at it
// (created_by), so deleting would be refused — and the data must stay. Instead the
// membership goes and, if they belong nowhere else, their login is banned. Adding the
// same email again brings them back.
import { createClient } from '@supabase/supabase-js';

const url = Deno.env.get('SUPABASE_URL')!;
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

/** Supabase's default minimum; the app checks the same before sending. */
const MIN_PASSWORD = 6;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Body =
  | { action: 'create'; businessId: string; email: string; password: string }
  | { action: 'reset'; businessId: string; userId: string; password: string }
  | { action: 'revoke'; businessId: string; userId: string };

/** Long enough to mean "until restored"; adding the munshi again lifts it. */
const BANNED = '876000h';

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
  if (!body || typeof body.businessId !== 'string') return fail(400, 'bad_request');
  if (body.action !== 'revoke') {
    if (typeof body.password !== 'string') return fail(400, 'bad_request');
    if (body.password.length < MIN_PASSWORD) return fail(400, 'weak_password');
  }

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
    if (error?.code === 'email_exists') return restore(email, body.businessId, body.password);
    if (error || !data.user) {
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

  if (body.action === 'reset' || body.action === 'revoke') {
    if (typeof body.userId !== 'string') return fail(400, 'bad_request');
    if (!(await isMunshiOf(body.businessId, body.userId))) return fail(403, 'not_munshi');
  }

  if (body.action === 'revoke') {
    const { error } = await admin
      .from('membership')
      .delete()
      .eq('business_id', body.businessId)
      .eq('user_id', body.userId);
    if (error) {
      console.error('membership delete', error);
      return fail(500, 'failed');
    }
    // Still in another business: leave their login alone.
    const { count: elsewhere } = await admin
      .from('membership')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', body.userId);
    if (!elsewhere) {
      const { error: banError } = await admin.auth.admin.updateUserById(body.userId, { ban_duration: BANNED });
      if (banError) console.error('ban', banError); // Access is already gone with the membership.
    }
    return reply(200, { ok: true });
  }

  if (body.action === 'reset') {
    const { error } = await admin.auth.admin.updateUserById(body.userId, { password: body.password });
    if (error) {
      if (error.code === 'weak_password') return fail(400, 'weak_password');
      console.error('updateUserById', error);
      return fail(500, 'failed');
    }
    return reply(200, { ok: true });
  }

  return fail(400, 'bad_request');

  /** A munshi of this business who owns no business anywhere (owners are never managed here). */
  async function isMunshiOf(businessId: string, userId: string) {
    const { data: target } = await admin
      .from('membership')
      .select('role')
      .eq('business_id', businessId)
      .eq('user_id', userId)
      .maybeSingle();
    if (target?.role !== 'munshi') return false;
    const { count: ownsAny } = await admin
      .from('membership')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('role', 'owner');
    return !ownsAny;
  }

  /**
   * The email already has an account. If it belongs to no business — a munshi whose
   * access was removed — bring it back here with the new password; otherwise refuse.
   */
  async function restore(email: string, businessId: string, password: string) {
    // No lookup-by-email in the admin API; a business has a handful of accounts.
    const { data: list, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const found = list?.users.find((u) => u.email?.toLowerCase() === email);
    if (error || !found) return fail(409, 'exists');
    const { count: memberships } = await admin
      .from('membership')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', found.id);
    if (memberships) return fail(409, 'exists');

    const { error: updateError } = await admin.auth.admin.updateUserById(found.id, { password, ban_duration: 'none' });
    if (updateError) {
      if (updateError.code === 'weak_password') return fail(400, 'weak_password');
      console.error('restore update', updateError);
      return fail(500, 'failed');
    }
    const { error: joinError } = await admin
      .from('membership')
      .insert({ business_id: businessId, user_id: found.id, role: 'munshi' });
    if (joinError) {
      console.error('restore membership', joinError);
      return fail(500, 'failed');
    }
    return reply(200, { userId: found.id, restored: true });
  }
});
