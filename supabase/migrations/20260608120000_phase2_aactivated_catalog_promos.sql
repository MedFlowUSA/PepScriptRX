-- Phase 2 revenue optimization:
-- - AACTIVATED catalog completeness for approved requested products.
-- - Admin-controlled Top Sellers via aactivated_store_product_prices.featured/sort_order.
-- - Server-authoritative AACTIVATED promo code engine.

alter table public.aactivated_promo_links
  add column if not exists discount_type text not null default 'fixed_amount',
  add column if not exists discount_percent numeric(5,2),
  add column if not exists starts_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists usage_limit integer,
  add column if not exists uses_count integer not null default 0,
  add column if not exists rep_id uuid references public.reps(id) on delete set null,
  add column if not exists rep_slug text,
  add column if not exists min_subtotal numeric(10,2) not null default 0;

update public.aactivated_promo_links
set discount_type = 'fixed_amount'
where discount_type is null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'aactivated_promo_links_discount_type_check') then
    alter table public.aactivated_promo_links
      add constraint aactivated_promo_links_discount_type_check
      check (discount_type in ('fixed_amount', 'percentage'));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'aactivated_promo_links_discount_percent_check') then
    alter table public.aactivated_promo_links
      add constraint aactivated_promo_links_discount_percent_check
      check (discount_percent is null or (discount_percent > 0 and discount_percent <= 100));
  end if;

  if not exists (select 1 from pg_constraint where conname = 'aactivated_promo_links_usage_limit_check') then
    alter table public.aactivated_promo_links
      add constraint aactivated_promo_links_usage_limit_check
      check (usage_limit is null or usage_limit > 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'aactivated_promo_links_uses_count_check') then
    alter table public.aactivated_promo_links
      add constraint aactivated_promo_links_uses_count_check
      check (uses_count >= 0);
  end if;

  if not exists (select 1 from pg_constraint where conname = 'aactivated_promo_links_min_subtotal_check') then
    alter table public.aactivated_promo_links
      add constraint aactivated_promo_links_min_subtotal_check
      check (min_subtotal >= 0);
  end if;
end $$;

create index if not exists aactivated_promo_links_code_valid_idx
  on public.aactivated_promo_links(discount_code, is_active, expires_at, usage_limit, uses_count);

create index if not exists aactivated_promo_links_rep_idx
  on public.aactivated_promo_links(rep_id, rep_slug);

create or replace function public.is_aactivated_rep_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.reps r
    where r.profile_id = p_profile_id
      and r.active = true
      and (
        upper(coalesce(r.custom_store_slug, '')) = 'AACTIVATED'
        or upper(coalesce(r.brand_name, '')) = 'AACTIVATEDRX'
        or upper(coalesce(r.rep_channel, '')) = 'AACTIVATED_DOWNLINE'
        or upper(coalesce(r.rep_tier, '')) = 'AACTIVATED_REP'
        or upper(coalesce(r.rep_slug, '')) in ('GUY60', 'VITALITYINS')
      )
  );
$$;

drop policy if exists "public_read_active_aactivated_promo_links" on public.aactivated_promo_links;
create policy "public_read_active_aactivated_promo_links"
on public.aactivated_promo_links for select
using (
  is_active = true
  and (starts_at is null or starts_at <= now())
  and (expires_at is null or expires_at > now())
  and (usage_limit is null or uses_count < usage_limit)
);

drop policy if exists "admin_manage_aactivated_promo_links" on public.aactivated_promo_links;
create policy "admin_manage_aactivated_promo_links"
on public.aactivated_promo_links for all
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'owner', 'platform_admin', 'super_admin', 'rx_plus_admin')
  )
  or exists (
    select 1
    from public.reps r
    where r.id = aactivated_promo_links.rep_id
      and r.profile_id = auth.uid()
      and r.active = true
      and public.is_aactivated_rep_profile(auth.uid())
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'owner', 'platform_admin', 'super_admin', 'rx_plus_admin')
  )
  or exists (
    select 1
    from public.reps r
    where r.id = aactivated_promo_links.rep_id
      and r.profile_id = auth.uid()
      and r.active = true
      and public.is_aactivated_rep_profile(auth.uid())
  )
);

