-- AACTIVATEDRX Phase 2 rep activation and guarded sample/internal code program.

alter table public.patient_submissions
  add column if not exists order_type text not null default 'CUSTOMER_ORDER';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'patient_submissions_order_type_check') then
    alter table public.patient_submissions
      add constraint patient_submissions_order_type_check
      check (order_type in ('CUSTOMER_ORDER', 'REP_SAMPLE', 'REP_INTERNAL', 'WHOLESALE'));
  end if;
end $$;

comment on column public.patient_submissions.order_type is
  'Separates normal customer orders from rep sample/internal/wholesale orders for discount, commission, reporting, and leaderboard guardrails.';

alter table public.aactivated_promo_links
  add column if not exists promo_kind text not null default 'customer_discount',
  add column if not exists disabled_by uuid references public.profiles(id) on delete set null,
  add column if not exists disabled_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'aactivated_promo_links_promo_kind_check') then
    alter table public.aactivated_promo_links
      add constraint aactivated_promo_links_promo_kind_check
      check (promo_kind in ('customer_discount', 'rep_sample', 'rep_internal', 'wholesale'));
  end if;
end $$;

create index if not exists aactivated_promo_links_kind_code_idx
  on public.aactivated_promo_links(promo_kind, discount_code, is_active);

drop policy if exists "public_read_active_aactivated_promo_links" on public.aactivated_promo_links;
create policy "public_read_active_aactivated_promo_links"
on public.aactivated_promo_links for select
using (
  is_active = true
  and promo_kind = 'customer_discount'
  and (starts_at is null or starts_at <= now())
  and (expires_at is null or expires_at > now())
  and (usage_limit is null or uses_count < usage_limit)
);

