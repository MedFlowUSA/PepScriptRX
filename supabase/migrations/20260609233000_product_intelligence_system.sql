-- Main-admin-only Product Intelligence and cost analysis.
-- Cost, margin, profit, supplier, and internal notes live in these locked tables,
-- never in public storefront catalog tables or customer/rep APIs.

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in (
    'patient', 'customer', 'client',
    'rep', 'representative', 'affiliate',
    'physician', 'fulfillment',
    'admin', 'rx_plus_admin', 'distributor', 'owner', 'platform_admin', 'master_admin', 'super_admin'
  ));

create or replace function public.is_product_intelligence_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where (p.id = auth.uid() or p.auth_user_id = auth.uid())
      and (
        lower(coalesce(p.role, '')) in ('admin', 'owner', 'platform_admin', 'master_admin', 'super_admin')
        and nullif(trim(coalesce(p.admin_scope, '')), '') is null
        and nullif(trim(coalesce(p.store_slug, '')), '') is null
        and nullif(trim(coalesce(p.owner_email, '')), '') is null
      )
  );
$$;

create table if not exists public.product_intelligence_products (
  product_key text primary key,
  product_name text not null,
  scientific_name text,
  sku text not null unique,
  category text not null,
  strength text,
  units_per_box integer not null default 1 check (units_per_box > 0),
  supplier_box_cost numeric(12,2) check (supplier_box_cost is null or supplier_box_cost >= 0),
  cost_per_unit numeric(12,2) generated always as (
    case
      when supplier_box_cost is null then null
      else round(supplier_box_cost / units_per_box, 2)
    end
  ) stored,
  true_landing_cost numeric(12,2) generated always as (
    case
      when supplier_box_cost is null then null
      else round((supplier_box_cost / units_per_box) * 1.15, 2)
    end
  ) stored,
  current_retail_price numeric(12,2) check (current_retail_price is null or current_retail_price >= 0),
  profit_per_unit numeric(12,2) generated always as (
    case
      when supplier_box_cost is null or current_retail_price is null then null
      else round(current_retail_price - ((supplier_box_cost / units_per_box) * 1.15), 2)
    end
  ) stored,
  margin_percent numeric(8,2) generated always as (
    case
      when supplier_box_cost is null or current_retail_price is null or current_retail_price = 0 then null
      else round(((current_retail_price - ((supplier_box_cost / units_per_box) * 1.15)) / current_retail_price) * 100, 2)
    end
  ) stored,
  active_status text not null default 'active' check (active_status in ('active', 'inactive', 'hidden', 'review')),
  description text,
  typical_use_case text,
  components text[] not null default '{}',
  notes text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.product_intelligence_aliases (
  id uuid primary key default gen_random_uuid(),
  product_key text not null references public.product_intelligence_products(product_key) on delete cascade,
  alias text not null,
  created_at timestamptz not null default now(),
  unique (product_key, alias)
);

create table if not exists public.product_intelligence_store_visibility (
  id uuid primary key default gen_random_uuid(),
  product_key text not null references public.product_intelligence_products(product_key) on delete cascade,
  store_key text not null,
  store_name text not null,
  visible boolean not null default false,
  source text not null default 'manual',
  updated_at timestamptz not null default now(),
  unique (product_key, store_key)
);

create index if not exists product_intelligence_products_search_idx
  on public.product_intelligence_products using gin (
    to_tsvector('simple', product_name || ' ' || coalesce(scientific_name, '') || ' ' || sku || ' ' || category || ' ' || coalesce(strength, ''))
  );

create index if not exists product_intelligence_aliases_product_idx
  on public.product_intelligence_aliases(product_key);

create index if not exists product_intelligence_visibility_product_idx
  on public.product_intelligence_store_visibility(product_key);

alter table public.product_intelligence_products enable row level security;
alter table public.product_intelligence_aliases enable row level security;
alter table public.product_intelligence_store_visibility enable row level security;

grant select, insert, update, delete on public.product_intelligence_products to authenticated;
grant select, insert, update, delete on public.product_intelligence_aliases to authenticated;
grant select, insert, update, delete on public.product_intelligence_store_visibility to authenticated;

drop policy if exists "main admins manage product intelligence products" on public.product_intelligence_products;
create policy "main admins manage product intelligence products"
on public.product_intelligence_products
for all
to authenticated
using (public.is_product_intelligence_admin())
with check (public.is_product_intelligence_admin());

drop policy if exists "main admins manage product intelligence aliases" on public.product_intelligence_aliases;
create policy "main admins manage product intelligence aliases"
on public.product_intelligence_aliases
for all
to authenticated
using (public.is_product_intelligence_admin())
with check (public.is_product_intelligence_admin());

drop policy if exists "main admins manage product intelligence visibility" on public.product_intelligence_store_visibility;
create policy "main admins manage product intelligence visibility"
on public.product_intelligence_store_visibility
for all
to authenticated
using (public.is_product_intelligence_admin())
with check (public.is_product_intelligence_admin());

drop trigger if exists product_intelligence_products_touch_updated_at on public.product_intelligence_products;
create trigger product_intelligence_products_touch_updated_at
before update on public.product_intelligence_products
for each row execute function public.touch_updated_at();

drop trigger if exists product_intelligence_visibility_touch_updated_at on public.product_intelligence_store_visibility;
create trigger product_intelligence_visibility_touch_updated_at
before update on public.product_intelligence_store_visibility
for each row execute function public.touch_updated_at();

with seed(
  product_key, product_name, scientific_name, sku, category, strength, units_per_box,
  supplier_box_cost, current_retail_price, active_status, description, typical_use_case, components, sort_order
) as (
  values
    ('retatrutide-5mg', 'Retatrutide', 'Retatrutide', 'RXP-GLP-RETA-5', 'Weight Loss & Metabolic', '5mg', 1, 8.63, 150.00, 'active', 'Partner catalog GLP option for weight-management review.', 'Weight-management and metabolic review.', '{}', 10),
    ('retatrutide-10mg', 'Retatrutide', 'Retatrutide', 'RXP-GLP-RETA-10', 'Weight Loss & Metabolic', '10mg', 1, 12.65, 200.00, 'active', 'Partner catalog GLP option for weight-management review.', 'Weight-management and metabolic review.', '{}', 20),
    ('retatrutide-15mg', 'Retatrutide', 'Retatrutide', 'RXP-GLP-RETA-15', 'Weight Loss & Metabolic', '15mg', 1, 16.10, 250.00, 'active', 'Partner catalog GLP option for weight-management review.', 'Weight-management and metabolic review.', '{}', 30),
    ('retatrutide-20mg', 'Retatrutide', 'Retatrutide', 'RXP-GLP-RETA-20', 'Weight Loss & Metabolic', '20mg', 1, 20.70, 350.00, 'active', 'Expanded GLP option available through partner catalog review.', 'Weight-management and metabolic review.', '{}', 40),
    ('retatrutide-30mg', 'Retatrutide', 'Retatrutide', 'RXP-GLP-RETA-30', 'Weight Loss & Metabolic', '30mg', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Weight-management and metabolic review.', '{}', 50),
    ('retatrutide-40mg', 'Retatrutide', 'Retatrutide', 'RXP-GLP-RETA-40', 'Weight Loss & Metabolic', '40mg', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Weight-management and metabolic review.', '{}', 60),
    ('retatrutide-50mg', 'Retatrutide', 'Retatrutide', 'RXP-GLP-RETA-50', 'Weight Loss & Metabolic', '50mg', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Weight-management and metabolic review.', '{}', 70),
    ('retatrutide-60mg', 'Retatrutide', 'Retatrutide', 'RXP-GLP-RETA-60', 'Weight Loss & Metabolic', '60mg', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Weight-management and metabolic review.', '{}', 80),
    ('retatrutide-100mg', 'Retatrutide', 'Retatrutide', 'RXP-GLP-RETA-100', 'Weight Loss & Metabolic', '100mg', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Weight-management and metabolic review.', '{}', 90),
    ('tirzepatide-5mg', 'Tirzepatide', 'Tirzepatide', 'RXP-GLP-TIRZ-5', 'Weight Loss & Metabolic', '5mg', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'GLP/GIP weight-management review.', '{}', 100),
    ('tirzepatide-10mg', 'Tirzepatide', 'Tirzepatide', 'RXP-GLP-TIRZ-10', 'Weight Loss & Metabolic', '10mg', 1, 6.90, 200.00, 'active', 'GLP/GIP weight-management option available through partner review.', 'GLP/GIP weight-management review.', '{}', 110),
    ('tirzepatide-15mg', 'Tirzepatide', 'Tirzepatide', 'RXP-GLP-TIRZ-15', 'Weight Loss & Metabolic', '15mg', 1, 9.20, 250.00, 'active', 'GLP/GIP weight-management option available through partner review.', 'GLP/GIP weight-management review.', '{}', 120),
    ('tirzepatide-20mg', 'Tirzepatide', 'Tirzepatide', 'RXP-GLP-TIRZ-20', 'Weight Loss & Metabolic', '20mg', 1, 10.93, 350.00, 'active', 'Expanded GLP/GIP option available through partner catalog review.', 'GLP/GIP weight-management review.', '{}', 130),
    ('tirzepatide-30mg', 'Tirzepatide', 'Tirzepatide', 'RXP-GLP-TIRZ-30', 'Weight Loss & Metabolic', '30mg', 1, 15.53, 600.00, 'active', 'Higher-strength GLP/GIP partner catalog option.', 'GLP/GIP weight-management review.', '{}', 140),
    ('tirzepatide-40mg', 'Tirzepatide', 'Tirzepatide', 'RXP-GLP-TIRZ-40', 'Weight Loss & Metabolic', '40mg', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'GLP/GIP weight-management review.', '{}', 150),
    ('tirzepatide-50mg', 'Tirzepatide', 'Tirzepatide', 'RXP-GLP-TIRZ-50', 'Weight Loss & Metabolic', '50mg', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'GLP/GIP weight-management review.', '{}', 160),
    ('tirzepatide-60mg', 'Tirzepatide', 'Tirzepatide', 'RXP-GLP-TIRZ-60', 'Weight Loss & Metabolic', '60mg', 1, 24.15, 950.00, 'active', 'Expanded high-strength GLP/GIP partner catalog option.', 'GLP/GIP weight-management review.', '{}', 170),
    ('tirzepatide-100mg', 'Tirzepatide', 'Tirzepatide', 'RXP-GLP-TIRZ-100', 'Weight Loss & Metabolic', '100mg', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'GLP/GIP weight-management review.', '{}', 180),
    ('tirzepatide-120mg', 'Tirzepatide', 'Tirzepatide', 'RXP-GLP-TIRZ-120', 'Weight Loss & Metabolic', '120mg', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'GLP/GIP weight-management review.', '{}', 190),
    ('cagrilintide-5mg', 'Cagrilintide', 'Cagrilintide', 'RXP-GLP-CAGRI-5', 'Weight Loss & Metabolic', '5mg', 1, 13.80, 220.00, 'active', 'Partner catalog metabolic-support option for clinical review.', 'Satiety and metabolic review.', '{}', 200),
    ('cagrilintide-10mg', 'Cagrilintide', 'Cagrilintide', 'RXP-GLP-CAGRI-10', 'Weight Loss & Metabolic', '10mg', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Satiety and metabolic review.', '{}', 210),
    ('aod-9604-2mg', 'AOD9604', 'AOD-9604', 'RXP-GLP-AOD-2', 'Weight Loss & Metabolic', '2mg', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Metabolic-support review.', '{}', 220),
    ('aod-9604-5mg', 'AOD9604', 'AOD-9604', 'RXP-GLP-AOD-5', 'Weight Loss & Metabolic', '5mg', 1, 11.39, 119.00, 'active', 'Metabolic-support peptide available through partner review.', 'Metabolic-support review.', '{}', 230),
    ('aod-9604-10mg', 'AOD9604', 'AOD-9604', 'RXP-GLP-AOD-10', 'Weight Loss & Metabolic', '10mg', 1, 21.28, 199.00, 'active', 'Metabolic-support peptide available through partner review.', 'Metabolic-support review.', '{}', 240),
    ('mazdutide-10mg', 'Mazdutide', 'Mazdutide', 'RXP-GLP-MAZ-10', 'Weight Loss & Metabolic', '10mg', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Weight-management review.', '{}', 250),
    ('survodutide-10mg', 'Survodutide', 'Survodutide', 'RXP-GLP-SURVO-10', 'Weight Loss & Metabolic', '10mg', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Weight-management review.', '{}', 260),
    ('adipotide-2mg', 'Adipotide', 'Adipotide', 'RXP-GLP-ADIPO-2', 'Weight Loss & Metabolic', '2mg', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Metabolic research support.', '{}', 270),
    ('adipotide-5mg', 'Adipotide', 'Adipotide', 'RXP-GLP-ADIPO-5', 'Weight Loss & Metabolic', '5mg', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Metabolic research support.', '{}', 280),
    ('l-carnitine-600mg', 'L-Carnitine', 'Levocarnitine', 'RXP-GLP-LCARN-600', 'Weight Loss & Metabolic', '600mg', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Energy and metabolic support.', '{}', 290),
    ('l-carnitine-1200mg', 'L-Carnitine', 'Levocarnitine', 'RXP-GLP-LCARN-1200', 'Weight Loss & Metabolic', '1200mg', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Energy and metabolic support.', '{}', 300),
    ('lipo-c', 'Lipo-C', 'Lipotropic blend', 'RXP-GLP-LIPOC', 'Weight Loss & Metabolic', 'Blend', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Metabolic and energy support.', '{}', 310),
    ('5-amino-1mq-5mg', '5-Amino-1MQ', '5-Amino-1MQ', 'RXP-GLP-5A1MQ-5', 'Weight Loss & Metabolic', '5mg', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Metabolic support review.', '{}', 320),
    ('5-amino-1mq-10mg', '5-Amino-1MQ', '5-Amino-1MQ', 'RXP-GLP-5A1MQ-10', 'Weight Loss & Metabolic', '10mg', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Metabolic support review.', '{}', 330),
    ('cjc-1295-dac', 'CJC-1295 DAC', 'CJC-1295 with DAC', 'RXP-GROW-CJC-DAC', 'Growth & Hormone', 'Standard', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Growth-hormone pathway support.', '{}', 400),
    ('cjc-1295-no-dac', 'CJC-1295 No DAC', 'CJC-1295 without DAC', 'RXP-GROW-CJC-NODAC', 'Growth & Hormone', 'Standard', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Growth-hormone pathway support.', '{}', 410),
    ('ipamorelin', 'Ipamorelin', 'Ipamorelin', 'RXP-GROW-IPA', 'Growth & Hormone', 'Standard', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Growth-hormone pathway support.', '{}', 420),
    ('hgh', 'HGH', 'Human Growth Hormone', 'RXP-GROW-HGH', 'Growth & Hormone', 'Standard', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Growth and hormone review.', '{}', 430),
    ('ghrp-2', 'GHRP-2', 'Growth Hormone Releasing Peptide-2', 'RXP-GROW-GHRP2', 'Growth & Hormone', 'Standard', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Growth-hormone pathway support.', '{}', 440),
    ('ghrp-6', 'GHRP-6', 'Growth Hormone Releasing Peptide-6', 'RXP-GROW-GHRP6', 'Growth & Hormone', 'Standard', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Growth-hormone pathway support.', '{}', 450),
    ('sermorelin', 'Sermorelin', 'Sermorelin', 'RXP-GROW-SERM', 'Growth & Hormone', 'Standard', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Growth-hormone pathway support.', '{}', 460),
    ('tesamorelin', 'Tesamorelin', 'Tesamorelin', 'RXP-GROW-TESA', 'Growth & Hormone', 'Standard', 1, 23.46, 229.00, 'active', 'Growth-hormone pathway support option for clinical review.', 'Growth-hormone pathway support.', '{}', 470),
    ('kisspeptin', 'Kisspeptin', 'Kisspeptin', 'RXP-GROW-KISS', 'Growth & Hormone', 'Standard', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Hormone pathway support.', '{}', 480),
    ('hcg', 'HCG', 'Human Chorionic Gonadotropin', 'RXP-GROW-HCG', 'Growth & Hormone', 'Standard', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Hormone pathway support.', '{}', 490),
    ('pt-141', 'PT-141', 'Bremelanotide', 'RXP-GROW-PT141', 'Growth & Hormone', 'Standard', 1, 7.94, 129.00, 'active', 'Wellness support item available through partner review.', 'Wellness and hormone pathway support.', '{}', 500),
    ('gonadorelin', 'Gonadorelin', 'Gonadorelin', 'RXP-GROW-GONAD', 'Growth & Hormone', 'Standard', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Hormone pathway support.', '{}', 510),
    ('hmg', 'HMG', 'Human Menopausal Gonadotropin', 'RXP-GROW-HMG', 'Growth & Hormone', 'Standard', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Hormone pathway support.', '{}', 520),
    ('hexarelin', 'Hexarelin', 'Hexarelin', 'RXP-GROW-HEXA', 'Growth & Hormone', 'Standard', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Growth-hormone pathway support.', '{}', 530),
    ('mk-677', 'MK-677', 'Ibutamoren', 'RXP-GROW-MK677', 'Growth & Hormone', 'Standard', 1, 3.22, 79.00, 'active', 'Growth and performance support item in the partner catalog.', 'Growth-hormone pathway support.', '{}', 540),
    ('bpc-157-10mg', 'BPC-157', 'Body Protection Compound 157', 'RXP-REC-BPC157-10', 'Repair & Anti-Inflammatory', '10mg', 1, 7.48, 99.00, 'active', 'Recovery and repair support peptide available through partner review.', 'Repair and recovery review.', '{}', 600),
    ('tb-500-10mg', 'TB-500', 'Thymosin Beta-4 fragment', 'RXP-REC-TB500-10', 'Repair & Anti-Inflammatory', '10mg', 1, 17.83, 169.00, 'active', 'Recovery-support peptide available through partner review.', 'Repair and recovery review.', '{}', 610),
    ('ghk-cu-100mg', 'GHK-Cu', 'Copper Peptide GHK-Cu', 'RXP-REC-GHKCU-100', 'Repair & Anti-Inflammatory', '100mg', 1, 6.90, 119.00, 'active', 'Repair and skin-support peptide available through partner review.', 'Repair and skin-support review.', '{}', 620),
    ('kpv', 'KPV', 'Lysine-Proline-Valine', 'RXP-REC-KPV', 'Repair & Anti-Inflammatory', 'Standard', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Inflammatory and gut-support review.', '{}', 630),
    ('ss-31', 'SS-31', 'Elamipretide', 'RXP-REC-SS31', 'Repair & Anti-Inflammatory', 'Standard', 1, 40.14, 399.00, 'active', 'Advanced longevity option subject to availability and approval.', 'Mitochondrial support review.', '{}', 640),
    ('ara-290', 'ARA-290', 'Cibinetide', 'RXP-REC-ARA290', 'Repair & Anti-Inflammatory', 'Standard', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Repair and inflammatory support review.', '{}', 650),
    ('snap-8', 'Snap-8', 'Acetyl Octapeptide-3', 'RXP-COS-SNAP8', 'Cosmetic & Anti-Aging', 'Standard', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Cosmetic support review.', '{}', 700),
    ('melanotan-i', 'Melanotan I', 'Afamelanotide analog', 'RXP-COS-MT1', 'Cosmetic & Anti-Aging', 'Standard', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Cosmetic support review.', '{}', 710),
    ('melanotan-ii', 'Melanotan II', 'Melanotan II', 'RXP-COS-MT2', 'Cosmetic & Anti-Aging', 'Standard', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Cosmetic support review.', '{}', 720),
    ('glutathione-1500mg', 'Glutathione', 'Glutathione', 'RXP-COS-GLUTA-1500', 'Cosmetic & Anti-Aging', '1500mg', 1, 17.25, 179.00, 'active', 'Wellness-support antioxidant option for clinical review.', 'Antioxidant and cosmetic support review.', '{}', 730),
    ('nad-500iu', 'NAD+', 'Nicotinamide Adenine Dinucleotide', 'RXP-COS-NAD', 'Cosmetic & Anti-Aging', '500iu', 1, 9.43, 119.00, 'active', 'Longevity wellness item available through partner review.', 'Longevity and energy support review.', '{}', 740),
    ('epithalon-10mg', 'Epithalon', 'Epitalon', 'RXP-COS-EPI-10', 'Cosmetic & Anti-Aging', '10mg', 1, 4.03, 99.00, 'active', 'Longevity support item available through partner review.', 'Longevity support review.', '{}', 750),
    ('foxo4-dri', 'FOXO4-DRI', 'FOXO4-DRI', 'RXP-COS-FOXO4', 'Cosmetic & Anti-Aging', 'Standard', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Longevity support review.', '{}', 760),
    ('dsip', 'DSIP', 'Delta Sleep-Inducing Peptide', 'RXP-NEU-DSIP', 'Neuro / Sleep / Mood', 'Standard', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Sleep and mood support review.', '{}', 800),
    ('selank', 'Selank', 'Selank', 'RXP-NEU-SELANK', 'Neuro / Sleep / Mood', 'Standard', 1, 8.28, 89.00, 'active', 'Cognitive wellness item available through partner review.', 'Cognitive and mood support review.', '{}', 810),
    ('semax', 'Semax', 'Semax', 'RXP-NEU-SEMAX', 'Neuro / Sleep / Mood', 'Standard', 1, 8.05, 89.00, 'active', 'Cognitive wellness item available through partner review.', 'Cognitive and mood support review.', '{}', 820),
    ('oxytocin', 'Oxytocin', 'Oxytocin', 'RXP-NEU-OXY', 'Neuro / Sleep / Mood', 'Standard', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Mood and social-support review.', '{}', 830),
    ('vip', 'VIP', 'Vasoactive Intestinal Peptide', 'RXP-NEU-VIP', 'Neuro / Sleep / Mood', 'Standard', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Neuroimmune support review.', '{}', 840),
    ('b12', 'B12', 'Methylcobalamin', 'RXP-NEU-B12', 'Neuro / Sleep / Mood', 'Standard', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Energy and wellness support.', '{}', 850),
    ('thymosin-alpha-1', 'Thymosin Alpha-1', 'Thymosin Alpha-1', 'RXP-IMM-TA1', 'Immune & Thymic', 'Standard', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Immune and thymic support review.', '{}', 900),
    ('thymalin', 'Thymalin', 'Thymalin', 'RXP-IMM-THYMALIN', 'Immune & Thymic', 'Standard', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Immune and thymic support review.', '{}', 910),
    ('mots-c-10mg', 'MOTS-C', 'Mitochondrial Open Reading Frame of the 12S rRNA-c', 'RXP-IMM-MOTSC-10', 'Immune & Thymic', '10mg', 1, 7.48, 129.00, 'active', 'Longevity and mitochondrial-support option for wellness review.', 'Mitochondrial and energy support review.', '{}', 920),
    ('ll-37', 'LL-37', 'LL-37', 'RXP-IMM-LL37', 'Immune & Thymic', 'Standard', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Immune support review.', '{}', 930),
    ('igf-1-lr3-1mg', 'IGF-1 LR3', 'Insulin-like Growth Factor 1 LR3', 'RXP-PERF-IGF1-LR3-1', 'Energy & Sports Recovery', '1mg', 1, 20.00, 199.00, 'review', 'Growth and performance support item requiring additional verification.', 'Performance and recovery review.', '{}', 1000),
    ('mgf', 'MGF', 'Mechano Growth Factor', 'RXP-PERF-MGF', 'Energy & Sports Recovery', 'Standard', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Performance and recovery review.', '{}', 1010),
    ('peg-mgf', 'PEG-MGF', 'PEGylated Mechano Growth Factor', 'RXP-PERF-PEGMGF', 'Energy & Sports Recovery', 'Standard', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Performance and recovery review.', '{}', 1020),
    ('aicar', 'AICAR', 'AICAR', 'RXP-PERF-AICAR', 'Energy & Sports Recovery', 'Standard', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Performance and energy review.', '{}', 1030),
    ('wolverine-bpc-tb', 'Wolverine Stack', 'BPC-157 / TB-500 Blend', 'RXP-COMBO-BB10', 'Combination Formulas', 'Blend', 1, 12.54, 149.00, 'active', 'Recovery blend commonly requested for repair and training support review.', 'Repair and recovery blend.', '{"BPC-157","TB-500"}', 1100),
    ('wolverine-20', 'Wolverine 20', 'BPC-157 10mg / TB-500 10mg Blend', 'RXP-COMBO-BB20', 'Combination Formulas', '20mg', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Repair and recovery blend.', '{"BPC-157 10mg","TB-500 10mg"}', 1110),
    ('cjc-ipamorelin-10mg', 'CJC/IPA Blend', 'CJC-1295 / Ipamorelin', 'RXP-COMBO-CJCIPA-10', 'Combination Formulas', '10mg', 1, 12.54, 149.00, 'active', 'Performance and recovery support blend for clinical review.', 'Growth-hormone pathway support blend.', '{"CJC-1295","Ipamorelin"}', 1120),
    ('cagrisema', 'CagriSema', 'Cagrilintide / Semaglutide Blend', 'RXP-COMBO-CS10', 'Combination Formulas', 'Blend', 1, 20.70, 450.00, 'active', 'Expanded partner catalog blend for weight-management review.', 'Weight-management combination review.', '{"Cagrilintide","Semaglutide"}', 1130),
    ('glow-peptide-blend', 'Glow', 'BPC-157 / TB-500 / GHK-Cu Blend', 'RXP-COMBO-GLOW', 'Combination Formulas', 'Blend', 1, 17.25, 169.00, 'active', 'Recovery and skin-support blend available through partner review.', 'Recovery and cosmetic-support blend.', '{"BPC-157","TB-500","GHK-Cu"}', 1140),
    ('klow-peptide-blend', 'Klow', 'TB-500 / BPC-157 / GHK-Cu / KPV Blend', 'RXP-COMBO-KLOW', 'Combination Formulas', 'Blend', 1, 17.25, 169.00, 'active', 'Recovery and repair blend available through partner review.', 'Total recovery blend.', '{"TB-500","BPC-157","GHK-Cu","KPV"}', 1150),
    ('bac-water-3ml', 'BAC Water', 'Bacteriostatic Water', 'RXP-REAG-BAC-3', 'Functional Reagents', '3ml', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Reconstitution supply.', '{}', 1200),
    ('bac-water-10ml', 'BAC Water', 'Bacteriostatic Water', 'RXP-REAG-BAC-10', 'Functional Reagents', '10ml', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Reconstitution supply.', '{}', 1210),
    ('benzyl-alcohol-3ml', 'Benzyl Alcohol', 'Benzyl Alcohol', 'RXP-REAG-BA-3', 'Functional Reagents', '3ml', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Functional reagent.', '{}', 1220),
    ('benzyl-alcohol-10ml', 'Benzyl Alcohol', 'Benzyl Alcohol', 'RXP-REAG-BA-10', 'Functional Reagents', '10ml', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Functional reagent.', '{}', 1230),
    ('acetic-acid-water-3ml', 'Acetic Acid Water', 'Acetic Acid Water', 'RXP-REAG-AAW-3', 'Functional Reagents', '3ml', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Functional reagent.', '{}', 1240),
    ('acetic-acid-water-10ml', 'Acetic Acid Water', 'Acetic Acid Water', 'RXP-REAG-AAW-10', 'Functional Reagents', '10ml', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Functional reagent.', '{}', 1250),
    ('lemon-bottle', 'Lemon Bottle', 'Lemon Bottle', 'RXP-REAG-LEMON', 'Functional Reagents', 'Standard', 1, null, null, 'active', 'Supplier sheet item pending final internal cost.', 'Functional reagent.', '{}', 1260)
)
insert into public.product_intelligence_products (
  product_key, product_name, scientific_name, sku, category, strength, units_per_box,
  supplier_box_cost, current_retail_price, active_status, description, typical_use_case, components, sort_order
)
select
  product_key, product_name, scientific_name, sku, category, strength, units_per_box,
  supplier_box_cost, current_retail_price, active_status, description, typical_use_case, components::text[], sort_order
from seed
on conflict (product_key) do update set
  product_name = excluded.product_name,
  scientific_name = excluded.scientific_name,
  sku = excluded.sku,
  category = excluded.category,
  strength = excluded.strength,
  units_per_box = excluded.units_per_box,
  supplier_box_cost = coalesce(public.product_intelligence_products.supplier_box_cost, excluded.supplier_box_cost),
  current_retail_price = coalesce(public.product_intelligence_products.current_retail_price, excluded.current_retail_price),
  active_status = excluded.active_status,
  description = excluded.description,
  typical_use_case = excluded.typical_use_case,
  components = excluded.components,
  sort_order = excluded.sort_order,
  updated_at = now();

with alias_seed(product_name, alias) as (
  values
    ('Retatrutide', 'Reta'), ('Retatrutide', 'RT'), ('Retatrutide', 'Triple Agonist'),
    ('Tirzepatide', 'Tirz'), ('Tirzepatide', 'TR'), ('Tirzepatide', 'GLP/GIP Agonist'),
    ('Semaglutide', 'Sema'), ('Semaglutide', 'Ozempic-style peptide'),
    ('BPC-157', 'Body Protection Compound'), ('BPC-157', 'BPC'),
    ('TB-500', 'Thymosin Beta 4'), ('TB-500', 'TB500'),
    ('GHK-Cu', 'Copper Peptide'), ('GHK-Cu', 'GHK'),
    ('KPV', 'Lysine-Proline-Valine'),
    ('Tesamorelin', 'Tesa'), ('Ipamorelin', 'IPA'),
    ('CJC-1295 DAC', 'CJC DAC'), ('CJC-1295 No DAC', 'CJC No DAC'),
    ('PT-141', 'Bremelanotide'),
    ('NAD+', 'Nicotinamide Adenine Dinucleotide'),
    ('MOTS-C', 'MOTS'), ('IGF-1 LR3', 'IGF'),
    ('Wolverine Stack', 'BB10'), ('Wolverine Stack', 'BPC/TB Blend'),
    ('Wolverine 20', 'BB20'),
    ('Glow', 'Glow Blend'), ('Klow', 'Total Recovery Blend'),
    ('CagriSema', 'CS10')
)
insert into public.product_intelligence_aliases (product_key, alias)
select p.product_key, a.alias
from alias_seed a
join public.product_intelligence_products p on lower(p.product_name) = lower(a.product_name)
on conflict (product_key, alias) do nothing;

with visibility(product_key, store_key, store_name, visible, source) as (
  values
    ('tirzepatide-30mg', 'main', 'Main Store', true, 'products'),
    ('tirzepatide-60mg', 'main', 'Main Store', true, 'products'),
    ('semaglutide-10mg', 'main', 'Main Store', true, 'products'),
    ('retatrutide-15mg', 'main', 'Main Store', true, 'products'),
    ('bpc-157-10mg', 'main', 'Main Store', true, 'products'),
    ('tb-500-10mg', 'main', 'Main Store', true, 'products'),
    ('cjc-ipamorelin-10mg', 'main', 'Main Store', true, 'products'),
    ('nad-500iu', 'main', 'Main Store', true, 'products'),
    ('ghk-cu-100mg', 'main', 'Main Store', true, 'products'),
    ('igf-1-lr3-1mg', 'main', 'Main Store', true, 'products'),
    ('retatrutide-5mg', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('retatrutide-10mg', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('retatrutide-15mg', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('retatrutide-20mg', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('tirzepatide-10mg', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('tirzepatide-15mg', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('tirzepatide-20mg', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('tirzepatide-30mg', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('tirzepatide-60mg', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('semaglutide-10mg', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('cagrisema', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('cagrilintide-5mg', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('aod-9604-5mg', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('aod-9604-10mg', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('tesamorelin', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('cjc-ipamorelin-10mg', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('mk-677', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('wolverine-bpc-tb', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('glow-peptide-blend', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('klow-peptide-blend', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('bpc-157-10mg', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('tb-500-10mg', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('ghk-cu-100mg', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('mots-c-10mg', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('nad-500iu', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('glutathione-1500mg', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('epithalon-10mg', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('ss-31', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('selank', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('semax', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('pt-141', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('igf-1-lr3-1mg', 'aactivated', 'AACTIVATED', true, 'rx_plus'),
    ('retatrutide-5mg', 'empire', 'Empire', true, 'portal_catalog'),
    ('retatrutide-10mg', 'empire', 'Empire', true, 'portal_catalog'),
    ('tirzepatide-10mg', 'empire', 'Empire', true, 'portal_catalog'),
    ('semaglutide-10mg', 'empire', 'Empire', true, 'portal_catalog'),
    ('bpc-157-10mg', 'empire', 'Empire', true, 'portal_catalog'),
    ('tb-500-10mg', 'empire', 'Empire', true, 'portal_catalog'),
    ('glow-peptide-blend', 'empire', 'Empire', true, 'portal_catalog'),
    ('klow-peptide-blend', 'empire', 'Empire', true, 'portal_catalog'),
    ('tesamorelin', 'empire', 'Empire', true, 'portal_catalog'),
    ('nad-500iu', 'empire', 'Empire', true, 'portal_catalog'),
    ('retatrutide-10mg', 'peakform', 'Peak Form', true, 'portal_catalog'),
    ('retatrutide-15mg', 'peakform', 'Peak Form', true, 'portal_catalog'),
    ('tirzepatide-10mg', 'peakform', 'Peak Form', true, 'portal_catalog'),
    ('tirzepatide-15mg', 'peakform', 'Peak Form', true, 'portal_catalog'),
    ('bpc-157-10mg', 'peakform', 'Peak Form', true, 'portal_catalog'),
    ('tb-500-10mg', 'peakform', 'Peak Form', true, 'portal_catalog'),
    ('wolverine-bpc-tb', 'peakform', 'Peak Form', true, 'portal_catalog'),
    ('glow-peptide-blend', 'peakform', 'Peak Form', true, 'portal_catalog'),
    ('klow-peptide-blend', 'peakform', 'Peak Form', true, 'portal_catalog'),
    ('retatrutide-5mg', 'zenora', 'Zenora', true, 'portal_catalog'),
    ('retatrutide-10mg', 'zenora', 'Zenora', true, 'portal_catalog'),
    ('retatrutide-15mg', 'zenora', 'Zenora', true, 'portal_catalog'),
    ('retatrutide-20mg', 'zenora', 'Zenora', true, 'portal_catalog'),
    ('tirzepatide-10mg', 'zenora', 'Zenora', true, 'portal_catalog'),
    ('tirzepatide-15mg', 'zenora', 'Zenora', true, 'portal_catalog'),
    ('tirzepatide-20mg', 'zenora', 'Zenora', true, 'portal_catalog'),
    ('tirzepatide-30mg', 'zenora', 'Zenora', true, 'portal_catalog'),
    ('tirzepatide-60mg', 'zenora', 'Zenora', true, 'portal_catalog'),
    ('semaglutide-10mg', 'zenora', 'Zenora', true, 'portal_catalog'),
    ('nad-500iu', 'zenora', 'Zenora', true, 'portal_catalog'),
    ('ghk-cu-100mg', 'zenora', 'Zenora', true, 'portal_catalog'),
    ('mots-c-10mg', 'zenora', 'Zenora', true, 'portal_catalog'),
    ('retatrutide-10mg', 'aurora', 'Aurora', true, 'portal_catalog'),
    ('tirzepatide-10mg', 'aurora', 'Aurora', true, 'portal_catalog'),
    ('tirzepatide-30mg', 'aurora', 'Aurora', true, 'portal_catalog'),
    ('bpc-157-10mg', 'aurora', 'Aurora', true, 'portal_catalog'),
    ('tb-500-10mg', 'aurora', 'Aurora', true, 'portal_catalog'),
    ('nad-500iu', 'aurora', 'Aurora', true, 'portal_catalog')
)
insert into public.product_intelligence_store_visibility (product_key, store_key, store_name, visible, source)
select product_key, store_key, store_name, visible, source
from visibility
on conflict (product_key, store_key) do update set
  store_name = excluded.store_name,
  visible = excluded.visible,
  source = excluded.source,
  updated_at = now();

comment on table public.product_intelligence_products is
  'Main-admin-only internal cost analysis. Do not expose through public, customer, rep, partner-admin, checkout, or storefront APIs.';
comment on column public.product_intelligence_products.supplier_box_cost is
  'Internal supplier box cost. Protected by product-intelligence RLS only.';
comment on column public.product_intelligence_products.true_landing_cost is
  'Generated internal true landing cost: cost per unit multiplied by 1.15.';
comment on column public.product_intelligence_products.profit_per_unit is
  'Generated internal profit: retail price minus true landing cost.';
comment on column public.product_intelligence_products.margin_percent is
  'Generated internal margin percent: profit divided by retail price.';
