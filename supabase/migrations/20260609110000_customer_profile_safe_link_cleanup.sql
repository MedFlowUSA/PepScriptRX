-- Customer profile safe-link cleanup.
-- Source: read-only customer dedupe audit generated 2026-06-09.
--
-- This migration links only the 32 submissions that the audit marked
-- safely linkable by normalized email. It does not delete, merge, or
-- deactivate profiles. Attribution fields on patient_submissions,
-- commission_ledger, reps, stores, discounts, and payment rows are left
-- untouched.
--
-- Rollback note:
--   select * from public.customer_profile_cleanup_audit
--   where cleanup_batch = '20260609_safe_email_link_v1';
--
-- To reverse this batch, review the audit rows first, then restore:
--   update public.patient_submissions s
--   set patient_profile_id = a.previous_patient_profile_id,
--       updated_at = now()
--   from public.customer_profile_cleanup_audit a
--   where a.cleanup_batch = '20260609_safe_email_link_v1'
--     and a.submission_id = s.id
--     and s.patient_profile_id = a.canonical_profile_id;

create table if not exists public.customer_profile_cleanup_audit (
  id uuid primary key default gen_random_uuid(),
  cleanup_batch text not null,
  submission_id uuid not null references public.patient_submissions(id) on delete restrict,
  previous_patient_profile_id uuid references public.profiles(id) on delete restrict,
  canonical_profile_id uuid not null references public.profiles(id) on delete restrict,
  submission_email text,
  profile_email text,
  matched_by text not null,
  safety_notes text not null,
  created_at timestamptz not null default now(),
  unique (cleanup_batch, submission_id)
);

comment on table public.customer_profile_cleanup_audit is
  'Audit log for reviewed customer profile cleanup batches. Stores enough information to reverse profile-link updates without deleting or merging records.';