with catalog(sku, product_key, product_name, display_name, category, strength, retail_price, wholesale_cost, description) as (
  values
    ('RXP-GLP-SEMA-10', 'semaglutide-10mg', 'Semaglutide', 'Semaglutide 10mg', 'GLP / Weight Management', '10mg', 99.00, 7.50, 'GLP weight-management option available through partner review.'),
    ('RXP-REC-GLOW', 'glow-peptide-blend', 'Glow Peptide Blend', 'Glow Peptide Blend', 'Recovery / Repair', 'Blend', 169.00, 17.25, 'Recovery and skin-support blend available through partner review.'),
    ('RXP-REC-KLOW', 'klow-peptide-blend', 'Klow Peptide Blend', 'Klow Peptide Blend', 'Recovery / Repair', 'Blend', 169.00, 17.25, 'Recovery and repair blend available through partner review.'),
    ('RXP-GROW-IGF1-LR3-1', 'igf-1-lr3-1mg', 'IGF-1 LR3', 'IGF-1 LR3 1mg', 'Growth / Performance', '1mg', 199.00, 20.00, 'Growth and performance support item requiring additional verification.')
)
insert into public.rx_plus_products (
  sku, product_name, display_name, category, strength, suggested_retail_price, retail_price,
  base_cost, true_wholesale_cost_per_vial, active, visibility_type, public_visible,
  partner_visible, partner_slug, featured, description
)
select
  sku, product_name, display_name, category, strength, retail_price, retail_price,
  0, wholesale_cost, true, 'rx_plus', false,
  true, 'guy', false, description
from catalog
on conflict (sku) do update set
  product_name = excluded.product_name,
  display_name = excluded.display_name,
  category = excluded.category,
  strength = excluded.strength,
  suggested_retail_price = excluded.suggested_retail_price,
  retail_price = excluded.retail_price,
  true_wholesale_cost_per_vial = excluded.true_wholesale_cost_per_vial,
  active = excluded.active,
  visibility_type = excluded.visibility_type,
  partner_visible = excluded.partner_visible,
  partner_slug = excluded.partner_slug,
  description = excluded.description,
  updated_at = now();

with catalog(sku, wholesale_cost) as (
  values
    ('RXP-GLP-SEMA-10', 7.50),
    ('RXP-REC-GLOW', 17.25),
    ('RXP-REC-KLOW', 17.25),
    ('RXP-GROW-IGF1-LR3-1', 20.00)
)
insert into public.distributor_products (
  distributor_id, product_id, is_enabled, enabled, custom_price, custom_retail_price,
  featured, internal_wholesale_cost_per_vial, commission_rate
)
select
  d.id, p.id, true, true, p.retail_price, p.retail_price,
  false, c.wholesale_cost, 0.6000
from catalog c
join public.rx_plus_products p on p.sku = c.sku
join public.distributors d on d.slug = 'guy'
on conflict (distributor_id, product_id) do update set
  is_enabled = true,
  enabled = true,
  custom_price = excluded.custom_price,
  custom_retail_price = excluded.custom_retail_price,
  internal_wholesale_cost_per_vial = excluded.internal_wholesale_cost_per_vial,
  commission_rate = excluded.commission_rate,
  updated_at = now();

with storefront(product_id, product_name, retail_price, featured, sort_order) as (
  values
    ('retatrutide-10mg', 'Retatrutide 10mg', 200.00, true, 10),
    ('tirzepatide-30mg', 'Tirzepatide 30mg', 600.00, true, 20),
    ('wolverine-bpc-tb', 'Wolverine BPC/TB Blend', 149.00, true, 30),
    ('nad-500iu', 'NAD+ 500iu', 119.00, true, 40),
    ('tesamorelin-10mg', 'Tesamorelin 10mg', 229.00, true, 50),
    ('cjc-ipamorelin-10mg', 'CJC + Ipamorelin 10mg', 149.00, true, 60),
    ('semaglutide-10mg', 'Semaglutide 10mg', 99.00, false, 70),
    ('glow-peptide-blend', 'Glow Peptide Blend', 169.00, false, 80),
    ('klow-peptide-blend', 'Klow Peptide Blend', 169.00, false, 90),
    ('igf-1-lr3-1mg', 'IGF-1 LR3 1mg', 199.00, false, 100)
)
insert into public.aactivated_store_product_prices (
  store_slug, product_id, product_name, retail_price, sale_price, is_active, featured, sort_order, product_note, updated_at
)
select
  'aactivated', product_id, product_name, retail_price, null, true, featured, sort_order,
  case when product_id = 'igf-1-lr3-1mg' then 'Additional verification required before fulfillment.' else null end,
  now()
from storefront
on conflict (store_slug, product_id) do nothing;

create or replace function public.apply_aactivated_server_promo_to_submission()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_raw_code text := upper(coalesce(new.discount_code, ''));
  v_base_code text := split_part(upper(coalesce(new.discount_code, '')), '+', 1);
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
    and p.is_active = true
    and (p.starts_at is null or p.starts_at <= now())
    and (p.expires_at is null or p.expires_at > now())
    and (p.usage_limit is null or p.uses_count < p.usage_limit)
    and coalesce(p.min_subtotal, 0) <= v_product_total
  order by p.created_at desc
  limit 1
  for update;

  if not found then
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
before insert or update of discount_code, order_items, quoted_price, shipping_cost, checkout_scope_code, source_portal, source_store, store_slug, store_name
on public.patient_submissions
for each row
execute function public.apply_aactivated_server_promo_to_submission();
