import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { PDFDocument } from 'pdf-lib';
import { agreementPdf, type ReferralAgreement } from '../src/lib/referralAgreements.ts';

const admin = '10000000-0000-0000-0000-000000000001';
const referrer = '10000000-0000-0000-0000-000000000002';
const other = '10000000-0000-0000-0000-000000000003';
const scoped = '10000000-0000-0000-0000-000000000004';
const order1 = '20000000-0000-0000-0000-000000000001';
const order2 = '20000000-0000-0000-0000-000000000002';

test('private referral agreement database workflow and accounting', async t => {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
    grant usage on schema auth to authenticated,anon;
    create table public.profiles(id uuid,auth_user_id uuid,role text,brand_id text,store_slug text,admin_scope text);
    create table public.patient_submissions(id uuid primary key,email text,created_at timestamptz default now(),status text default 'paid');
    grant select on public.patient_submissions to authenticated;
    insert into auth.users values ('${admin}','admin@example.com',now()),('${referrer}','referrer@example.com',now()),('${other}','other@example.com',now()),('${scoped}','scoped@example.com',now());
    insert into public.profiles(id,auth_user_id,role) values ('${admin}','${admin}','admin'),('${referrer}','${referrer}','rep'),('${other}','${other}','patient');
    insert into public.profiles values ('${scoped}','${scoped}','admin','partner','partner','partner');
  `);
  const helpers = readFileSync(new URL('../supabase/migrations/20260712120000_global_admin_cross_store_visibility.sql', import.meta.url), 'utf8');
  await db.exec(helpers.slice(0, helpers.indexOf('create or replace function public.my_role')));
  await db.exec(readFileSync(new URL('../supabase/migrations/20261007120000_private_referral_agreements.sql', import.meta.url), 'utf8'));
  await db.exec(`insert into referral_accounts(name,email) values ('Test Referrer','referrer@example.com');
    insert into referral_agreements(account_id,version) select id,1 from referral_accounts;
    update referral_agreements a set terms=referral_contract_text(a);`);
  await db.exec(readFileSync(new URL('../supabase/migrations/20261007123000_private_referral_recipient_data.sql', import.meta.url), 'utf8'));
  async function login(id: string, method = 'otp', age = 0) {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)`, [id, JSON.stringify({ amr: [{ method, timestamp: Math.floor(Date.now() / 1000) - age }] })]);
    await db.exec('set role authenticated');
  }
  async function action(name: string, data: object = {}) {
    const r = await db.query<{ result: Record<string, unknown> }>('select public.referral_admin($1,$2::jsonb) result', [name, JSON.stringify(data)]);
    return r.rows[0].result;
  }
  async function sign(id: string, token: string, name: string | null = null, consent = false, hash: string | null = null) {
    const r = await db.query<{ result: ReferralAgreement }>('select public.referral_signer($1,$2,$3,$4,$5) result', [id, token, name, consent, hash]);
    return r.rows[0].result;
  }
  let a: Record<string, unknown>;
  let token: string;
  await t.test('private tables reject anonymous, scoped, and non-admin access', async () => {
    for (const id of [other, scoped, referrer]) {
      await login(id);
      assert.equal((await db.query('select * from referral_agreements')).rows.length, 0);
      await assert.rejects(action('new_draft'), /Platform administrator/);
      await assert.rejects(db.exec("update referral_agreements set company_name='hacked'"), /permission denied/);
    }
    await db.exec('reset role; set role anon');
    await assert.rejects(action('new_draft'), /permission denied/);
    await assert.rejects(db.exec('select * from referral_signing_links'), /permission denied/);
  });
  await t.test('draft includes terms and issuance requires completed review', async () => {
    await login(admin);
    a = (await db.query<Record<string, unknown>>('select * from referral_agreements')).rows[0];
    assert.match(String(a.terms), /50%/); assert.match(String(a.terms), /repeat orders/);
    await assert.rejects(action('issue', { id: a.id, revision: a.revision, confirmed: true }), /Confirm the legal entity/);
    a = await action('save', { id: a.id, revision: a.revision, company_name: 'Example Operator LLC', payout_schedule: 'Monthly on the 15th by bank transfer for the prior month.', termination_terms: 'Either party may terminate by written notice. Commissions on all previously introduced customers continue indefinitely on all future orders.', contact_email: 'agreements@example.com' });
    await assert.rejects(action('issue', { id: a.id, revision: 0, confirmed: true }), /Version changed/);
    await assert.rejects(action('issue', { id: a.id, revision: a.revision }), /Confirm/);
    a = await action('issue', { id: a.id, revision: a.revision, confirmed: true }); token = String(a.token);
    assert.equal(token.length, 64); assert.equal(String(a.terms_hash).length, 64);
    await assert.rejects(action('save', { ...a }), /Only drafts/);
    const audit = await db.query('select detail from referral_audit');
    assert.ok(!JSON.stringify(audit.rows).includes(token));
  });
  await t.test('signing needs the link, intended email, fresh verification, and exact-text consent', async () => {
    await login(other); await assert.rejects(sign(String(a.id), token), /unavailable/);
    await login(referrer, 'password'); await assert.rejects(sign(String(a.id), token), /fresh code/);
    await login(referrer, 'otp', 3600); await assert.rejects(sign(String(a.id), token), /fresh code/);
    await login(referrer); await assert.rejects(sign(String(a.id), 'bad-token'), /unavailable/);
    assert.equal((await sign(String(a.id), token)).id, a.id);
    await assert.rejects(sign(String(a.id), token, 'Test Referrer', false, String(a.terms_hash)), /Consent/);
    await assert.rejects(sign(String(a.id), token, 'Someone Else', true, String(a.terms_hash)), /Consent/);
    await assert.rejects(sign(String(a.id), token, 'Test Referrer', true, 'changed'), /Consent/);
    await db.exec('reset role');
    await db.exec("update referral_signing_links set expires_at=now()-interval '1 second'");
    await login(referrer); await assert.rejects(sign(String(a.id), token), /expired/);
    await login(admin); a = await action('rotate_link', { id: a.id, revision: a.revision, confirmed: true });
    await login(referrer); await assert.rejects(sign(String(a.id), token), /unavailable/);
    token = String(a.token);
    const signed = await sign(String(a.id), token, 'Test Referrer', true, String(a.terms_hash));
    assert.equal(signed.status, 'partner_signed'); assert.ok(signed.partner_signed_at);
    a = { ...signed };
    await assert.rejects(sign(String(a.id), token, 'Test Referrer', true, String(a.terms_hash)), /unavailable/);
    assert.equal((await sign(String(a.id), '')).status, 'partner_signed');
  });
  await t.test('company countersigns; signed versions and audit are immutable; PDF is retained-text verifiable', async () => {
    await login(admin);
    await assert.rejects(action('void', { id: a.id, revision: a.revision }), /signature already/);
    await assert.rejects(action('countersign', { id: a.id, revision: a.revision, signature: 'Company Signer' }), /consent required/);
    a = await action('countersign', { id: a.id, revision: a.revision, signature: 'Company Signer', consent: true });
    assert.equal(a.status, 'signed');
    await db.exec('reset role');
    await assert.rejects(db.exec("update referral_agreements set terms='tampered'"), /immutable/);
    await assert.rejects(db.exec('delete from referral_agreements'), /immutable/);
    await assert.rejects(db.exec('delete from referral_audit'), /immutable/);
    const pdf = await agreementPdf(a as unknown as ReferralAgreement);
    assert.equal(new TextDecoder().decode(pdf.slice(0, 5)), '%PDF-');
    assert.ok((await PDFDocument.load(pdf)).getPageCount() >= 2);
    await assert.rejects(agreementPdf({ ...a, terms: 'tampered' } as unknown as ReferralAgreement), /integrity/);
    await login(other); await assert.rejects(sign(String(a.id), token), /unavailable/);
    await login(referrer, 'password'); assert.equal((await sign(String(a.id), '')).status, 'signed');
  });
  await t.test('introduced customers retain attribution for direct repeat orders; earlier and unrelated orders excluded', async () => {
    await login(admin);
    await action('attribute', { email: ' BUYER@example.com ', introduced_at: '2026-01-01', evidence: 'Introduced by Test Referrer, written introduction.' });
    await assert.rejects(action('attribute', { email: 'buyer@example.com', introduced_at: '2026-01-01', evidence: 'Duplicate' }), /unique/);
    await db.exec('reset role');
    await db.exec(`insert into patient_submissions(id,email,created_at) values
      ('${order1}','buyer@example.com','2026-02-01'),('${order2}','BUYER@example.com','2026-03-01'),
      (gen_random_uuid(),'buyer@example.com','2025-01-01'),(gen_random_uuid(),'unrelated@example.com','2026-03-01');`);
    await login(admin);
    const rows = (await db.query('select * from referral_order_review')).rows;
    assert.equal(rows.length, 2); assert.ok(rows.every(r => r.commission === null));
  });
  const financials = { order_id: order1, collected_gross: 220, sales_tax: 20, product_cost: 60, processing_fees: 6, company_shipping: 10, cash_loss: 0, evidence: 'Processor settlement, invoice, and postage reconciled.', confirmed: true };
  await t.test('50% net profit excludes tax and costs; repeats earn the same commission', async () => {
    await login(admin);
    const first = await action('reconcile', { ...financials, agreement_id: a.id, revision: 0 });
    assert.equal(Number(first.commission_adjustment), 62);
    const repeat = await action('reconcile', { ...financials, order_id: order2, agreement_id: a.id, revision: 0 });
    assert.equal(Number(repeat.commission_adjustment), 62);
    await assert.rejects(action('reconcile', { ...financials, agreement_id: a.id, revision: 0 }), /Financials changed/);
    await assert.rejects(action('reconcile', { ...financials, agreement_id: a.id, revision: 1, sales_tax: 221 }), /check constraint/);
  });
  await t.test('refund/chargeback reconciliation is cumulative, idempotent, reversible and may produce negative adjustments', async () => {
    let result = await action('reconcile', { ...financials, agreement_id: a.id, revision: 1, cash_loss: 80 });
    assert.equal(Number(result.commission_adjustment), -40);
    // Same economic loss reported as both refund and chargeback stays 80 total.
    result = await action('reconcile', { ...financials, agreement_id: a.id, revision: 2, cash_loss: 80 });
    assert.equal(Number(result.commission_adjustment), 0);
    result = await action('reconcile', { ...financials, agreement_id: a.id, revision: 3, cash_loss: 30 });
    assert.equal(Number(result.commission_adjustment), 25);
    result = await action('reconcile', { ...financials, agreement_id: a.id, revision: 4, cash_loss: 200 });
    assert.equal(Number(result.commission_adjustment), -85);
    assert.equal(Number((result.after as Record<string, unknown>).commission), -38);
    await assert.rejects(action('reconcile', { ...financials, agreement_id: a.id, revision: 5, cash_loss: 220 }), /check constraint/);
  });
  await t.test('payouts cannot exceed the ledger; references prevent duplicates and history is immutable', async () => {
    await assert.rejects(action('record_payout', { amount: 25, reference: 'bank-1', paid_at: '2026-01-01' }), /exceeds/);
    await action('record_payout', { amount: 10, reference: 'bank-1', paid_at: '2026-01-01' });
    await assert.rejects(action('record_payout', { amount: 10, reference: 'bank-1', paid_at: '2026-01-01' }), /unique/);
    await db.exec('reset role');
    await assert.rejects(db.exec('delete from referral_payouts'), /immutable/);
  });
  await t.test('changed source orders return to review and block payouts until reconciled', async () => {
    await db.exec('reset role');
    await db.exec(`update patient_submissions set status='cancelled_refunded' where id='${order2}'`);
    await login(admin);
    const review = await db.query<{ needs_review: boolean }>('select needs_review from referral_order_review where order_id=$1', [order2]);
    assert.equal(review.rows[0].needs_review, true);
    await assert.rejects(action('record_payout', { amount: 1, reference: 'bank-2', paid_at: '2026-01-01' }), /changed after reconciliation/);
    await action('reconcile', { ...financials, order_id: order2, agreement_id: a.id, revision: 1 });
    assert.equal((await db.query<{ needs_review: boolean }>('select needs_review from referral_order_review where order_id=$1', [order2])).rows[0].needs_review, false);
  });
  await t.test('unverified email and signed record access through a different identity fail closed', async () => {
    await db.exec('reset role');
    await db.exec(`update auth.users set email_confirmed_at=null where id='${referrer}'`);
    await login(referrer); await assert.rejects(sign(String(a.id), ''), /unavailable/);
    await db.exec('reset role');
    await db.exec(`update auth.users set email_confirmed_at=now(),email='changed@example.com' where id='${referrer}'`);
    await login(referrer); await assert.rejects(sign(String(a.id), ''), /unavailable/);
  });
  await db.close();
});
