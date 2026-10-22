-- Amber OBrien: Blackline child rep, 40% of net profit using existing rep commission basis.
-- Passwords are provisioned separately through Supabase Auth.
do $$
declare parent_id uuid; parent_profile uuid; amber_id uuid;
begin
  select id, profile_id into parent_id, parent_profile from public.reps
  where rep_slug = 'BLACKLINE' and brand_id = 'blackline' and active;
  if parent_id is null then raise exception 'Blackline parent account is required'; end if;
  if exists (select 1 from public.reps where rep_slug = 'AMBEROBRIEN'
    and (payout_email is distinct from 'anobrien917@gmail.com' or parent_rep_id is distinct from parent_id)) then
    raise exception 'Amber referral code belongs to another account';
  end if;
  insert into public.reps (
    rep_slug, rep_name, rep_identifier, payout_email, commission_rate, commission_type,
    override_percent, platform_percent, rep_tier, rep_channel, discount_code, discount_amount,
    referral_path, custom_store_slug, brand_name, account_type, parent_type,
    parent_rep_id, managed_by_profile_id, brand_id, parent_brand_id, assigned_store_slug, active
  ) values (
    'AMBEROBRIEN', 'Amber OBrien', 'AMBEROBRIEN', 'anobrien917@gmail.com', 0.40, 'net_profit_after_true_cost',
    0, 0.60, 'standard_rep', 'blackline_downline_rep', 'AMBEROBRIEN', 0,
    '/blackline?rep=AMBEROBRIEN', 'blackline', 'Blackline Peptides', 'rep', 'blackline_downline',
    parent_id, parent_profile, 'blackline', 'blackline', 'blackline', true
  ) on conflict (rep_slug) do update set
    rep_name = excluded.rep_name, commission_rate = 0.40, commission_type = excluded.commission_type,
    referral_path = excluded.referral_path, custom_store_slug = excluded.custom_store_slug,
    brand_id = excluded.brand_id, parent_brand_id = excluded.parent_brand_id,
    assigned_store_slug = excluded.assigned_store_slug, parent_rep_id = excluded.parent_rep_id,
    managed_by_profile_id = excluded.managed_by_profile_id, active = true, updated_at = now()
  returning id into amber_id;

  insert into public.checkout_scopes
    (scope_code, display_name, account_type, account_id, parent_account_id, default_commission_rate, is_active, notes)
  values ('AMBEROBRIEN', 'Amber OBrien / Blackline', 'rep', 'AMBEROBRIEN', 'BLACKLINE', 0.40, true,
    'Blackline rep under Erik. 40% net profit commission. Existing Blackline parent commission remains unchanged.')
  on conflict (scope_code) do update set
    display_name = excluded.display_name, account_type = excluded.account_type, account_id = excluded.account_id,
    parent_account_id = excluded.parent_account_id, default_commission_rate = 0.40, is_active = true, updated_at = now();
end $$;
