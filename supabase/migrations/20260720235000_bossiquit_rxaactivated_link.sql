-- Give James Wiggins / BOSSIQUIT a dedicated public alias while keeping him under AACTIVATEDRX.

do $$
declare
  james_rep_id uuid;
  guy_rep_id uuid;
  guy_profile_id uuid;
begin
  select id, profile_id
    into guy_rep_id, guy_profile_id
  from public.reps
  where upper(coalesce(rep_slug, '')) = 'GUY60'
  order by created_at
  limit 1;

  select id
    into james_rep_id
  from public.reps
  where upper(coalesce(rep_slug, '')) = 'BOSSIQUIT'
  order by created_at desc
  limit 1;

  if james_rep_id is null then
    raise exception 'Cannot assign /rxaactivated because BOSSIQUIT rep was not found.';
  end if;

  update public.reps
  set
    parent_rep_id = guy_rep_id,
    managed_by_profile_id = coalesce(guy_profile_id, managed_by_profile_id),
    custom_store_slug = 'aactivated',
    assigned_store_slug = 'aactivated',
    brand_id = 'aactivated',
    parent_brand_id = 'aactivated',
    brand_name = 'AACTIVATEDRX',
    rep_channel = 'aactivated_rep',
    rep_tier = 'standard',
    account_type = 'rep',
    parent_type = 'aactivated_main_portal',
    referral_path = '/rxaactivated',
    discount_code = 'BOSSIQUIT',
    commission_rate = 0.50,
    override_percent = 0,
    platform_percent = 0,
    active = true,
    updated_at = now()
  where id = james_rep_id;

  update public.checkout_scopes
  set
    display_name = 'RX AACTIVATED / James Wiggins',
    account_type = 'rep',
    account_id = 'BOSSIQUIT',
    parent_account_id = 'GUY60',
    is_active = true,
    default_commission_rate = 0.50,
    notes = 'Dedicated /rxaactivated link for James Wiggins / BOSSIQUIT. Attribution remains under AACTIVATEDRX / Guy.',
    updated_at = now()
  where upper(coalesce(scope_code, '')) = 'BOSSIQUIT';

  if not found then
    insert into public.checkout_scopes (
      scope_code,
      display_name,
      account_type,
      account_id,
      parent_account_id,
      is_active,
      default_commission_rate,
      notes
    )
    values (
      'BOSSIQUIT',
      'RX AACTIVATED / James Wiggins',
      'rep',
      'BOSSIQUIT',
      'GUY60',
      true,
      0.50,
      'Dedicated /rxaactivated link for James Wiggins / BOSSIQUIT. Attribution remains under AACTIVATEDRX / Guy.'
    );
  end if;

  update public.partner_rep_store_settings
  set
    partner_admin_id = coalesce(guy_profile_id, partner_admin_id),
    partner_admin_email = 'guy@aactivated.com',
    rep_email = coalesce(rep_email, 'bossiquitinc@gmail.com'),
    rep_name = 'James Wiggins',
    public_display_name = 'RX AACTIVATED',
    store_slug = 'rxaactivated',
    storefront_path = '/rxaactivated',
    pricing_mode = coalesce(nullif(pricing_mode, ''), 'aactivated_default'),
    features = coalesce(features, '{}'::jsonb) || jsonb_build_object(
      'storefront', true,
      'cart', true,
      'checkout', true,
      'promo_links', true,
      'rep_portal', true
    ),
    promo_config = coalesce(promo_config, '{}'::jsonb) || jsonb_build_object(
      'admin_code', 'BOSSIQUIT',
      'attribution_code', 'BOSSIQUIT',
      'discount_code', 'BOSSIQUIT',
      'referral_link', '/rxaactivated',
      'storefront_link', '/rxaactivated',
      'canonical_aactivated_link', '/aactivated?rep=BOSSIQUIT',
      'hierarchy_parent_rep_slug', 'GUY60',
      'hierarchy_parent_name', 'Guy Griffithe',
      'hierarchy_parent_type', 'aactivated_main_portal'
    ),
    status = 'active',
    activated_at = coalesce(activated_at, now()),
    disabled_at = null,
    internal_notes = 'James Wiggins / BOSSIQUIT dedicated alias /rxaactivated; remains under AACTIVATEDRX / Guy.',
    brand_id = 'aactivated',
    updated_at = now()
  where store_scope = 'AACTIVATEDRX'
    and rep_id = james_rep_id;

  insert into public.partner_rep_setup_audit (
    store_scope,
    actor_id,
    actor_email,
    action,
    target_table,
    target_id,
    rep_id,
    new_value,
    audit_notes
  )
  values (
    'AACTIVATEDRX',
    guy_profile_id,
    'guy@aactivated.com',
    'bossiquit_rxaactivated_alias_created',
    'partner_rep_store_settings',
    james_rep_id,
    james_rep_id,
    jsonb_build_object(
      'rep_slug', 'BOSSIQUIT',
      'public_link', '/rxaactivated',
      'canonical_link', '/aactivated?rep=BOSSIQUIT',
      'parent_rep_slug', 'GUY60',
      'brand_id', 'aactivated'
    ),
    'Created dedicated RX AACTIVATED alias for James Wiggins while keeping him under AACTIVATEDRX.'
  );
end $$;
