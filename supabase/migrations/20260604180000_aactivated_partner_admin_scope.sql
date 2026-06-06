alter table public.rep_store_intake_submissions
  add column if not exists source_url text,
  add column if not exists parent_store_slug text,
  add column if not exists parent_store_name text,
  add column if not exists partner_admin_id uuid,
  add column if not exists partner_admin_email text,
  add column if not exists approval_owner_id uuid,
  add column if not exists approval_owner_email text,
  add column if not exists approval_status text,
  add column if not exists approval_notes text;

alter table public.rep_store_intake_submissions
  drop constraint if exists rep_store_intake_approval_status_check;

alter table public.rep_store_intake_submissions
  add constraint rep_store_intake_approval_status_check
  check (
    approval_status is null
    or approval_status in ('pending', 'approved', 'rejected', 'more_info_requested')
  );

create index if not exists rep_store_intake_parent_store_slug_idx
  on public.rep_store_intake_submissions(parent_store_slug);

create index if not exists rep_store_intake_partner_admin_email_idx
  on public.rep_store_intake_submissions(lower(partner_admin_email));

create index if not exists rep_store_intake_approval_owner_email_idx
  on public.rep_store_intake_submissions(lower(approval_owner_email));

create index if not exists rep_store_intake_approval_status_idx
  on public.rep_store_intake_submissions(approval_status);

do $$
declare
  guy_profile_id uuid;
begin
  select id
    into guy_profile_id
  from public.profiles
  where lower(email) = 'guy@aactivated.com'
  order by created_at desc
  limit 1;

  update public.profiles
  set
    role = 'rx_plus_admin',
    full_name = 'Guy Griffithe',
    email = 'guy@aactivated.com'
  where id = guy_profile_id;

  update public.reps
  set
    profile_id = coalesce(profile_id, guy_profile_id),
    rep_name = 'Guy Griffithe',
    payout_email = 'guy@aactivated.com',
    rep_tier = 'rx_plus_admin_distributor',
    rep_channel = 'aactivated_partner_admin',
    custom_store_slug = 'aactivated',
    brand_name = 'AACTIVATEDRX',
    parent_rep_id = null,
    managed_by_profile_id = null,
    active = true
  where rep_slug = 'GUY60';

  update public.rep_store_intake_submissions
  set
    source_portal_id = coalesce(source_portal_id, 'aactivated'),
    source_portal = coalesce(source_portal, 'AACTIVATEDRX'),
    source_route = coalesce(source_route, '/AACTIVATED/rep-intake'),
    source_url = coalesce(source_url, 'https://pepscriptrx.vercel.app/AACTIVATED/rep-intake'),
    parent_store_slug = 'aactivated',
    parent_store_name = 'AACTIVATEDRX',
    partner_admin_id = guy_profile_id,
    partner_admin_email = 'guy@aactivated.com',
    approval_owner_id = guy_profile_id,
    approval_owner_email = 'guy@aactivated.com',
    approval_status = case
      when status in ('ready_to_build', 'launched') then 'approved'
      when status = 'rejected' then 'rejected'
      when status = 'more_info_requested' then 'more_info_requested'
      else 'pending'
    end,
    review_queue = coalesce(review_queue, 'aactivated'),
    review_admin_code = coalesce(review_admin_code, 'GUY60'),
    review_admin_name = 'Guy Griffithe'
  where
    source_portal_id = 'aactivated'
    or review_queue = 'aactivated'
    or review_admin_code = 'GUY60'
    or upper(
      coalesce(internal_notes, '') || ' ' ||
      coalesce(parent_rep_or_admin_name, '') || ' ' ||
      coalesce(store_brand_name, '') || ' ' ||
      coalesce(store_type, '') || ' ' ||
      coalesce(source_portal, '') || ' ' ||
      coalesce(source_route, '')
    ) like '%AACTIVATED%'
    or lower(full_name) in ('wendy myers', 'kaylee poway', 'juwan', 'billy');
end $$;

drop policy if exists "admin_manage_rep_store_intake" on public.rep_store_intake_submissions;
create policy "admin_manage_rep_store_intake"
on public.rep_store_intake_submissions
for all
to authenticated
using (
  public.my_role() = 'admin'
  or (
    public.my_role() = 'rx_plus_admin'
    and lower(coalesce(approval_owner_email, partner_admin_email, '')) = 'guy@aactivated.com'
    and coalesce(parent_store_slug, review_queue, source_portal_id) in ('aactivated', 'AACTIVATEDRX')
  )
)
with check (
  public.my_role() = 'admin'
  or (
    public.my_role() = 'rx_plus_admin'
    and lower(coalesce(approval_owner_email, partner_admin_email, '')) = 'guy@aactivated.com'
    and coalesce(parent_store_slug, review_queue, source_portal_id) in ('aactivated', 'AACTIVATEDRX')
  )
);

drop policy if exists "rx plus aactivated submissions scoped read" on public.patient_submissions;
create policy "rx plus aactivated submissions scoped read"
on public.patient_submissions
for select
to authenticated
using (
  public.my_role() = 'rx_plus_admin'
  and (
    checkout_scope_code in ('VITALITYINS', 'GUY60', 'AACTIVATED', 'AACTIVATEDRX')
    or lower(coalesce(store_slug, '')) = 'aactivated'
    or upper(coalesce(source_portal, '') || ' ' || coalesce(source_store, '') || ' ' || coalesce(source_admin, '') || ' ' || coalesce(source_rep, '') || ' ' || coalesce(referral_code, '') || ' ' || coalesce(discount_code, '')) like '%AACTIVATED%'
    or coalesce(source_admin, source_rep, admin_code, referral_code) = 'GUY60'
  )
);

