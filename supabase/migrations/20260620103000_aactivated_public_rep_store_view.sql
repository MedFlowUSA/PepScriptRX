create or replace view public.aactivated_public_rep_stores as
select
  s.id,
  s.rep_id,
  upper(coalesce(r.rep_slug, s.store_slug)) as rep_slug,
  s.rep_name,
  s.public_display_name,
  s.store_slug,
  s.storefront_path,
  s.product_list_id,
  s.product_list_name,
  coalesce((
    select array_agg(i.product_id order by i.sort_order, i.product_name)
    from public.partner_product_list_items i
    where i.product_list_id = s.product_list_id
      and i.store_scope = s.store_scope
      and i.is_visible = true
  ), '{}'::text[]) as product_ids,
  s.pricing_mode,
  s.features,
  s.promo_config,
  s.status,
  r.discount_code,
  r.referral_path,
  r.active as rep_active,
  s.updated_at
from public.partner_rep_store_settings s
left join public.reps r on r.id = s.rep_id
where s.store_scope = 'AACTIVATEDRX'
  and s.status = 'active'
  and coalesce(r.active, true) = true;

grant select on public.aactivated_public_rep_stores to anon, authenticated;
