-- Complete staging workflow prerequisites for applicant corrections and starter-kit checkout.

alter table public.profiles add column if not exists phone text;

alter table public.reps
  add column if not exists profile_id uuid references public.profiles(id);

create or replace function public.is_aactivated_starter_kit_rep()
returns boolean
language sql
stable
security definer
set search_path=public
as $$
  select exists (
    select 1 from public.aactivated_onboarding_profiles o
    where o.user_id = auth.uid()
      and o.brand_id = 'aactivated'
      and o.state not in ('application_pending','application_more_info_required','application_declined','suspended')
  );
$$;

grant execute on function public.is_aactivated_starter_kit_rep() to authenticated;

create or replace function public.complete_aactivated_onboarding_starter_kit()
returns trigger language plpgsql security definer set search_path=public as $$
begin
  if new.payment_status = 'paid' and old.payment_status is distinct from 'paid' then
    update public.aactivated_onboarding_profiles o
    set starter_kit_status='complete', last_activity_at=now(), updated_at=now()
    where o.user_id in (
      select coalesce(p.auth_user_id,p.id) from public.profiles p where p.id=new.rep_profile_id
    ) and o.brand_id='aactivated';
  end if;
  return new;
end $$;

drop trigger if exists complete_aactivated_onboarding_starter_kit_trigger on public.aactivated_starter_kit_orders;
create trigger complete_aactivated_onboarding_starter_kit_trigger
after update of payment_status on public.aactivated_starter_kit_orders
for each row execute function public.complete_aactivated_onboarding_starter_kit();

create or replace function public.activate_aactivated_onboarding(p_onboarding_id uuid)
returns public.aactivated_onboarding_profiles
language plpgsql security definer set search_path=public as $$
declare v_row public.aactivated_onboarding_profiles;
begin
  if not public.is_aactivated_onboarding_admin() then raise exception 'Administrator authorization required'; end if;
  v_row := public.evaluate_aactivated_onboarding(p_onboarding_id);
  if v_row.state <> 'ready_for_activation' then raise exception 'Required onboarding steps are incomplete'; end if;
  update public.aactivated_onboarding_profiles
  set state='active', commissions_enabled=true, referral_enabled=true, activated_at=now(), updated_at=now()
  where id=p_onboarding_id returning * into v_row;
  insert into public.aactivated_onboarding_audit(onboarding_id,actor_id,action)
  values(p_onboarding_id,auth.uid(),'onboarding_activated');
  return v_row;
end $$;

grant execute on function public.activate_aactivated_onboarding(uuid) to authenticated;
