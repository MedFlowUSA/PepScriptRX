import { PGlite } from '../artifacts/purepeptidelabs/verification/node_modules/@electric-sql/pglite/dist/index.js';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const db = new PGlite();

try {
  await db.exec(`
    create table aactivated_promo_links (
      id uuid default gen_random_uuid(), link_slug text unique, store_scope_code text,
      promo_title text, discount_code text, discount_amount numeric, discount_type text,
      discount_percent numeric, promo_kind text, is_active boolean, rep_id uuid, rep_slug text,
      requires_platform_approval boolean, approval_status text, approved_at timestamptz,
      updated_at timestamptz, created_at timestamptz default now(), product_id text,
      starts_at timestamptz, expires_at timestamptz, usage_limit integer,
      uses_count integer default 0, min_subtotal numeric default 0
    );
    create table patient_submissions (
      id integer generated always as identity, discount_code text, checkout_scope_code text,
      order_type text, quoted_price numeric, shipping_cost numeric, order_total numeric,
      discount_amount numeric, discount_cents integer, subtotal_cents integer,
      amount_due_cents integer, promo_discount_percent numeric, promo_rep_slug text,
      commission_basis_amount numeric, final_customer_paid_amount numeric, order_items jsonb,
      source_portal text, source_store text, store_slug text, store_name text,
      admin_code text, source_admin text, source_rep text
    );
  `);

  const base = readFileSync('supabase/migrations/20260625014500_billy_rep50_internal_discount.sql', 'utf8');
  await db.exec(base.slice(base.indexOf('create or replace function public.apply_aactivated_server_promo_to_submission()')));
  await db.exec(readFileSync('supabase/migrations/20261002001000_pure25_customer_discount.sql', 'utf8'));

  const migration = readFileSync('supabase/migrations/20261005010000_ginto_kathy30_customer_discount.sql', 'utf8');
  await db.exec(migration);
  await db.exec(migration);

  const insert = (code = 'KATHY30', scope = 'GINTO', kind = 'CUSTOMER_ORDER', total = 299, shipping = 25) => db.query(
    'insert into patient_submissions(discount_code,checkout_scope_code,order_type,quoted_price,shipping_cost) values($1,$2,$3,$4,$5) returning *',
    [code, scope, kind, total, shipping],
  );

  const row = (await insert()).rows[0];
  assert.equal(Number(row.discount_amount), 89.7);
  assert.equal(Number(row.order_total), 234.3);
  assert.equal(row.amount_due_cents, 23430);
  assert.equal(Number(row.commission_basis_amount), 209.3);
  assert.equal((await db.query("select uses_count from aactivated_promo_links where discount_code='KATHY30'")).rows[0].uses_count, 1);

  for (const scope of ['GLOW', 'AACTIVATED', 'PUREPEPTIDELABS', '']) {
    await assert.rejects(insert('KATHY30', scope), /valid only for Ginto/);
  }
  await assert.rejects(insert('KATHY30+BUNDLE'), /cannot be combined/);
  await assert.rejects(insert('KATHY30', 'GINTO', 'REP_INTERNAL'), /valid only for Ginto/);
  assert.equal(Number((await insert(' kathy30 ', 'GINTO', 'CUSTOMER_ORDER', 100.01, 0)).rows[0].discount_amount), 30);

  for (const condition of [
    'is_active=false',
    "expires_at=now()-interval '1 day'",
    "starts_at=now()+interval '1 day'",
    'usage_limit=0',
    'min_subtotal=1000',
    "requires_platform_approval=true,approval_status='pending'",
  ]) {
    await db.exec(`update aactivated_promo_links set ${condition} where discount_code='KATHY30'`);
    await assert.rejects(insert(), /not available/);
    await db.exec(migration);
  }

  await insert('UNRELATED', 'GLOW');
  console.log('PASS: KATHY30 is 30% off Ginto customer product subtotal; shipping, scope, stacking, usage and availability guards passed.');
} finally {
  await db.close();
}
