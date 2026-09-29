-- Run ONLY after Lily supplies her email and completes the existing secure auth
-- invitation/signup workflow. No auth user, password, or invitation is created here.
-- psql -v lily_email="<the supplied real email>" -f tools/onboard-pure-peptide-labs.sql
\set ON_ERROR_STOP on
begin;
select set_config('onboarding.lily_email', lower(trim(:'lily_email')), true);
do $$
declare
  lily_email text := current_setting('onboarding.lily_email');
  lily_profile uuid;
  lily_rep uuid;
begin
  if lily_email='' or position('@' in lily_email)=0 then raise exception 'Lily actual email is required'; end if;
  select p.id into strict lily_profile from public.profiles p join auth.users u on u.id=p.id
    where lower(p.email)=lily_email and lower(u.email)=lily_email;
  if exists (select 1 from public.profiles p where p.id=lily_profile and
    (p.role not in ('patient','rep') or coalesce(p.brand_id,'') not in ('','purepeptidelabs')
      or coalesce(p.store_slug,'') not in ('','purepeptidelabs')
      or coalesce(p.admin_scope,'') not in ('','PUREPEPTIDELABS')
      or coalesce(p.global_admin,false) or coalesce(p.super_admin,false)))
    or exists (select 1 from public.reps where profile_id=lily_profile and rep_slug<>'LILY60')
    or exists (select 1 from public.partner_admin_brand_assignments where profile_id=lily_profile and brand_id<>'purepeptidelabs') then
    raise exception 'This identity already has another owner/privileged scope; do not reassign it';
  end if;
  select id into strict lily_rep from public.reps where rep_slug='LILY60' and brand_id='purepeptidelabs'
    and (profile_id is null or profile_id=lily_profile);
  if exists (select 1 from public.partner_brands where brand_id='purepeptidelabs'
    and owner_email is not null and lower(owner_email)<>lily_email) then
    raise exception 'Pure Peptide Labs already has a different owner email';
  end if;
  update public.profiles set full_name='Lily Graham',role='rep',admin_scope='PUREPEPTIDELABS',store_slug='purepeptidelabs',
    owner_email=lily_email,brand_id='purepeptidelabs',partner_access_level='limited',access_scope='brand_only',
    global_admin=false,super_admin=false,can_view_all_brands=false,can_view_all_reps=false,can_view_all_orders=false,
    can_view_all_customers=false,can_edit_global_catalog=false,can_edit_global_settings=false,
    can_view_platform_financials=false,can_view_other_partner_financials=false,updated_at=now() where id=lily_profile;
  update public.reps set profile_id=lily_profile,updated_at=now() where id=lily_rep;
  -- Payout email stays unset until Lily confirms her payout destination.
  update public.partner_brands set owner_email=lily_email,updated_at=now() where brand_id='purepeptidelabs';
  insert into public.partner_rep_commission_settings (store_scope,partner_admin_id,partner_admin_email,rep_id,rep_email,
    commission_type,commission_percent,special_note,approval_required,approval_status,internal_notes,brand_id,rep_name,
    commission_basis,parent_override_percent,platform_percent,status,updated_at)
  values ('PUREPEPTIDELABS',lily_profile,lily_email,lily_rep,lily_email,'direct_store_commission',60,
    'Direct platform owner; 60% of existing paid-order margin.',false,'active','No parent or override recipient.',
    'purepeptidelabs','Lily Graham','direct_store_commission',0,40,'active',now())
  on conflict (store_scope,rep_id) do update set partner_admin_id=excluded.partner_admin_id,
    partner_admin_email=excluded.partner_admin_email,rep_email=excluded.rep_email,commission_percent=60,
    parent_override_percent=0,platform_percent=40,status='active',updated_at=now();
end $$;
commit;
