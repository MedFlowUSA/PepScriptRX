-- Set Guy's AACTIVATED commission to 70% going forward.

do $$
declare
  guy_profile_id uuid;
  guy_rep_id uuid;
begin
  select p.id
    into guy_profile_id
  from public.profiles p
  where lower(coalesce(p.email, '')) = 'guy@aactivated.com'
     or lower(coalesce(p.owner_email, '')) = 'guy@aactivated.com'
  order by p.created_at desc
  limit 1;

  update public.reps
  set
    commission_type = 'net_profit_share',
    commission_rate = 0.70,
    payout_email = coalesce(nullif(payout_email, ''), 'guy@aactivated.com'),
    rep_tier = coalesce(nullif(rep_tier, ''), 'rx_plus_admin_distributor'),
    rep_channel = coalesce(nullif(rep_channel, ''), 'aactivated_partner_admin'),
    active = true
  where upper(coalesce(rep_slug, '')) in ('GUY60', 'AACTIVATED', 'AACTIVATEDRX')
     or lower(coalesce(payout_email, '')) = 'guy@aactivated.com'
     or (guy_profile_id is not null and profile_id = guy_profile_id);

  select r.id
    into guy_rep_id
  from public.reps r
  where upper(coalesce(r.rep_slug, '')) = 'GUY60'
     or lower(coalesce(r.payout_email, '')) = 'guy@aactivated.com'
     or (guy_profile_id is not null and r.profile_id = guy_profile_id)
  order by case when upper(coalesce(r.rep_slug, '')) = 'GUY60' then 0 else 1 end, r.created_at desc
  limit 1;

  update public.checkout_scopes
  set
    default_commission_rate = 0.70,
    notes = case
      when notes is null or notes = '' then 'AACTIVATED/Guy checkout scope. Guy receives 70% net-profit commission.'
      when notes not ilike '%70%' then notes || ' Guy commission updated to 70% net-profit commission.'
      else notes
    end,
    updated_at = now()
  where upper(coalesce(scope_code, '')) in ('GUY60', 'AACTIVATED', 'AACTIVATEDRX', 'VITALITYINS')
    and (
      upper(coalesce(account_id, '')) in ('GUY60', 'AACTIVATED', 'AACTIVATEDRX', 'VITALITYINS')
      or lower(coalesce(display_name, '')) like '%aactivated%'
      or lower(coalesce(notes, '')) like '%aactivated%'
    );

  update public.distributors
  set
    commission_rate = 0.70,
    updated_at = now()
  where lower(coalesce(slug, '')) = 'guy'
     or lower(coalesce(portal_name, '')) like '%aactivated%';

  update public.distributor_products dp
  set
    commission_rate = 0.70,
    updated_at = now()
  from public.distributors d
  where dp.distributor_id = d.id
    and (lower(coalesce(d.slug, '')) = 'guy' or lower(coalesce(d.portal_name, '')) like '%aactivated%');

  if guy_rep_id is not null then
    insert into public.partner_rep_commission_settings (
      store_scope,
      brand_id,
      partner_admin_id,
      partner_admin_email,
      rep_id,
      rep_email,
      commission_type,
      commission_percent,
      override_percent,
      approval_required,
      approval_status,
      special_note,
      internal_notes,
      updated_by
    )
    values (
      'AACTIVATEDRX',
      'aactivated',
      guy_profile_id,
      'guy@aactivated.com',
      guy_rep_id,
      'guy@aactivated.com',
      'flat_net_profit',
      70,
      0,
      false,
      'active',
      'Guy receives 70% net-profit commission for AACTIVATED.',
      'Updated by platform request on 2026-07-08. Applies to Guy/AACTIVATED parent commission.',
      guy_profile_id
    )
    on conflict (store_scope, rep_id) do update set
      brand_id = excluded.brand_id,
      partner_admin_id = excluded.partner_admin_id,
      partner_admin_email = excluded.partner_admin_email,
      rep_email = excluded.rep_email,
      commission_type = excluded.commission_type,
      commission_percent = excluded.commission_percent,
      override_percent = excluded.override_percent,
      approval_required = excluded.approval_required,
      approval_status = excluded.approval_status,
      special_note = excluded.special_note,
      internal_notes = excluded.internal_notes,
      updated_by = excluded.updated_by,
      updated_at = now();
  end if;
end $$;
