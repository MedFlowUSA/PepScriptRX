-- Longevity Wellness: Cynthia Hunter's independent direct PepScriptRX storefront.
-- No credential is created or stored here. Existing auth/profile identities are linked
-- case-insensitively; a missing identity must be provisioned through the secure auth workflow.

insert into public.distributors (name, slug, portal_name, commission_rate, is_active, white_label_enabled, wholesale_enabled)
values ('Cynthia Hunter', 'longevity-wellness', 'Longevity Wellness', 0.5000, true, true, false)
on conflict (slug) do update set name=excluded.name, portal_name=excluded.portal_name,
  commission_rate=0.5000, is_active=true, white_label_enabled=true, wholesale_enabled=false, updated_at=now();

with desired(product_name, strength, price) as (values
  ('Retatrutide','5mg',179::numeric),('Retatrutide','10mg',229),('Retatrutide','15mg',269),('Retatrutide','20mg',299),('Retatrutide','30mg',349),
  ('Tirzepatide','10mg',129),('Tirzepatide','15mg',149),('Tirzepatide','20mg',169),('Tirzepatide','30mg',199),('Tirzepatide','60mg',249),
  ('Semaglutide','10mg',99),('CagriSema','2.4 mg + 2.4 mg, 4.8 mg total',249),('Cagrilintide','5mg',179),
  ('BPC-157','5mg',99),('BPC-157','10mg',139),('TB-500','5mg',99),('TB-500','10mg',149),
  ('Wolverine Stack','BPC-157 10 mg + TB-500 10 mg, 20 mg total',159),('NAD+','1000 mg',149),('Glutathione','1500mg',149),
  ('GHK-Cu','100mg',129),('Glow Stack','70 mg total',169),('Tesamorelin','2mg',99),('Tesamorelin','5mg',149),('Tesamorelin','10mg',199),
  ('Sermorelin','Standard',129),('Ipamorelin','5mg',129),('CJC-1295 / Ipamorelin','5 mg + 5 mg, 10 mg total',169),
  ('HGH / Somatropin','10 IU x 10, 100 IU total',285)
), matched as (
  select distinct on (d.product_name,d.strength) p.id product_id,d.price
  from desired d join public.rx_plus_products p on lower(p.product_name)=lower(d.product_name)
    and regexp_replace(lower(coalesce(p.strength,'')),'\s+','','g')=regexp_replace(lower(d.strength),'\s+','','g')
  order by d.product_name,d.strength,p.active desc,p.updated_at desc
)
insert into public.distributor_products (distributor_id,product_id,is_enabled,enabled,custom_price,custom_retail_price,featured,commission_rate)
select s.id,m.product_id,true,true,m.price,m.price,false,0.5000 from matched m cross join public.distributors s where s.slug='longevity-wellness'
on conflict (distributor_id,product_id) do update set is_enabled=true,enabled=true,custom_price=excluded.custom_price,
  custom_retail_price=excluded.custom_retail_price,commission_rate=0.5000,updated_at=now();

insert into public.checkout_scopes (scope_code,display_name,account_type,account_id,parent_account_id,is_active,default_commission_rate,notes)
values ('LONGEVITY','Longevity Wellness','rep','CYNTHIA50',null,true,0.5000,'Independent direct PepScriptRX storefront; no parent override.')
on conflict (scope_code) do update set display_name=excluded.display_name,account_type='rep',account_id='CYNTHIA50',
  parent_account_id=null,is_active=true,default_commission_rate=0.5000,notes=excluded.notes,updated_at=now();

insert into public.partner_brands (brand_id,store_slug,store_name,scope_code,owner_email,access_level,logo_url,colors,hero_text,custom_url,status,capabilities,pricing_guardrails)
values ('longevity-wellness','longevity-wellness','Longevity Wellness','LONGEVITY','chunter8594@gmail.com','limited',
  '/brands/longevity-wellness/longevity-logo.png',jsonb_build_object('primary','#071b3e','secondary','#075f9d','teal','#08a9b9','purple','#6541a4','gold','#c5a96d'),
  'Invest in Your Longevity','/longevity-wellness','active',
  jsonb_build_object('dashboard',true,'storefront',true,'orders',true,'customers',true,'analytics',true,'reports',true,'commission_reports',true,'payouts',true,'pricing',false,'inventory',false,'cross_brand_visibility',false),
  jsonb_build_object('commission_rate',0.50,'parent_brand_id',null,'parent_scope',null,'server_side_commission',true,'disallow_cross_brand_visibility',true))
