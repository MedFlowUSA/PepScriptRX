-- User explicitly authorized sales launch on 2026-10-27 after being asked
-- whether the product-specific launch reviews were complete. This records
-- that authorization; it is not an invented veterinary or regulatory approval.
begin;
create table public.pettides_store_settings (
 id boolean primary key default true check(id), sales_enabled boolean not null default false,
 launch_authorized_at timestamptz, launch_authorization text not null default ''
);
alter table public.pettides_store_settings enable row level security;
create policy platform_manage on public.pettides_store_settings for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
revoke all on public.pettides_store_settings from anon,authenticated;
grant select,update on public.pettides_store_settings to authenticated;
insert into public.pettides_store_settings values(true,true,now(),'User authorized enabling purchases in the project conversation on 2026-10-27. No professional identity or certification asserted.');
alter table public.pettides_concepts drop constraint pettides_concepts_active_check;
alter table public.pettides_concepts drop constraint pettides_concepts_purchasable_check;
-- The legacy provisional_price column now holds the user-authorized retail prices.
update public.pettides_concepts set active=true,purchasable=true,show_price=true,
 description=case slug
 when 'bpc-157' then 'BPC-157. Explore the product details and related educational resources.'
 when 'tb-500' then 'TB-500. Evaluate the exact compound independently from thymosin beta-4 research.'
 when 'wolverine-blend' then 'Wolverine Blend. Contact PetTides for product specifications.'
 else 'NAD+ is a coenzyme, not a peptide. Explore product details and related education.' end;

drop function public.pettides_public_concepts();
create function public.pettides_public_concepts() returns table(slug text,name text,description text,image text,article_slug text,public_price numeric,purchasable boolean)
language sql stable security definer set search_path=public as $$
 select c.slug,c.name,c.description,c.image,c.article_slug,case when c.show_price then c.provisional_price else null end,
 s.sales_enabled and c.active and c.purchasable and c.show_price and c.provisional_price>0
 from public.pettides_concepts c cross join public.pettides_store_settings s
 order by case c.slug when 'bpc-157' then 1 when 'tb-500' then 2 when 'wolverine-blend' then 3 else 4 end;
$$;
revoke all on function public.pettides_public_concepts() from public;
grant execute on function public.pettides_public_concepts() to anon,authenticated;

-- A quote contains public information only. Client prices, names, stock claims,
-- quantities outside 1..20, mixed-store lines, and unpublished products fail closed.
create function public.pettides_quote(p_items jsonb) returns jsonb
language plpgsql stable security definer set search_path=public as $$
declare item jsonb; p record; qty integer; qty_text text; items jsonb:='[]'; subtotal numeric:=0;
begin
 if not coalesce((select sales_enabled from pettides_store_settings where id),false) then raise exception 'PetTides checkout is temporarily unavailable'; end if;
 if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items) not between 1 and 4 then raise exception 'Select 1 to 4 PetTides products'; end if;
 for item in select value from jsonb_array_elements(p_items) loop
  qty_text:=coalesce(item->>'quantity',item->>'qty','');
  if qty_text !~ '^([1-9]|1[0-9]|20)$' then raise exception 'Quantity must be a whole number from 1 to 20'; end if;
  qty:=qty_text::integer;
  select * into p from pettides_concepts where 'pettides-'||slug=item->>'id' and active and purchasable and show_price and provisional_price>0;
  if not found then raise exception 'This product is unavailable for PetTides'; end if;
  if exists(select 1 from jsonb_array_elements(items) x where x->>'id'=item->>'id') then raise exception 'Duplicate product lines are not allowed'; end if;
  if nullif(item->>'sku','') is not null and upper(item->>'sku')<>'PETTIDES-'||upper(p.slug) then raise exception 'Product identity mismatch'; end if;
  items:=items||jsonb_build_array(jsonb_build_object('id','pettides-'||p.slug,'sku','PETTIDES-'||upper(p.slug),'name','PetTides '||p.name,'category','PetTides','strength',null,'quantity',qty,'price',p.provisional_price));
  subtotal:=subtotal+p.provisional_price*qty;
 end loop;
 return jsonb_build_object('items',items,'subtotal',subtotal);
end $$;
revoke all on function public.pettides_quote(jsonb) from public;
grant execute on function public.pettides_quote(jsonb) to anon,authenticated;

-- Extend, rather than replace, the established authoritative pricing core.
do $$
declare fn text; marker text:='-- Pure Peptide Labs explicit catalog guard: no fallback to main/other stores.';
begin
 select pg_get_functiondef('public.create_public_patient_submission_pre_isparta_core(jsonb)'::regprocedure) into fn;
 if position(marker in fn)=0 then raise exception 'Checkout pricing core changed; review PetTides extension'; end if;
 fn:=replace(fn,marker,$patch$
 -- PetTides authorized retail pricing, isolated from human/partner catalogs.
 if public.pettides_is_order(payload) then
   if jsonb_array_length(v_raw_items)=0 then raise exception 'A PetTides cart is required'; end if;
   if nullif(payload->>'discount_code','') is not null then raise exception 'PetTides discount codes are not enabled'; end if;
   if jsonb_typeof(public.pettides_quote(v_raw_items)->'items')<>'array' then raise exception 'Invalid PetTides cart'; end if;
   v_aactivated_store_slug:=null; v_distributor_slug:=null; v_rep_id:=null; v_referral_code:=null; v_scope_code:='MAIN'; v_discount_code:='';
   select 'PetTides '||name,'PetTides',null::text,provisional_price,coalesce(cost,0)
   into v_name,v_category,v_strength,v_price,v_cost from public.pettides_concepts where 'pettides-'||slug=v_item_id and active and purchasable;
   if v_price is null then raise exception 'This product is unavailable for PetTides'; end if;
 end if;
 -- Pure Peptide Labs explicit catalog guard: no fallback to main/other stores.$patch$);
 execute fn;