with candidates(submission_id, canonical_profile_id) as (
  values
    ('064df02d-81b0-434f-b285-55c661eca9bf'::uuid, '74a7e124-4ad2-4c76-bd12-9c5cf1e0d724'::uuid),
    ('534d98e3-6d5d-4d25-92e4-bb4f6e06d9f3'::uuid, '74a7e124-4ad2-4c76-bd12-9c5cf1e0d724'::uuid),
    ('668dee94-4332-46de-b011-31714e82ee9b'::uuid, '74a7e124-4ad2-4c76-bd12-9c5cf1e0d724'::uuid),
    ('bc3fc0d3-7b70-43e4-ab48-6770a0ad13e4'::uuid, '74a7e124-4ad2-4c76-bd12-9c5cf1e0d724'::uuid),
    ('220fa28f-d482-4b01-9c4f-17c8a87d34e7'::uuid, '74a7e124-4ad2-4c76-bd12-9c5cf1e0d724'::uuid),
    ('d04f20d7-f944-4469-be4a-da90c4be6402'::uuid, '74a7e124-4ad2-4c76-bd12-9c5cf1e0d724'::uuid),
    ('5a40f2bb-0cc8-4711-a6f1-61c0e0b38980'::uuid, '74a7e124-4ad2-4c76-bd12-9c5cf1e0d724'::uuid),
    ('5f86bc78-5c79-4e59-a7ae-8daa9e69847e'::uuid, '74a7e124-4ad2-4c76-bd12-9c5cf1e0d724'::uuid),
    ('161b1758-b26a-4e33-aa7b-79c65bfc6df8'::uuid, '74a7e124-4ad2-4c76-bd12-9c5cf1e0d724'::uuid),
    ('b0472854-2110-4a8a-8764-a06b6935a41c'::uuid, '74a7e124-4ad2-4c76-bd12-9c5cf1e0d724'::uuid),
    ('9c2c7b50-fb9c-4b82-8a92-ad18a4fd17b9'::uuid, '74a7e124-4ad2-4c76-bd12-9c5cf1e0d724'::uuid),
    ('a3df2266-dd85-4540-9584-084a73ca21a7'::uuid, '74a7e124-4ad2-4c76-bd12-9c5cf1e0d724'::uuid),
    ('4170dddb-6f2a-4f7f-89cb-56ec25af3d2b'::uuid, '74a7e124-4ad2-4c76-bd12-9c5cf1e0d724'::uuid),
    ('6864aa4a-0afd-4ebb-bb89-f3aa2a025f66'::uuid, '74a7e124-4ad2-4c76-bd12-9c5cf1e0d724'::uuid),
    ('bd4a7203-8369-4b6d-9760-4a039d9f62d0'::uuid, '74a7e124-4ad2-4c76-bd12-9c5cf1e0d724'::uuid),
    ('bad0c8a0-be5f-4273-bb60-ca3030be0e44'::uuid, '74a7e124-4ad2-4c76-bd12-9c5cf1e0d724'::uuid),
    ('95d6e763-ed1f-4567-b97d-9a68207a3e50'::uuid, '74a7e124-4ad2-4c76-bd12-9c5cf1e0d724'::uuid),
    ('8dd63168-b150-4f31-9bc2-7d7103c7e9ac'::uuid, '74a7e124-4ad2-4c76-bd12-9c5cf1e0d724'::uuid),
    ('83216f96-e9cf-40c4-af41-88e70ea9b1e3'::uuid, '74a7e124-4ad2-4c76-bd12-9c5cf1e0d724'::uuid),
    ('c0dd7c0f-264d-4e5b-a4e2-e1870c93b1d0'::uuid, '74a7e124-4ad2-4c76-bd12-9c5cf1e0d724'::uuid),
    ('b1fa5786-7017-4a81-b7a8-e5ddc5d2bfee'::uuid, '74a7e124-4ad2-4c76-bd12-9c5cf1e0d724'::uuid),
    ('544e6a7e-f115-4f51-82da-407eacec2807'::uuid, '74a7e124-4ad2-4c76-bd12-9c5cf1e0d724'::uuid),
    ('ec517eae-d29b-4660-8823-8f18dc1597bc'::uuid, '74a7e124-4ad2-4c76-bd12-9c5cf1e0d724'::uuid),
    ('a18c50a3-9680-4435-8ff6-b47338ad6cec'::uuid, '74a7e124-4ad2-4c76-bd12-9c5cf1e0d724'::uuid),
    ('904c1330-10ba-45c2-871a-87f67bdb5229'::uuid, '74a7e124-4ad2-4c76-bd12-9c5cf1e0d724'::uuid),
    ('219e3a95-6424-442e-890d-151c5a096a9f'::uuid, '74a7e124-4ad2-4c76-bd12-9c5cf1e0d724'::uuid),
    ('233299f1-1a98-46cd-9e36-50f0e86ca460'::uuid, '74a7e124-4ad2-4c76-bd12-9c5cf1e0d724'::uuid),
    ('9b88ed90-5e1d-4c53-81dd-e94d83cd5eb2'::uuid, '466a5019-04ff-45c8-9c94-c4bc4d482b45'::uuid),
    ('5b929309-59d3-403d-8eea-4319b1ff87ba'::uuid, '466a5019-04ff-45c8-9c94-c4bc4d482b45'::uuid),
    ('b956624c-f60d-40f1-8505-e33229275346'::uuid, '466a5019-04ff-45c8-9c94-c4bc4d482b45'::uuid),
    ('3bccb8fd-2560-414b-8fe2-6e8c0c43c6b1'::uuid, '466a5019-04ff-45c8-9c94-c4bc4d482b45'::uuid),
    ('a152a40a-fa53-4b87-9d05-176348d5cdb7'::uuid, '466a5019-04ff-45c8-9c94-c4bc4d482b45'::uuid)
),
safe_matches as (
  select
    c.submission_id,
    c.canonical_profile_id,
    s.patient_profile_id as previous_patient_profile_id,
    s.email as submission_email,
    p.email as profile_email
  from candidates c
  join public.patient_submissions s on s.id = c.submission_id
  join public.profiles p on p.id = c.canonical_profile_id
  where s.patient_profile_id is null
    and lower(trim(coalesce(s.email, ''))) = lower(trim(coalesce(p.email, '')))
    and lower(coalesce(p.role, '')) in ('customer', 'patient', 'client')
)
insert into public.customer_profile_cleanup_audit (
  cleanup_batch,
  submission_id,
  previous_patient_profile_id,
  canonical_profile_id,
  submission_email,
  profile_email,
  matched_by,
  safety_notes
)
select
  '20260609_safe_email_link_v1',
  submission_id,
  previous_patient_profile_id,
  canonical_profile_id,
  submission_email,
  profile_email,
  'normalized_email',
  'Read-only audit marked this submission safely linkable: single customer profile match by normalized email.'
from safe_matches
on conflict (cleanup_batch, submission_id) do nothing;

with audited as (
  select submission_id, canonical_profile_id
  from public.customer_profile_cleanup_audit
  where cleanup_batch = '20260609_safe_email_link_v1'
)
update public.patient_submissions s
set
  patient_profile_id = a.canonical_profile_id,
  updated_at = now()
from audited a
join public.profiles p on p.id = a.canonical_profile_id
where s.id = a.submission_id
  and s.patient_profile_id is null
  and lower(trim(coalesce(s.email, ''))) = lower(trim(coalesce(p.email, '')))
  and lower(coalesce(p.role, '')) in ('customer', 'patient', 'client');
