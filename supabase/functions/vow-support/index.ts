import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });
const escapeHtml = (value: string) => value.replace(/[&<>\'\"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character);
const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return json({ error: 'Request could not be processed.' }, 405);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return json({ error: 'Request could not be processed.' }, 401);
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) return json({ error: 'Request could not be processed.' }, 401);
  const body = await request.json().catch(() => ({}));
  const message = clean(body.message, 10000);
  if (!message) return json({ error: 'Please enter a message before submitting.' }, 422);
  const name = clean(body.name, 120) || 'Not provided';
  const issue = clean(body.issue, 120) || 'Support request';
  const email = user.email || '';
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: submission, error: insertError } = await admin.from('support_submissions').insert({ user_id: user.id, email, message }).select('id, created_at').single();
  if (insertError || !submission) return json({ persisted: false, error: 'We couldn\'t submit your request. Please try again.' }, 500);
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const recipient = Deno.env.get('SUPPORT_RECIPIENT_EMAIL') || 'support@vowglobal.online';
  const from = Deno.env.get('SUPPORT_FROM_EMAIL') || 'VOW Support <support@vowglobal.online>';
  if (!resendKey) return json({ accepted: false, persisted: true, delivery_status: 'failed', delivery_configured: false });
  const received = new Date(submission.created_at).toISOString();
  const subject = `[VOW Support] ${issue.replace(/[\r\n]+/g, ' ').slice(0, 120)}`;
  const plainText = ['New support request', '', `Name: ${name}`, `Email: ${email || 'Not provided'}`, `Issue: ${issue}`, '', 'Message', message, '', `Reference: ${submission.id}`, `Received: ${received}`].join('\n');
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;color:#111;background:#fff;line-height:1.5"><h1 style="font-size:20px;font-weight:600;margin:0 0 24px">New support request</h1><table style="border-collapse:collapse;width:100%;font-size:14px"><tr><td style="padding:6px 16px 6px 0;font-weight:600;vertical-align:top">Name</td><td style="padding:6px 0">${escapeHtml(name)}</td></tr><tr><td style="padding:6px 16px 6px 0;font-weight:600;vertical-align:top">Email</td><td style="padding:6px 0">${escapeHtml(email || 'Not provided')}</td></tr><tr><td style="padding:6px 16px 6px 0;font-weight:600;vertical-align:top">Issue</td><td style="padding:6px 0">${escapeHtml(issue)}</td></tr></table><h2 style="font-size:15px;margin:28px 0 8px">Message</h2><div style="white-space:pre-wrap;border-left:2px solid #111;padding-left:14px">${escapeHtml(message)}</div><p style="font-size:12px;color:#555;margin-top:28px">Reference: ${escapeHtml(submission.id)}<br>Received: ${escapeHtml(received)} UTC</p></div>`;
  try {
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from, to: [recipient], reply_to: email || undefined, subject, text: plainText, html }) });
    await response.text().catch(() => '');
    if (!response.ok) { await admin.from('support_submissions').update({ delivery_status: 'failed', delivery_error: `Resend ${response.status}` }).eq('id', submission.id); return json({ accepted: false, persisted: true, delivery_status: 'failed', delivery_configured: true }); }
    await admin.from('support_submissions').update({ delivery_status: 'sent' }).eq('id', submission.id);
    return json({ accepted: true, persisted: true, delivery_status: 'sent' });
  } catch (_error) {
    await admin.from('support_submissions').update({ delivery_status: 'failed', delivery_error: 'Resend request failed' }).eq('id', submission.id);
    return json({ accepted: false, persisted: true, delivery_status: 'failed', delivery_configured: true });
  }
});