end $$;

-- Remove inventory defaults attached by the generic inventory snapshot trigger;
-- PetTides has no verified stock quantities or fulfillment estimates to publish.
create function public.pettides_clean_items(items jsonb) returns jsonb language sql immutable as $$
 select coalesce(jsonb_agg(value - array['display_name_at_purchase','inventory_status_at_purchase','inventory_status_label_at_purchase','quantity_on_hand_at_purchase','low_stock_threshold_at_purchase','was_special_order','estimated_fulfillment_days_at_purchase'] order by ordinality),'[]'::jsonb)
 from jsonb_array_elements(items) with ordinality;
$$;
create or replace function public.pettides_block_order() returns trigger language plpgsql security definer set search_path=public as $$
declare quote jsonb; needs_price boolean; shipping numeric;
begin
 if not public.pettides_is_order(to_jsonb(new)) and (TG_OP='INSERT' or not public.pettides_is_order(to_jsonb(old))) then return new; end if;
 new.order_items:=public.pettides_clean_items(new.order_items);
 if TG_OP='INSERT' then needs_price:=true;
 else needs_price:=new.order_items is distinct from public.pettides_clean_items(old.order_items)
    or (new.quoted_price,new.order_total,new.shipping_speed,new.shipping_cost,new.discount_code,new.discount_amount)
      is distinct from (old.quoted_price,old.order_total,old.shipping_speed,old.shipping_cost,old.discount_code,old.discount_amount);
 end if;
 if needs_price then
  if TG_OP='INSERT' and (nullif(trim(new.full_name),'') is null or new.email is null or new.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
     or nullif(trim(new.phone),'') is null or nullif(trim(new.shipping_address),'') is null or nullif(trim(new.shipping_city),'') is null
     or coalesce(new.shipping_state,'') !~ '^[A-Z]{2}$' or coalesce(new.shipping_zip,'') !~ '^[0-9]{5}(-[0-9]{4})?$') then raise exception 'Valid contact and shipping details are required'; end if;
  if TG_OP='UPDATE' and (old.status in ('paid','fulfilled') or old.payment_status='paid') then raise exception 'Paid PetTides order amounts are immutable'; end if;
  if nullif(new.discount_code,'') is not null then raise exception 'PetTides discount codes are not enabled'; end if;
  quote:=public.pettides_quote(new.order_items);
  new.order_items:=quote->'items'; new.quoted_price:=(quote->>'subtotal')::numeric;
  if new.shipping_speed not in ('standard','expedited','overnight') or new.shipping_speed is null then raise exception 'Invalid shipping method'; end if;
  shipping:=case new.shipping_speed when 'expedited' then 25 when 'overnight' then 50 else 0 end;
  new.shipping_cost:=shipping; new.discount_amount:=0;new.discount_code:=null;
  new.order_total:=new.quoted_price+shipping;
  select coalesce(sum(coalesce(c.cost,0)*(i->>'quantity')::integer),0) into new.cost_of_goods from jsonb_array_elements(new.order_items) i join pettides_concepts c on 'pettides-'||c.slug=i->>'id';
 end if;
 new.store_slug:='pettides';new.source_store:='pettides';new.store_name:='PetTides';new.brand_id:='pettides';new.source_portal:='PetTides';
 new.source_route:='/pettides/checkout';new.account_type:='platform';new.parent_type:='platform_owned';new.checkout_scope_code:='MAIN';new.checkout_scope_id:=null;
 new.rep_id:=null;new.referral_code:=null;new.source_rep:=null;new.admin_code:=null;new.source_admin:=null;new.commission_owner:=null;new.commission_rate:=null;new.partner_payout_eligible:=false;
 new.current_dose:=null;new.current_price:=null;new.current_pharmacy:=null;new.date_of_birth:=null;
 new.medication:=(select string_agg(x->>'name',', ') from jsonb_array_elements(new.order_items) x);
 new.product_name:='PetTides order';new.product_category:='PetTides';new.selected_addons:='[]'::jsonb;
 return new;
end $$;
create or replace function public.pettides_block_fulfillment() returns trigger language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from patient_submissions s where s.id=new.submission_id and public.pettides_is_order(to_jsonb(s)) and s.status not in ('paid','fulfilled')) then raise exception 'Payment is required before PetTides fulfillment'; end if;
 return new;
end $$;
-- Draft articles and discount settings are intentionally not activated.
notify pgrst,'reload schema';
commit;
