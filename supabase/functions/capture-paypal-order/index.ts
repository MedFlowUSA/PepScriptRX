import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const PAYPAL_CLIENT_ID     = Deno.env.get('PAYPAL_CLIENT_ID') ?? '';
const PAYPAL_CLIENT_SECRET = Deno.env.get('PAYPAL_CLIENT_SECRET') ?? '';
const PAYPAL_ENV           = Deno.env.get('PAYPAL_ENV') ?? '';
const ADMIN_PAYPAL_EMAIL   = Deno.env.get('ADMIN_PAYPAL_EMAIL') ?? '';
const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

if (PAYPAL_ENV !== 'live') {
  throw new Error(
    'PAYPAL_ENV must be set to "live" in Supabase Edge Function secrets. ' +
    'Payment capture is blocked until this is configured.',
  );
}

if (!PAYPAL_CLIENT_ID || !PAYPAL_CLIENT_SECRET) {
  throw new Error('PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET must be set in Supabase Edge Function secrets.');
}

if (!ADMIN_PAYPAL_EMAIL) {
  throw new Error('ADMIN_PAYPAL_EMAIL must be set to the official PepScriptRX PayPal Business receiver email.');
}

const PAYPAL_BASE = 'https://api-m.paypal.com';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
  'Content-Type': 'application/json',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const { order_id, payment_token } = await req.json() as { order_id: string; payment_token: string };
    if (!order_id || !payment_token) {
      return json({ error: 'order_id and payment_token required' }, 400);
    }

    const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: submission, error: subError } = await db
      .from('patient_submissions')
      .select('id, status, quoted_price, discount_amount, shipping_cost, cost_of_goods, rep_id, admin_code, store_slug, store_name, account_type, checkout_scope_id, checkout_scope_code, source_portal, source_store, source_admin, source_rep')
      .eq('public_payment_token', payment_token)
      .single();

    if (subError || !submission) return json({ ok: false, error: 'Submission not found' }, 404);
    if (submission.status === 'paid' || submission.status === 'fulfilled') {
      return json({ ok: true, paypal_order_id: order_id, already_paid: true }, 200);
    }
    if (submission.status !== 'payment_sent') {
      return json({ ok: false, error: `Submission is not payable: ${submission.status}` }, 409);
    }

    const productTotal = Number(submission.quoted_price ?? 0);
    const discountAmt = Math.min(Number(submission.discount_amount ?? 0), productTotal);
    const shippingCost = Number(submission.shipping_cost ?? 0);
    const expectedTotal = roundMoney(Math.max(0, productTotal - discountAmt) + shippingCost);
    if (expectedTotal <= 0) return json({ ok: false, error: 'Submission total is not payable' }, 400);

    // Get PayPal access token
    const tokenRes = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${btoa(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`)}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      return json({ ok: false, error: 'PayPal auth failed', detail: tokenData }, 502);
    }

    // Capture the PayPal order server-side
    const captureRes = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${order_id}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/json',
        'PayPal-Request-Id': submission.id, // idempotency - safe to retry
      },
    });
    const captureData = await captureRes.json();

    if (!captureRes.ok) {
      return json({ ok: false, error: 'PayPal capture failed', detail: captureData }, 502);
    }

    if (captureData.status !== 'COMPLETED') {
      return json({ ok: false, error: `Unexpected PayPal order status: ${captureData.status}` }, 400);
    }

    // Mark submission as paid only after PayPal returns a completed capture.
    const capture = captureData.purchase_units?.[0]?.payments?.captures?.[0] ?? null;
    const captureId = capture?.id ?? null;
    const captureStatus = capture?.status ?? captureData.status;
    const captureAmount = roundMoney(Number(capture?.amount?.value ?? NaN));
    const captureCurrency = String(capture?.amount?.currency_code ?? '');
    const payee = captureData.purchase_units?.[0]?.payee ?? {};

    if (captureStatus !== 'COMPLETED') {
      return json({ ok: false, error: `Unexpected PayPal capture status: ${captureStatus}` }, 400);
    }
    if (captureCurrency !== 'USD' || captureAmount !== expectedTotal) {
      return json({
        ok: false,
        error: 'PayPal capture amount does not match expected order total',
        expected: { value: expectedTotal.toFixed(2), currency: 'USD' },
        captured: { value: Number.isFinite(captureAmount) ? captureAmount.toFixed(2) : null, currency: captureCurrency },
      }, 400);
    }
    const payeeEmail = String(payee.email_address ?? '').toLowerCase();
    if (payeeEmail && payeeEmail !== ADMIN_PAYPAL_EMAIL.toLowerCase()) {
      return json({ ok: false, error: 'PayPal payee email mismatch' }, 400);
    }

    // Only transition from payment_sent to prevent double-processing.
    const { error: updateError } = await db
      .from('patient_submissions')
      .update({
        status: 'paid',
        payment_provider: 'paypal',
        payment_status: 'paid',
        payout_status: 'pending',
        fulfillment_status: 'pending',
        paypal_order_id: order_id,
        paypal_capture_id: captureId,
        paypal_capture_status: captureStatus,
        paid_at: new Date().toISOString(),
      })
      .eq('id', submission.id)
      .eq('status', 'payment_sent');

    if (updateError) return json({ ok: false, error: 'Could not mark submission paid', detail: updateError }, 500);

    const cogs = Number(submission.cost_of_goods ?? 0);
    const grossSale = Math.max(0, productTotal - discountAmt) + shippingCost;
    // Commission is on net profit only (gross revenue minus discount and wholesale cost)
    const netProfit = Math.max(0, productTotal - discountAmt - cogs);
    const { data: checkoutScope } = submission.checkout_scope_id || submission.checkout_scope_code
      ? await db
        .from('checkout_scopes')
        .select('id, scope_code, display_name, account_type, account_id, parent_account_id, default_commission_rate')
        .or(`id.eq.${submission.checkout_scope_id ?? '00000000-0000-0000-0000-000000000000'},scope_code.eq.${submission.checkout_scope_code ?? ''}`)
        .eq('is_active', true)
        .maybeSingle()
      : { data: null };

    if (checkoutScope && checkoutScope.scope_code !== 'MAIN') {
      if (['rep', 'sub_account', 'admin'].includes(String(checkoutScope.account_type)) && checkoutScope.account_id) {
        const { data: scopedRep } = await db
          .from('reps')
          .select('id, rep_name, rep_slug, commission_rate, parent_rep_id, override_percent, platform_percent')
          .ilike('rep_slug', String(checkoutScope.account_id))
          .maybeSingle();
        const { data: parentRep } = scopedRep?.parent_rep_id
          ? await db
            .from('reps')
            .select('id, rep_name, rep_slug')
            .eq('id', scopedRep.parent_rep_id)
            .maybeSingle()
          : { data: null };

        if (scopedRep?.id) {
          const rate = Math.max(0, Math.min(1, Number(scopedRep.commission_rate ?? checkoutScope.default_commission_rate ?? 0)));
          const overrideRate = Math.max(0, Math.min(1, Number(scopedRep.override_percent ?? 0)));
          const platformRate = Math.max(0, Math.min(1, Number(scopedRep.platform_percent ?? Math.max(0, 1 - rate - overrideRate))));
          const rows: CommissionRow[] = [{
            submission_id: submission.id,
            rep_id: scopedRep.id,
            gross_sale: grossSale,
            margin: netProfit,
            commission_rate: rate,
            commission_amount: roundMoney(netProfit * rate),
            commission_role: 'rep_commission_owner',
            owner_label: checkoutScope.display_name ?? scopedRep.rep_name ?? scopedRep.rep_slug ?? checkoutScope.scope_code,
            status: 'pending',
            wallet_account_type: checkoutScope.account_type,
            wallet_account_id: checkoutScope.account_id,
          }];

          if (parentRep?.id && overrideRate > 0) {
            rows.push({
              submission_id: submission.id,
              rep_id: parentRep.id,
              gross_sale: grossSale,
              margin: netProfit,
              commission_rate: overrideRate,
              commission_amount: roundMoney(netProfit * overrideRate),
              commission_role: 'override_owner',
              owner_label: parentRep.rep_name ?? parentRep.rep_slug ?? 'Parent rep',
              status: 'pending',
              wallet_account_type: 'rep',
              wallet_account_id: parentRep.rep_slug ?? parentRep.id,
            });
          }

          if (platformRate > 0) {
            rows.push({
              submission_id: submission.id,
              rep_id: null,
              gross_sale: grossSale,
              margin: netProfit,
              commission_rate: platformRate,
              commission_amount: roundMoney(netProfit * platformRate),
              commission_role: 'platform_margin_owner',
              owner_label: 'PepScriptRX',
              status: 'pending',
            });
          }

          await upsertCommissionLedger(db, rows);
          await createWalletEntries(db, submission, rows);
          return json({ ok: true, paypal_order_id: order_id, paypal_capture_id: captureId }, 200);
        }
      }

      const scopeRate = Math.max(0, Math.min(1, Number(checkoutScope.default_commission_rate ?? 0)));
      const scopeAmount = roundMoney(netProfit * scopeRate);
      const platformAmount = roundMoney(Math.max(0, netProfit - scopeAmount));
      const rows = [];

      if (scopeAmount > 0) {
        rows.push({
          submission_id: submission.id,
          rep_id: null,
          gross_sale: grossSale,
          margin: netProfit,
          commission_rate: scopeRate,
          commission_amount: scopeAmount,
          commission_role: 'scope_commission_owner',
          owner_label: checkoutScope.display_name ?? checkoutScope.scope_code,
          status: 'pending',
          wallet_account_type: checkoutScope.account_type,
          wallet_account_id: checkoutScope.account_id ?? checkoutScope.scope_code,
        });
      }

      if (platformAmount > 0) {
        rows.push({
          submission_id: submission.id,
          rep_id: null,
          gross_sale: grossSale,
          margin: netProfit,
          commission_rate: 1 - scopeRate,
          commission_amount: platformAmount,
          commission_role: 'platform_margin_owner',
          owner_label: 'PepScriptRX',
          status: 'pending',
        });
      }

      await upsertCommissionLedger(db, rows);
      await createWalletEntries(db, submission, rows);
      return json({ ok: true, paypal_order_id: order_id, paypal_capture_id: captureId }, 200);
    }

    if (submission.rep_id) {
      const { data: rep } = await db
        .from('reps')
        .select('id, rep_name, rep_slug, commission_rate, parent_rep_id, override_percent, platform_percent')
        .eq('id', submission.rep_id)
        .single();
      const { data: parentRep } = rep?.parent_rep_id
        ? await db
          .from('reps')
          .select('id, rep_name, rep_slug')
          .eq('id', rep.parent_rep_id)
          .maybeSingle()
        : { data: null };
      const rate = Number(rep?.commission_rate ?? 0.2);
      const overrideRate = Number(rep?.override_percent ?? 0);
      const platformRate = Number(rep?.platform_percent ?? Math.max(0, 1 - rate - overrideRate));
      const rows = [{
        submission_id: submission.id,
        rep_id: submission.rep_id,
        gross_sale: grossSale,
        margin: netProfit,
        commission_rate: rate,
        commission_amount: netProfit * rate,
        commission_role: 'rep_commission_owner',
        owner_label: rep?.rep_name ?? rep?.rep_slug ?? 'Rep',
        status: 'pending',
      }];

      if (parentRep?.id && overrideRate > 0) {
        rows.push({
          submission_id: submission.id,
          rep_id: parentRep.id,
          gross_sale: grossSale,
          margin: netProfit,
          commission_rate: overrideRate,
          commission_amount: netProfit * overrideRate,
          commission_role: 'override_owner',
          owner_label: parentRep.rep_name ?? parentRep.rep_slug ?? 'Parent rep',
          status: 'pending',
        });
      }

      if (platformRate > 0) {
        rows.push({
          submission_id: submission.id,
          rep_id: submission.rep_id,
          gross_sale: grossSale,
          margin: netProfit,
          commission_rate: platformRate,
          commission_amount: netProfit * platformRate,
          commission_role: 'platform_margin_owner',
          owner_label: 'PepScriptRX',
          status: 'pending',
        });
      }

      await upsertCommissionLedger(db, rows);
      await createWalletEntries(db, submission, rows);
    } else {
      await createWalletEntries(db, submission, [{
        submission_id: submission.id,
        rep_id: null,
        gross_sale: grossSale,
        margin: netProfit,
        commission_rate: 1,
        commission_amount: netProfit,
        commission_role: 'platform_margin_owner',
        owner_label: 'PepScriptRX',
        status: 'pending',
      }]);
    }

    return json({ ok: true, paypal_order_id: order_id, paypal_capture_id: captureId }, 200);

  } catch (err) {
    return json({ ok: false, error: String(err) }, 500);
  }
});

function json(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders });
}

function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

type DbClient = ReturnType<typeof createClient>;

type WalletSubmission = {
  id: string;
  rep_id?: string | null;
  admin_code?: string | null;
  store_slug?: string | null;
  store_name?: string | null;
  account_type?: string | null;
  source_portal?: string | null;
  source_store?: string | null;
  source_admin?: string | null;
  source_rep?: string | null;
};

type CommissionRow = {
  submission_id: string;
  rep_id: string | null;
  gross_sale?: number;
  margin?: number;
  commission_rate?: number;
  commission_amount: number;
  commission_role: string;
  owner_label: string;
  status?: string;
  wallet_account_type?: string;
  wallet_account_id?: string | null;
};

async function upsertCommissionLedger(db: DbClient, rows: CommissionRow[]) {
  const ledgerRows = rows
    .filter((row) => row.rep_id)
    .map((row) => ({
      submission_id: row.submission_id,
      rep_id: row.rep_id,
      gross_sale: row.gross_sale,
      margin: row.margin,
      commission_rate: row.commission_rate,
      commission_amount: row.commission_amount,
      commission_role: row.commission_role,
      owner_label: row.owner_label,
      status: row.status ?? 'pending',
    }));

  if (ledgerRows.length === 0) return;

  const { error } = await db
    .from('commission_ledger')
    .upsert(ledgerRows, { onConflict: 'submission_id,rep_id,commission_role' });

  if (error) console.error('Could not upsert commission ledger', error);
}

async function createWalletEntries(db: DbClient, submission: WalletSubmission, rows: CommissionRow[]) {
  for (const row of rows) {
    const amount = roundMoney(Number(row.commission_amount ?? 0));
    if (amount <= 0) continue;

    const walletTarget = walletTargetForRow(submission, row);
    await upsertWalletEntry(db, {
      ...walletTarget,
      orderId: row.submission_id,
      entryType: entryTypeForRole(row.commission_role),
      amount,
      description: `${row.owner_label} - ${row.commission_role.replace(/_/g, ' ')}`,
    });
  }
}

function walletTargetForRow(submission: WalletSubmission, row: CommissionRow) {
  if (row.commission_role === 'platform_margin_owner') {
    return { accountType: 'platform', accountId: 'platform', displayName: 'PepScriptRX' };
  }

  if (row.wallet_account_type && row.wallet_account_id) {
    return {
      accountType: row.wallet_account_type,
      accountId: row.wallet_account_id,
      displayName: row.owner_label || row.wallet_account_id,
    };
  }

  const isAdminStoreOwner = row.commission_role === 'rep_commission_owner'
    && String(submission.account_type ?? '').toLowerCase() === 'admin'
    && Boolean(submission.admin_code);

  if (isAdminStoreOwner) {
    return {
      accountType: 'admin',
      accountId: String(submission.admin_code),
      displayName: submission.store_name || submission.source_portal || String(submission.admin_code),
    };
  }

  return {
    accountType: 'rep',
    accountId: row.rep_id || submission.source_rep || 'unassigned',
    displayName: row.owner_label || submission.source_portal || 'Rep',
  };
}

function entryTypeForRole(role: string) {
  if (role === 'override_owner') return 'override';
  if (role === 'platform_margin_owner') return 'platform_margin';
  return 'commission';
}

async function upsertWalletEntry(
  db: DbClient,
  input: {
    accountType: string;
    accountId: string;
    displayName: string;
    orderId: string;
    entryType: string;
    amount: number;
    description: string;
  },
) {
  const { data: wallet, error: walletError } = await db
    .from('internal_wallets')
    .upsert({
      account_type: input.accountType,
      account_id: input.accountId,
      display_name: input.displayName,
      status: 'active',
    }, { onConflict: 'account_type,account_id' })
    .select('id')
    .single();

  if (walletError || !wallet?.id) {
    console.error('Could not upsert internal wallet', walletError);
    return;
  }

  const { error: entryError } = await db
    .from('wallet_entries')
    .upsert({
      wallet_id: wallet.id,
      order_id: input.orderId,
      entry_type: input.entryType,
      amount: input.amount,
      status: 'pending',
      description: input.description,
    }, { onConflict: 'wallet_id,order_id,entry_type' });

  if (entryError) console.error('Could not upsert wallet entry', entryError);
}
