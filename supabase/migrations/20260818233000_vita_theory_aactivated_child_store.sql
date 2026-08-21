-- Vita Theory Wellness is an AACTIVATEDRX child storefront owned by Valerie Spencer.
-- Security: this migration never creates auth identities or stores credentials. It only
-- associates an existing, case-insensitively matched profile when one already exists.

insert into public.distributors (name, slug, portal_name, commission_rate, is_active, white_label_enabled, wholesale_enabled)
values ('Valerie Spencer', 'vita-theory', 'Vita Theory Wellness', 0.5000, true, true, false)
on conflict (slug) do update set
  name = excluded.name, portal_name = excluded.portal_name, commission_rate = 0.5000,
  is_active = true, white_label_enabled = true, wholesale_enabled = false, updated_at = now();

-- Reuse the AACTIVATED catalog rows and underlying product/inventory identities.
insert into public.distributor_products (
  distributor_id, product_id, is_enabled, enabled, custom_price, custom_retail_price, featured, commission_rate
)
select vita.id, source.product_id, source.is_enabled, source.enabled,
  source.custom_price, source.custom_retail_price, source.featured, 0.5000
from public.distributor_products source
join public.distributors parent on parent.id = source.distributor_id and parent.slug = 'guy'
cross join public.distributors vita
where vita.slug = 'vita-theory' and coalesce(source.is_enabled, source.enabled, true)
on conflict (distributor_id, product_id) do update set
  is_enabled = excluded.is_enabled, enabled = excluded.enabled,
  custom_price = excluded.custom_price, custom_retail_price = excluded.custom_retail_price,
  featured = excluded.featured, commission_rate = 0.5000, updated_at = now();

insert into public.checkout_scopes (
  scope_code, display_name, account_type, account_id, parent_account_id, is_active, default_commission_rate, notes
)
values (
  'VITATHEORY', 'Vita Theory Wellness', 'rep', 'VALERIE50', 'GUY60', true, 0.5000,
  'AACTIVATEDRX child storefront. Valerie Spencer receives 50% using the existing server-side commission engine.'
)
on conflict (scope_code) do update set
  display_name = excluded.display_name, account_type = excluded.account_type,
  account_id = excluded.account_id, parent_account_id = 'GUY60', is_active = true,
  default_commission_rate = 0.5000, notes = excluded.notes, updated_at = now();

insert into public.partner_brands (
  brand_id, store_slug, store_name, scope_code, owner_email, access_level, logo_url,
  colors, hero_text, custom_url, status, capabilities, pricing_guardrails
)
values (
  'vita-theory', 'vita-theory', 'Vita Theory Wellness', 'VITATHEORY', 'valeriespencer10@gmail.com', 'limited',
  '/brands/vita-theory/vita-theory-logo.png',
  jsonb_build_object('primary','#303521','secondary','#8c9274','surface','#f6f1e7','accent','#bc7868','gold','#b79a5c'),
  'Wellness. Elevated. From Within.', '/vita-theory', 'active',
  jsonb_build_object('dashboard',true,'storefront',true,'orders',true,'customers',true,'analytics',true,'reports',true,'marketing',true,'commission_reports',true,'pricing',false,'inventory',false,'cross_brand_visibility',false),
  jsonb_build_object('commission_rate',0.50,'parent_brand_id','aactivated','parent_scope','AACTIVATEDRX','server_side_commission',true,'inherits_parent_catalog',true,'disallow_cross_brand_visibility',true)
)
on conflict (brand_id) do update set
  store_slug=excluded.store_slug, store_name=excluded.store_name, scope_code=excluded.scope_code,
  owner_email=excluded.owner_email, access_level=excluded.access_level, logo_url=excluded.logo_url,
  colors=excluded.colors, hero_text=excluded.hero_text, custom_url=excluded.custom_url,
  status='active', capabilities=excluded.capabilities, pricing_guardrails=excluded.pricing_guardrails, updated_at=now();

do $$
declare
  valerie_email text := 'valeriespencer10@gmail.com';
  valerie_profile_id uuid;
  valerie_rep_id uuid;
  aactivated_profile_id uuid;
  aactivated_rep_id uuid;
