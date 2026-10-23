import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

function publishableKey(): string {
  const legacy = Deno.env.get('SUPABASE_ANON_KEY');
  if (legacy) return legacy;
  try {
    return JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS') || '{}').default || '';
  } catch {
    return '';
  }
}

function secretKey(): string {
  try {
    const keys = JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS') || '{}');
    if (keys.default) return keys.default;
  } catch {
    console.warn('[VOW Support] Invalid secret-key environment JSON.');
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
}
const escapeHtml = (value: string) => value.replace(/[&<>\'\"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] || character);
const clean = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers });
  if (request.method !== 'POST') return json({ error: 'Request could not be processed.' }, 405);
  const auth = request.headers.get('Authorization');
  if (!auth?.startsWith('Bearer ')) return json({ error: 'Request could not be processed.' }, 401);
  const url = Deno.env.get('SUPABASE_URL');
  const publicKey = publishableKey();
  if (!url || !publicKey) {
    console.error('[VOW Support] Supabase URL or publishable key is not configured.');
    return json({ error: 'Support is temporarily unavailable. Please try again later.' }, 503);
  }

  const userClient = createClient(url, publicKey, { global: { headers: { Authorization: auth } } });
  const { data: { user }, error: authError } = await userClient.auth.getUser();
  if (authError || !user) return json({ error: 'Request could not be processed.' }, 401);
  const body = await request.json().catch(() => ({}));
  const requestId = clean(body.request_id, 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    return json({ persisted: false, error: 'Please retry your support request.' }, 422);
  }
  const message = clean(body.message, 10000);
  if (!message) return json({ error: 'Please enter a message before submitting.' }, 422);
  const name = clean(body.name, 120) || 'Not provided';
  const issue = clean(body.issue, 120) || 'Support request';
  const submittedEmail = clean(body.email, 254);
  const email = submittedEmail || user.email || '';
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ persisted: false, error: 'Please enter a valid reply email address.' }, 422);
  }
  const serviceKey = secretKey();
  if (!serviceKey) {
    console.error('[VOW Support] Supabase secret key is not configured; request was not persisted.');
    return json({ persisted: false, error: 'Support is temporarily unavailable. Please try again later.' }, 503);
  }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // Allow idempotent retries of the same request, but limit new support
  // submissions to one per account per hour.
  const { data: priorRequest, error: priorRequestError } = await admin
    .from('support_submissions')
    .select('id')
    .eq('client_request_id', requestId)
    .maybeSingle();
  if (priorRequestError) {
    console.error('[VOW Support] Could not check support request idempotency.');
    return json({ persisted: false, error: 'We could not check your existing request. Please try again.' }, 500);
  }
  if (!priorRequest) {
    const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentRequests, error: recentRequestError } = await admin
      .from('support_submissions')
      .select('id')
      .eq('user_id', user.id)
      .gte('created_at', cutoff)
      .limit(1);
    if (recentRequestError) {
      console.error('[VOW Support] Could not check support submission rate limit.');
      return json({ persisted: false, error: 'Support is temporarily unavailable. Please try again.' }, 503);
    }
    if (recentRequests?.length) {
      return json({ persisted: false, error: 'You can send one support request per hour. Please wait before submitting another.' }, 429);
    }
  }

  let submission: { id: string; created_at: string; delivery_status: string; delivery_id: string | null; user_id: string; name: string; email: string; issue: string; message: string } | null = null;
  const inserted = await admin.from('support_submissions').insert({ client_request_id: requestId, user_id: user.id, name, email, issue, message, delivery_status: 'pending' }).select('id, created_at, delivery_status, delivery_id, user_id, name, email, issue, message').single();
  if (!inserted.error && inserted.data) {
    submission = inserted.data;
  } else if (inserted.error?.code === '23505') {
    const existing = await admin.from('support_submissions').select('id, created_at, delivery_status, delivery_id, user_id, name, email, issue, message').eq('client_request_id', requestId).maybeSingle();
    if (existing.error || !existing.data) {
      console.error('[VOW Support] Idempotent submission lookup failed.');
      return json({ persisted: false, error: "We couldn't check your existing request. Please try again." }, 500);
    }
    const prior = existing.data;
    if (prior.user_id !== user.id || prior.name !== name || prior.email !== email || prior.issue !== issue || prior.message !== message) {
      return json({ persisted: false, error: 'This submission key belongs to a different support request. Please refresh the form and try again.' }, 409);
    }
    if (prior.delivery_id && ['accepted', 'delivered', 'delivery_delayed'].includes(prior.delivery_status)) {
      return json({ persisted: true, accepted: true, delivery_status: prior.delivery_status, duplicate: true });
    }
    submission = prior;
  } else {
    console.error('[VOW Support] Support submission insert failed; no email was sent.');
    return json({ persisted: false, error: "We couldn't submit your request. Please try again." }, 500);
  }
  if (!submission) {
    console.error('[VOW Support] Support submission was not available after insert.');
    return json({ persisted: false, error: "We couldn't submit your request. Please try again." }, 500);
  }
  const recordDelivery = async (values: Record<string, unknown>) => {
    const { error } = await admin.from('support_submissions').update(values).eq('id', submission.id);
    if (error) {
      console.error('[VOW Support] Delivery status update failed; database error code:', error.code || 'unknown');
      return false;
    }
    return true;
  };
  const resendKey = Deno.env.get('RESEND_API_KEY')?.trim();
  const recipient = (Deno.env.get('SUPPORT_RECIPIENT_EMAIL') || 'support@vowglobal.online').trim();
  const from = (Deno.env.get('VOW_SUPPORT_FROM_EMAIL') || Deno.env.get('SUPPORT_FROM_EMAIL') || 'VOW Support <support@vowglobal.online>').trim();
  if (!resendKey || !recipient || !from) {
    const recorded = await recordDelivery({ delivery_status: 'failed', delivery_error: !resendKey ? 'Resend API key is not configured' : 'Support sender or recipient is not configured' });
    return json({ accepted: false, persisted: true, delivery_status: recorded ? 'failed' : 'unknown', delivery_configured: false, status_recorded: recorded });
  }
  const received = new Date(submission.created_at).toISOString();
  const subject = `[VOW Support] ${issue.replace(/[\r\n]+/g, ' ').slice(0, 120)}`;
  const replyInstructions = email
    ? 'Reply directly to this email to respond to the requester; the reply-to address is set to the requester.'
    : 'No reply email was provided, so this message does not have a requester reply-to address.';
  const plainText = ['New support request', '', replyInstructions, '', `Name: ${name}`, `Email: ${email || 'Not provided'}`, `Issue: ${issue}`, '', 'Message', message, '', `Reference: ${submission.id}`, `Received: ${received}`].join('\n');
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;color:#111;background:#fff;line-height:1.5"><h1 style="font-size:20px;font-weight:600;margin:0 0 16px">New support request</h1><p style="padding:12px;background:#f2f5f8;border-radius:6px;font-size:14px">${escapeHtml(replyInstructions)}</p><table style="border-collapse:collapse;width:100%;font-size:14px"><tr><td style="padding:6px 16px 6px 0;font-weight:600;vertical-align:top">Name</td><td style="padding:6px 0">${escapeHtml(name)}</td></tr><tr><td style="padding:6px 16px 6px 0;font-weight:600;vertical-align:top">Email</td><td style="padding:6px 0">${escapeHtml(email || 'Not provided')}</td></tr><tr><td style="padding:6px 16px 6px 0;font-weight:600;vertical-align:top">Issue</td><td style="padding:6px 0">${escapeHtml(issue)}</td></tr></table><h2 style="font-size:15px;margin:28px 0 8px">Message</h2><div style="white-space:pre-wrap;border-left:2px solid #111;padding-left:14px">${escapeHtml(message)}</div><p style="font-size:12px;color:#555;margin-top:28px">Reference: ${escapeHtml(submission.id)}<br>Received: ${escapeHtml(received)} UTC</p></div>`;
  try {
    const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': `vow-support-${submission.id}` }, body: JSON.stringify({ from, to: [recipient], reply_to: email || undefined, subject, text: plainText, html }) });
    const providerResult = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('[VOW Support] Email provider rejected support notification:', response.status);
      const recorded = await recordDelivery({ delivery_status: 'failed', delivery_error: `Resend HTTP ${response.status}` });
      return json({ accepted: false, persisted: true, delivery_status: recorded ? 'failed' : 'unknown', delivery_configured: true, status_recorded: recorded });
    }
    const deliveryId = typeof providerResult?.id === 'string' ? providerResult.id.trim() : '';
    if (!deliveryId) {
      const recorded = await recordDelivery({ delivery_status: 'failed', delivery_error: 'Resend returned no message ID; provider acceptance could not be tracked' });
      console.error('[VOW Support] Resend returned success without a message ID.');
      return json({ accepted: false, persisted: true, delivery_status: recorded ? 'failed' : 'unknown', delivery_configured: true, status_recorded: recorded });
    }
    const recorded = await recordDelivery({ delivery_status: 'accepted', delivery_id: deliveryId, delivery_error: null });
    return json({ accepted: true, persisted: true, delivery_status: 'accepted', status_recorded: recorded });
  } catch (_error) {
    const recorded = await recordDelivery({ delivery_status: 'failed', delivery_error: 'Resend request failed; check provider logs before retrying' });
    return json({ accepted: false, persisted: true, delivery_status: recorded ? 'failed' : 'unknown', delivery_configured: true, status_recorded: recorded });
  }
});
