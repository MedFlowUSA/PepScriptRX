// Isolated PostgreSQL verification. Dependency installed only in artifacts; no live DB access.
import { PGlite } from '../artifacts/purepeptidelabs/verification/node_modules/@electric-sql/pglite/dist/index.js';
import { readFileSync, writeFileSync } from 'node:fs';
import assert from 'node:assert/strict';
const db = new PGlite();
const read = (name) => readFileSync(`supabase/migrations/${name}`, 'utf8');
try {
  await db.exec(`
    create table distributors (id uuid primary key default gen_random_uuid(), name text,slug text unique,portal_name text,commission_rate numeric,is_active boolean,white_label_enabled boolean,wholesale_enabled boolean,updated_at timestamptz);
    create table partner_brands (brand_id text primary key,store_slug text unique,store_name text,scope_code text,owner_email text,access_level text,logo_url text,colors jsonb,hero_text text,custom_url text,status text,capabilities jsonb,pricing_guardrails jsonb,updated_at timestamptz);
    create table reps (id uuid primary key default gen_random_uuid(),profile_id uuid,rep_name text,handle text,rep_identifier text,rep_slug text unique,commission_type text,commission_rate numeric,override_percent numeric,platform_percent numeric,rep_tier text,discount_code text,discount_amount numeric,referral_path text,attribution_locked boolean,attribution_window_days integer,payout_email text,rep_channel text,managed_by_profile_id uuid,parent_rep_id uuid,custom_store_slug text,brand_name text,brand_id text,parent_brand_id text,assigned_store_slug text,account_type text,parent_type text,active boolean,updated_at timestamptz);
    create table checkout_scopes (id uuid primary key default gen_random_uuid(),scope_code text unique,display_name text,account_type text,account_id text,parent_account_id text,is_active boolean,default_commission_rate numeric,notes text,updated_at timestamptz);
    create table partner_marketing_assets (brand_id text,store_slug text,asset_name text,asset_type text,storage_path text,public_url text,metadata jsonb);
    create table patient_submissions (cost_of_goods numeric,order_type text,checkout_scope_id uuid,checkout_scope_code text,rep_id uuid);
    create table provider_payment_events (id uuid,event_fingerprint text,order_id uuid);
    create table rx_plus_products (id uuid primary key,sku text,active boolean,visibility_type text,partner_slug text);
    create table distributor_products (product_id uuid,distributor_id uuid,is_enabled boolean,enabled boolean,custom_price numeric,custom_retail_price numeric);
    insert into reps (rep_name,rep_slug,commission_rate,override_percent,platform_percent,brand_id) values ('Unrelated owner','EXISTING50',.5,0,.5,'existing');
  `);
  const before = (await db.query("select row_to_json(r) snapshot from reps r where rep_slug='EXISTING50'")).rows;
  const source = read('20260731010000_shared_paid_order_finalizer.sql');
  const finalizerStart = source.indexOf('create or replace function public.finalize_verified_paid_order(');
  await db.exec(source.slice(finalizerStart, source.indexOf('$$;', finalizerStart) + 3));
  const seed = read('20260928190000_pure_peptide_labs_direct_store.sql');
  await db.exec(seed);
  await db.exec(seed); // Idempotency: no duplicate owners or marketing assets.
  assert.deepEqual((await db.query("select row_to_json(r) snapshot from reps r where rep_slug='EXISTING50'")).rows, before);
  const lily = (await db.query("select * from reps where rep_slug='LILY60'")).rows[0];
  assert.equal(lily.profile_id, null); assert.equal(lily.payout_email, null);
  assert.equal(lily.parent_rep_id, null); assert.equal(lily.parent_brand_id, null);
  assert.equal(Number(lily.commission_rate), .6);
  assert.equal((await db.query('select * from partner_marketing_assets')).rows.length, 3);
  assert.equal((await db.query('select * from distributor_products')).rows.length, 0);

  // Execute the existing finalizer's actual commission SQL, unchanged, with fixture orders.
  // This covers its branching, rates, rounding, shipping exclusion, and margin floor.
  const start = source.indexOf('    create temporary table if not exists pg_temp.finalizer_commission_rows(');
  const end = source.indexOf('      for v_row in select * from pg_temp.finalizer_commission_rows', start);
  assert.ok(start > 0 && end > start);
  const block = source.slice(start, end);
  await db.exec(`create function test_commission(total numeric,discount numeric,cost numeric,shipping numeric,scope text,kind text default 'CUSTOMER_ORDER')
    returns jsonb language plpgsql as $$ declare
      v_order patient_submissions%rowtype; v_scope checkout_scopes%rowtype; v_rep reps%rowtype; v_parent reps%rowtype;
      v_product_total numeric:=total; v_discount numeric:=discount; v_shipping numeric:=shipping;
      v_cogs numeric; v_gross numeric; v_profit numeric; v_rate numeric; v_override numeric; v_platform numeric;
      v_scope_amount numeric; v_platform_amount numeric; v_has_scope boolean:=false; result jsonb;
    begin
      v_order.cost_of_goods:=cost; v_order.order_type:=kind; v_order.checkout_scope_code:=scope;
      ${block}
      end if;
      select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) into result from pg_temp.finalizer_commission_rows r;
      return result;
    end $$;`);
  const cases = [
    { total: 200, discount: 20, cost: 50, shipping: 25, owner: 78, platform: 52 },
    { total: 200, discount: 20, cost: 50, shipping: 0, owner: 78, platform: 52 },
    { total: 50, discount: 10, cost: 70, shipping: 25, owner: 0, platform: 0 },
    { total: 100.01, discount: 0, cost: 0, shipping: 0, owner: 60.01, platform: 40 },
  ];
  for (const c of cases) {
    const result = (await db.query('select test_commission($1,$2,$3,$4,$5) result', [c.total,c.discount,c.cost,c.shipping,'PUREPEPTIDELABS'])).rows[0].result;
    assert.equal(result.length, 2);
    assert.equal(result.find((r) => r.commission_role === 'rep_commission_owner').commission_amount, c.owner);
    assert.equal(result.find((r) => r.commission_role === 'platform_margin_owner').commission_amount, c.platform);
    assert.ok(!result.some((r) => r.commission_role === 'override_owner'));
  }
  const internal = (await db.query("select test_commission(200,0,50,0,'PUREPEPTIDELABS','REP_INTERNAL') result")).rows[0].result;
  assert.deepEqual(internal, []);

  // Compile the actual existing RPC, then apply and reapply the new scoped patch.
  // PostgreSQL resolves other RPC dependencies lazily; no original RPC is invoked here.
  const core = read('20260717110000_fix_aactivated_cart_submission_pricing.sql');
  await db.exec(core.slice(core.indexOf('create or replace function'), core.indexOf('\nrevoke ') > 0 ? core.indexOf('\nrevoke ') : core.length));
  const patch = read('20260928191000_pure_peptide_labs_checkout_catalog.sql');
  await db.exec(patch); await db.exec(patch);
  const patched = (await db.query("select pg_get_functiondef('create_public_patient_submission(jsonb)'::regprocedure) fn")).rows[0].fn;
  assert.ok(patched.includes("when v_scope_code = 'PUREPEPTIDELABS' then 'purepeptidelabs'"));
  const guard = patched.slice(patched.indexOf('-- Pure Peptide Labs explicit catalog guard'), patched.indexOf('if v_aactivated_store_slug is not null then', patched.indexOf('-- Pure Peptide Labs explicit catalog guard')));
  await db.exec(`create function test_catalog(v_item_id text,v_item_sku text,v_distributor_slug text default 'purepeptidelabs') returns boolean language plpgsql as $$ begin ${guard} return true; end $$;`);
  await assert.rejects(db.query("select test_catalog('unpublished','UNKNOWN')"), /not published/);
  await db.exec("insert into rx_plus_products values ('00000000-0000-4000-8000-000000000001','TEST',true,'rx_plus',null); insert into distributor_products select '00000000-0000-4000-8000-000000000001',id,true,true,125,150 from distributors where slug='purepeptidelabs';");
  assert.equal((await db.query("select test_catalog('00000000-0000-4000-8000-000000000001','TEST') ok")).rows[0].ok, true);
  for (const mutation of ["enabled=false", "custom_price=null,custom_retail_price=null", "is_enabled=false"]) {
    await db.exec('begin; update distributor_products set '+mutation+';');
    await assert.rejects(db.query("select test_catalog('00000000-0000-4000-8000-000000000001','TEST')"), /not published/);
    await db.exec('rollback;');
  }
  assert.equal((await db.query("select test_catalog('unpublished','UNKNOWN','existing-store') ok")).rows[0].ok, true);
  const report = { ok: true, migration: 'applies and reapplies in isolated PostgreSQL', identitiesCreated: 0, catalogInitiallyEmpty: true, unrelatedOwnerUnchanged: true, commissionCases: cases, internalOrdersExcluded: true, scopedCatalogGuard: 'passed', limitation: 'Schema fixtures; no live migration or payment executed.' };
  writeFileSync('artifacts/purepeptidelabs/sql-verification.json', JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally { await db.close(); }
