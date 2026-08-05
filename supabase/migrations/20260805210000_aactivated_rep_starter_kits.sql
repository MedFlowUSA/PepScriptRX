begin;

create table if not exists public.aactivated_starter_kit_packages (
  package_id text primary key,
  package_tier text not null check (package_tier in ('starter_experience', 'momentum_business_builder', 'ultimate_business_builder')),
  package_name text not null,
  promo_label text,
  description text not null default '',
  retail_value numeric(12,2) not null check (retail_value >= 0),
  promo_price numeric(12,2) not null check (promo_price >= 0),
  savings numeric(12,2) not null check (savings >= 0),
  purchase_limit integer not null default 1 check (purchase_limit >= 0),
  commission_enabled boolean not null default false,
  enabled boolean not null default true,
  resources jsonb not null default '[]'::jsonb,
  sort_order integer not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.aactivated_starter_kit_variations (
  package_id text not null references public.aactivated_starter_kit_packages(package_id) on delete cascade,
  variation_id text not null,
  variation_name text not null,
  retail_value numeric(12,2) not null check (retail_value >= 0),
  promo_price numeric(12,2) not null check (promo_price >= 0),
  savings numeric(12,2) not null check (savings >= 0),
  sort_order integer not null default 100,
  primary key (package_id, variation_id)
);

create table if not exists public.aactivated_starter_kit_components (
  id uuid primary key default gen_random_uuid(),
  package_id text not null references public.aactivated_starter_kit_packages(package_id) on delete cascade,
  variation_id text,
  inventory_sku text not null,
  display_name text not null,
  quantity integer not null check (quantity > 0),
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

create unique index if not exists aactivated_starter_kit_components_uidx
  on public.aactivated_starter_kit_components(package_id, (coalesce(variation_id, '')), (upper(inventory_sku)));

create table if not exists public.aactivated_starter_kit_orders (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.patient_submissions(id) on delete cascade,
  package_id text not null references public.aactivated_starter_kit_packages(package_id),
  variation_id text,
  package_name text not null,
  package_tier text not null,
  variation_name text,
  rep_profile_id uuid references public.profiles(id) on delete set null,
  rep_id uuid references public.reps(id) on delete set null,
  rep_slug text,
  rep_name text,
  rep_email text,
  brand_id text not null default 'aactivated',
  retail_value numeric(12,2) not null,
  promo_price numeric(12,2) not null,
  savings numeric(12,2) not null,
  component_snapshot jsonb not null default '[]'::jsonb,
  inventory_deductions jsonb not null default '[]'::jsonb,
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','payment_exception','cancelled','refunded')),
  fulfillment_status text not null default 'pending',
  eligibility_override_id uuid,
  checkout_created_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists aactivated_starter_kit_orders_rep_idx
  on public.aactivated_starter_kit_orders(rep_profile_id, rep_id, package_id, payment_status);

create table if not exists public.aactivated_starter_kit_eligibility_overrides (
  id uuid primary key default gen_random_uuid(),
  rep_profile_id uuid references public.profiles(id) on delete cascade,
  rep_id uuid references public.reps(id) on delete cascade,
  package_id text references public.aactivated_starter_kit_packages(package_id) on delete cascade,
  variation_id text,
  override_type text not null check (override_type in ('reopen','ineligible')),
  reason text not null,
  active boolean not null default true,
  expires_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists aactivated_starter_kit_overrides_lookup_idx
  on public.aactivated_starter_kit_eligibility_overrides(rep_profile_id, rep_id, package_id, active, expires_at);

create table if not exists public.aactivated_starter_kit_resource_access (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null unique references public.patient_submissions(id) on delete cascade,
  rep_profile_id uuid references public.profiles(id) on delete cascade,
  rep_id uuid references public.reps(id) on delete cascade,
  package_id text not null references public.aactivated_starter_kit_packages(package_id) on delete cascade,
  package_tier text not null,
  resources jsonb not null default '[]'::jsonb,
  unlocked_at timestamptz not null default now()
);

create table if not exists public.aactivated_starter_kit_audit_log (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid references public.profiles(id) on delete set null,
  actor_email text,
  action text not null,
  target_table text not null,
  target_id text,
  old_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.is_aactivated_starter_kit_admin()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select coalesce(public.is_current_profile_platform_admin(), false)
    or coalesce(public.is_aactivated_partner_ops_admin(), false);
$$;

create or replace function public.is_aactivated_starter_kit_rep()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists (
    select 1
    from public.reps r
    where r.profile_id = public.current_profile_id()
      and coalesce(r.active, true)
      and (
        upper(coalesce(r.rep_slug, '')) in ('GUY60','AACTIVATED','AACTIVATEDRX','VITALITYINS')
        or lower(concat_ws(' ', r.brand_id, r.parent_brand_id, r.custom_store_slug, r.assigned_store_slug, r.brand_name, r.rep_channel, r.rep_tier, r.parent_type)) like '%aactivated%'
        or r.managed_by_profile_id in (select profile_id from public.reps where upper(rep_slug) = 'GUY60')
        or r.parent_rep_id in (select id from public.reps where upper(rep_slug) = 'GUY60')
      )
  );
$$;

create or replace function public.is_aactivated_starter_kit_user()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select public.is_aactivated_starter_kit_admin() or public.is_aactivated_starter_kit_rep();
$$;

create or replace function public.touch_aactivated_starter_kit_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_aactivated_starter_kit_packages_updated_at on public.aactivated_starter_kit_packages;
create trigger trg_aactivated_starter_kit_packages_updated_at
before update on public.aactivated_starter_kit_packages
for each row execute function public.touch_aactivated_starter_kit_updated_at();

drop trigger if exists trg_aactivated_starter_kit_orders_updated_at on public.aactivated_starter_kit_orders;
create trigger trg_aactivated_starter_kit_orders_updated_at
before update on public.aactivated_starter_kit_orders
for each row execute function public.touch_aactivated_starter_kit_updated_at();

insert into public.aactivated_starter_kit_packages (
  package_id, package_tier, package_name, promo_label, description,
  retail_value, promo_price, savings, purchase_limit, resources, sort_order
) values
  ('starter-experience-kit', 'starter_experience', 'Starter Experience Kit', 'CHOOSE YOUR STARTER STACK', 'A controlled first kit for new AACTIVATEDRX reps.', 447, 249, 198, 1,
   '[{"title":"Starter selling guide","path":"/resources/aactivated/starter-selling-guide"},{"title":"Follow-up scripts","path":"/resources/aactivated/follow-up-scripts"}]'::jsonb, 10),
  ('momentum-business-builder-kit', 'momentum_business_builder', 'Momentum Business Builder Kit', 'MOST POPULAR', 'A broader launch kit for active customer conversations.', 850, 499, 351, 1,
   '[{"title":"Business builder guide","path":"/resources/aactivated/business-builder-guide"},{"title":"Product conversation map","path":"/resources/aactivated/product-conversation-map"}]'::jsonb, 20),
  ('ultimate-business-builder-kit', 'ultimate_business_builder', 'Ultimate Business Builder Kit', 'FULLY STACKED', 'The full AACTIVATEDRX rep launch kit.', 1099, 699, 400, 1,
   '[{"title":"Advanced stack guide","path":"/resources/aactivated/advanced-stack-guide"},{"title":"Premium sales asset pack","path":"/resources/aactivated/premium-asset-pack"}]'::jsonb, 30)
on conflict (package_id) do update set
  package_tier = excluded.package_tier,
  package_name = excluded.package_name,
  promo_label = excluded.promo_label,
  description = excluded.description,
  retail_value = excluded.retail_value,
  promo_price = excluded.promo_price,
  savings = excluded.savings,
  purchase_limit = excluded.purchase_limit,
  commission_enabled = false,
  resources = excluded.resources,
  sort_order = excluded.sort_order;

insert into public.aactivated_starter_kit_variations (
  package_id, variation_id, variation_name, retail_value, promo_price, savings, sort_order
) values
  ('starter-experience-kit', 'reta', 'RETA Starter', 447, 249, 198, 10),
  ('starter-experience-kit', 'tirz', 'Tirzepatide Starter', 567, 349, 218, 20)
on conflict (package_id, variation_id) do update set
  variation_name = excluded.variation_name,
  retail_value = excluded.retail_value,
  promo_price = excluded.promo_price,
  savings = excluded.savings,
  sort_order = excluded.sort_order;

delete from public.aactivated_starter_kit_components
where package_id in ('starter-experience-kit','momentum-business-builder-kit','ultimate-business-builder-kit');

insert into public.aactivated_starter_kit_components (package_id, variation_id, inventory_sku, display_name, quantity, sort_order) values
  ('starter-experience-kit','reta','RXP-GLP-RETA-20','RETA 20 mg',1,10),
  ('starter-experience-kit','reta','RXP-LONG-NAD-1000','NAD+ 1000 mg',1,20),
  ('starter-experience-kit','reta','RXP-MAIN-GLOW70','Glow',1,30),
  ('starter-experience-kit','reta','WA10','BAC Water 10 mL',2,40),
  ('starter-experience-kit','tirz','TR30','Tirzepatide 30 mg',1,10),
  ('starter-experience-kit','tirz','RXP-LONG-NAD-1000','NAD+ 1000 mg',1,20),
  ('starter-experience-kit','tirz','RXP-MAIN-WOLVERINE-20','Wolverine Stack 10 mg',1,30),
  ('starter-experience-kit','tirz','WA10','BAC Water 10 mL',2,40),
  ('momentum-business-builder-kit',null,'RXP-GLP-RETA-20','RETA 20 mg',1,10),
  ('momentum-business-builder-kit',null,'TR30','Tirzepatide 30 mg',1,20),
  ('momentum-business-builder-kit',null,'RXP-LONG-NAD-1000','NAD+ 1000 mg',1,30),
  ('momentum-business-builder-kit',null,'RXP-MAIN-GLOW70','Glow',1,40),
  ('momentum-business-builder-kit',null,'RXP-MAIN-WOLVERINE-20','Wolverine Stack 10 mg',1,50),
  ('momentum-business-builder-kit',null,'WA10','BAC Water 10 mL',2,60),
  ('ultimate-business-builder-kit',null,'RXP-GLP-RETA-20','RETA 20 mg',1,10),
  ('ultimate-business-builder-kit',null,'TR30','Tirzepatide 30 mg',1,20),
  ('ultimate-business-builder-kit',null,'RXP-MAIN-WOLVERINE-20','Wolverine Stack 20 mg',1,30),
  ('ultimate-business-builder-kit',null,'RXP-REC-BPC157-10','BPC-157 10 mg',1,40),
  ('ultimate-business-builder-kit',null,'RXP-LONG-NAD-1000','NAD+ 1000 mg',1,50),
  ('ultimate-business-builder-kit',null,'RXP-MAIN-GLOW70','Glow',1,60),
  ('ultimate-business-builder-kit',null,'WA10','BAC Water 10 mL',3,70);

create or replace function public.get_aactivated_starter_kit_availability()
returns table (
  package_id text,
  variation_id text,
  components jsonb,
  is_available boolean,
  limiting_sku text,
  available_qty integer,
  needed_qty integer,
  already_purchased boolean,
  can_purchase boolean,
  message text
)
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_profile uuid := public.current_profile_id();
  v_rep public.reps%rowtype;
  v_admin boolean := public.is_aactivated_starter_kit_admin();
  v_key record;
  v_parts jsonb;
  v_low record;
  v_purchased boolean;
begin
  if not public.is_aactivated_starter_kit_user() then
    raise exception 'AACTIVATED starter kits are private.';
  end if;

  select * into v_rep
  from public.reps r
  where r.profile_id = v_profile
    and coalesce(r.active, true)
  order by r.created_at desc
  limit 1;

  for v_key in
    select p.package_id, v.variation_id
    from public.aactivated_starter_kit_packages p
    left join public.aactivated_starter_kit_variations v on v.package_id = p.package_id
    where p.enabled
    order by p.sort_order, v.sort_order nulls first
  loop
    select jsonb_agg(jsonb_build_object(
      'sku', c.inventory_sku,
      'name', c.display_name,
      'quantity', c.quantity,
      'current_qty', coalesce(i.current_qty, 0),
      'active', coalesce(i.active, false)
    ) order by c.sort_order)
    into v_parts
    from public.aactivated_starter_kit_components c
    left join public.inventory_items i on upper(i.sku) = upper(c.inventory_sku)
    where c.package_id = v_key.package_id
      and coalesce(c.variation_id, '') = coalesce(v_key.variation_id, '');

    select c.inventory_sku, coalesce(i.current_qty, 0) as available, c.quantity as needed
    into v_low
    from public.aactivated_starter_kit_components c
    left join public.inventory_items i on upper(i.sku) = upper(c.inventory_sku)
    where c.package_id = v_key.package_id
      and coalesce(c.variation_id, '') = coalesce(v_key.variation_id, '')
      and (i.id is null or coalesce(i.active, false) = false or coalesce(i.current_qty, 0) < c.quantity)
    order by coalesce(i.current_qty, 0) asc
    limit 1;

    select exists (
      select 1
      from public.aactivated_starter_kit_orders o
      where o.package_id = v_key.package_id
        and o.payment_status in ('pending','paid')
        and (
          o.rep_profile_id = v_profile
          or (v_rep.id is not null and o.rep_id = v_rep.id)
        )
    ) into v_purchased;

    package_id := v_key.package_id;
    variation_id := v_key.variation_id;
    components := coalesce(v_parts, '[]'::jsonb);
    is_available := v_low.inventory_sku is null;
    limiting_sku := v_low.inventory_sku;
    available_qty := coalesce(v_low.available, 0);
    needed_qty := coalesce(v_low.needed, 0);
    already_purchased := v_purchased;
    can_purchase := (v_low.inventory_sku is null) and (v_admin or not v_purchased) and v_rep.id is not null;
    message := case
      when v_rep.id is null and not v_admin then 'Rep profile required.'
      when v_low.inventory_sku is not null then 'Inventory is not available for every kit component.'
      when v_purchased and not v_admin then 'Purchase limit reached for this kit.'
      else 'Ready'
    end;
    return next;
  end loop;
end;
$$;

create or replace function public.finalize_aactivated_starter_kit_order(p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public, pg_temp
as $$
declare
  v_order public.aactivated_starter_kit_orders%rowtype;
  v_submission public.patient_submissions%rowtype;
  v_component jsonb;
  v_item public.inventory_items%rowtype;
  v_qty integer;
  v_deductions jsonb := '[]'::jsonb;
begin
  select * into v_order
  from public.aactivated_starter_kit_orders
  where submission_id = p_submission_id
  for update;

  if not found then
    return jsonb_build_object('result','not_starter_kit');
  end if;
  if v_order.payment_status = 'paid' or v_order.completed_at is not null then
    return jsonb_build_object('result','already_finalized');
  end if;

  select * into v_submission
  from public.patient_submissions
  where id = p_submission_id
  for update;

  if not found or coalesce(v_submission.payment_status, '') <> 'paid' then
    return jsonb_build_object('result','not_paid');
  end if;

  for v_component in select value from jsonb_array_elements(v_order.component_snapshot)
  loop
    v_qty := greatest(1, coalesce((v_component->>'quantity')::integer, 1));
    select * into v_item
    from public.inventory_items
    where upper(sku) = upper(v_component->>'sku')
    for update;

    if not found or coalesce(v_item.active, false) = false or coalesce(v_item.current_qty, 0) < v_qty then
      update public.aactivated_starter_kit_orders
      set payment_status = 'payment_exception',
          fulfillment_status = 'inventory_exception',
          updated_at = now()
      where id = v_order.id;
      raise exception 'AACTIVATED starter kit inventory unavailable for %', coalesce(v_component->>'sku', 'unknown');
    end if;

    update public.inventory_items
    set current_qty = current_qty - v_qty,
        updated_at = now()
    where id = v_item.id;

    insert into public.inventory_adjustments (inventory_item_id, actor_profile_id, adjustment_qty, reason, notes)
    values (v_item.id, null, -v_qty, 'aactivated_starter_kit_paid_order',
      'Paid AACTIVATED starter kit order ' || coalesce(v_submission.order_number, p_submission_id::text));

    insert into public.sales_log (
      order_number, submission_id, inventory_item_id, sku, product_name,
      qty_sold, unit_cost, revenue, rep_id, rep_code
    ) values (
      v_submission.order_number, p_submission_id, v_item.id, v_item.sku, v_item.product_name,
      v_qty, coalesce(v_item.true_landed_cost_per_vial, 0), 0, v_order.rep_id, v_order.rep_slug
    );

    v_deductions := v_deductions || jsonb_build_array(jsonb_build_object(
      'sku', v_item.sku,
      'quantity', v_qty,
      'inventory_item_id', v_item.id,
      'deducted_at', now()
    ));
  end loop;

  update public.aactivated_starter_kit_orders
  set payment_status = 'paid',
      fulfillment_status = 'pending',
      completed_at = now(),
      inventory_deductions = v_deductions,
      updated_at = now()
  where id = v_order.id;

  insert into public.aactivated_starter_kit_resource_access (
    submission_id, rep_profile_id, rep_id, package_id, package_tier, resources
  )
  select
    v_order.submission_id, v_order.rep_profile_id, v_order.rep_id,
    p.package_id, p.package_tier, p.resources
  from public.aactivated_starter_kit_packages p
  where p.package_id = v_order.package_id
  on conflict (submission_id) do update set
    resources = excluded.resources,
    unlocked_at = now();

  insert into public.aactivated_starter_kit_audit_log(action, target_table, target_id, new_value)
  values ('starter_kit_paid_finalized', 'aactivated_starter_kit_orders', v_order.id::text,
    jsonb_build_object('submission_id', p_submission_id, 'deductions', v_deductions));

  return jsonb_build_object('result','finalized','deductions',v_deductions);
end;
$$;

create or replace function public.handle_aactivated_starter_kit_paid()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if new.payment_status = 'paid'
     and new.status in ('paid','fulfilled')
     and (old.payment_status is distinct from new.payment_status or old.status is distinct from new.status)
     and exists (select 1 from public.aactivated_starter_kit_orders o where o.submission_id = new.id) then
    perform public.finalize_aactivated_starter_kit_order(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists zz_aactivated_starter_kit_paid on public.patient_submissions;
create trigger zz_aactivated_starter_kit_paid
after update of status, payment_status on public.patient_submissions
for each row execute function public.handle_aactivated_starter_kit_paid();

alter table public.aactivated_starter_kit_packages enable row level security;
alter table public.aactivated_starter_kit_variations enable row level security;
alter table public.aactivated_starter_kit_components enable row level security;
alter table public.aactivated_starter_kit_orders enable row level security;
alter table public.aactivated_starter_kit_eligibility_overrides enable row level security;
alter table public.aactivated_starter_kit_resource_access enable row level security;
alter table public.aactivated_starter_kit_audit_log enable row level security;

grant select on public.aactivated_starter_kit_packages, public.aactivated_starter_kit_variations, public.aactivated_starter_kit_components to authenticated;
grant update on public.aactivated_starter_kit_variations to authenticated;
grant select on public.aactivated_starter_kit_orders, public.aactivated_starter_kit_eligibility_overrides, public.aactivated_starter_kit_resource_access, public.aactivated_starter_kit_audit_log to authenticated;
grant update on public.aactivated_starter_kit_packages to authenticated;
grant insert, update on public.aactivated_starter_kit_eligibility_overrides to authenticated;
grant all on public.aactivated_starter_kit_packages, public.aactivated_starter_kit_variations, public.aactivated_starter_kit_components, public.aactivated_starter_kit_orders, public.aactivated_starter_kit_eligibility_overrides, public.aactivated_starter_kit_resource_access, public.aactivated_starter_kit_audit_log to service_role;

drop policy if exists "aactivated starter users read packages" on public.aactivated_starter_kit_packages;
create policy "aactivated starter users read packages" on public.aactivated_starter_kit_packages
for select to authenticated using (public.is_aactivated_starter_kit_user());

drop policy if exists "aactivated starter admins update packages" on public.aactivated_starter_kit_packages;
create policy "aactivated starter admins update packages" on public.aactivated_starter_kit_packages
for update to authenticated using (public.is_aactivated_starter_kit_admin()) with check (public.is_aactivated_starter_kit_admin());

drop policy if exists "aactivated starter users read variations" on public.aactivated_starter_kit_variations;
create policy "aactivated starter users read variations" on public.aactivated_starter_kit_variations
for select to authenticated using (public.is_aactivated_starter_kit_user());

drop policy if exists "aactivated starter admins update variations" on public.aactivated_starter_kit_variations;
create policy "aactivated starter admins update variations" on public.aactivated_starter_kit_variations
for update to authenticated using (public.is_aactivated_starter_kit_admin()) with check (public.is_aactivated_starter_kit_admin());

drop policy if exists "aactivated starter users read components" on public.aactivated_starter_kit_components;
create policy "aactivated starter users read components" on public.aactivated_starter_kit_components
for select to authenticated using (public.is_aactivated_starter_kit_user());

drop policy if exists "aactivated starter users read own orders" on public.aactivated_starter_kit_orders;
create policy "aactivated starter users read own orders" on public.aactivated_starter_kit_orders
for select to authenticated using (
  public.is_aactivated_starter_kit_admin()
  or rep_profile_id = public.current_profile_id()
);

drop policy if exists "aactivated starter overrides admin manage" on public.aactivated_starter_kit_eligibility_overrides;
create policy "aactivated starter overrides admin manage" on public.aactivated_starter_kit_eligibility_overrides
for all to authenticated using (public.is_aactivated_starter_kit_admin()) with check (public.is_aactivated_starter_kit_admin());

drop policy if exists "aactivated starter users read own resources" on public.aactivated_starter_kit_resource_access;
create policy "aactivated starter users read own resources" on public.aactivated_starter_kit_resource_access
for select to authenticated using (
  public.is_aactivated_starter_kit_admin()
  or rep_profile_id = public.current_profile_id()
);

drop policy if exists "aactivated starter admins read audit" on public.aactivated_starter_kit_audit_log;
create policy "aactivated starter admins read audit" on public.aactivated_starter_kit_audit_log
for select to authenticated using (public.is_aactivated_starter_kit_admin());

revoke all on function public.finalize_aactivated_starter_kit_order(uuid) from public;
revoke all on function public.handle_aactivated_starter_kit_paid() from public;
grant execute on function public.is_aactivated_starter_kit_admin() to authenticated;
grant execute on function public.is_aactivated_starter_kit_rep() to authenticated;
grant execute on function public.is_aactivated_starter_kit_user() to authenticated;
grant execute on function public.get_aactivated_starter_kit_availability() to authenticated;
grant execute on function public.finalize_aactivated_starter_kit_order(uuid) to service_role;

commit;