on conflict (brand_id) do update set store_slug=excluded.store_slug,store_name=excluded.store_name,scope_code=excluded.scope_code,
  owner_email=excluded.owner_email,access_level=excluded.access_level,logo_url=excluded.logo_url,colors=excluded.colors,hero_text=excluded.hero_text,
  custom_url=excluded.custom_url,status='active',capabilities=excluded.capabilities,pricing_guardrails=excluded.pricing_guardrails,updated_at=now();

do $$
declare c_email text := 'chunter8594@gmail.com'; c_profile uuid; c_rep uuid;
begin
  select id into c_profile from public.profiles where lower(coalesce(email,''))=c_email order by created_at desc limit 1;
  if c_profile is not null then
    update public.profiles set full_name='Cynthia Hunter',role='rep',admin_scope='LONGEVITY',store_slug='longevity-wellness',owner_email=c_email,
      brand_id='longevity-wellness',partner_access_level='limited',access_scope='brand_only',global_admin=false,super_admin=false,
      can_view_all_brands=false,can_view_all_reps=false,can_view_all_orders=false,can_view_all_customers=false,
      can_edit_global_catalog=false,can_edit_global_settings=false,can_view_platform_financials=false,can_view_other_partner_financials=false,updated_at=now()
    where id=c_profile;
  end if;
  insert into public.reps (profile_id,rep_name,handle,rep_identifier,rep_slug,commission_type,commission_rate,override_percent,platform_percent,
    rep_tier,discount_code,discount_amount,referral_path,attribution_locked,attribution_window_days,payout_email,rep_channel,managed_by_profile_id,
    parent_rep_id,custom_store_slug,brand_name,brand_id,parent_brand_id,assigned_store_slug,account_type,parent_type,active)
  values (c_profile,'Cynthia Hunter','CYNTHIA50','PEPSCRIPTRX-LONGEVITY-CYNTHIA50','CYNTHIA50','direct_store_commission',0.5000,0,0.5000,
    'direct_store_owner',null,0,'/longevity-wellness',true,60,c_email,'direct_store',null,null,'longevity-wellness','Longevity Wellness',
    'longevity-wellness',null,'longevity-wellness','rep','direct_store',true)
  on conflict (rep_slug) do update set profile_id=coalesce(excluded.profile_id,public.reps.profile_id),rep_name=excluded.rep_name,
    commission_type='direct_store_commission',commission_rate=0.5000,override_percent=0,platform_percent=0.5000,parent_rep_id=null,
    managed_by_profile_id=null,custom_store_slug='longevity-wellness',brand_name='Longevity Wellness',brand_id='longevity-wellness',parent_brand_id=null,
    assigned_store_slug='longevity-wellness',account_type='rep',parent_type='direct_store',active=true,updated_at=now() returning id into c_rep;
  if to_regclass('public.partner_rep_commission_settings') is not null then
    insert into public.partner_rep_commission_settings (store_scope,partner_admin_id,partner_admin_email,rep_id,rep_email,commission_type,commission_percent,
      special_note,approval_required,approval_status,internal_notes,brand_id,rep_name,commission_basis,parent_override_percent,platform_percent,status,updated_at)
    values ('LONGEVITY',c_profile,c_email,c_rep,c_email,'direct_store_commission',50,'Independent direct-store owner commission.',false,'active',
      'No parent or override recipient.','longevity-wellness','Cynthia Hunter','direct_store_commission',0,50,'active',now())
    on conflict (store_scope,rep_id) do update set commission_percent=50,approval_required=false,approval_status='active',brand_id='longevity-wellness',
      rep_name='Cynthia Hunter',parent_override_percent=0,platform_percent=50,status='active',updated_at=now();
  end if;
end $$;

insert into public.partner_marketing_assets (brand_id,store_slug,asset_name,asset_type,storage_path,public_url,metadata) values
 ('longevity-wellness','longevity-wellness','Longevity Wellness primary logo','image/png','public/brands/longevity-wellness/longevity-logo.png','/brands/longevity-wellness/longevity-logo.png',jsonb_build_object('usage','primary_logo')),
 ('longevity-wellness','longevity-wellness','Longevity Wellness luxury vial','image/png','public/brands/longevity-wellness/longevity-vial.png','/brands/longevity-wellness/longevity-vial.png',jsonb_build_object('usage','product_placeholder')),
 ('longevity-wellness','longevity-wellness','Longevity Wellness peptide bundle','image/png','public/brands/longevity-wellness/longevity-hero.png','/brands/longevity-wellness/longevity-hero.png',jsonb_build_object('usage','hero'))
on conflict do nothing;
