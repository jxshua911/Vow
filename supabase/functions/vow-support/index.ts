import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return json({ error: 'Authentication required.' }, 401);
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'Authentication required.' }, 401);
  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === 'string' ? body.message.trim().slice(0, 10000) : '';
  if (!message) return json({ error: 'Please describe how we can help.' }, 422);
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const email = user.email || '';
  const { data: submission, error: insertError } = await admin.from('support_submissions').insert({ user_id: user.id, email, message }).select('id').single();
  if (insertError) return json({ error: 'Your request could not be saved. Please email support@vowglobal.online directly.' }, 500);
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const recipient = Deno.env.get('SUPPORT_RECIPIENT_EMAIL') || 'support@vowglobal.online';
  if (!resendKey) return json({ accepted: false, persisted: true, delivery_status: 'failed', message: 'Your request was saved, but email delivery is not configured. Please email support@vowglobal.online directly.' }, 503);
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: Deno.env.get('SUPPORT_FROM_EMAIL') || 'VOW Support <support@vowglobal.online>', to: [recipient], reply_to: email || undefined, subject: `VOW support request from ${email || 'user'}`, text: message }) });
  const providerBody = await response.json().catch(() => ({}));
  if (!response.ok) { await admin.from('support_submissions').update({ delivery_status: 'failed', delivery_error: String(providerBody?.message || response.status).slice(0, 500) }).eq('id', submission.id); return json({ accepted: false, persisted: true, delivery_status: 'failed', message: 'Your request was saved, but we could not send it. Please email support@vowglobal.online directly.' }, 502); }
  await admin.from('support_submissions').update({ delivery_status: 'sent' }).eq('id', submission.id);
  return json({ accepted: true, persisted: true, delivery_status: 'sent' });
});
