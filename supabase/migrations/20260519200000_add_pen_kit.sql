-- Add Reusable Pen Kit product and re-order existing supplies

insert into public.products (id, name, price, category, status, display_note, sort_order)
values (
  'pen-kit',
  'Reusable Pen Kit',
  19,
  'Supplies',
  'active',
  'Includes reusable pen body, cartridge, and pen needles. Multiple colors available.',
  5
)
on conflict (id) do update set
  name         = excluded.name,
  price        = excluded.price,
  category     = excluded.category,
  status       = excluded.status,
  display_note = excluded.display_note,
  sort_order   = excluded.sort_order;

-- Shift retatrutide and igf1 down one slot
update public.products set sort_order = 6 where id = 'retatrutide';
update public.products set sort_order = 7 where id = 'igf1';
