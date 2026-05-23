-- SECURITY DEFINER function so authenticated patients can count their own referrals
-- without being able to read other patients' submissions.
create or replace function public.count_my_referrals(referral_code_input text)
returns integer
language sql
security definer
set search_path = public
stable
as $$
  select count(*)::integer
  from public.patient_submissions
  where upper(referral_code) = upper(referral_code_input)
    and (patient_profile_id is null or patient_profile_id != auth.uid());
$$;

grant execute on function public.count_my_referrals(text) to authenticated;
