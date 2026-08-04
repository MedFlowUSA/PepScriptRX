import assert from 'node:assert/strict';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import postgres from 'postgres';

const sql = postgres(process.env.PSRX_STAGING_TEST_DATABASE_URL, { max: 8, ssl: 'require', prepare: false });
const base = 'https://yjexrleubnjuitiyjvoy.supabase.co/functions/v1';
const secret = process.env.PSRX_CALLBACK_SECRET;
const keyId = process.env.PSRX_KEY_ID;
const results = [];
const hex = (value) => createHash('sha256').update(value).digest('hex');

async function command(action, payload = {}) {
  const [row] = await sql`select staging_bridge_test_command(${action},${sql.json(payload)}) value`;
  return row.value;
}
async function fixture(withRep = true) {
  const id = randomUUID();
  const token = `staging_${randomUUID().replaceAll('-', '')}`;
  const woo = Math.floor(100000 + Math.random() * 800000);
  await command('create_order', { id, with_rep: withRep });
  await command('create_session', {
    order_id: id, token_hash: hex(token), public_token_hash: hex(`public_${token}`),
    idempotency_key: hex(`idempotency_${token}`), amount_cents: 9500, woo_order_id: woo,
  });
  return { id, token, woo };
}
async function callback(f, status, eventId, options = {}) {
  const body = JSON.stringify({
    event_id: eventId, timestamp: options.timestamp ?? Math.floor(Date.now() / 1000),
    session_token: f.token, woo_order_id: f.woo, status,
    amount_cents: options.amount ?? 9500, currency: options.currency ?? 'USD',
    processor_reference: options.transaction ?? `tx-${f.woo}`,
    woo_status: options.wooStatus ?? (status === 'paid' ? 'processing' : status),
    woo_is_paid: options.wooIsPaid ?? status === 'paid', payment_method: 'mps_staging_mock',
    reversed_amount_cents: options.reversed,
  });
  const signature = createHmac('sha256', secret).update(body).digest('hex');
  return fetch(`${base}/woocommerce-payment-callback`, {
    method: 'POST', headers: {
      'content-type': 'application/json',
      'x-psrx-key-id': options.keyId ?? keyId,
      'x-psrx-signature': options.signature ?? signature,
    }, body,
  });
}
async function test(name, fn) {
  await fn(); results.push({ name, result: 'PASS' });
}

try {
  await command('seed_rep');
  await test('disabled initiation and hidden status are safe', async () => {
    const start = await fetch(`${base}/create-woocommerce-payment-session`, {
      method: 'POST', headers: { origin: 'https://staging.pepscriptrx.invalid', 'content-type': 'application/json' },
      body: JSON.stringify({ payment_token: 'x'.repeat(32) }),
    });
    assert.equal(start.status, 503);
    assert.equal((await start.json()).code, 'bridge_disabled');
    const status = await fetch(`${base}/woocommerce-payment-status`, {
      method: 'POST', headers: { origin: 'https://staging.pepscriptrx.invalid', 'content-type': 'application/json' },
      body: JSON.stringify({ payment_token: 'y'.repeat(32) }),
    });
    assert.deepEqual(await status.json(), { status: 'not_started' });
  });
  await test('unauthorized, invalid HMAC, unknown key and expired callbacks reject', async () => {
    const f = await fixture(false);
    assert.equal((await fetch(`${base}/woocommerce-payment-callback`, { method: 'POST', body: '{}' })).status, 401);
    assert.equal((await callback(f, 'paid', 'evt-invalid-signature', { signature: '00'.repeat(32) })).status, 401);
    assert.equal((await callback(f, 'paid', 'evt-unknown-key', { keyId: 'unknown-key' })).status, 401);
    assert.equal((await callback(f, 'paid', 'evt-expired', { timestamp: Math.floor(Date.now()/1000)-600 })).status, 400);
    assert.equal((await command('snapshot', { id: f.id })).status, 'payment_sent');
  });
  await test('approval finalizes once; sequential replay is idempotent', async () => {
    const f=await fixture();
    assert.equal((await callback(f,'paid','evt-approval')).status,200);
    assert.equal((await callback(f,'paid','evt-approval')).status,200);
    const s=await command('snapshot',{id:f.id});
    assert.deepEqual([s.status,Number(s.events),Number(s.commissions),Number(s.wallet_entries),Number(s.audits),Number(s.notifications),s.inventory_marker,s.promo_use_marker],
      ['paid',1,2,2,1,1,7,3]);
    assert.equal((await command('session_snapshot',{token_hash:hex(f.token)})).status,'paid');
  });
  await test('concurrent replay is idempotent', async () => {
    const f=await fixture();
    const responses=await Promise.all([1,2,3].map(()=>callback(f,'paid','evt-concurrent')));
    assert.ok(responses.every(r=>r.status===200));
    const s=await command('snapshot',{id:f.id});
    assert.deepEqual([Number(s.events),Number(s.commissions),Number(s.wallet_entries),Number(s.notifications)],[1,2,2,1]);
  });
  await test('decline, failure, pending, on-hold and unpaid cancellation do not finalize', async () => {
    for(const [name,status] of [['decline','declined'],['failure','failed'],['pending','awaiting_payment'],['onhold','payment_processing'],['cancel','cancelled']]){
      const f=await fixture(false); assert.equal((await callback(f,status,`evt-${name}`)).status,200);
      assert.equal((await command('snapshot',{id:f.id})).status,'payment_sent');
    }
  });
  await test('amount and currency mismatches fail closed', async () => {
    for(const options of [{amount:9499},{currency:'EUR'}]){
      const f=await fixture(false); assert.equal((await callback(f,'paid',randomUUID(),options)).status,409);
      assert.equal((await command('snapshot',{id:f.id})).status,'payment_sent');
      assert.equal((await command('session_snapshot',{token_hash:hex(f.token)})).status,'reconciliation_required');
    }
  });
  await test('conflicting references and late failure do not regress paid order', async () => {
    const a=await fixture(false), b=await fixture(false);
    assert.equal((await callback(a,'paid','evt-reference',{transaction:'tx-shared'})).status,200);
    assert.equal((await callback(b,'paid','evt-reference',{transaction:'tx-other'})).status,409);
    assert.equal((await callback(b,'paid','evt-reference-other',{transaction:'tx-shared'})).status,409);
    assert.equal((await callback(a,'failed','evt-late-failure',{transaction:'tx-shared'})).status,200);
    assert.equal((await command('snapshot',{id:a.id})).status,'paid');
    assert.equal((await command('session_snapshot',{token_hash:hex(a.token)})).status,'paid');
  });
  await test('refunds, partial refunds, voids and disputes reconcile once', async () => {
    for(const status of ['refunded','partially_refunded','voided','disputed','chargeback']){
      const f=await fixture(); await callback(f,'paid',`evt-paid-${status}`);
      await callback(f,status,`evt-${status}`,{reversed:status==='partially_refunded'?2500:9500});
      await callback(f,status,`evt-${status}`,{reversed:status==='partially_refunded'?2500:9500});
      const s=await command('snapshot',{id:f.id});
      assert.equal(Number(s.reconciliations),1);
      assert.deepEqual([Number(s.commissions),Number(s.wallet_entries),s.inventory_marker,s.promo_use_marker],[2,2,7,3]);
    }
  });
  console.log(JSON.stringify({project_ref:'yjexrleubnjuitiyjvoy',results},null,2));
} finally {
  await command('cleanup').catch(()=>{});
  await sql.end();
}
