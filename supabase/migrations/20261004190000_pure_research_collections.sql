-- Store-scoped merchandising only: components remain existing catalog/order lines.
create table if not exists public.store_collections (
  id uuid primary key default gen_random_uuid(),
  store_slug text not null check (store_slug = 'purepeptidelabs'),
  slug text not null, name text not null, description text not null default '',
  image_url text not null default '/brands/purepeptidelabs/hero-aqua.webp',
  components jsonb not null check (jsonb_typeof(components) = 'array'),
  discount_percent numeric not null default 15 check (discount_percent > 0 and discount_percent < 100),
  display_order integer not null default 0, published boolean not null default false,
  updated_at timestamptz not null default now(), unique(store_slug,slug)
);
alter table public.store_collections enable row level security;
drop policy if exists pure_collections_read on public.store_collections;
create policy pure_collections_read on public.store_collections for select to anon, authenticated
  using (published or public.is_current_partner_brand('purepeptidelabs'));
grant select on public.store_collections to anon, authenticated;
revoke insert, update, delete on public.store_collections from anon, authenticated;

-- Authoritative, read-only quote used by storefront, admin preview and order trigger.
create or replace function public.quote_pure_cart(p_items jsonb, p_code text default '', p_preview boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  line jsonb; component jsonb; bundle public.store_collections%rowtype; product record; inventory record;
  promo public.aactivated_promo_links%rowtype; guards jsonb;
  items jsonb := '[]'; groups jsonb := '[]'; result_items jsonb := '[]'; group_row record;
  subtotal numeric := 0; costs numeric := 0; group_total numeric; bundle_discount numeric := 0;
  promo_discount numeric := 0; discount numeric; net numeric; eligible numeric := 0;
  qty integer; bundle_qty integer; allocated numeric := 0; cumulative numeric := 0; line_discount numeric;
  code text := upper(trim(coalesce(p_code,''))); special boolean; status text;
begin
  if p_preview and not (coalesce(public.is_current_partner_brand('purepeptidelabs'),false) or coalesce(auth.role(),'')='service_role') then
    raise exception 'Collection preview requires Pure store administration';
  end if;
  if jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 100 then raise exception 'Choose valid collection components'; end if;
  if exists(select 1 from jsonb_array_elements(p_items) x group by x->>'id',coalesce(x->>'bundle_id','') having count(*)>1) then raise exception 'Duplicate component lines'; end if;
  select pricing_guardrails into guards from public.partner_brands where brand_id='purepeptidelabs';
  for line in select value from jsonb_array_elements(p_items) loop
    if coalesce(line->>'qty',line->>'quantity','') !~ '^[0-9]+$' then raise exception 'Invalid component quantity'; end if;
    qty := coalesce(line->>'qty',line->>'quantity')::integer;
    if qty not between 1 and 20 then raise exception 'Component quantities must be between 1 and 20'; end if;
    select p.id,p.sku,p.product_name,p.strength,p.category,
      coalesce(dp.custom_price,dp.custom_retail_price) price,
      coalesce(dp.internal_wholesale_cost_per_vial,p.true_wholesale_cost_per_vial,p.base_cost,0) cost
    into product from public.rx_plus_products p
    join public.distributor_products dp on dp.product_id=p.id
    join public.distributors d on d.id=dp.distributor_id
    where p.id::text=line->>'id' and p.sku=line->>'sku'
      and d.slug='purepeptidelabs' and d.is_active and dp.is_enabled and coalesce(dp.enabled,true)
      and p.active and p.visibility_type in ('public','rx_plus','distributor_only')
      and coalesce(p.partner_slug,'') in ('','purepeptidelabs','guy');
    if not found or product.price is null or product.price<=0 then raise exception 'A component is missing, archived, or not published for Pure'; end if;
    if product.strength is distinct from line->>'strength' then raise exception 'A component strength changed; review the collection'; end if;
    select * into inventory from public.public_inventory_status where catalog_source='rx_plus_products' and product_id=product.id;
    if not found or inventory.checkout_allowed is not true or inventory.active is not true
      or inventory.sellable is not true or inventory.customer_visible is not true then raise exception 'A component is unavailable for checkout'; end if;
    special := coalesce(inventory.quantity_on_hand,0) < (select sum(coalesce(x->>'qty',x->>'quantity')::integer) from jsonb_array_elements(p_items) x where x->>'id'=product.id::text);
    if special and inventory.allow_special_order is not true then raise exception 'Insufficient component stock'; end if;
    status := case when special then 'special_order' when inventory.stock_status='low_stock' or inventory.quantity_on_hand<=inventory.low_stock_threshold then 'low_stock' else 'in_stock' end;
    items := items || jsonb_build_array(jsonb_build_object('id',product.id,'sku',product.sku,'name',product.product_name,'strength',product.strength,
      'category',product.category,'price',product.price,'qty',qty,'quantity',qty,'bundle_id',nullif(line->>'bundle_id',''),
      'inventory_status_at_purchase',status,'inventory_status_label_at_purchase',case status when 'special_order' then 'Out of Stock - Checkout Available' when 'low_stock' then 'Low Stock' else 'In Stock' end,
      'was_special_order',special,'estimated_fulfillment_days_at_purchase',inventory.estimated_fulfillment_days));
    subtotal := subtotal+product.price*qty; costs := costs+product.cost*qty;
  end loop;
  for group_row in select x->>'bundle_id' id from jsonb_array_elements(items) x where nullif(x->>'bundle_id','') is not null group by x->>'bundle_id' loop
    select * into bundle from public.store_collections where id::text=group_row.id and store_slug='purepeptidelabs' and (published or p_preview);
    if not found then raise exception 'Collection is no longer published'; end if;
    if jsonb_array_length(bundle.components)<2 or exists(select 1 from jsonb_array_elements(bundle.components) c group by c->>'product_id' having count(*)>1) then raise exception 'Invalid or duplicate collection components'; end if;
    if (select count(*) from jsonb_array_elements(items) x where x->>'bundle_id'=group_row.id)<>jsonb_array_length(bundle.components) then raise exception 'Collection components do not match'; end if;
    bundle_qty := null;
    for component in select value from jsonb_array_elements(bundle.components) loop
      select value into line from jsonb_array_elements(items) where value->>'bundle_id'=group_row.id and value->>'id'=component->>'product_id' and value->>'sku'=component->>'sku' and value->>'strength'=component->>'strength';
      if not found or coalesce(component->>'quantity','') !~ '^[1-9][0-9]*$' then raise exception 'Collection SKU or strength changed'; end if;
      qty := (line->>'qty')::integer;
      if (component->>'quantity')::integer>20 or qty % (component->>'quantity')::integer<>0 then raise exception 'Collection quantities do not match'; end if;
      if bundle_qty is not null and bundle_qty<>qty/(component->>'quantity')::integer then raise exception 'Collection quantities do not match'; end if;
      bundle_qty := qty/(component->>'quantity')::integer;
    end loop;
    if bundle.discount_percent>coalesce((guards->>'max_discount_percent')::numeric,100) then raise exception 'Collection discount exceeds store margin rules'; end if;
    select sum((x->>'price')::numeric*(x->>'qty')::integer) into group_total from jsonb_array_elements(items) x where x->>'bundle_id'=group_row.id;
    net := round(group_total*(1-bundle.discount_percent/100),2);
    bundle_discount := bundle_discount + group_total-net;
    groups := groups || jsonb_build_array(jsonb_build_object('id',bundle.id,'name',bundle.name,'quantity',bundle_qty,'regular_total',group_total,'discount_percent',bundle.discount_percent,'discount',group_total-net,'total',net));
  end loop;
  if code not in ('','BUNDLE') then
    select * into promo from public.aactivated_promo_links p where upper(p.discount_code)=code
      and p.store_scope_code in ('PUREPEPTIDELABS','GLOBAL') and p.promo_kind='customer_discount' and p.is_active
      and (p.starts_at is null or p.starts_at<=now()) and (p.expires_at is null or p.expires_at>now())
      and (p.usage_limit is null or p.uses_count<p.usage_limit) and coalesce(p.min_subtotal,0)<=subtotal
      and (not p.requires_platform_approval or p.approval_status='approved')
      order by (p.store_scope_code='PUREPEPTIDELABS') desc,p.created_at desc limit 1;
    if not found then raise exception 'Promotion is unavailable for this collection'; end if;
    select coalesce(sum((x->>'price')::numeric*(x->>'qty')::integer),0) into eligible from jsonb_array_elements(items) x where promo.product_id is null or x->>'id'=promo.product_id;
    promo_discount := round(least(eligible,case when promo.discount_type='percentage' then eligible*coalesce(promo.discount_percent,0)/100 else coalesce(promo.discount_amount,0) end),2);
  end if;
  discount := greatest(bundle_discount,promo_discount);
  net := subtotal-discount;
  if net<=0 or (net-costs)/net*100 < coalesce((guards->>'min_margin_percent')::numeric,0) then raise exception 'Collection does not meet store margin rules'; end if;
  -- Allocate cents exactly across actual components for reporting/manual refund review.
  for line in select value from jsonb_array_elements(items) loop
    if promo_discount>bundle_discount then
      cumulative := cumulative + case when promo.product_id is null or line->>'id'=promo.product_id then (line->>'price')::numeric*(line->>'qty')::integer else 0 end;
      line_discount := round(discount*cumulative/nullif(eligible,0),2)-allocated; allocated := allocated+line_discount;
    elsif nullif(line->>'bundle_id','') is not null then
      select value into component from jsonb_array_elements(groups) where value->>'id'=line->>'bundle_id';
      select coalesce(sum((x->>'price')::numeric*(x->>'qty')::integer),0) into cumulative from jsonb_array_elements(result_items) x where x->>'bundle_id'=line->>'bundle_id';
      line_discount := round((component->>'discount')::numeric*(cumulative+(line->>'price')::numeric*(line->>'qty')::integer)/(component->>'regular_total')::numeric,2)-round((component->>'discount')::numeric*cumulative/(component->>'regular_total')::numeric,2);
    else line_discount := 0; end if;
    result_items := result_items || jsonb_build_array(line || jsonb_build_object('line_discount_amount',line_discount,'line_paid_total',(line->>'price')::numeric*(line->>'qty')::integer-line_discount,
      'bundle_name',(select x->>'name' from jsonb_array_elements(groups) x where x->>'id'=line->>'bundle_id')));
  end loop;
  return jsonb_build_object('items',result_items,'bundles',groups,'subtotal',subtotal,'bundle_discount',bundle_discount,'promotion_discount',promo_discount,
    'discount',discount,'total',net,'requested_code',code,'applied_code',case when promo_discount>bundle_discount then code when bundle_discount>0 then 'BUNDLE' else '' end,
    'offer',case when promo_discount>bundle_discount then code||' replaces bundle savings' else 'Collection savings' end);
end $$;
revoke all on function public.quote_pure_cart(jsonb,text,boolean) from public;
grant execute on function public.quote_pure_cart(jsonb,text,boolean) to anon,authenticated,service_role;

create or replace function public.save_pure_collection(p_collection jsonb, p_expected_total numeric default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare saved public.store_collections%rowtype; quote jsonb; lines jsonb;
begin
  if not (coalesce(public.is_current_partner_brand('purepeptidelabs'),false)) then raise exception 'Pure store administration required'; end if;
  if length(trim(p_collection->>'name')) not between 3 and 120 or coalesce(p_collection->>'slug','') !~ '^[a-z0-9-]+$' then raise exception 'Name and collection slug are required'; end if;
  if coalesce(p_collection->>'image_url','') not like '/brands/purepeptidelabs/%' then raise exception 'Use a Pure brand image path'; end if;
  insert into public.store_collections(store_slug,slug,name,description,image_url,components,discount_percent,display_order,published)
  values('purepeptidelabs',p_collection->>'slug',p_collection->>'name',coalesce(p_collection->>'description',''),p_collection->>'image_url',p_collection->'components',(p_collection->>'discount_percent')::numeric,coalesce((p_collection->>'display_order')::integer,0),false)
  on conflict(store_slug,slug) do update set name=excluded.name,description=excluded.description,image_url=excluded.image_url,components=excluded.components,discount_percent=excluded.discount_percent,display_order=excluded.display_order,published=false,updated_at=now() returning * into saved;
  select jsonb_agg(jsonb_build_object('id',c->>'product_id','sku',c->>'sku','strength',c->>'strength','qty',c->'quantity','bundle_id',saved.id)) into lines from jsonb_array_elements(saved.components) c;
  quote := public.quote_pure_cart(lines,'',true);
  if coalesce((p_collection->>'published')::boolean,false) then
    if p_expected_total is null or p_expected_total<>(quote->>'subtotal')::numeric then raise exception 'Prices changed: preview current component totals before publishing'; end if;
    update public.store_collections set published=true where id=saved.id;
  end if;
  return quote || jsonb_build_object('id',saved.id);
end $$;
revoke all on function public.save_pure_collection(jsonb,numeric) from public;
grant execute on function public.save_pure_collection(jsonb,numeric) to authenticated;

create or replace function public.unpublish_pure_collection(p_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not (coalesce(public.is_current_partner_brand('purepeptidelabs'),false)) then raise exception 'Pure store administration required'; end if;
  update public.store_collections set published=false,updated_at=now() where id=p_id and store_slug='purepeptidelabs';
end $$;
revoke all on function public.unpublish_pure_collection(uuid) from public;
grant execute on function public.unpublish_pure_collection(uuid) to authenticated;

-- Preserve the client-selected collection identity through the existing price resolver.
do $$ declare fn regprocedure:=coalesce(to_regprocedure('public.create_public_patient_submission_pre_isparta_core(jsonb)'),to_regprocedure('public.create_public_patient_submission(jsonb)')); definition text; marker text := 'if v_discount_code <> '''' and v_product_total > 0 then';
begin
  definition := pg_get_functiondef(fn);
  if position('-- Pure collection identity' in definition)=0 then
    if position(marker in definition)=0 then raise exception 'Checkout price resolver changed'; end if;
    definition := replace(definition,marker,$patch$
    -- Pure collection identity; amounts and components are revalidated by the order trigger.
    if v_scope_code='PUREPEPTIDELABS' then
      if exists(select 1 from jsonb_array_elements(v_raw_items) x where nullif(x->>'bundle_id','') is not null)
         and nullif(payload->>'quoted_price','') is not null
         and (payload->>'quoted_price')::numeric <> v_product_total then
        raise exception 'Component prices changed. Refresh your cart and review the updated total.';
      end if;
      select coalesce(jsonb_agg(priced.value || jsonb_build_object('bundle_id',raw.value->>'bundle_id') order by priced.ordinality),'[]'::jsonb)
      into v_order_items from jsonb_array_elements(v_order_items) with ordinality priced
      join jsonb_array_elements(v_raw_items) with ordinality raw using(ordinality);
    end if;
    $patch$ || marker);
    execute definition;
  end if;
end $$;
alter table public.patient_submissions add column if not exists collection_summary jsonb;
-- Collection checkout owns its single offer; avoid counting the generic promo twice.
do $$ declare definition text:=pg_get_functiondef('public.apply_aactivated_server_promo_to_submission()'::regprocedure); marker text:='  if not v_is_supported_store or v_base_code';
begin
  if position('-- Pure collection promo accounting' in definition)=0 then
    if position(marker in definition)=0 then raise exception 'Promo calculator changed'; end if;
    definition:=replace(definition,marker,$patch$
  -- Pure collection promo accounting is handled after component validation.
  if new.checkout_scope_code='PUREPEPTIDELABS' and exists(select 1 from jsonb_array_elements(coalesce(new.order_items,'[]')) x where nullif(x->>'bundle_id','') is not null) then return new; end if;
  $patch$||marker);
    execute definition;
  end if;
end $$;
create or replace function public.apply_pure_collection_order()
returns trigger language plpgsql security definer set search_path=public as $$
declare quote jsonb; shipping numeric:=greatest(0,coalesce(new.shipping_cost,0));
begin
  if not exists(select 1 from jsonb_array_elements(coalesce(new.order_items,'[]')) x where nullif(x->>'bundle_id','') is not null) then return new; end if;
  if new.checkout_scope_code is distinct from 'PUREPEPTIDELABS' or upper(coalesce(new.order_type,'CUSTOMER_ORDER'))<>'CUSTOMER_ORDER' then raise exception 'Pure collections require Pure customer checkout'; end if;
  quote := public.quote_pure_cart(new.order_items,coalesce(new.discount_code,''));
  if tg_op='INSERT' and quote->>'applied_code' not in ('','BUNDLE') then
    update public.aactivated_promo_links set uses_count=uses_count+1,updated_at=now()
    where id=(select p.id from public.aactivated_promo_links p where upper(p.discount_code)=quote->>'applied_code'
      and p.store_scope_code in ('PUREPEPTIDELABS','GLOBAL') and p.promo_kind='customer_discount' and p.is_active
      and (p.starts_at is null or p.starts_at<=now()) and (p.expires_at is null or p.expires_at>now())
      and (not p.requires_platform_approval or p.approval_status='approved')
      order by (p.store_scope_code='PUREPEPTIDELABS') desc,p.created_at desc limit 1)
      and (usage_limit is null or uses_count<usage_limit);
    if not found then raise exception 'Promotion usage limit reached. Refresh your cart.'; end if;
  end if;
  if new.quoted_price is distinct from (quote->>'subtotal')::numeric then raise exception 'Component prices changed. Refresh your cart and review the updated total.'; end if;
  new.order_items := quote->'items'; new.collection_summary := quote - 'items';
  new.discount_amount := (quote->>'discount')::numeric;
  new.discount_cents := round(new.discount_amount*100)::integer;
  new.order_total := (quote->>'total')::numeric+shipping;
  new.amount_due_cents := round(new.order_total*100)::integer;
  new.subtotal_cents := round((new.quoted_price+shipping)*100)::integer;
  new.commission_basis_amount := (quote->>'total')::numeric;
  new.final_customer_paid_amount := new.order_total;
  return new;
end $$;
drop trigger if exists zzzz_pure_collection_order on public.patient_submissions;
create trigger zzzz_pure_collection_order before insert or update of order_items,quoted_price,discount_code,shipping_cost,checkout_scope_code,order_type on public.patient_submissions for each row execute function public.apply_pure_collection_order();

-- Exact SKU/variant/strength seed; no product or retail-price writes.
do $$ declare spec jsonb; components jsonb; amount numeric;
begin
  for spec in select value from jsonb_array_elements('[
    {"slug":"aging-research","name":"Aging Research Collection","skus":["RXP-REC-GHKCU-100","RXP-LONG-NAD-500","RXP-LONG-MOTSC-10"],"strengths":["100mg","500iu","10mg"],"total":367,"sort":1},
    {"slug":"skin-formulation-research","name":"Skin & Formulation Research Collection","skus":["RXP-REC-GHKCU-100","RXP-REC-GLOW"],"strengths":["100mg","Blend"],"total":288,"sort":2},
    {"slug":"cellular-research","name":"Cellular Research Collection","skus":["RXP-LONG-NAD-1000","RXP-LONG-GLUTA-1500","RXP-LONG-MOTSC-10"],"strengths":["1000iu","1500mg","10mg"],"total":487,"sort":3}
  ]'::jsonb) loop
    select jsonb_agg(jsonb_build_object('product_id',p.id,'sku',p.sku,'strength',p.strength,'quantity',1) order by s.ordinality),sum(coalesce(dp.custom_price,dp.custom_retail_price)) into components,amount
    from jsonb_array_elements_text(spec->'skus') with ordinality s(sku,ordinality)
    join public.rx_plus_products p on p.sku=s.sku and p.strength=spec->'strengths'->>(s.ordinality::integer-1)
    join public.distributor_products dp on dp.product_id=p.id
    join public.distributors d on d.id=dp.distributor_id and d.slug='purepeptidelabs';
    if coalesce(jsonb_array_length(components),0)<>jsonb_array_length(spec->'skus') then raise exception 'Review exact SKU and strength matches for %',spec->>'name'; end if;
    insert into public.store_collections(store_slug,slug,name,description,components,display_order,published)
    values('purepeptidelabs',spec->>'slug',spec->>'name','A research collection containing one of each listed product. Grouping does not imply a combined health outcome.',components,(spec->>'sort')::integer,amount=(spec->>'total')::numeric)
    on conflict(store_slug,slug) do nothing;
  end loop;
end $$;

update public.partner_brands set logo_url='/brands/purepeptidelabs/logo-aqua.webp',colors='{"primary":"#29434D","accent":"#527780","background":"#F8F7F2","aqua":"#D8EFED"}'::jsonb,hero_text='A considered collection for research.' where brand_id='purepeptidelabs';
