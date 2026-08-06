-- AACTIVATEDRX rep onboarding. Additive, reversible, and production-disabled.
-- Do not enable production until legal review, staging validation, and separate authorization.

alter table public.rep_store_intake_submissions
  add column if not exists first_name text,
  add column if not exists last_name text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists social_profile text,
  add column if not exists referral_rep text,
  add column if not exists discovery_source text,
  add column if not exists motivation text,
  add column if not exists application_terms_accepted_at timestamptz,
  add column if not exists privacy_accepted_at timestamptz;

comment on column public.rep_store_intake_submissions.paypal_account is
  'DEPRECATED for AACTIVATEDRX application intake. Retained only for historical and other-brand compatibility.';

create table if not exists public.aactivated_onboarding_settings (
  brand_id text primary key check (brand_id = 'aactivated'),
  production_enabled boolean not null default false,
  allow_w9_pending_activation boolean not null default false,
  support_url text not null default '/contact',
  updated_at timestamptz not null default now(),
  updated_by uuid
);
insert into public.aactivated_onboarding_settings (brand_id, production_enabled)
values ('aactivated', false) on conflict (brand_id) do nothing;

create table if not exists public.aactivated_onboarding_profiles (
  id uuid primary key default gen_random_uuid(),
  brand_id text not null default 'aactivated' check (brand_id = 'aactivated'),
  application_id uuid unique references public.rep_store_intake_submissions(id),
  rep_id uuid unique references public.reps(id),
  user_id uuid unique references auth.users(id),
  state text not null default 'application_pending' check (state in (
    'application_pending','application_more_info_required','application_declined',
    'approved_activation_pending','approved_onboarding_incomplete','agreement_complete',
    'w9_pending_review','starter_kit_pending','payout_pending','ready_for_activation','active','suspended'
  )),
  account_status text not null default 'pending' check (account_status in ('pending','activation_sent','complete','suspended')),
  agreement_status text not null default 'not_started',
  w9_status text not null default 'not_started',
  starter_kit_status text not null default 'not_started',
  payout_status text not null default 'not_started',
  commissions_enabled boolean not null default false,
  referral_enabled boolean not null default false,
  approved_at timestamptz,
  activated_at timestamptz,
  last_activity_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.aactivated_agreements (
  id uuid primary key default gen_random_uuid(),
  brand_id text not null default 'aactivated' check (brand_id = 'aactivated'),
  version text not null,
  effective_date date not null,
  title text not null,
  content text not null,
  content_hash text not null,
  status text not null default 'draft' check (status in ('draft','approved','retired')),
  created_by uuid,
  approved_by uuid,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  unique (brand_id, version)
);

insert into public.aactivated_agreements (brand_id, version, effective_date, title, content, content_hash, status)
values ('aactivated', 'development-draft-1', current_date,
  'AACTIVATEDRX REP AGREEMENT — LEGAL REVIEW REQUIRED',
  'Development placeholder only. This agreement is not approved or published and must not be presented for production signature.',
  encode(digest('AACTIVATEDRX REP AGREEMENT — LEGAL REVIEW REQUIRED development placeholder', 'sha256'), 'hex'),
  'draft') on conflict (brand_id, version) do nothing;

create table if not exists public.aactivated_agreement_signatures (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references public.aactivated_onboarding_profiles(id),
  rep_user_id uuid not null references auth.users(id),
  agreement_id uuid not null references public.aactivated_agreements(id),
  agreement_version text not null,
  rendered_content text not null,
  document_hash text not null,
  legal_name text not null,
  signature_text text not null,
  read_consent boolean not null check (read_consent),
  electronic_consent boolean not null check (electronic_consent),
  signed_at timestamptz not null default now(),
  ip_address inet,
  user_agent text,
  audit_id uuid not null default gen_random_uuid(),
  pdf_storage_path text,
  unique (onboarding_id, agreement_id)
);

create table if not exists public.aactivated_w9_submissions (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references public.aactivated_onboarding_profiles(id),
  rep_user_id uuid not null references auth.users(id),
  revision integer not null default 1,
  status text not null default 'submitted' check (status in ('in_progress','submitted','under_review','accepted','correction_required','superseded')),
  tax_name text not null,
  business_name text,
  federal_tax_classification text not null,
  llc_classification text,
  exempt_payee_code text,
  fatca_exemption_code text,
  address text not null,
  city text not null,
  state text not null,
  zip text not null,
  account_numbers text,
  tin_ciphertext text not null,
  tin_last_four char(4) not null,
  certification_version text not null,
  certification_accepted boolean not null check (certification_accepted),
  signature_text text not null,
  signed_at timestamptz not null default now(),
  document_hash text not null,
  pdf_storage_path text,
  reviewer_id uuid,
  reviewed_at timestamptz,
  correction_reason text,
  created_at timestamptz not null default now(),
  unique (onboarding_id, revision)
);

create table if not exists public.aactivated_starter_kit_definitions (
  id uuid primary key default gen_random_uuid(),
  tier text not null check (tier in ('starter_experience','momentum_business_builder','ultimate_business_builder')),
  product_path text not null check (product_path in ('reta','tirzepatide')),
  name text not null,
  price_cents integer not null check (price_cents > 0),
  package_definition jsonb not null default '[]',
  eligibility_rules jsonb not null default '{}',
  purchase_limit integer not null default 1 check (purchase_limit > 0),
  active boolean not null default false,
  source_definition_version text not null,
  unique (tier, product_path)
);

create table if not exists public.aactivated_starter_kit_orders (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references public.aactivated_onboarding_profiles(id),
  rep_user_id uuid not null references auth.users(id),
  kit_definition_id uuid not null references public.aactivated_starter_kit_definitions(id),
  payment_provider text not null,
  payment_reference text unique,
  status text not null default 'pending' check (status in ('pending','paid','failed','cancelled','refunded','abandoned','overridden')),
  amount_cents integer not null check (amount_cents > 0),
  paid_at timestamptz,
  validated_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.aactivated_payout_profiles (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references public.aactivated_onboarding_profiles(id),
  rep_user_id uuid not null references auth.users(id),
  method text not null check (method in ('paypal')),
  destination_ciphertext text not null,
  masked_destination text not null,
  verification_status text not null default 'submitted' check (verification_status in ('submitted','verified','correction_required','disabled')),
  submitted_at timestamptz not null default now(),
  verified_at timestamptz,
  admin_notes text,
  superseded_at timestamptz
);

create table if not exists public.aactivated_onboarding_audit (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid references public.aactivated_onboarding_profiles(id),
  actor_id uuid,
  action text not null,
  reason text,
  metadata jsonb not null default '{}',
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.aactivated_onboarding_notifications (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid references public.aactivated_onboarding_profiles(id),
  event_type text not null,
  recipient_email text not null,
  status text not null default 'pending' check (status in ('pending','sent','failed','suppressed')),
  secure_portal_path text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create table if not exists public.aactivated_onboarding_overrides (
  id uuid primary key default gen_random_uuid(),
  onboarding_id uuid not null references public.aactivated_onboarding_profiles(id),
  step text not null check (step in ('agreement','w9','starter_kit','payout','activation')),
  reason text not null check (length(trim(reason)) >= 10),
  authorized_by uuid not null,
  created_at timestamptz not null default now()
);

create or replace function public.is_aactivated_onboarding_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_current_profile_platform_admin() or public.is_current_profile_aactivated_admin();
$$;

create or replace function public.current_aactivated_onboarding_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.aactivated_onboarding_profiles where user_id = auth.uid() and brand_id = 'aactivated' limit 1;
$$;

create or replace function public.evaluate_aactivated_onboarding(p_onboarding_id uuid)
returns public.aactivated_onboarding_profiles
language plpgsql security definer set search_path = public as $$
declare v_row public.aactivated_onboarding_profiles; v_allow_pending boolean; v_override_count integer;
begin
  select * into v_row from public.aactivated_onboarding_profiles where id = p_onboarding_id for update;
  if v_row.id is null then raise exception 'Onboarding record not found'; end if;
  if auth.uid() <> v_row.user_id and not public.is_aactivated_onboarding_admin() then raise exception 'Not authorized'; end if;
  select allow_w9_pending_activation into v_allow_pending from public.aactivated_onboarding_settings where brand_id='aactivated';
  select count(*) into v_override_count from public.aactivated_onboarding_overrides where onboarding_id=p_onboarding_id and step='activation';
  if v_row.state not in ('application_declined','suspended')
    and v_row.account_status='complete' and v_row.agreement_status='complete'
    and (v_row.w9_status='accepted' or (v_allow_pending and v_row.w9_status in ('submitted','under_review')))
    and v_row.starter_kit_status='complete' and v_row.payout_status in ('complete','verified') then
      update public.aactivated_onboarding_profiles set state='ready_for_activation', updated_at=now() where id=p_onboarding_id returning * into v_row;
  elsif v_row.state not in ('application_pending','application_more_info_required','application_declined','approved_activation_pending','suspended') then
      update public.aactivated_onboarding_profiles set state='approved_onboarding_incomplete', commissions_enabled=false, referral_enabled=false, updated_at=now() where id=p_onboarding_id returning * into v_row;
  end if;
  return v_row;
end $$;

create or replace function public.activate_aactivated_onboarding(p_onboarding_id uuid)
returns public.aactivated_onboarding_profiles
language plpgsql security definer set search_path = public as $$
declare v_row public.aactivated_onboarding_profiles;
begin
  if not public.is_aactivated_onboarding_admin() then raise exception 'Administrator authorization required'; end if;
  v_row := public.evaluate_aactivated_onboarding(p_onboarding_id);
  if v_row.state <> 'ready_for_activation' then raise exception 'Required onboarding steps are incomplete'; end if;
  update public.aactivated_onboarding_profiles set state='active', commissions_enabled=true, referral_enabled=true, activated_at=now(), updated_at=now() where id=p_onboarding_id returning * into v_row;
  update public.reps set active=true where id=v_row.rep_id;
  insert into public.aactivated_onboarding_audit(onboarding_id,actor_id,action) values(p_onboarding_id,auth.uid(),'onboarding_activated');
  return v_row;
end $$;

alter table public.aactivated_onboarding_settings enable row level security;
alter table public.aactivated_onboarding_profiles enable row level security;
alter table public.aactivated_agreements enable row level security;
alter table public.aactivated_agreement_signatures enable row level security;
alter table public.aactivated_w9_submissions enable row level security;
alter table public.aactivated_starter_kit_definitions enable row level security;
alter table public.aactivated_starter_kit_orders enable row level security;
alter table public.aactivated_payout_profiles enable row level security;
alter table public.aactivated_onboarding_audit enable row level security;
alter table public.aactivated_onboarding_notifications enable row level security;
alter table public.aactivated_onboarding_overrides enable row level security;

create policy "onboarding owner or scoped admin read" on public.aactivated_onboarding_profiles for select to authenticated
using (user_id=auth.uid() or public.is_aactivated_onboarding_admin());
create policy "published agreement or scoped admin read" on public.aactivated_agreements for select to authenticated
using ((status='approved' and published_at is not null) or public.is_aactivated_onboarding_admin());
create policy "agreement admin manage" on public.aactivated_agreements for all to authenticated
using (public.is_aactivated_onboarding_admin()) with check (public.is_aactivated_onboarding_admin());
create policy "signature owner or scoped admin read" on public.aactivated_agreement_signatures for select to authenticated
using (rep_user_id=auth.uid() or public.is_aactivated_onboarding_admin());
create policy "signature owner insert" on public.aactivated_agreement_signatures for insert to authenticated
with check (rep_user_id=auth.uid() and onboarding_id=public.current_aactivated_onboarding_id());
create policy "w9 owner masked metadata read" on public.aactivated_w9_submissions for select to authenticated
using (rep_user_id=auth.uid());
create policy "w9 tax admin read" on public.aactivated_w9_submissions for select to authenticated
using (public.is_current_profile_platform_admin());
create policy "kit definitions authenticated read" on public.aactivated_starter_kit_definitions for select to authenticated using (active or public.is_aactivated_onboarding_admin());
create policy "kit order owner or scoped admin read" on public.aactivated_starter_kit_orders for select to authenticated
using (rep_user_id=auth.uid() or public.is_aactivated_onboarding_admin());
create policy "payout owner or scoped admin read" on public.aactivated_payout_profiles for select to authenticated
using (rep_user_id=auth.uid() or public.is_aactivated_onboarding_admin());
create policy "audit scoped admin read" on public.aactivated_onboarding_audit for select to authenticated using (public.is_aactivated_onboarding_admin());
create policy "notification scoped admin read" on public.aactivated_onboarding_notifications for select to authenticated using (public.is_aactivated_onboarding_admin());
create policy "override scoped admin manage" on public.aactivated_onboarding_overrides for all to authenticated
using (public.is_aactivated_onboarding_admin()) with check (public.is_aactivated_onboarding_admin() and authorized_by=auth.uid());

revoke all on public.aactivated_w9_submissions from anon;
revoke insert, update, delete on public.aactivated_w9_submissions from authenticated;
revoke all on public.aactivated_payout_profiles from anon;
revoke insert, update, delete on public.aactivated_payout_profiles from authenticated;
grant execute on function public.evaluate_aactivated_onboarding(uuid) to authenticated;
grant execute on function public.activate_aactivated_onboarding(uuid) to authenticated;

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('aactivated-onboarding-private','aactivated-onboarding-private',false,10485760,array['application/pdf'])
on conflict (id) do update set public=false;

create policy "private onboarding document read" on storage.objects for select to authenticated
using (bucket_id='aactivated-onboarding-private' and public.is_aactivated_onboarding_admin());

comment on table public.aactivated_onboarding_settings is 'Production remains disabled until separately authorized.';
