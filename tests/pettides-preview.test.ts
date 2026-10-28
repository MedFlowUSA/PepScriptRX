import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

test('PetTides enforces preview, privacy, role access and review transitions in PostgreSQL', async () => {
 const db = new PGlite();
 try {
  await db.exec(`create role anon; create role authenticated; grant usage on schema public to anon,authenticated;
   create schema auth; grant usage on schema auth to anon,authenticated;
   create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
   create function public.is_platform_admin() returns boolean language sql stable as $$ select coalesce(current_setting('test.admin',true),'false')='true' $$;
   create table portal_age_lead_captures(id uuid default gen_random_uuid(),first_name text,email text,portal_id text,portal_name text,portal_path text,path text,age_confirmed boolean);
   alter table portal_age_lead_captures enable row level security;
   grant select,insert on portal_age_lead_captures to authenticated,anon;
   create policy legacy_read on portal_age_lead_captures for select to authenticated using(true);
   create policy legacy_insert on portal_age_lead_captures for insert to anon,authenticated with check(true);
   create table patient_submissions(id uuid primary key default gen_random_uuid(),store_slug text,order_items jsonb,discount_code text,commission_rate numeric);
   create table fulfillment_orders(submission_id uuid);
   create table aactivated_promo_links(id uuid default gen_random_uuid(),is_active boolean,store_scope_code text,promo_title text,discount_code text,discount_amount numeric,link_slug text unique,notes text);
  `);
  await db.exec(readFileSync('supabase/migrations/20261027120000_pettides_preview.sql','utf8'));
  assert.equal((await db.query('select * from pettides_concepts')).rows.length,4);
  assert.equal((await db.query('select * from pettides_articles')).rows.length,6);
  await db.exec('set role anon');
  assert.equal((await db.query('select * from pettides_articles')).rows.length,0);
  const publicProducts = (await db.query('select * from pettides_public_concepts()')).rows;
  assert.equal(publicProducts.length,4); assert(publicProducts.every(p => p.public_price===null));
  await assert.rejects(db.query('select provisional_price from pettides_concepts'),/permission denied/);
  await db.exec(`select pettides_join_interest('Test','test@example.com',true)`);
  await assert.rejects(db.query(`select pettides_join_interest('Test','bad',true)`),/Valid contact/);
  await assert.rejects(db.query(`select pettides_join_interest('Test',null,true)`),/Valid contact/);
  await assert.rejects(db.query(`select pettides_join_interest('Test','test@example.com',false)`),/Valid contact/);
  await db.exec('reset role');
  assert.equal((await db.query('select * from portal_age_lead_captures')).rows[0].age_confirmed,false);
  await db.exec('set role authenticated');
  assert.equal((await db.query('select * from portal_age_lead_captures')).rows.length,0);
  await assert.rejects(db.query(`insert into portal_age_lead_captures(portal_id,email) values('pettides','bypass@example.com')`),/row-level security/);
  assert.equal((await db.query('select * from pettides_concepts')).rows.length,0);
  await assert.rejects(db.query('select pettides_prepare_discount()'),/Platform administrator/);
  await db.exec(`set test.admin='true'; set test.uid='00000000-0000-4000-8000-000000000001'`);
  assert.equal((await db.query('select * from pettides_concepts')).rows.length,4);
  await db.exec(`update pettides_concepts set show_price=true where slug='bpc-157'`);
  assert.equal(Number((await db.query(`select public_price from pettides_public_concepts() where slug='bpc-157'`)).rows[0].public_price),129);
  await assert.rejects(db.query(`update pettides_concepts set purchasable=true where slug='bpc-157'`),/check constraint/);
  await assert.rejects(db.query(`update pettides_articles set status='published' where slug='bpc-157-dogs'`),/Approve before publishing/);
  await db.exec(`update pettides_articles set status='in_review' where slug='bpc-157-dogs'`);
  await assert.rejects(db.query(`update pettides_articles set status='approved' where slug='bpc-157-dogs'`),/Verify original/);
  await db.exec(`update pettides_articles set status='approved',source_verified=true where slug='bpc-157-dogs'; update pettides_articles set status='published' where slug='bpc-157-dogs';`);
  await db.exec(`set role anon`);
  assert.equal((await db.query('select * from pettides_articles')).rows.length,1);
  await db.exec(`reset role; update pettides_articles set body='Changed after review' where slug='bpc-157-dogs'; set role anon;`);
  assert.equal((await db.query('select * from pettides_articles')).rows.length,0);
  await db.exec(`reset role; select pettides_prepare_discount(); update aactivated_promo_links set is_active=true where store_scope_code='PETTIDES'`);
  assert.equal((await db.query('select is_active from aactivated_promo_links')).rows[0].is_active,false);
  await db.exec(`update aactivated_promo_links set store_scope_code='MAIN',is_active=true`);
  assert.equal((await db.query('select store_scope_code from aactivated_promo_links')).rows[0].store_scope_code,'PETTIDES');
  for (const payload of ["'pettides',null", "'MAIN','[{\"id\":\"pettides-bpc-157\"}]'", "'MAIN','[{\"name\":\"PetTides NAD+\"}]'"]) {
   await assert.rejects(db.query(`insert into patient_submissions(store_slug,order_items) values(${payload})`),/not available for purchase/);
  }
  await db.exec(`insert into patient_submissions(store_slug,commission_rate) values('existing-store',0.25)`);
  assert.equal(Number((await db.query('select commission_rate from patient_submissions')).rows[0].commission_rate),.25);
  await assert.rejects(db.query(`update patient_submissions set order_items='[{"sku":"PETTIDES-TB-500"}]',discount_code='FREE'`),/not available for purchase/);
  await db.exec(readFileSync('supabase/migrations/20261027140000_pettides_benefit_evidence_drafts.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/20261027150000_pettides_primary_source_enrichment.sql','utf8'));
  await db.exec(readFileSync('supabase/migrations/20261027150000_pettides_primary_source_enrichment.sql','utf8')); // enrichment is idempotent
  const benefits=(await db.query<{slug:string;status:string;reviewed_at:null;sources:string[];body:string}>(`select * from pettides_articles where slug like '%-benefits-evidence'`)).rows;
  assert.equal(benefits.length,4);
  assert.deepEqual(benefits.map(a=>a.sources.length).sort(),[2,3,4,4]);
  assert(benefits.every(a=>a.body.includes('Mechanistic context:')||a.body.includes('Related research:')||a.body.includes('Ingredient-level mechanism:')));
  assert(benefits.every(a=>a.status==='draft'&&a.reviewed_at===null&&a.sources.length>0));
  assert(benefits.find(a=>a.slug==='wolverine-blend-benefits-evidence')?.body.includes('BPC-157 (10 mg) plus TB-500 (10 mg)'));
  await db.exec('set role anon');
  assert.equal((await db.query(`select * from pettides_articles where slug like '%-benefits-evidence'`)).rows.length,0);
  await db.exec('reset role');
  // Production connects as postgres; PGlite's superuser is postgres as well.
  await db.exec(readFileSync('supabase/migrations/20261028120000_pettides_owner_authorized_publication.sql','utf8'));
  await db.exec('set role anon');
  assert.equal((await db.query("select * from pettides_articles where status='published'")).rows.length,4);
  await db.exec("reset role; set role authenticated; set test.admin='true'");
  await db.exec("update pettides_articles set body=body || ' Edited' where slug='bpc-157-benefits-evidence'");
  const changed=(await db.query("select status,owner_publication_authorized_at,reviewed_by from pettides_articles where slug='bpc-157-benefits-evidence'")).rows[0];
  assert.equal(changed.status,'draft'); assert.equal(changed.owner_publication_authorized_at,null); assert.equal(changed.reviewed_by,null);
  await assert.rejects(db.query("update pettides_articles set status='published',owner_publication_authorized_at=now() where slug='bpc-157-benefits-evidence'"),/Approve before publishing/);
 } finally { await db.close(); }
});
