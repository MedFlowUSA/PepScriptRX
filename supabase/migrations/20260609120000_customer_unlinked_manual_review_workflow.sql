-- Customer unlinked submission manual review workflow.
--
-- This migration is intentionally non-destructive. It does not attach,
-- merge, deactivate, or delete customer/profile/order records. It only adds
-- fields admins can use to classify high-risk historical checkout submissions
-- after human review while preserving payment, rep, store, promo, and
-- commission attribution.

alter table public.patient_submissions
  add column if not exists manual_review_status text,
  add column if not exists manual_review_notes text,
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists recommended_action text,
  add column if not exists manual_review_risk_level text,
  add column if not exists manual_review_source text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'patient_submissions_manual_review_status_check'
  ) then
    alter table public.patient_submissions
      add constraint patient_submissions_manual_review_status_check
      check (
        manual_review_status is null
        or manual_review_status in (
          'leave_unlinked',
          'test_record',
          'staff_internal',
          'customer_confirmed_attach_later',
          'cancelled_refunded_preserve',
          'payment_mismatch_review',
          'needs_customer_confirmation'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'patient_submissions_manual_review_risk_level_check'
  ) then
    alter table public.patient_submissions
      add constraint patient_submissions_manual_review_risk_level_check
      check (
        manual_review_risk_level is null
        or manual_review_risk_level in ('low', 'medium', 'high', 'manual')
      );
  end if;
end $$;

create index if not exists patient_submissions_manual_review_status_idx
  on public.patient_submissions(manual_review_status);

create index if not exists patient_submissions_unlinked_manual_review_idx
  on public.patient_submissions(patient_profile_id, manual_review_status)
  where patient_profile_id is null;

comment on column public.patient_submissions.manual_review_status is
  'Non-destructive manual classification for high-risk unlinked checkout submissions. Does not link or mutate customer ownership.';

comment on column public.patient_submissions.manual_review_notes is
  'Internal notes from manual customer/profile review. Preserve attribution and payment history.';

comment on column public.patient_submissions.reviewed_by is
  'Admin profile that last classified the unlinked customer/profile review state.';

comment on column public.patient_submissions.reviewed_at is
  'Timestamp when the manual review classification was last saved.';

comment on column public.patient_submissions.recommended_action is
  'Human-readable next action from manual review tooling or admin review.';

comment on column public.patient_submissions.manual_review_risk_level is
  'Risk level assigned by manual review tooling or admin review. Informational only.';

comment on column public.patient_submissions.manual_review_source is
  'Source that proposed or saved the manual review classification, such as customer-unlinked-review or admin-order-detail.';
