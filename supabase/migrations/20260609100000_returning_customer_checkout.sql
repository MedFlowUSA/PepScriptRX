-- Returning customer checkout support.
-- Keeps public checkout available while letting authenticated customers attach
-- orders to their patient profile and preventing staff profiles from being
-- treated as customer accounts.

create or replace function public.get_customer_account_status(p_email text)
returns table (
  account_exists boolean,
  customer_account_exists boolean
)
language sql
security definer
set search_path = public
as $$
  with normalized as (
    select lower(trim(coalesce(p_email, ''))) as email
  ),
  matches as (
    select p.role
    from public.profiles p, normalized n
    where n.email <> ''
      and lower(p.email) = n.email
  )
  select
    exists(select 1 from matches) as account_exists,
    exists(
      select 1
      from matches
      where lower(coalesce(role, '')) in ('customer', 'patient', 'client')
    ) as customer_account_exists;
$$;

revoke all on function public.get_customer_account_status(text) from public;
grant execute on function public.get_customer_account_status(text) to anon, authenticated;

create or replace function public.attach_current_customer_to_submission(p_submission_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_profile public.profiles%rowtype;
  v_updated_count integer := 0;
begin
  if auth.uid() is null then
    return false;
  end if;

  select *
  into v_profile
  from public.profiles
  where auth_user_id = auth.uid()
     or id = auth.uid()
  order by created_at desc
  limit 1;

  if not found then
    return false;
  end if;

  if lower(coalesce(v_profile.role, '')) not in ('customer', 'patient', 'client') then
    raise exception 'Only customer accounts can attach orders through customer checkout.';
  end if;

  update public.patient_submissions
  set patient_profile_id = v_profile.id
  where id = p_submission_id
    and lower(email) = lower(coalesce(v_profile.email, ''))
    and (patient_profile_id is null or patient_profile_id = v_profile.id);

  get diagnostics v_updated_count = row_count;
  return v_updated_count > 0;
end;
$$;

revoke all on function public.attach_current_customer_to_submission(uuid) from public;
grant execute on function public.attach_current_customer_to_submission(uuid) to authenticated;
