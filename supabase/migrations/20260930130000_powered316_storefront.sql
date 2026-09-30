-- POWERED BY 316 uses the live partner master catalog, never a copied price list.
-- No owner, rep, upline, login or agreed commission is created.
begin;

do $$ begin
  if exists (select 1 from public.partner_brands where store_slug='316' and brand_id<>'316') then
    raise exception '/316 is already assigned to another brand';
  end if;
end $$;

insert into public.partner_brands (brand_id,store_slug,store_name,scope_code,owner_email,access_level,logo_url,colors,hero_text,custom_url,status,capabilities,pricing_guardrails)
values ('316','316','POWERED BY 316','POWERED316',null,'limited','/brands/powered-by-316/logo.png',
  '{"primary":"#101010","accent":"#d6bc80","silver":"#d7d7d4"}',
  'Explore the POWERED BY 316 Collection.','/316','active',
  '{"storefront":true,"payouts":false,"pricing":false,"inventory":false,"cross_brand_visibility":false}',
  '{"commission_configuration_status":"pending","commission_rate":null,"commission_owner":null,"parent_brand_id":null,"partner_payout_eligible":false,"pricing_source":"partner_standard_retail"}')
on conflict (brand_id) do update set logo_url=excluded.logo_url,colors=excluded.colors,hero_text=excluded.hero_text,updated_at=now();

-- Explicit public projection excludes wholesale costs and all internal pricing.
create or replace view public.powered316_catalog with (security_barrier=true) as
select p.id,p.sku,coalesce(p.display_name,p.product_name) as product_name,p.strength,p.category,p.description,
  p.retail_price,p.suggested_retail_price
from public.rx_plus_products p
where p.active=true and p.visibility_type in ('public','rx_plus','distributor_only');
revoke all on public.powered316_catalog from public;
grant select on public.powered316_catalog to anon,authenticated;

-- Extend the established authoritative cart pricing implementation. Abort on drift.
do $$
declare
  fn_oid regprocedure := coalesce(to_regprocedure('public.create_public_patient_submission_pre_isparta_core(jsonb)'),to_regprocedure('public.create_public_patient_submission(jsonb)'));
  fn text;
  marker text := 'if v_aactivated_store_slug is not null then';
begin
  if fn_oid is null then raise exception 'Submission pricing function is missing'; end if;
  select pg_get_functiondef(fn_oid) into fn;
  if position('-- POWERED316 authoritative retail' in fn)>0 then return; end if;
  if position(marker in fn)=0 then raise exception 'Submission pricing changed; review POWERED316 extension'; end if;
  fn := replace(fn,marker,$patch$
      -- POWERED316 authoritative retail: ignore partner overrides and client prices.
      if payload->>'store_slug'='316' or payload->>'brand_id'='316' or payload->>'source_store'='316' then
        v_aactivated_store_slug := null;
        v_distributor_slug := null;
        v_rep_id := null;
        v_referral_code := null;
        v_scope_code := 'MAIN';
        v_discount_code := '';
        select coalesce(p.display_name,p.product_name),p.category,p.strength,
          coalesce(p.retail_price,p.suggested_retail_price),
          coalesce(p.true_wholesale_cost_per_vial,p.base_cost,0)
        into v_name,v_category,v_strength,v_price,v_cost
        from public.rx_plus_products p
        join public.public_inventory_status i on i.product_id=p.id::text and i.catalog_source='rx_plus_products'
        where p.id::text=v_item_id and (coalesce(v_item_sku,'')='' or upper(p.sku)=v_item_sku)
          and p.active=true and p.visibility_type in ('public','rx_plus','distributor_only')
          and i.checkout_allowed=true;
        if v_price is null or v_price<=0 then raise exception 'This item is unavailable for POWERED BY 316'; end if;
      end if;
      if v_aactivated_store_slug is not null then$patch$);
  execute fn;
end $$;

-- Persist pending (NULL), never an agreed zero commission. This also neutralizes
-- stale referral cookies and prevents later payment handlers restoring a recipient.
create or replace function public.guard_powered316_pending_commission()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.store_slug='316' or new.source_store='316' or new.brand_id='316' then
    new.store_slug := '316'; new.source_store := '316'; new.store_name := 'POWERED BY 316';
    new.source_portal := 'POWERED BY 316'; new.brand_id := '316';
    if exists (select 1 from public.partner_brands where brand_id='316'
      and pricing_guardrails->>'commission_configuration_status'='pending') then
      new.checkout_scope_id := null; new.checkout_scope_code := 'MAIN'; new.source_rep := null; new.admin_code := null;
      new.rep_id := null; new.commission_owner := null; new.commission_rate := null;
      new.partner_payout_eligible := false;
    end if;
  end if;
  return new;
end $$;
drop trigger if exists zz_powered316_pending_commission on public.patient_submissions;
create trigger zz_powered316_pending_commission before insert or update on public.patient_submissions
for each row execute function public.guard_powered316_pending_commission();

create or replace function public.block_powered316_pending_payout()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if exists (select 1 from public.patient_submissions s join public.partner_brands b on b.brand_id='316'
    where s.id=new.submission_id and s.store_slug='316'
      and b.pricing_guardrails->>'commission_configuration_status'='pending') then
    raise exception 'POWERED BY 316 owner and commission configuration is pending; payouts are blocked';
  end if;
  return new;
end $$;
drop trigger if exists block_powered316_pending_payout on public.payouts;
create trigger block_powered316_pending_payout before insert or update on public.payouts
for each row execute function public.block_powered316_pending_payout();
commit;
