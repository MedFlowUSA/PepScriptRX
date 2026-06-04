alter table public.rep_store_intake_submissions
  drop constraint if exists rep_store_intake_submissions_status_check;

alter table public.rep_store_intake_submissions
  add constraint rep_store_intake_submissions_status_check
  check (status in (
    'new',
    'reviewing',
    'more_info_requested',
    'logo_needed',
    'pricing_review',
    'ready_to_build',
    'launched',
    'rejected'
  ));
