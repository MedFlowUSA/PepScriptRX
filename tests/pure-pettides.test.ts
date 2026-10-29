import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { purePetCommissionExample } from '../src/lib/purePetTidesCommission.ts';

test('Pure PetTides preserves direct-margin commission examples with no override', () => {
  assert.deepEqual(purePetCommissionExample(100, 0, 20), { margin: 80, lily: 52, override: 0, platform: 28 });
  assert.deepEqual(purePetCommissionExample(100, 0, 0), { margin: 100, lily: 65, override: 0, platform: 35 });
  assert.deepEqual(purePetCommissionExample(100, 10, 20), { margin: 70, lily: 45.5, override: 0, platform: 24.5 });
  assert.deepEqual(purePetCommissionExample(100, 100, 20), { margin: 0, lily: 0, override: 0, platform: 0 });
});

test('Pure PetTides enforces preview, permissions, shared review, and isolated attribution in PostgreSQL', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated;
      grant usage on schema public to anon,authenticated;
      create function is_platform_admin() returns boolean language sql stable as $$select coalesce(current_setting('test.admin',true),'false')='true'$$;
      create table reps(id uuid primary key default gen_random_uuid(),rep_slug text unique,rep_name text,brand_id text,commission_rate numeric,override_percent numeric,platform_percent numeric,parent_rep_id uuid,parent_brand_id text,managed_by_profile_id uuid);
      insert into reps(rep_slug,rep_name,brand_id,commission_rate,override_percent,platform_percent) values('LILY60','Lily Graham','purepeptidelabs',.65,0,.35);
      create table checkout_scopes(scope_code text primary key,display_name text,account_type text,account_id text,parent_account_id text,is_active boolean,default_commission_rate numeric,notes text);
      insert into checkout_scopes values('PUREPEPTIDELABS','Pure Peptide Labs','rep','LILY60',null,true,.65,'Unchanged original');
      create table partner_brands(brand_id text primary key,store_slug text,store_name text,scope_code text,owner_email text,access_level text,logo_url text,colors jsonb,hero_text text,custom_url text,status text,capabilities jsonb,pricing_guardrails jsonb);
      insert into partner_brands(brand_id,store_slug,store_name,custom_url) values('purepeptidelabs','purepeptidelabs','Pure Peptide Labs','/purepeptidelabs');
      create function finalize_verified_paid_order_unlocked(text,text,text,text,uuid,integer,text,timestamptz,jsonb) returns void language plpgsql as $$begin
      -- v_profit:=greatest(0,v_product_total-v_discount-v_cogs); round(v_profit*v_rate,2)
      end$$;
      create table pettides_articles(slug text primary key,title text,category text,body text,sources text[],status text,reviewed_by uuid,reviewed_at timestamptz,source_verified boolean);
      insert into pettides_articles values('reviewed','Reviewed research','Understanding Research','Test-only reviewed content',array['https://example.org/research'],'published','00000000-0000-4000-8000-000000000001',now(),true),('draft','Draft','Research','Private draft',array['https://example.org'],'draft',null,null,false),('owner-only','Owner-only','Research','Owner authorization is not professional review',array['https://example.org'],'published',null,null,false);
      alter table pettides_articles enable row level security;
      create policy published_read on pettides_articles for select to anon using(status='published');
      grant select on pettides_articles to anon;
      create table portal_age_lead_captures(id uuid primary key default gen_random_uuid(),first_name text,email text,portal_id text,portal_name text,portal_path text,path text,age_confirmed boolean,created_at timestamptz default now());
      alter table portal_age_lead_captures enable row level security;
      grant select,insert on portal_age_lead_captures to anon,authenticated;
      create policy legacy_read on portal_age_lead_captures for select to authenticated using(true);
      create policy legacy_insert on portal_age_lead_captures for insert to anon,authenticated with check(true);
      create table patient_submissions(id uuid primary key default gen_random_uuid(),store_slug text,store_name text,brand_id text,source_store text,source_portal text,source_route text,checkout_scope_code text,product_id text,product_name text,medication text,order_items jsonb,selected_addons jsonb);
      create table fulfillment_orders(submission_id uuid);
      create table aactivated_promo_links(id uuid primary key default gen_random_uuid(),is_active boolean,store_scope_code text,promo_title text,discount_code text,discount_amount numeric,product_id text,link_slug text unique,notes text);
    `);
    const before = (await db.query('select to_jsonb(r) value from reps r')).rows;
    const beforeScope = (await db.query('select to_jsonb(s) value from checkout_scopes s')).rows;
    const beforeBrand = (await db.query('select to_jsonb(b) value from partner_brands b')).rows;
    const beforeArticles = (await db.query('select to_jsonb(a) value from pettides_articles a order by slug')).rows;
    await db.exec(readFileSync('supabase/migrations/20261029120000_pure_pettides_preview.sql', 'utf8'));
    assert.deepEqual((await db.query('select to_jsonb(r) value from reps r')).rows, before);
    assert.deepEqual((await db.query("select to_jsonb(s) value from checkout_scopes s where scope_code='PUREPEPTIDELABS'")).rows, beforeScope);
    assert.deepEqual((await db.query("select to_jsonb(b) value from partner_brands b where brand_id='purepeptidelabs'")).rows, beforeBrand);
    assert.deepEqual((await db.query('select to_jsonb(a) value from pettides_articles a order by slug')).rows, beforeArticles);
    const [scope] = (await db.query("select * from checkout_scopes where scope_code='PUREPETTIDES'")).rows;
    assert.equal(scope.account_id, 'LILY60'); assert.equal(scope.parent_account_id, null); assert.equal(scope.is_active, false); assert.equal(Number(scope.default_commission_rate), .65);
    await db.exec('set role anon');
    const products = (await db.query('select * from pure_pettides_public_concepts()')).rows;
    assert.equal(products.length, 4); assert(products.every(p => p.public_price === null));
    await assert.rejects(db.query('select provisional_price from pure_pettides_concepts'), /permission denied/);
    assert.deepEqual((await db.query('select slug from pure_pettides_library()')).rows, [{ slug: 'reviewed' }]);
    await assert.rejects(db.query("select pure_pettides_quote('[]')"), /not available for purchase/);
    await assert.rejects(db.query("select pure_pettides_join_interest('Contact','bad',true)"), /Valid contact/);
    await assert.rejects(db.query("select pure_pettides_join_interest('Contact','qa@example.org',false)"), /Valid contact/);
    await db.exec("select pure_pettides_join_interest('Contact','qa@example.org',true)");
    await assert.rejects(db.query("insert into portal_age_lead_captures(portal_id,email) values('pure-pettides','bypass@example.org')"), /row-level security/);
    await db.exec('reset role; set role authenticated');
    assert.equal((await db.query('select * from pure_pettides_concepts')).rows.length, 0);
    assert.equal((await db.query('select * from portal_age_lead_captures')).rows.length, 0);
    await assert.rejects(db.query('select pure_pettides_prepare_discount()'), /Platform administrator/);
    await db.exec("set test.admin='true'");
    assert.equal((await db.query('select * from pure_pettides_concepts')).rows.length, 4);
    assert.equal((await db.query('select * from portal_age_lead_captures')).rows.length, 1);
    await assert.rejects(db.query("update pure_pettides_concepts set active=true"), /check constraint/);
    await assert.rejects(db.query("update pure_pettides_concepts set purchasable=true"), /check constraint/);
    await assert.rejects(db.query("update pure_pettides_concepts set show_price=true"), /check constraint/);
    await db.exec("update pure_pettides_concepts set price_reviewed=true,show_price=true where slug='bpc-157'");
    assert.equal(Number((await db.query("select public_price from pure_pettides_public_concepts() where slug='bpc-157'")).rows[0].public_price), 129);
    await db.exec('select pure_pettides_prepare_discount(); reset role');
    await db.exec("set test.admin='true'; update aactivated_promo_links set is_active=true where store_scope_code='PUREPETTIDES'");
    assert.equal((await db.query('select is_active from aactivated_promo_links')).rows[0].is_active, false);
    await db.exec("update aactivated_promo_links set store_scope_code='MAIN',is_active=true");
    assert.equal((await db.query('select store_scope_code from aactivated_promo_links')).rows[0].store_scope_code, 'PUREPETTIDES');
    for (const [field, value] of [['store_slug', 'pure-pettides'], ['brand_id', 'pure_pettides'], ['checkout_scope_code', 'PUREPETTIDES'], ['source_route', '/pure-pettides/checkout'], ['product_name', 'Pure PetTides BPC-157']]) {
      await assert.rejects(db.query(`insert into patient_submissions(${field}) values('${value}')`), /not available for purchase/);
    }
    for (const payload of ['[{"id":"pure-pettides-bpc-157"}]', '[{"sku":"PUREPETTIDES-TB-500"}]', '[{"name":"Pure PetTides NAD+"}]']) {
      await assert.rejects(db.query(`insert into patient_submissions(store_slug,order_items) values('MAIN','${payload}')`), /not available for purchase/);
    }
    await db.exec("insert into patient_submissions(store_slug) values('purepeptidelabs'),('pettides')");
    assert.equal((await db.query('select * from patient_submissions')).rows.length, 2);
    await assert.rejects(db.query("update patient_submissions set selected_addons='[{\"id\":\"pure-pettides-nad-plus\"}]'"), /not available for purchase/);
    // A hypothetical historical row must not acquire fulfillment, even if inserted before the guard.
    await db.exec("alter table patient_submissions disable trigger aaa_pure_pettides_preview; insert into patient_submissions(store_slug) values('pure-pettides'); alter table patient_submissions enable trigger aaa_pure_pettides_preview");
    await assert.rejects(db.query("insert into fulfillment_orders select id from patient_submissions where store_slug='pure-pettides'"), /fulfillment is disabled/);
    await assert.rejects(db.query("update patient_submissions set store_slug='MAIN' where store_slug='pure-pettides'"), /not available for purchase/);
  } finally { await db.close(); }
});
