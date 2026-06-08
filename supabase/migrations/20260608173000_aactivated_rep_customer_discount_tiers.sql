-- AACTIVATEDRX-only pre-approved customer promo tiers.
-- Keeps customer-facing rep promos separate from REP-* sample/internal purchase codes.

alter table public.aactivated_promo_links
  add column if not exists requires_platform_approval boolean not null default false,
  add column if not exists approval_status text not null default 'approved',
  add column if not exists approved_by uuid references public.profiles(id) on delete set null,
  add column if not exists approved_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'aactivated_promo_links_approval_status_check') then
    alter table public.aactivated_promo_links
      add constraint aactivated_promo_links_approval_status_check
      check (approval_status in ('approved', 'pending_platform_approval', 'rejected'));
  end if;
end $$;

alter table public.patient_submissions
  add column if not exists promo_discount_percent numeric(5,2),
  add column if not exists promo_rep_slug text,
  add column if not exists commission_basis_amount numeric(10,2),
  add column if not exists final_customer_paid_amount numeric(10,2);

create index if not exists aactivated_promo_links_rep_customer_tiers_idx
  on public.aactivated_promo_links(rep_slug, promo_kind, discount_percent, is_active);

update public.aactivated_promo_links
set
  requires_platform_approval = true,
  approval_status = 'pending_platform_approval',
  is_active = false,
  notes = trim(coalesce(notes, '') || ' Platform approval required for customer fixed-dollar or >30% discount.'),
  updated_at = now()
where promo_kind = 'customer_discount'
  and (
    discount_type = 'fixed_amount'
    or coalesce(discount_percent, 0) > 30
  )
  and coalesce(requires_platform_approval, false) = false;

drop policy if exists "public_read_active_aactivated_promo_links" on public.aactivated_promo_links;
create policy "public_read_active_aactivated_promo_links"
on public.aactivated_promo_links for select
using (
  is_active = true
  and promo_kind = 'customer_discount'
  and (starts_at is null or starts_at <= now())
  and (expires_at is null or expires_at > now())
  and (usage_limit is null or uses_count < usage_limit)
  and (
    requires_platform_approval = false
    or approval_status = 'approved'
  )
);

do $$
declare
  tier integer;
  rep_row record;
  seeded_rep_id uuid;
  code_text text;
begin
  for rep_row in
    select *
    from (
      values
        ('ADONIS', 'ADONIS', 'Anthony Davis'),
        ('AAMIR', 'AAMIR', 'Aamir Paige'),
        ('2LEGIT', '2LEGIT', 'Isaac Muniz'),
        ('WENDYCREATES54', 'WENDY', 'Wendy Meyer'),
        ('JUJUAN', 'JUJUAN', 'Jujuan Gailey'),
        ('POWERS', 'POWERS', 'Caylee Powers'),
        ('OMGBILLY', 'OMGBILLY', 'Billy')
    ) as reps_to_seed(rep_slug, code_base, rep_name)
  loop
    select id
      into seeded_rep_id
    from public.reps
    where upper(rep_slug) = rep_row.rep_slug
      and active = true
    limit 1;

    if seeded_rep_id is null then
      continue;
    end if;

    foreach tier in array array[15, 20, 25, 30]
    loop
      code_text := rep_row.code_base || tier::text;

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
        requires_platform_approval,
        approval_status,
        updated_at
      )
      values (
        true,
        rep_row.rep_slug,
        null,
        rep_row.rep_name || ' ' || tier::text || '% Customer Promo',
        code_text,
        0,
        'percentage',
        tier,
        'customer_discount',
        null,
        0,
        seeded_rep_id,
        rep_row.rep_slug,
        lower(code_text) || '-' || lower(rep_row.rep_slug),
        'AACTIVATEDRX customer-facing pre-approved rep promo tier. Not valid for REP_SAMPLE, REP_INTERNAL, or wholesale order types. Commission is calculated on discounted net revenue.',
        false,
        'approved',
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
        requires_platform_approval = false,
        approval_status = 'approved',
        disabled_by = null,
        disabled_at = null,
        updated_at = now();
    end loop;
  end loop;
end $$;

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
    upper(coalesce(new.checkout_scope_code, '')) in ('AACTIVATED', 'AACTIVATEDRX', 'VITALITYINS', 'GUY60', 'ADONIS', 'AAMIR', '2LEGIT', 'WENDYCREATES54', 'JUJUAN', 'POWERS', 'OMGBILLY', 'BOSSIQUIT')
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
    and (
      p.requires_platform_approval = false
      or p.approval_status = 'approved'
    )
  order by p.created_at desc
  limit 1
  for update;

  if not found then
    if v_order_type = 'CUSTOMER_ORDER' and v_base_code like 'REP-%' then
      new.discount_amount := 0;
      new.discount_cents := 0;
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
    new.discount_cents := 0;
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
  new.promo_discount_percent := case when v_promo.discount_type = 'percentage' then v_promo.discount_percent else null end;
  new.promo_rep_slug := v_promo.rep_slug;
  new.commission_basis_amount := greatest(0, v_product_total - v_discount);
  new.final_customer_paid_amount := new.order_total;

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
