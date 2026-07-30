-- Radiance renders its catalog with ehwsub-* product ids, while the hardened
-- checkout RPC prices payable items from server-owned catalog rows. Mirror the
-- established Empire/Mark catalog under Radiance's ids so browser prices are
-- never trusted and every Radiance cart item remains checkoutable.
insert into public.products (
  id,
  name,
  price,
  category,
  status,
  display_note,
  sort_order
)
select
  regexp_replace(id, '^mark-', 'ehwsub-'),
  name,
  price,
  category,
  'manual_review',
  'Radiance Wellness checkout catalog.',
  905
from public.products
where id like 'mark-%'
on conflict (id) do update
set
  name = excluded.name,
  price = excluded.price,
  category = excluded.category,
  status = excluded.status,
  display_note = excluded.display_note;