create table if not exists public.aactivated_rep_sample_programs (
  id uuid primary key default gen_random_uuid(),
  store_scope text not null default 'AACTIVATEDRX',
  rep_id uuid not null references public.reps(id) on delete cascade,
  rep_slug text not null,
  rep_email text,
  customer_discount_code text not null,
  internal_purchase_code text not null,
  sample_discount_percent numeric(5,2) not null default 65 check (sample_discount_percent >= 0 and sample_discount_percent <= 100),
  monthly_vial_limit integer not null default 15 check (monthly_vial_limit > 0),
  monthly_order_limit integer not null default 2 check (monthly_order_limit > 0),
  eligible_product_ids text[] not null default array[]::text[],
  approval_required_product_ids text[] not null default array[]::text[],
  approval_owner_email text not null default 'guy@aactivated.com',
  status text not null default 'active' check (status in ('draft', 'active', 'paused', 'disabled')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (store_scope, rep_id),
  unique (internal_purchase_code)
);

create table if not exists public.aactivated_rep_sample_usage (
  id uuid primary key default gen_random_uuid(),
  store_scope text not null default 'AACTIVATEDRX',
  rep_id uuid not null references public.reps(id) on delete cascade,
  month_key text not null,
  order_count integer not null default 0 check (order_count >= 0),
  vial_count integer not null default 0 check (vial_count >= 0),
  last_order_id uuid references public.patient_submissions(id) on delete set null,
  updated_at timestamptz not null default now(),
  unique (store_scope, rep_id, month_key)
);

alter table public.aactivated_rep_sample_programs enable row level security;
alter table public.aactivated_rep_sample_usage enable row level security;

drop policy if exists "aactivated sample programs admin read" on public.aactivated_rep_sample_programs;
create policy "aactivated sample programs admin read"
on public.aactivated_rep_sample_programs
for select
to authenticated
using (
  public.my_role() in ('admin', 'owner', 'platform_admin', 'super_admin', 'rx_plus_admin')
  or exists (
    select 1
    from public.reps r
    where r.id = aactivated_rep_sample_programs.rep_id
      and r.profile_id = auth.uid()
  )
);

drop policy if exists "aactivated sample programs admin manage" on public.aactivated_rep_sample_programs;
create policy "aactivated sample programs admin manage"
on public.aactivated_rep_sample_programs
for all
to authenticated
using (public.my_role() in ('admin', 'owner', 'platform_admin', 'super_admin', 'rx_plus_admin'))
with check (public.my_role() in ('admin', 'owner', 'platform_admin', 'super_admin', 'rx_plus_admin'));

drop policy if exists "aactivated sample usage admin read" on public.aactivated_rep_sample_usage;
create policy "aactivated sample usage admin read"
on public.aactivated_rep_sample_usage
for select
to authenticated
using (
  public.my_role() in ('admin', 'owner', 'platform_admin', 'super_admin', 'rx_plus_admin')
  or exists (
    select 1
    from public.reps r
    where r.id = aactivated_rep_sample_usage.rep_id
      and r.profile_id = auth.uid()
  )
);

drop policy if exists "aactivated sample usage admin manage" on public.aactivated_rep_sample_usage;
create policy "aactivated sample usage admin manage"
on public.aactivated_rep_sample_usage
for all
to authenticated
using (public.my_role() in ('admin', 'owner', 'platform_admin', 'super_admin', 'rx_plus_admin'))
with check (public.my_role() in ('admin', 'owner', 'platform_admin', 'super_admin', 'rx_plus_admin'));

create or replace function public.apply_aactivated_server_promo_to_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raw_code text := upper(coalesce(new.discount_code, ''));
  v_base_code text := split_part(upper(coalesce(new.discount_code, '')), '+', 1);
  v_order_type text := upper(coalesce(new.order_type, 'CUSTOMER_ORDER'));
  v_required_promo_kind text := case
    when upper(coalesce(new.order_type, 'CUSTOMER_ORDER')) = 'REP_SAMPLE' then 'rep_sample'
    when upper(coalesce(new.order_type, 'CUSTOMER_ORDER')) = 'REP_INTERNAL' then 'rep_internal'
    when upper(coalesce(new.order_type, 'CUSTOMER_ORDER')) = 'WHOLESALE' then 'wholesale'
    else 'customer_discount'
  end;
  v_is_aactivated boolean;
  v_promo record;
  v_item jsonb;
  v_item_id text;
  v_qty numeric;
  v_price numeric;
  v_product_total numeric := greatest(0, coalesce(new.quoted_price, 0));
  v_eligible_total numeric := 0;
  v_discount numeric := null;
begin
  v_is_aactivated := (
    upper(coalesce(new.checkout_scope_code, '')) in ('AACTIVATED', 'AACTIVATEDRX', 'VITALITYINS', 'GUY60')
    or upper(coalesce(new.source_portal, '')) like '%AACTIVATED%'
    or upper(coalesce(new.source_portal, '')) like '%VITALITY%'
    or upper(coalesce(new.source_store, '')) like '%AACTIVATED%'
    or upper(coalesce(new.source_store, '')) like '%VITALITY%'
    or upper(coalesce(new.store_slug, '')) = 'AACTIVATED'
    or upper(coalesce(new.store_name, '')) like '%AACTIVATED%'
  );

  if not v_is_aactivated or v_base_code = '' or v_base_code = 'BUNDLE' or v_product_total <= 0 then
    return new;
  end if;

  select *
  into v_promo
  from public.aactivated_promo_links p
  where upper(p.discount_code) = v_base_code
    and p.promo_kind = v_required_promo_kind
    and p.is_active = true
    and (p.starts_at is null or p.starts_at <= now())
    and (p.expires_at is null or p.expires_at > now())
    and (p.usage_limit is null or p.uses_count < p.usage_limit)
    and coalesce(p.min_subtotal, 0) <= v_product_total
  order by p.created_at desc
  limit 1
  for update;

  if not found then
    if v_order_type = 'CUSTOMER_ORDER' and v_base_code like 'REP-%' then
      new.discount_amount := 0;
    end if;
    return new;
  end if;

  if v_promo.product_id is null then
    v_eligible_total := v_product_total;
  else
    for v_item in select value from jsonb_array_elements(coalesce(new.order_items, '[]'::jsonb))
    loop
      v_item_id := coalesce(nullif(v_item->>'id', ''), nullif(v_item->>'product_id', ''));
      v_qty := greatest(1, coalesce(nullif(v_item->>'quantity', '')::numeric, nullif(v_item->>'qty', '')::numeric, 1));
      v_price := greatest(0, coalesce(nullif(v_item->>'price', '')::numeric, 0));
      if v_item_id = v_promo.product_id then
        v_eligible_total := v_eligible_total + (v_price * v_qty);
      end if;
    end loop;
  end if;

  if v_eligible_total <= 0 then
    new.discount_amount := 0;
    return new;
  end if;

  if v_promo.discount_type = 'percentage' then
    v_discount := v_eligible_total * (coalesce(v_promo.discount_percent, 0) / 100);
  else
    v_discount := coalesce(v_promo.discount_amount, 0);
  end if;

  v_discount := round(least(v_product_total, v_eligible_total, greatest(0, coalesce(v_discount, 0))), 2);

  new.discount_code := case
    when v_raw_code like '%+BUNDLE%' then v_promo.discount_code || '+BUNDLE'
    else v_promo.discount_code
  end;
  new.discount_amount := v_discount;
  new.order_total := greatest(0, v_product_total - v_discount) + coalesce(new.shipping_cost, 0);
  new.subtotal_cents := round((v_product_total + coalesce(new.shipping_cost, 0)) * 100)::integer;
  new.discount_cents := round(v_discount * 100)::integer;
  new.amount_due_cents := round(new.order_total * 100)::integer;

  if tg_op = 'INSERT' then
    update public.aactivated_promo_links
    set uses_count = uses_count + 1,
        updated_at = now()
    where id = v_promo.id;
  end if;

  return new;
end;
$$;

drop trigger if exists patient_submissions_aactivated_server_promo_trigger on public.patient_submissions;
create trigger patient_submissions_aactivated_server_promo_trigger
before insert or update of discount_code, order_items, quoted_price, shipping_cost, checkout_scope_code, source_portal, source_store, store_slug, store_name, order_type
on public.patient_submissions
for each row
execute function public.apply_aactivated_server_promo_to_submission();

do $$
declare
  guy_profile_id uuid;
  guy_rep_id uuid;
  seeded_rep_id uuid;
  rep_profile_id uuid;
  eligible_products text[] := array[
    'wolverine-bpc-tb',
    'glow-peptide-blend',
    'klow-peptide-blend',
    'tesamorelin-10mg',
    'mots-c-10mg',
    'nad-500iu',
    'hgh-somatropin',
    'igf-1-lr3-1mg',
    'ghk-cu-50mg',
    'cjc-ipamorelin-10mg',
    'retatrutide-10mg',
    'tirzepatide-10mg',
    'tirzepatide-30mg',
    'semaglutide-10mg'
  ];
  approval_required_products text[] := array['hgh-somatropin', 'igf-1-lr3-1mg'];
  rep_row record;
begin
  select id, profile_id
    into guy_rep_id, guy_profile_id
  from public.reps
  where rep_slug = 'GUY60'
  limit 1;

  for rep_row in
    select *
    from (
      values
        ('Anthony Davis', 'adavis30430@gmail.com', 'ADONIS', 'SAVE-ADONIS', 'REP-ADONIS'),
        ('Aamir Paige', 'prehziii@gmail.com', 'AAMIR', 'SAVE-AAMIR', 'REP-AAMIR'),
        ('Isaac Muniz', '2legitbusiness@gmail.com', '2LEGIT', 'SAVE-2LEGIT', 'REP-2LEGIT'),
        ('Wendy Meyer', 'wmeyer0312@gmail.com', 'WENDYCREATES54', 'SAVE-WENDY', 'REP-WENDY'),
        ('Jujuan Gailey', 'jujuangailey@gmail.com', 'JUJUAN', 'SAVE-JUJUAN', 'REP-JUJUAN'),
        ('Caylee Powers', 'luckyyou024@gmail.com', 'POWERS', 'SAVE-POWERS', 'REP-POWERS')
    ) as reps_to_seed(rep_name, rep_email, rep_slug, customer_discount_code, internal_purchase_code)
  loop
    select p.id
      into rep_profile_id
    from public.profiles p
    where lower(coalesce(p.email, '')) = lower(rep_row.rep_email)
    order by p.created_at desc
    limit 1;

    if rep_profile_id is not null then
      update public.profiles
      set
        full_name = rep_row.rep_name,
        email = rep_row.rep_email,
        role = 'rep'
      where id = rep_profile_id;
    end if;

    insert into public.reps (
      profile_id,
      rep_name,
      handle,
      rep_identifier,
      rep_slug,
      commission_type,
      commission_rate,
      override_percent,
      platform_percent,
      rep_tier,
      discount_code,
      discount_amount,
      referral_path,
      attribution_locked,
      attribution_window_days,
      payout_method,
      payout_email,
      rep_channel,
      parent_rep_id,
      managed_by_profile_id,
      custom_store_slug,
      brand_name,
      brand_theme,
      active
    )
    values (
      rep_profile_id,
      rep_row.rep_name,
      rep_row.rep_slug,
      'AACTIVATED-' || rep_row.rep_slug,
      rep_row.rep_slug,
      'net_profit_share',
      0.50,
      0,
      0.50,
      'aactivated_rep',
      rep_row.customer_discount_code,
      0,
      '/r/' || rep_row.rep_slug,
      true,
      60,
      'Email: ' || rep_row.rep_email,
      rep_row.rep_email,
      'aactivated_downline',
      guy_rep_id,
      guy_profile_id,
      'aactivated',
      'AACTIVATEDRX',
      '{"palette":["#031924","#25c7d9","#ffffff"],"style":"AACTIVATEDRX downline storefront"}'::jsonb,
      true
    )
    on conflict (rep_slug) do update set
      profile_id = coalesce(excluded.profile_id, public.reps.profile_id),
      rep_name = excluded.rep_name,
      handle = excluded.handle,
      rep_identifier = excluded.rep_identifier,
      commission_type = excluded.commission_type,
      commission_rate = excluded.commission_rate,
      override_percent = excluded.override_percent,
      platform_percent = excluded.platform_percent,
      rep_tier = excluded.rep_tier,
      discount_code = excluded.discount_code,
      discount_amount = excluded.discount_amount,
      referral_path = excluded.referral_path,
      attribution_locked = excluded.attribution_locked,
      attribution_window_days = excluded.attribution_window_days,
      payout_method = excluded.payout_method,
      payout_email = excluded.payout_email,
      rep_channel = excluded.rep_channel,
      parent_rep_id = excluded.parent_rep_id,
      managed_by_profile_id = excluded.managed_by_profile_id,
      custom_store_slug = excluded.custom_store_slug,
      brand_name = excluded.brand_name,
      brand_theme = excluded.brand_theme,
      active = true;

    select id
      into seeded_rep_id
    from public.reps
    where rep_slug = rep_row.rep_slug
    limit 1;

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
      rep_row.rep_slug,
      rep_row.rep_slug || ' / ' || rep_row.rep_name,
      'rep',
      rep_row.rep_slug,
      'GUY60',
      true,
      0.50,
      'AACTIVATEDRX downline rep checkout scope. Customer purchases generate 50% net-profit commission; rep sample/internal orders are excluded.'
    )
    on conflict (scope_code) do update set
      display_name = excluded.display_name,
      account_type = excluded.account_type,
      account_id = excluded.account_id,
      parent_account_id = excluded.parent_account_id,
      is_active = excluded.is_active,
      default_commission_rate = excluded.default_commission_rate,
      notes = excluded.notes,
      updated_at = now();

    insert into public.aactivated_promo_links (
      is_active,
      store_scope_code,
      product_id,
      promo_title,
      discount_code,
      discount_amount,
      discount_type,
      discount_percent,
      promo_kind,
      usage_limit,
      uses_count,
      rep_id,
      rep_slug,
      link_slug,
      notes,
      updated_at
    )
    values (
      true,
      rep_row.rep_slug,
      null,
      rep_row.rep_name || ' Customer Savings',
      rep_row.customer_discount_code,
      0,
      'percentage',
      10,
      'customer_discount',
      null,
      0,
      seeded_rep_id,
      rep_row.rep_slug,
      lower(replace(rep_row.customer_discount_code, '-', '-')) || '-' || lower(rep_row.rep_slug),
      'AACTIVATEDRX customer purchase discount. Customer purchases only; not valid for samples, internal purchases, or wholesale.',
      now()
    )
    on conflict (link_slug) do update set
      is_active = true,
      store_scope_code = excluded.store_scope_code,
      product_id = excluded.product_id,
      promo_title = excluded.promo_title,
      discount_code = excluded.discount_code,
      discount_amount = excluded.discount_amount,
      discount_type = excluded.discount_type,
      discount_percent = excluded.discount_percent,
      promo_kind = excluded.promo_kind,
      usage_limit = excluded.usage_limit,
      rep_id = excluded.rep_id,
      rep_slug = excluded.rep_slug,
      notes = excluded.notes,
      disabled_by = null,
      disabled_at = null,
      updated_at = now();

    insert into public.aactivated_promo_links (
      is_active,
      store_scope_code,
      product_id,
      promo_title,
      discount_code,
      discount_amount,
      discount_type,
      discount_percent,
      promo_kind,
      usage_limit,
      uses_count,
      rep_id,
      rep_slug,
      link_slug,
      notes,
      updated_at
    )
    values (
      true,
      rep_row.rep_slug,
      null,
      rep_row.rep_name || ' Rep Sample Pricing',
      rep_row.internal_purchase_code,
      0,
      'percentage',
      65,
      'rep_sample',
      null,
      0,
      seeded_rep_id,
      rep_row.rep_slug,
      lower(replace(rep_row.internal_purchase_code, '-', '-')) || '-' || lower(rep_row.rep_slug),
      'Internal AACTIVATEDRX rep sample pricing. Requires REP_SAMPLE order_type; no commission, override, wholesale use, leaderboard credit, or public customer checkout use.',
      now()
    )
    on conflict (link_slug) do update set
      is_active = true,
      store_scope_code = excluded.store_scope_code,
      product_id = excluded.product_id,
      promo_title = excluded.promo_title,
      discount_code = excluded.discount_code,
      discount_amount = excluded.discount_amount,
      discount_type = excluded.discount_type,
      discount_percent = excluded.discount_percent,
      promo_kind = excluded.promo_kind,
      usage_limit = excluded.usage_limit,
      rep_id = excluded.rep_id,
      rep_slug = excluded.rep_slug,
      notes = excluded.notes,
      disabled_by = null,
      disabled_at = null,
      updated_at = now();

    insert into public.aactivated_rep_sample_programs (
      store_scope,
      rep_id,
      rep_slug,
      rep_email,
      customer_discount_code,
      internal_purchase_code,
      sample_discount_percent,
      monthly_vial_limit,
      monthly_order_limit,
      eligible_product_ids,
      approval_required_product_ids,
      approval_owner_email,
      status,
      notes
    )
    values (
      'AACTIVATEDRX',
      seeded_rep_id,
      rep_row.rep_slug,
      rep_row.rep_email,
      rep_row.customer_discount_code,
      rep_row.internal_purchase_code,
      65,
      15,
      2,
      eligible_products,
      approval_required_products,
      'guy@aactivated.com',
      'active',
      'Uniform AACTIVATEDRX rep sample model. Sample pricing is 65% off retail and not tied to commission percentage.'
    )
    on conflict (store_scope, rep_id) do update set
      rep_slug = excluded.rep_slug,
      rep_email = excluded.rep_email,
      customer_discount_code = excluded.customer_discount_code,
      internal_purchase_code = excluded.internal_purchase_code,
      sample_discount_percent = excluded.sample_discount_percent,
      monthly_vial_limit = excluded.monthly_vial_limit,
      monthly_order_limit = excluded.monthly_order_limit,
      eligible_product_ids = excluded.eligible_product_ids,
      approval_required_product_ids = excluded.approval_required_product_ids,
      approval_owner_email = excluded.approval_owner_email,
      status = excluded.status,
      notes = excluded.notes,
      updated_at = now();

    insert into public.partner_rep_commission_settings (
      store_scope,
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
      internal_notes
    )
    values (
      'AACTIVATEDRX',
      guy_profile_id,
      'guy@aactivated.com',
      seeded_rep_id,
      rep_row.rep_email,
      'flat_net_profit',
      50,
      0,
      false,
      'active',
      rep_row.rep_name || ' receives 50% net-profit commission on customer purchases.',
      'Parent store AACTIVATEDRX. Parent scope GUY60. Approval owner Guy Griffithe. Rep sample/internal orders excluded from commissions.'
    )
    on conflict (store_scope, rep_id) do update set
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
      updated_at = now();

    insert into public.partner_rep_store_settings (
      store_scope,
      partner_admin_id,
      partner_admin_email,
      rep_id,
      rep_email,
      rep_name,
      public_display_name,
      store_slug,
      storefront_path,
      pricing_mode,
      features,
      promo_config,
      status,
      activated_at,
      internal_notes
    )
    values (
      'AACTIVATEDRX',
      guy_profile_id,
      'guy@aactivated.com',
      seeded_rep_id,
      rep_row.rep_email,
      rep_row.rep_name,
      rep_row.rep_slug,
      rep_row.rep_slug,
      '/AACTIVATED?rep=' || rep_row.rep_slug,
      'aactivated_default',
      jsonb_build_object(
        'storefront', true,
        'rep_portal', true,
        'checkout_attribution', true,
        'customer_discount_codes', true,
        'rep_sample_program', true
      ),
      jsonb_build_object(
        'attribution_code', rep_row.rep_slug,
        'referral_link', '/r/' || rep_row.rep_slug,
        'storefront_link', '/AACTIVATED?rep=' || rep_row.rep_slug,
        'rep_portal', '/rep',
        'customer_discount_code', rep_row.customer_discount_code,
        'customer_discount_percent', 10,
        'internal_purchase_code', rep_row.internal_purchase_code,
        'sample_discount_percent', 65,
        'sample_monthly_vial_limit', 15,
        'sample_monthly_order_limit', 2
      ),
      'active',
      now(),
      'AACTIVATEDRX rep storefront approved by Guy Griffithe. Internal sample pricing requires REP_SAMPLE order type.'
    )
    on conflict (store_scope, rep_id) do update set
      partner_admin_id = excluded.partner_admin_id,
      partner_admin_email = excluded.partner_admin_email,
      rep_email = excluded.rep_email,
      rep_name = excluded.rep_name,
      public_display_name = excluded.public_display_name,
      store_slug = excluded.store_slug,
      storefront_path = excluded.storefront_path,
      pricing_mode = excluded.pricing_mode,
      features = excluded.features,
      promo_config = excluded.promo_config,
      status = excluded.status,
      activated_at = coalesce(public.partner_rep_store_settings.activated_at, excluded.activated_at),
      disabled_at = null,
      internal_notes = excluded.internal_notes,
      updated_at = now();

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
      'rep_program_activated',
      'reps',
      seeded_rep_id,
      seeded_rep_id,
      jsonb_build_object(
        'rep_slug', rep_row.rep_slug,
        'rep_email', rep_row.rep_email,
        'storefront_link', '/AACTIVATED?rep=' || rep_row.rep_slug,
        'referral_link', '/r/' || rep_row.rep_slug,
        'customer_discount_code', rep_row.customer_discount_code,
        'internal_purchase_code', rep_row.internal_purchase_code,
        'commission_percent', 50,
        'sample_discount_percent', 65
      ),
      rep_row.rep_slug || ' AACTIVATEDRX rep storefront, promo codes, commission settings, and sample guardrails seeded.'
    );
  end loop;
end $$;
