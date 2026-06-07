create index if not exists aactivated_promo_links_discount_code_active_idx
  on public.aactivated_promo_links(discount_code, is_active);
