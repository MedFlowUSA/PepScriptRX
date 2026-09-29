-- Lily Graham: direct platform owner, with no invented identity or payout address.
-- Commission uses finalize_verified_paid_order's existing margin calculation:
-- greatest(0, product total - discounts - cost_of_goods) * 0.60, rounded to cents.
-- No products or prices are published by this migration.

do $$
declare
  finalizer regprocedure := coalesce(
    to_regprocedure('public.finalize_verified_paid_order_unlocked(text,text,text,text,uuid,integer,text,timestamptz,jsonb)'),
    to_regprocedure('public.finalize_verified_paid_order(text,text,text,text,uuid,integer,text,timestamptz,jsonb)'));
  calculation text;
begin
  if finalizer is null then raise exception 'Existing paid-order commission finalizer is missing'; end if;
  select regexp_replace(pg_get_functiondef(finalizer),'\s','','g') into calculation;
  if position('v_profit:=greatest(0,v_product_total-v_discount-v_cogs)' in calculation)=0
    or position('round(v_profit*v_rate,2)' in calculation)=0 then
    raise exception 'Paid-order commission basis changed; review before configuring Lily';
  end if;
  if exists (select 1 from public.reps where rep_slug='LILY60' and
    (rep_name is distinct from 'Lily Graham' or brand_id is distinct from 'purepeptidelabs')) then
    raise exception 'LILY60 is already assigned to another owner/store';
  end if;
  if exists (select 1 from public.distributors where slug='purepeptidelabs' and name <> 'Lily Graham') then
    raise exception 'purepeptidelabs distributor already belongs to another owner';
  end if;
  if exists (select 1 from public.checkout_scopes where scope_code='PUREPEPTIDELABS' and account_id is distinct from 'LILY60') then
    raise exception 'PUREPEPTIDELABS scope is already assigned';
  end if;
end $$;

insert into public.distributors (name,slug,portal_name,commission_rate,is_active,white_label_enabled,wholesale_enabled)
values ('Lily Graham','purepeptidelabs','Pure Peptide Labs',0.6000,true,true,false)
on conflict (slug) do update set commission_rate=0.6000,portal_name=excluded.portal_name,updated_at=now();

insert into public.partner_brands (brand_id,store_slug,store_name,scope_code,owner_email,access_level,logo_url,colors,hero_text,custom_url,status,capabilities,pricing_guardrails)
values ('purepeptidelabs','purepeptidelabs','Pure Peptide Labs','PUREPEPTIDELABS',null,'limited',
  '/brands/purepeptidelabs/logo.png',
  jsonb_build_object('primary','#49342f','background','#fcf8f2','blush','#f2e6df','accent','#83584b'),
  'A considered approach to wellness.','/purepeptidelabs','active',
  jsonb_build_object('dashboard',true,'storefront',true,'orders',true,'customers',true,'analytics',true,'reports',true,'commission_reports',true,'payouts',true,'pricing',false,'inventory',false,'cross_brand_visibility',false),
  jsonb_build_object('commission_rate',0.60,'parent_brand_id',null,'parent_scope',null,'server_side_commission',true,'disallow_cross_brand_visibility',true,'catalog_requires_explicit_assignment',true))
on conflict (brand_id) do update set store_name=excluded.store_name,logo_url=excluded.logo_url,
  colors=excluded.colors,hero_text=excluded.hero_text,custom_url=excluded.custom_url,
  capabilities=excluded.capabilities,pricing_guardrails=excluded.pricing_guardrails,updated_at=now();

insert into public.reps (profile_id,rep_name,handle,rep_identifier,rep_slug,commission_type,commission_rate,override_percent,platform_percent,
  rep_tier,discount_code,discount_amount,referral_path,attribution_locked,attribution_window_days,payout_email,rep_channel,managed_by_profile_id,
  parent_rep_id,custom_store_slug,brand_name,brand_id,parent_brand_id,assigned_store_slug,account_type,parent_type,active)
values (null,'Lily Graham','LILY60','PEPSCRIPTRX-PUREPEPTIDELABS-LILY60','LILY60','direct_store_commission',0.6000,0,0.4000,
  'direct_store_owner',null,0,'/purepeptidelabs',true,60,null,'direct_store',null,null,'purepeptidelabs','Pure Peptide Labs',
  'purepeptidelabs',null,'purepeptidelabs','rep','direct_store',true)
on conflict (rep_slug) do update set commission_type='direct_store_commission',commission_rate=0.6000,
  override_percent=0,platform_percent=0.4000,parent_rep_id=null,managed_by_profile_id=null,parent_brand_id=null,
  rep_tier='direct_store_owner',rep_channel='direct_store',account_type='rep',parent_type='direct_store',updated_at=now();

insert into public.checkout_scopes (scope_code,display_name,account_type,account_id,parent_account_id,is_active,default_commission_rate,notes)
values ('PUREPEPTIDELABS','Pure Peptide Labs','rep','LILY60',null,true,0.6000,
  'Lily Graham; direct platform owner; 60% of existing paid-order margin; no parent override. Email onboarding pending.')
on conflict (scope_code) do update set default_commission_rate=0.6000,parent_account_id=null,updated_at=now();

-- partner_rep_commission_settings.partner_admin_email is NOT NULL and defaults to
-- another partner's email. Do not insert that optional reporting row until Lily's
-- real email is supplied. The reps + checkout_scopes rows above govern settlement.

insert into public.partner_marketing_assets (brand_id,store_slug,asset_name,asset_type,storage_path,public_url,metadata)
select 'purepeptidelabs','purepeptidelabs',a.name,'image/png',
  'public/brands/purepeptidelabs/'||a.file,'/brands/purepeptidelabs/'||a.file,jsonb_build_object('usage',a.usage)
from (values ('Pure Peptide Labs supplied logo','logo.png','primary_logo'),
  ('Pure Peptide Labs supplied blank-label vial','vial.png','product_placeholder'),
  ('Pure Peptide Labs supplied basket','hero.png','hero')) a(name,file,usage)
where not exists (select 1 from public.partner_marketing_assets m
  where m.brand_id='purepeptidelabs' and m.public_url='/brands/purepeptidelabs/'||a.file);
