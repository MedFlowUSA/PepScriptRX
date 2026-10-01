-- Lily's explicitly supplied identity and revised 65% direct-platform margin share.
-- Auth is provisioned separately through the existing Admin API; no credentials here.
-- LILY60 remains the stable attribution ID; it does not define the commission rate.
do $$
declare
  lily_email text := 'lilypurepeptides@gmail.com';
  owner_id uuid;
  owner_rep uuid;
begin
  select p.id into strict owner_id from public.profiles p join auth.users u on u.id=p.id
    where lower(p.email)=lily_email and lower(u.email)=lily_email;
  if exists (select 1 from public.profiles p where p.id=owner_id and
    (p.role not in ('patient','rep','partner_admin_limited')
      or coalesce(p.brand_id,'') not in ('','purepeptidelabs')
      or coalesce(p.store_slug,'') not in ('','purepeptidelabs')
      or coalesce(p.admin_scope,'') not in ('','PUREPEPTIDELABS')
      or coalesce(p.global_admin,false) or coalesce(p.super_admin,false)))
    or exists (select 1 from public.reps where profile_id=owner_id and rep_slug<>'LILY60')
    or exists (select 1 from public.partner_admin_brand_assignments where profile_id=owner_id and brand_id<>'purepeptidelabs') then
    raise exception 'Identity already belongs to another privileged scope; refusing reassignment';
  end if;
  select id into strict owner_rep from public.reps where rep_slug='LILY60' and brand_id='purepeptidelabs'
    and rep_name='Lily Graham' and (profile_id is null or profile_id=owner_id);
  if exists (select 1 from public.partner_brands b where b.brand_id='purepeptidelabs'
    and b.owner_email is not null and lower(b.owner_email)<>lily_email) then
    raise exception 'Pure Peptide Labs already has another owner';
  end if;
  if not exists (select 1 from public.checkout_scopes where scope_code='PUREPEPTIDELABS' and account_id='LILY60') then
    raise exception 'Pure checkout attribution is missing';
  end if;

  update public.profiles set full_name='Lily Graham',role='partner_admin_limited',auth_user_id=owner_id,
    admin_scope='PUREPEPTIDELABS',store_slug='purepeptidelabs',owner_email='lilypurepeptides@gmail.com',
    brand_id='purepeptidelabs',partner_access_level='limited',access_scope='brand_only',
    global_admin=false,super_admin=false,can_view_all_brands=false,can_view_all_reps=false,
    can_view_all_orders=false,can_view_all_customers=false,can_edit_global_catalog=false,
    can_edit_global_settings=false,can_view_platform_financials=false,can_view_other_partner_financials=false,
    updated_at=now() where id=owner_id;
  insert into public.partner_admin_brand_assignments(profile_id,brand_id,access_level,status)
    values(owner_id,'purepeptidelabs','limited','active')
    on conflict(profile_id,brand_id) do update set access_level='limited',status='active';
  update auth.users set raw_user_meta_data=coalesce(raw_user_meta_data,'{}'::jsonb) ||
    jsonb_build_object('full_name','Lily Graham','role','partner_admin_limited','brand_id','purepeptidelabs',
      'store_slug','purepeptidelabs','admin_scope','PUREPEPTIDELABS'),updated_at=now() where id=owner_id;

  update public.reps set profile_id=owner_id,commission_type='direct_store_commission',commission_rate=0.6500,
    platform_percent=0.3500,override_percent=0,rep_tier='direct_store_owner',rep_channel='direct_store',
    parent_rep_id=null,parent_brand_id=null,managed_by_profile_id=null,account_type='rep',parent_type='direct_store',
    updated_at=now() where id=owner_rep;
  update public.distributors set commission_rate=0.6500,updated_at=now() where slug='purepeptidelabs';
  update public.distributor_products dp set commission_rate=0.6500,updated_at=now()
    from public.distributors d where dp.distributor_id=d.id and d.slug='purepeptidelabs';
  update public.checkout_scopes set default_commission_rate=0.6500,parent_account_id=null,
    notes='Lily Graham; direct platform owner; 65% of existing paid-order margin; no parent override.',updated_at=now()
    where scope_code='PUREPEPTIDELABS' and account_id='LILY60';
  update public.partner_brands set owner_email='lilypurepeptides@gmail.com',access_level='limited',
    capabilities=coalesce(capabilities,'{}'::jsonb) || jsonb_build_object('orders_customers',true),
    pricing_guardrails=coalesce(pricing_guardrails,'{}'::jsonb) ||
      jsonb_build_object('commission_rate',0.65,'parent_brand_id',null,'parent_scope',null),updated_at=now()
    where brand_id='purepeptidelabs';
  insert into public.partner_rep_commission_settings(store_scope,partner_admin_id,partner_admin_email,rep_id,rep_email,
    commission_type,commission_percent,special_note,approval_required,approval_status,internal_notes,brand_id,rep_name,
    commission_basis,parent_override_percent,platform_percent,status,updated_at)
  values('PUREPEPTIDELABS',owner_id,lily_email,owner_rep,lily_email,'direct_store_commission',65,
    'Direct platform owner; 65% of existing paid-order margin.',false,'active','No parent or override recipient.',
    'purepeptidelabs','Lily Graham','direct_store_commission',0,35,'active',now())
  on conflict(store_scope,rep_id) do update set partner_admin_id=excluded.partner_admin_id,
    partner_admin_email=excluded.partner_admin_email,rep_email=excluded.rep_email,commission_type='direct_store_commission',
    commission_percent=65,parent_override_percent=0,platform_percent=35,status='active',approval_status='active',
    special_note=excluded.special_note,updated_at=now();
  -- Existing order ledgers and payouts are deliberately not recalculated.
end $$;
