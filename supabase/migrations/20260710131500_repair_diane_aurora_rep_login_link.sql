-- Repair Diane Duffy's Aurora rep portal profile link when her Auth user exists.
-- This intentionally does not create or store a password. Password resets/grants
-- must run through Supabase Auth/admin tooling or the Aurora grant Edge Function.

do $$
declare
  diane_auth_id uuid;
  diane_profile_id uuid;
  diane_rep_id uuid;
  aurora_rep_id uuid;
  mike_profile_id uuid;
begin
  select id
    into diane_auth_id
  from auth.users
  where lower(coalesce(email, '')) = 'queentort333@yahoo.com'
  order by created_at desc
  limit 1;

  select r.id, r.profile_id
    into aurora_rep_id, mike_profile_id
  from public.reps r
  where r.rep_slug = 'AURORA'
     or r.rep_identifier = 'MIKEAURORA'
  order by case when r.rep_slug = 'AURORA' then 0 else 1 end, r.created_at desc
  limit 1;

  update public.reps
  set
    rep_name = 'Diane Marie Duffy',
    commission_type = 'net_profit_after_true_cost',
    commission_rate = 0.20,
    override_percent = 0.20,
    rep_tier = 'aurora_downline_rep',
    rep_channel = 'aurora_downline_rep',
    discount_code = 'D026FIR',
    referral_path = coalesce(nullif(referral_path, ''), '/auroraDD'),
    custom_store_slug = 'aurora',
    brand_name = 'Aurora Labs',
    account_type = 'rep',
    parent_type = 'aurora_downline',
    parent_rep_id = coalesce(parent_rep_id, aurora_rep_id),
    managed_by_profile_id = coalesce(managed_by_profile_id, mike_profile_id),
    active = true,
    updated_at = now()
  where rep_slug = 'D026FIR'
  returning id into diane_rep_id;

  if diane_auth_id is null then
    raise notice 'Diane Auth user queentort333@yahoo.com does not exist yet. Create/grant the Auth user through the Aurora rep login grant flow.';
    return;
  end if;

  select id
    into diane_profile_id
  from public.profiles
  where auth_user_id = diane_auth_id
     or id = diane_auth_id
     or lower(coalesce(email, '')) = 'queentort333@yahoo.com'
  order by
    case when auth_user_id = diane_auth_id or id = diane_auth_id then 0 else 1 end,
    created_at desc
  limit 1;

  if diane_profile_id is null then
    diane_profile_id := diane_auth_id;

    insert into public.profiles (
      id,
      auth_user_id,
      full_name,
      email,
      role,
      admin_scope,
      store_slug,
      owner_email
    )
    values (
      diane_profile_id,
      diane_auth_id,
      'Diane Marie Duffy',
      'queentort333@yahoo.com',
      'rep',
      'AURORA',
      'aurora',
      'mnsgroup107@gmail.com'
    );
  else
    update public.profiles
    set
      auth_user_id = diane_auth_id,
      full_name = 'Diane Marie Duffy',
      email = 'queentort333@yahoo.com',
      role = 'rep',
      admin_scope = 'AURORA',
      store_slug = 'aurora',
      owner_email = 'mnsgroup107@gmail.com',
      updated_at = now()
    where id = diane_profile_id;
  end if;

  update public.reps
  set
    profile_id = diane_profile_id,
    active = true,
    updated_at = now()
  where id = diane_rep_id
     or rep_slug = 'D026FIR';

  update public.checkout_scopes
  set
    display_name = 'Diane Marie Duffy / Aurora Labs',
    account_type = 'rep',
    account_id = 'D026FIR',
    parent_account_id = 'AURORA',
    is_active = true,
    default_commission_rate = 0.20,
    updated_at = now()
  where scope_code = 'D026FIR';
end $$;
