import assert from 'node:assert/strict';
import postgres from 'postgres';

const connection = process.env.PSRX_STAGING_TEST_DATABASE_URL;
if (!connection) throw new Error('Missing ephemeral staging test connection');
const sql = postgres(connection, { max: 8, ssl: 'require', prepare: false });
const results = [];
const uid = () => crypto.randomUUID();

async function command(action, payload = {}) {
  const [row] = await sql`select staging_bridge_test_command(${action},${sql.json(payload)}) value`;
  return row.value;
}
async function order(withRep = false) {
  const id = uid();
  await command('create_order', { id, with_rep: withRep });
  return id;
}
async function finalize(id, event, tx, amount = 9500, currency = 'USD', provider = 'stripe') {
  const [row] = await sql`select finalize_verified_paid_order(
    ${provider},${event},${`order-${id}`},${tx},${id},${amount},${currency},now(),'{}'::jsonb) value`;
  return row.value;
}
async function test(name, fn) {
  await fn();
  results.push({ name, result: 'PASS' });
}

try {
  await command('seed_rep');
  await test('successful finalization and duplicate callback', async () => {
    const id = await order(true);
    assert.equal((await finalize(id,'evt-success','tx-success')).result,'finalized');
    assert.equal((await finalize(id,'evt-success','tx-success')).result,'already_finalized');
    const s = await command('snapshot',{id});
    assert.deepEqual(
      { status:s.status,payment_status:s.payment_status,payment_provider:s.payment_provider,
        inventory_marker:s.inventory_marker,promo_use_marker:s.promo_use_marker,
        events:Number(s.events),commissions:Number(s.commissions),wallet_entries:Number(s.wallet_entries),
        audits:Number(s.audits),notifications:Number(s.notifications) },
      { status:'paid',payment_status:'paid',payment_provider:'stripe',inventory_marker:7,promo_use_marker:3,
        events:1,commissions:2,wallet_entries:2,audits:1,notifications:1 });
    assert.equal(Number(s.pending_balance),65);
    assert.equal(Number(s.lifetime_earned),65);
  });
  await test('concurrent duplicate callbacks', async () => {
    const id=await order(true);
    const r=await Promise.all([1,2,3].map(()=>finalize(id,'evt-concurrent','tx-concurrent')));
    assert.equal(r.filter(x=>x.result==='finalized').length,1);
    assert.equal(r.filter(x=>x.result==='already_finalized').length,2);
    const s=await command('snapshot',{id});
    assert.deepEqual(
      [Number(s.events),Number(s.commissions),Number(s.wallet_entries),Number(s.audits),Number(s.notifications)],
      [1,2,2,1,1]);
  });
  await test('conflicting event and transaction references', async () => {
    const a=await order(), b=await order();
    assert.equal((await finalize(a,'evt-conflict','tx-conflict')).result,'finalized');
    assert.equal((await finalize(b,'evt-conflict','tx-other')).result,'conflicting_provider_reference');
    assert.equal((await finalize(b,'evt-other','tx-conflict')).result,'conflicting_provider_reference');
    assert.equal(Number((await command('snapshot',{id:b})).reconciliations),2);
  });
  await test('amount and currency mismatches fail closed', async () => {
    const id=await order();
    assert.equal((await finalize(id,'evt-amount','tx-amount',9499)).result,'amount_mismatch');
    assert.equal((await finalize(id,'evt-currency','tx-currency',9500,'EUR')).result,'currency_mismatch');
    assert.equal((await command('snapshot',{id})).status,'payment_sent');
  });
  await test('already-paid and late events do not regress state', async () => {
    const id=await order();
    assert.equal((await finalize(id,'evt-paid','tx-paid')).result,'finalized');
    assert.equal((await finalize(id,'evt-late','tx-paid')).result,'already_finalized');
    assert.equal((await finalize(id,'evt-provider','tx-paypal',9500,'USD','paypal')).result,'conflicting_provider_reference');
    const s=await command('snapshot',{id});
    assert.equal(s.status,'paid'); assert.equal(s.payment_provider,'stripe');
  });
  await test('atomic rollback', async () => {
    const id=await order(true);
    await command('set_rollback_failure',{id});
    await assert.rejects(()=>finalize(id,'evt-rollback','tx-rollback'),/forced audit failure/);
    await command('set_rollback_failure',{id:''});
    const s=await command('snapshot',{id});
    assert.deepEqual([s.status,Number(s.events),Number(s.commissions),Number(s.wallet_entries),Number(s.notifications)],
      ['payment_sent',0,0,0,0]);
  });
  await test('refund, partial refund, cancellation, void, dispute and chargeback reconciliation', async () => {
    const id=await order();
    for(const type of ['refund','partial_refund','cancellation','void','dispute','chargeback']){
      for(let n=0;n<2;n++) await sql`select record_payment_reconciliation_event(
        'woocommerce',${`evt-${type}`},${`tx-${type}`},${id},${type},9500,
        ${type==='partial_refund'?2500:9500},'USD',now(),'{}'::jsonb)`;
    }
    const s=await command('snapshot',{id});
    assert.equal(Number(s.reconciliations),6);
    assert.deepEqual([s.status,s.inventory_marker,s.promo_use_marker],['payment_sent',7,3]);
  });
  console.log(JSON.stringify({project_ref:'yjexrleubnjuitiyjvoy',results},null,2));
} finally {
  await command('cleanup').catch(()=>{});
  await sql.end();
}
