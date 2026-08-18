import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { constantTimeEqual, hmac } from '../_shared/woocommerce-bridge.ts';

const URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const CALLBACK_SECRET = Deno.env.get('WOOCOMMERCE_CALLBACK_SECRET') ?? '';
const EXPECTED_KEY_ID = Deno.env.get('WOOCOMMERCE_BRIDGE_KEY_ID') ?? '';
const ENABLED = (Deno.env.get('PAYMENT_NOTIFICATION_RETRY_ENABLED') ?? 'false').toLowerCase() === 'true';

serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (!ENABLED) return json({ ok: true, disabled: true }, 200);
  const raw = await req.text();
  const keyId = req.headers.get('x-psrx-key-id') ?? '';
  const signature = req.headers.get('x-psrx-signature') ?? '';
  if (!CALLBACK_SECRET || !EXPECTED_KEY_ID || !constantTimeEqual(keyId, EXPECTED_KEY_ID)) {
    return json({ error: 'Unauthorized' }, 401);
  }
  const expected = await hmac(CALLBACK_SECRET, raw);
  if (!constantTimeEqual(signature, expected)) return json({ error: 'Unauthorized' }, 401);

  let body: { timestamp?: number; limit?: number };
  try {
    body = JSON.parse(raw || '{}') as { timestamp?: number; limit?: number };
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const timestamp = Number(body.timestamp ?? 0);
  if (!Number.isSafeInteger(timestamp) || Math.abs(Date.now() / 1000 - timestamp) > 300) {
    return json({ error: 'Expired worker request' }, 400);
  }

  const db = createClient(URL, SERVICE_KEY);
  const requestedLimit = Number(body.limit ?? 10);
  const limit = Number.isSafeInteger(requestedLimit) ? Math.max(1, Math.min(requestedLimit, 25)) : 10;
  const { data: rows, error } = await db.rpc('claim_payment_notification_outbox', { p_limit: limit });
  if (error) return json({ error: 'Could not claim notification work' }, 500);

  const summary = { claimed: 0, sent: 0, retry_scheduled: 0, terminal_failed: 0 };
  for (const row of (rows ?? []) as Array<Record<string, unknown>>) {
    summary.claimed += 1;
    const id = String(row.id ?? '');
    const lockToken = String(row.lock_token ?? '');
    const orderId = String(row.order_id ?? '');
    const notificationType = String(row.notification_type ?? '');
    let succeeded = false;
    let temporary = false;
    let httpStatus: number | null = null;
    let category = 'unsupported_notification_type';

    if (notificationType === 'partner_sale') {
      try {
        const response = await fetch(`${URL}/functions/v1/notify-partner-sale`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ order_id: orderId, payment_provider: String(row.payment_provider ?? '') }),
        });
        httpStatus = response.status;
        succeeded = response.ok;
        temporary = response.status === 408 || response.status === 429 || response.status >= 500;
        category = succeeded ? '' : temporary ? 'temporary_notification_failure' : 'permanent_notification_failure';
      } catch {
        temporary = true;
        category = 'notification_network_failure';
      }
    }

    const { data: completed, error: completionError } = await db.rpc('complete_payment_notification_outbox', {
      p_id: id,
      p_lock_token: lockToken,
      p_succeeded: succeeded,
      p_temporary_failure: temporary,
      p_http_status: httpStatus,
      p_error_category: category || null,
    });
    if (completionError) {
      // The row remains claimed only until its short lease expires, after which
      // the database can safely claim it again.
      summary.retry_scheduled += 1;
      continue;
    }
    const result = String((completed as { result?: string } | null)?.result ?? 'terminal_failed');
    if (result === 'sent') summary.sent += 1;
    else if (result === 'retry_scheduled') summary.retry_scheduled += 1;
    else summary.terminal_failed += 1;
  }
  return json({ ok: true, ...summary }, 200);
});

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
