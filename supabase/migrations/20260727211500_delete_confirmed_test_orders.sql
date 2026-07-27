-- Permanently remove the eight non-production orders explicitly confirmed by
-- the platform owner on 2026-07-27. This is intentionally ID-scoped.

do $$
declare
  target_ids constant uuid[] := array[
    'bc3fc0d3-7b70-43e4-ab48-6770a0ad13e4'::uuid,
    '668dee94-4332-46de-b011-31714e82ee9b'::uuid,
    '6bba818e-9bd8-4d45-97db-6ad0d9b66879'::uuid,
    'e8c5969c-02af-496e-bb57-58c009156379'::uuid,
    '87055013-0075-4d47-b837-1a3ae8f916e2'::uuid,
    '534d98e3-6d5d-4d25-92e4-bb4f6e06d9f3'::uuid,
    '5c29423c-650e-4efb-803e-921ba3aae5a8'::uuid,
    '0e3af826-8bb4-4581-9489-a0394e2c1be8'::uuid
  ];
  existing_count integer;
  deleted_count integer;
begin
  select count(*)
  into existing_count
  from public.patient_submissions
  where id = any(target_ids);

  if existing_count <> cardinality(target_ids) then
    raise exception
      'Expected all % confirmed test orders before deletion; found %',
      cardinality(target_ids),
      existing_count;
  end if;

  -- These two historical tables intentionally restrict/no-action parent
  -- deletion, so their rows must be removed before the submissions.
  delete from public.customer_profile_cleanup_audit
  where submission_id = any(target_ids);

  delete from public.audit_logs
  where submission_id = any(target_ids);

  -- Remaining submission dependencies are configured to cascade or set null.
  delete from public.patient_submissions
  where id = any(target_ids);

  get diagnostics deleted_count = row_count;
  if deleted_count <> cardinality(target_ids) then
    raise exception
      'Expected to delete % confirmed test orders; deleted %',
      cardinality(target_ids),
      deleted_count;
  end if;
end
$$;
