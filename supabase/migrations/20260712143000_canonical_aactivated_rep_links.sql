-- Canonicalize AACTIVATED rep storefront links to the lowercase branded store.
-- Final public formats:
--   /aactivated?rep=REP
--   /aactivated/product/PRODUCT?rep=REP

with aactivated_reps as (
  select
    r.id,
    upper(r.rep_slug) as rep_slug
  from public.reps r
  left join public.reps parent on parent.id = r.parent_rep_id
  where upper(r.rep_slug) in (
      'GUY60',
      'OMGBILLY',
      'ADONIS',
      'AAMIR',
      '2LEGIT',
      'WENDYCREATES54',
      'JUJUAN',
      'POWERS'
    )
    or lower(coalesce(r.custom_store_slug, '')) = 'aactivated'
    or lower(coalesce(r.brand_name, '')) like '%aactivated%'
    or lower(coalesce(r.rep_channel, '')) like '%aactivated%'
    or lower(coalesce(r.rep_tier, '')) like '%aactivated%'
    or upper(coalesce(parent.rep_slug, '')) = 'GUY60'
    or r.managed_by_profile_id in (
      select p.id
      from public.profiles p
      where lower(coalesce(p.email, '')) = 'guy@aactivated.com'
    )
)
update public.reps r
set
  referral_path = '/aactivated?rep=' || a.rep_slug,
  custom_store_slug = coalesce(nullif(r.custom_store_slug, ''), 'aactivated'),
  brand_name = coalesce(nullif(r.brand_name, ''), 'AACTIVATED-RX')
from aactivated_reps a
where r.id = a.id;

update public.partner_rep_store_settings s
set
  storefront_path = '/aactivated?rep=' || upper(coalesce(r.rep_slug, s.store_slug)),
  promo_config = jsonb_set(
    jsonb_set(
      coalesce(s.promo_config, '{}'::jsonb),
      '{storefront_link}',
      to_jsonb('/aactivated?rep=' || upper(coalesce(r.rep_slug, s.store_slug))),
      true
    ),
    '{referral_link}',
    to_jsonb('/aactivated?rep=' || upper(coalesce(r.rep_slug, s.store_slug))),
    true
  ),
  updated_at = now()
from public.reps r
where s.rep_id = r.id
  and s.store_scope = 'AACTIVATEDRX';
