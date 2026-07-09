delete from public.rep_store_intake_submissions
where email like 'codex-aactivated-test-%@example.com'
  and internal_notes like 'CODEX_TEST_AACTIVATED_REP_INTAKE%';