drop policy if exists "rx plus aactivated submissions scoped update" on public.patient_submissions;
create policy "rx plus aactivated submissions scoped update"
on public.patient_submissions
for update
to authenticated
using (
  public.my_role() = 'rx_plus_admin'
  and (
    checkout_scope_code in ('VITALITYINS', 'GUY60', 'AACTIVATED', 'AACTIVATEDRX')
    or lower(coalesce(store_slug, '')) = 'aactivated'
    or coalesce(source_admin, source_rep, admin_code, referral_code) = 'GUY60'
  )
)
with check (
  public.my_role() = 'rx_plus_admin'
  and (
    checkout_scope_code in ('VITALITYINS', 'GUY60', 'AACTIVATED', 'AACTIVATEDRX')
    or lower(coalesce(store_slug, '')) = 'aactivated'
    or coalesce(source_admin, source_rep, admin_code, referral_code) = 'GUY60'
  )
);

drop policy if exists "rx plus aactivated ledger scoped read" on public.commission_ledger;
create policy "rx plus aactivated ledger scoped read"
on public.commission_ledger
for select
to authenticated
using (
  public.my_role() = 'rx_plus_admin'
  and (
    exists (
      select 1
      from public.reps r
      where r.id = commission_ledger.rep_id
        and (
          r.rep_slug = 'GUY60'
          or r.parent_rep_id = public.current_rx_plus_parent_rep_id()
          or r.managed_by_profile_id = public.current_profile_id()
          or lower(coalesce(r.payout_email, '')) = 'guy@aactivated.com'
          or lower(coalesce(r.custom_store_slug, '')) = 'aactivated'
        )
    )
    or exists (
      select 1
      from public.patient_submissions s
      where s.id = commission_ledger.submission_id
        and (
          s.checkout_scope_code in ('VITALITYINS', 'GUY60', 'AACTIVATED', 'AACTIVATEDRX')
          or lower(coalesce(s.store_slug, '')) = 'aactivated'
          or coalesce(s.source_admin, s.source_rep, s.admin_code, s.referral_code) = 'GUY60'
        )
    )
  )
);

drop policy if exists "rx plus aactivated checkout scopes read" on public.checkout_scopes;
create policy "rx plus aactivated checkout scopes read"
on public.checkout_scopes
for select
to authenticated
using (
  public.my_role() = 'rx_plus_admin'
  and scope_code in ('VITALITYINS', 'GUY60', 'AACTIVATED', 'AACTIVATEDRX')
);

create table if not exists public.partner_store_settings (
  store_slug text primary key,
  store_name text not null,
  settings jsonb not null default '{}'::jsonb,
  updated_by uuid,
  updated_at timestamptz not null default now()
);

insert into public.partner_store_settings (store_slug, store_name, settings)
values (
  'aactivated',
  'AACTIVATEDRX',
  jsonb_build_object(
    'logoSrc', '/marketing/aactivated-rx-logo-v2.png',
    'heroImage', '/marketing/aactivated-product-vial.png',
    'supportContact', 'guy@aactivated.com',
    'description', 'AACTIVATEDRX partner storefront.',
    'promoBanner', '',
    'socialLinks', ''
  )
)
on conflict (store_slug) do nothing;

alter table public.partner_store_settings enable row level security;

drop policy if exists "admin manage partner store settings" on public.partner_store_settings;
create policy "admin manage partner store settings"
on public.partner_store_settings
for all
to authenticated
using (public.my_role() = 'admin')
with check (public.my_role() = 'admin');

drop policy if exists "rx plus manage aactivated store settings" on public.partner_store_settings;
create policy "rx plus manage aactivated store settings"
on public.partner_store_settings
for all
to authenticated
using (
  public.my_role() = 'rx_plus_admin'
  and store_slug = 'aactivated'
)
with check (
  public.my_role() = 'rx_plus_admin'
  and store_slug = 'aactivated'
);

create table if not exists public.partner_notification_events (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  event_type text not null,
  partner_store_slug text not null,
  recipient_email text,
  applicant_email text,
  rep_request_id uuid,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued'
);

alter table public.partner_notification_events enable row level security;

drop policy if exists "admin manage partner notification events" on public.partner_notification_events;
create policy "admin manage partner notification events"
on public.partner_notification_events
for all
to authenticated
using (public.my_role() = 'admin')
with check (public.my_role() = 'admin');

create or replace function public.queue_aactivated_rep_intake_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(new.parent_store_slug, new.review_queue, new.source_portal_id) = 'aactivated'
     or lower(coalesce(new.partner_admin_email, new.approval_owner_email, '')) = 'guy@aactivated.com' then
    insert into public.partner_notification_events (
      event_type,
      partner_store_slug,
      recipient_email,
      applicant_email,
      rep_request_id,
      payload
    )
    values
      ('aactivated_rep_request_submitted_partner_admin', 'aactivated', 'guy@aactivated.com', new.email, new.id, to_jsonb(new)),
      ('aactivated_rep_request_submitted_platform_admin', 'aactivated', null, new.email, new.id, to_jsonb(new)),
      ('aactivated_rep_request_submitted_applicant', 'aactivated', new.email, new.email, new.id, jsonb_build_object('status', new.approval_status));
  end if;

  return new;
end;
$$;

drop trigger if exists queue_aactivated_rep_intake_notifications_trigger on public.rep_store_intake_submissions;
create trigger queue_aactivated_rep_intake_notifications_trigger
after insert on public.rep_store_intake_submissions
for each row execute function public.queue_aactivated_rep_intake_notifications();
