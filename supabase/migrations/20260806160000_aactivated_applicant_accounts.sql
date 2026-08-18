-- Pending applicants receive an isolated authenticated status portal.
-- They are neither patients nor representatives and have no commerce access.

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in (
  'patient','customer','client','rep','representative','affiliate','rep_applicant',
  'physician','fulfillment','admin','rx_plus_admin','partner_admin_full',
  'partner_admin_limited','distributor','owner','platform_admin','master_admin','super_admin'
));

alter table public.rep_store_intake_submissions
  add column if not exists applicant_user_id uuid references auth.users(id);

create unique index if not exists aactivated_one_application_per_user_idx
  on public.rep_store_intake_submissions(applicant_user_id)
  where applicant_user_id is not null and source_portal_id = 'aactivated';

create policy "aactivated applicant reads own application"
on public.rep_store_intake_submissions for select to authenticated
using (
  applicant_user_id = auth.uid()
  and source_portal_id = 'aactivated'
);

create policy "aactivated applicant updates requested information"
on public.rep_store_intake_submissions for update to authenticated
using (
  applicant_user_id = auth.uid()
  and source_portal_id = 'aactivated'
  and approval_status = 'more_info_requested'
)
with check (
  applicant_user_id = auth.uid()
  and source_portal_id = 'aactivated'
  and approval_status in ('more_info_requested','pending')
);

create or replace function public.enforce_aactivated_applicant_isolation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role = 'rep_applicant' then
    new.brand_id = 'aactivated';
    new.store_slug = 'aactivated';
    new.admin_scope = null;
    new.global_admin = false;
    new.super_admin = false;
    new.can_view_all_brands = false;
    new.can_view_all_reps = false;
    new.can_view_all_orders = false;
    new.can_view_all_customers = false;
    new.can_edit_global_catalog = false;
    new.can_edit_global_settings = false;
    new.can_view_platform_financials = false;
    new.can_view_other_partner_financials = false;
  end if;
  return new;
end $$;

drop trigger if exists enforce_aactivated_applicant_isolation_trigger on public.profiles;
create trigger enforce_aactivated_applicant_isolation_trigger
before insert or update on public.profiles
for each row execute function public.enforce_aactivated_applicant_isolation();

comment on column public.rep_store_intake_submissions.applicant_user_id is
  'Authenticated pending applicant. This does not grant representative, referral, commission, order, or customer access.';
