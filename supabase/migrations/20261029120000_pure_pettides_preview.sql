-- LOCAL ONLY: Pure PetTides preview. No changes to Pure Peptide Labs or PetTides.
begin;
-- Refuse to guess if the verified source compensation or route has changed.
do $verify$
declare calculation text;
begin
 if not exists(select 1 from public.reps where rep_slug='LILY60' and rep_name='Lily Graham'
   and brand_id='purepeptidelabs' and commission_rate=.65 and override_percent=0 and platform_percent=.35
   and parent_rep_id is null and parent_brand_id is null and managed_by_profile_id is null)
 or not exists(select 1 from public.checkout_scopes where scope_code='PUREPEPTIDELABS' and account_id='LILY60'
   and default_commission_rate=.65 and parent_account_id is null) then
   raise exception 'Lily compensation changed; reconcile before configuring Pure PetTides';
 end if;
 select regexp_replace(pg_get_functiondef(coalesce(
   to_regprocedure('public.finalize_verified_paid_order_unlocked(text,text,text,text,uuid,integer,text,timestamptz,jsonb)'),
   to_regprocedure('public.finalize_verified_paid_order(text,text,text,text,uuid,integer,text,timestamptz,jsonb)'))),'\s','','g') into calculation;
 if calculation is null or position('v_profit:=greatest(0,v_product_total-v_discount-v_cogs)' in calculation)=0
   or position('round(v_profit*v_rate,2)' in calculation)=0 then
   raise exception 'Paid-order calculation changed; verify margin basis before configuring';
 end if;
 if exists(select 1 from public.partner_brands where brand_id='pure-pettides' or store_slug='pure-pettides' or custom_url='/pure-pettides')
 or exists(select 1 from public.checkout_scopes where scope_code='PUREPETTIDES') then
   raise exception 'Pure PetTides route or scope is already reserved';
 end if;
end $verify$;

-- One additional brand and inactive checkout scope referencing the EXISTING payee.
-- No new rep, distributor commission, ledger entry, wallet, order, or payout.
insert into public.partner_brands(brand_id,store_slug,store_name,scope_code,owner_email,access_level,logo_url,colors,hero_text,custom_url,status,capabilities,pricing_guardrails)
select 'pure-pettides','pure-pettides','Pure PetTides','PUREPETTIDES',owner_email,'limited',
 '/brands/pettides/logo.jpg','{"primary":"#29434d","background":"#f8f7f2","accent":"#527780"}'::jsonb,
 'A Pure Peptide Labs specialty concept','/pure-pettides','active',
 '{"storefront":true,"preview_only":true,"orders":false,"pricing":false,"inventory":false,"cross_brand_visibility":false}'::jsonb,
 '{"commission_rate":0.65,"parent_brand_id":null,"parent_scope":null,"associated_business":"purepeptidelabs","payee_rep_slug":"LILY60","override_percent":0,"platform_percent":0.35,"sales_enabled":false}'::jsonb
from public.partner_brands where brand_id='purepeptidelabs';
insert into public.checkout_scopes(scope_code,display_name,account_type,account_id,parent_account_id,is_active,default_commission_rate,notes)
values('PUREPETTIDES','Pure PetTides','rep','LILY60',null,false,.65,
 'PREVIEW ONLY. Same existing Lily Graham payee as Pure Peptide Labs; 65% of max(0, product subtotal - discounts - COGS); no override. Do not activate checkout without separate implementation and review.');

create table public.pure_pettides_concepts(
 slug text primary key check(slug in ('bpc-157','tb-500','wolverine-blend','nad-plus')),
 name text not null,description text not null,image text not null check(image like '/brands/%'),article_slug text not null,
 provisional_price numeric(10,2) not null check(provisional_price>=0),
 price_reviewed boolean not null default false,show_price boolean not null default false check(not show_price or price_reviewed),
 active boolean not null default false check(active=false),purchasable boolean not null default false check(purchasable=false),
 launch_checklist jsonb not null default '{"legal":false,"veterinary":false,"evidence":false,"quality":false,"labeling":false,"distribution":false,"payment_processor":false}',
 launch_review_notes text not null default ''
);
insert into public.pure_pettides_concepts(slug,name,description,image,article_slug,provisional_price) values
 ('bpc-157','BPC-157','An investigational peptide. Explore what animal research has and has not established.','/brands/pettides/bpc-157.jpg','bpc-157-benefits-evidence',129),
 ('tb-500','TB-500','Exact compound identity matters. TB-500 and full-length thymosin beta-4 are not assumed to be equivalent.','/brands/pettides/tb-500.jpg','tb-500-benefits-evidence',139),
 ('wolverine-blend','Wolverine Blend','A blend concept awaiting its own formulation, quality, and evidence review.','/brands/pettides/wolverine-blend.jpg','wolverine-blend-benefits-evidence',199),
 ('nad-plus','NAD+','A coenzyme involved in cellular metabolism, not a peptide. Biological roles and product outcomes are different questions.','/brands/pettides/nad-plus.jpg','nad-plus-benefits-evidence',159);
alter table public.pure_pettides_concepts enable row level security;
create policy platform_manage on public.pure_pettides_concepts for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
revoke all on public.pure_pettides_concepts from anon,authenticated;
grant select,insert,update,delete on public.pure_pettides_concepts to authenticated;

