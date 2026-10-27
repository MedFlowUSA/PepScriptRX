import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
test('PetTides launch uses authoritative prices, isolates carts, preserves paid orders and supports pausing',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;grant usage on schema public,auth to anon,authenticated;
 create function auth.uid() returns uuid language sql as $$select null::uuid$$;
 create function is_platform_admin() returns boolean language sql stable as $$select coalesce(current_setting('test.admin',true),'false')='true'$$;
 create table portal_age_lead_captures(first_name text,email text,portal_id text,portal_name text,portal_path text,path text,age_confirmed boolean);
 create table aactivated_promo_links(id uuid default gen_random_uuid(),is_active boolean,store_scope_code text,promo_title text,discount_code text,discount_amount numeric,link_slug text unique,notes text);
 create table patient_submissions(id uuid primary key default gen_random_uuid(),full_name text default 'QA',email text default 'qa@example.com',phone text default '5555550100',shipping_address text default '1 Test St',shipping_city text default 'Los Angeles',shipping_state text default 'CA',shipping_zip text default '90001',medication text,product_name text,product_category text,selected_addons jsonb,order_items jsonb,quoted_price numeric,order_total numeric,shipping_speed text,shipping_cost numeric,discount_code text,discount_amount numeric,cost_of_goods numeric,store_slug text,source_store text,store_name text,brand_id text,source_portal text,source_route text,account_type text,parent_type text,checkout_scope_code text,checkout_scope_id uuid,rep_id uuid,referral_code text,source_rep text,admin_code text,source_admin text,commission_owner text,commission_rate numeric,partner_payout_eligible boolean,current_dose text,current_price numeric,current_pharmacy text,date_of_birth date,status text,payment_status text);
 create table fulfillment_orders(submission_id uuid);
 create function create_public_patient_submission_pre_isparta_core(payload jsonb) returns numeric language plpgsql as $core$
 declare v_raw_items jsonb:=payload->'order_items';v_aactivated_store_slug text;v_distributor_slug text;v_rep_id uuid;v_referral_code text;v_scope_code text;v_discount_code text;v_name text;v_category text;v_strength text;v_price numeric;v_cost numeric;v_item_id text:=payload->'order_items'->0->>'id';
 begin
 -- Pure Peptide Labs explicit catalog guard: no fallback to main/other stores.
 return coalesce(v_price,42);
 end $core$;
 `);
 await db.exec(readFileSync('supabase/migrations/20261027120000_pettides_preview.sql','utf8'));
 await db.exec(readFileSync('supabase/migrations/20261027130000_pettides_sales_launch.sql','utf8'));
 const quote=(items:unknown)=>db.query<{pettides_quote:{subtotal:number;items:unknown[]}}>('select pettides_quote($1::jsonb)',[JSON.stringify(items)]);
 const item={id:'pettides-bpc-157',quantity:2,price:1,name:'Tampered'};
 assert.equal(Number((await quote([item])).rows[0].pettides_quote.subtotal),258);
 await assert.rejects(quote([{...item,id:'human-product'}]),/unavailable/);
 await assert.rejects(quote([item,item]),/Duplicate/);
 for(const qty of [0,-1,21,1.5,'1e1',null])await assert.rejects(quote([{...item,quantity:qty}]),/Quantity/);
 await assert.rejects(quote([{...item,sku:'FAKE'}]),/identity/);
 const core=(payload:unknown)=>db.query<{price:number}>('select create_public_patient_submission_pre_isparta_core($1::jsonb) price',[JSON.stringify(payload)]);
 assert.equal(Number((await core({store_slug:'pettides',order_items:[item]})).rows[0].price),129);
 assert.equal(Number((await core({store_slug:'existing-store',order_items:[]})).rows[0].price),42);
 await assert.rejects(core({store_slug:'pettides',discount_code:'PSRX15',order_items:[item]}),/not enabled/);
 const [row]=(await db.query<{id:string;quoted_price:number;order_total:number;rep_id:null;commission_rate:null;order_items:{price:number;name:string}[]}>(`insert into patient_submissions(store_slug,order_items,shipping_speed,shipping_cost,quoted_price,order_total,rep_id,commission_rate,status,payment_status) values('pettides',$1,'expedited',1,1,1,'00000000-0000-4000-8000-000000000001',.9,'payment_sent','unpaid') returning *`,[JSON.stringify([item])])).rows;
 assert.equal(Number(row.quoted_price),258);assert.equal(Number(row.order_total),283);assert.equal(row.rep_id,null);assert.equal(row.commission_rate,null);assert.equal(row.order_items[0].name,'PetTides BPC-157');
 await assert.rejects(db.query('insert into fulfillment_orders values($1)',[row.id]),/Payment is required/);
 await db.query(`update patient_submissions set status='paid',payment_status='paid' where id=$1`,[row.id]);
 await db.exec(`update pettides_concepts set provisional_price=999,active=false where slug='bpc-157'`);
 await db.query(`update patient_submissions set status='fulfilled' where id=$1`,[row.id]);
 assert.equal(Number((await db.query<{order_total:number}>('select order_total from patient_submissions where id=$1',[row.id])).rows[0].order_total),283);
 await assert.rejects(db.query('update patient_submissions set order_total=1 where id=$1',[row.id]),/immutable/);
 await db.query('insert into fulfillment_orders values($1)',[row.id]);
 await db.exec(`set role authenticated`);assert.equal((await db.query('select * from pettides_store_settings')).rows.length,0);
 await db.exec(`reset role;update pettides_store_settings set sales_enabled=false`);
 await assert.rejects(quote([{id:'pettides-tb-500',quantity:1}]),/temporarily unavailable/);
 assert.equal((await db.query<{purchasable:boolean}>('select * from pettides_public_concepts()')).rows.every(p=>!p.purchasable),true);
 assert.equal((await db.query('select * from pettides_articles where status=\'published\'')).rows.length,0);
 }finally{await db.close();}
});