begin
  select id into valerie_profile_id from public.profiles
  where lower(coalesce(email,'')) = valerie_email order by created_at desc limit 1;

  select id into aactivated_profile_id from public.profiles
  where lower(coalesce(email,'')) in ('guy@aactivated.com','bossiquitinc@gmail.com')
     or upper(coalesce(admin_scope,'')) = 'AACTIVATEDRX'
  order by case when lower(coalesce(email,''))='guy@aactivated.com' then 0 else 1 end, created_at limit 1;

  select id into aactivated_rep_id from public.reps
  where upper(coalesce(rep_slug,''))='GUY60' or (aactivated_profile_id is not null and profile_id=aactivated_profile_id)
  order by case when upper(coalesce(rep_slug,''))='GUY60' then 0 else 1 end, created_at limit 1;

  if valerie_profile_id is not null then
    update public.profiles set
      full_name='Valerie Spencer', role='rep', admin_scope='VITATHEORY', store_slug='vita-theory',
      owner_email=valerie_email, brand_id='vita-theory', partner_access_level='limited', access_scope='brand_only',
      global_admin=false, super_admin=false, can_view_all_brands=false, can_view_all_reps=false,
      can_view_all_orders=false, can_view_all_customers=false, can_edit_global_catalog=false,
      can_edit_global_settings=false, can_view_platform_financials=false,
      can_view_other_partner_financials=false, updated_at=now()
    where id=valerie_profile_id;
  end if;

  insert into public.reps (
    profile_id, rep_name, handle, rep_identifier, rep_slug, commission_type, commission_rate,
    override_percent, platform_percent, rep_tier, discount_code, discount_amount, referral_path,
    attribution_locked, attribution_window_days, payout_email, rep_channel, managed_by_profile_id,
    parent_rep_id, custom_store_slug, brand_name, brand_id, parent_brand_id, assigned_store_slug,
    account_type, parent_type, active
  ) values (
    valerie_profile_id, 'Valerie Spencer', 'VALERIE50', 'AACTIVATED-VITA-THEORY-VALERIE50', 'VALERIE50',
    'aactivated_rep_commission', 0.5000, 0, 0.5000, 'aactivated_rep', null, 0, '/vita-theory',
    true, 60, valerie_email, 'aactivated_downline', aactivated_profile_id, aactivated_rep_id,
    'vita-theory', 'Vita Theory Wellness', 'vita-theory', 'aactivated', 'vita-theory',
    'rep', 'aactivated_child_store', true
  ) on conflict (rep_slug) do update set
    profile_id=coalesce(excluded.profile_id,public.reps.profile_id), rep_name=excluded.rep_name,
    commission_type=excluded.commission_type, commission_rate=0.5000, override_percent=0,
    platform_percent=0.5000, rep_tier=excluded.rep_tier, referral_path=excluded.referral_path,
    attribution_locked=true, payout_email=excluded.payout_email, rep_channel=excluded.rep_channel,
    managed_by_profile_id=excluded.managed_by_profile_id, parent_rep_id=excluded.parent_rep_id,
    custom_store_slug='vita-theory', brand_name='Vita Theory Wellness', brand_id='vita-theory',
    parent_brand_id='aactivated', assigned_store_slug='vita-theory', account_type='rep',
    parent_type='aactivated_child_store', active=true, updated_at=now()
  returning id into valerie_rep_id;

  if to_regclass('public.partner_rep_commission_settings') is not null then
    insert into public.partner_rep_commission_settings (
      store_scope, partner_admin_id, partner_admin_email, rep_id, rep_email, commission_type,
      commission_percent, special_note, approval_required, approval_status, internal_notes,
      brand_id, rep_name, commission_basis, parent_override_percent, platform_percent, status, updated_at
    ) values (
      'AACTIVATEDRX', aactivated_profile_id, 'guy@aactivated.com', valerie_rep_id, valerie_email,
      'aactivated_rep_commission', 50, 'Vita Theory Wellness owner commission.', false, 'active',
      'Child storefront VITATHEORY; server-side attribution owner VALERIE50.', 'vita-theory',
      'Valerie Spencer', 'aactivated_rep_commission', 0, 50, 'active', now()
    ) on conflict (store_scope,rep_id) do update set
      commission_percent=50, approval_required=false, approval_status='active', brand_id='vita-theory',
      rep_name='Valerie Spencer', parent_override_percent=0, platform_percent=50, status='active', updated_at=now();
  end if;

  if to_regclass('public.partner_rep_store_settings') is not null then
    insert into public.partner_rep_store_settings (
      store_scope, partner_admin_id, partner_admin_email, rep_id, rep_email, rep_name,
      public_display_name, store_slug, storefront_path, product_list_name, pricing_mode,
      features, promo_config, status, activated_at, internal_notes, brand_id, updated_at
    ) values (
      'AACTIVATEDRX', aactivated_profile_id, 'guy@aactivated.com', valerie_rep_id, valerie_email,
      'Valerie Spencer', 'Vita Theory Wellness', 'vita-theory', '/vita-theory',
      'AACTIVATEDRX inherited catalog', 'parent_catalog',
      jsonb_build_object('child_storefront',true,'cart',true,'secure_checkout',true,'rep_portal',true,'founder_section_visible',false),
      jsonb_build_object('tagline','Wellness. Elevated. From Within.','commission_owner','VALERIE50','commission_rate',0.50),
      'active', now(), 'AACTIVATEDRX child storefront; Valerie access is Vita Theory scoped.', 'vita-theory', now()
    ) on conflict (store_scope,rep_id) do update set
      rep_email=excluded.rep_email, public_display_name=excluded.public_display_name,
      store_slug='vita-theory', storefront_path='/vita-theory', product_list_name=excluded.product_list_name,
      pricing_mode='parent_catalog', features=excluded.features, promo_config=excluded.promo_config,
      status='active', disabled_at=null, brand_id='vita-theory', updated_at=now();
  end if;
end $$;

insert into public.partner_marketing_assets (brand_id,store_slug,asset_name,asset_type,storage_path,public_url,metadata)
values
 ('vita-theory','vita-theory','Vita Theory primary logo','image/png','public/brands/vita-theory/vita-theory-logo.png','/brands/vita-theory/vita-theory-logo.png',jsonb_build_object('usage','primary_logo')),
 ('vita-theory','vita-theory','Vita Theory single vial','image/png','public/brands/vita-theory/vita-theory-single-vial.png','/brands/vita-theory/vita-theory-single-vial.png',jsonb_build_object('usage','product_display')),
 ('vita-theory','vita-theory','Vita Theory collection','image/png','public/brands/vita-theory/vita-theory-collection.png','/brands/vita-theory/vita-theory-collection.png',jsonb_build_object('usage','collection')),
 ('vita-theory','vita-theory','Vita Theory basket','image/png','public/brands/vita-theory/vita-theory-basket.png','/brands/vita-theory/vita-theory-basket.png',jsonb_build_object('usage','hero_editorial'))
on conflict do nothing;