create function public.pure_pettides_public_concepts() returns table(slug text,name text,description text,image text,article_slug text,public_price numeric)
language sql stable security definer set search_path=public as $$
 select slug,name,description,image,article_slug,case when show_price and price_reviewed then provisional_price else null end
 from public.pure_pettides_concepts order by case slug when 'bpc-157' then 1 when 'tb-500' then 2 when 'wolverine-blend' then 3 else 4 end;
$$;
revoke all on function public.pure_pettides_public_concepts() from public;
grant execute on function public.pure_pettides_public_concepts() to anon,authenticated;

-- Same records and review workflow, with no duplicate educational copy.
-- Owner authorization alone is not recorded professional review for this storefront.
create function public.pure_pettides_library() returns table(slug text,title text,category text,body text,sources text[],status text,reviewed_by uuid,reviewed_at timestamptz)
language sql stable security definer set search_path=public as $$
 select slug,title,category,body,sources,status,reviewed_by,reviewed_at from public.pettides_articles
 where status='published' and source_verified and reviewed_by is not null and reviewed_at is not null order by title;
$$;
revoke all on function public.pure_pettides_library() from public;
grant execute on function public.pure_pettides_library() to anon,authenticated;

create policy pure_pettides_platform_contact_read on public.portal_age_lead_captures for select to authenticated
 using(portal_id='pure-pettides' and public.is_platform_admin());
create policy pure_pettides_contact_scope on public.portal_age_lead_captures as restrictive for select to authenticated
 using(portal_id is distinct from 'pure-pettides' or public.is_platform_admin());
create policy pure_pettides_contact_rpc_only on public.portal_age_lead_captures as restrictive for insert to anon,authenticated
 with check(portal_id is distinct from 'pure-pettides');
create function public.pure_pettides_join_interest(p_name text,p_email text,p_consent boolean) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not coalesce(p_consent,false) or p_email is null or length(trim(p_email))>254
   or trim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p_name)>100 then
   raise exception 'Valid contact and consent required';
 end if;
 insert into public.portal_age_lead_captures(first_name,email,portal_id,portal_name,portal_path,path,age_confirmed)
 values(nullif(trim(p_name),''),lower(trim(p_email)),'pure-pettides','Pure PetTides','/pure-pettides','/pure-pettides#contact',false);
end $$;
revoke all on function public.pure_pettides_join_interest(text,text,boolean) from public;
grant execute on function public.pure_pettides_join_interest(text,text,boolean) to anon,authenticated;

create function public.pure_pettides_is_order(payload jsonb) returns boolean language sql immutable as $$
 select jsonb_build_array(payload->'store_slug',payload->'store_name',payload->'brand_id',payload->'source_store',
 payload->'source_portal',payload->'source_route',payload->'checkout_scope_code',payload->'product_id',
 payload->'product_name',payload->'medication',payload->'order_items',payload->'selected_addons')::text ~* 'pure[^a-z0-9]*pet[^a-z0-9]*tides';
$$;
create function public.pure_pettides_block_order() returns trigger language plpgsql set search_path=public as $$
begin
 if public.pure_pettides_is_order(to_jsonb(new)) or (TG_OP='UPDATE' and public.pure_pettides_is_order(to_jsonb(old))) then
   raise exception 'Pure PetTides is in preview. Concepts are not available for purchase.';
 end if;
 return new;
end $$;
-- Runs before the existing PetTides/shared pricing and submission side effects.
create trigger aaa_pure_pettides_preview before insert or update on public.patient_submissions for each row execute function public.pure_pettides_block_order();
create function public.pure_pettides_block_fulfillment() returns trigger language plpgsql set search_path=public as $$
begin
 if exists(select 1 from public.patient_submissions s where s.id=new.submission_id and public.pure_pettides_is_order(to_jsonb(s))) then
   raise exception 'Pure PetTides fulfillment is disabled';
 end if;
 return new;
end $$;
create trigger aaa_pure_pettides_preview before insert or update on public.fulfillment_orders for each row execute function public.pure_pettides_block_fulfillment();
create function public.pure_pettides_quote(p_items jsonb) returns jsonb language plpgsql as $$
begin raise exception 'Pure PetTides is in preview. Concepts are not available for purchase.'; end $$;
revoke all on function public.pure_pettides_quote(jsonb) from public;
grant execute on function public.pure_pettides_quote(jsonb) to anon,authenticated;

create function public.pure_pettides_discount_guard() returns trigger language plpgsql set search_path=public as $$
begin
 if upper(new.store_scope_code)='PUREPETTIDES' or (TG_OP='UPDATE' and upper(old.store_scope_code)='PUREPETTIDES') then
   if not public.is_platform_admin() then raise exception 'Platform administrator required'; end if;
   new.store_scope_code:='PUREPETTIDES'; new.is_active:=false;
 end if;
 return new;
end $$;
create trigger pure_pettides_discount_guard before insert or update on public.aactivated_promo_links for each row execute function public.pure_pettides_discount_guard();
create function public.pure_pettides_prepare_discount() returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_platform_admin() then raise exception 'Platform administrator required'; end if;
 insert into public.aactivated_promo_links(is_active,store_scope_code,promo_title,discount_code,discount_amount,link_slug,notes)
 values(false,'PUREPETTIDES','Pure PetTides future discount planning','PUREPETTIDES-PLANNING',0,'pure-pettides-future-discount','Internal inactive planning record only. No checkout permitted.') on conflict(link_slug) do nothing;
end $$;
revoke all on function public.pure_pettides_prepare_discount() from public;
grant execute on function public.pure_pettides_prepare_discount() to authenticated;
commit;
