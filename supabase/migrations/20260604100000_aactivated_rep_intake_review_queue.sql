alter table public.rep_store_intake_submissions
  add column if not exists source_portal_id text,
  add column if not exists source_portal text,
  add column if not exists source_route text,
  add column if not exists review_queue text,
  add column if not exists review_admin_code text,
  add column if not exists review_admin_name text;

create index if not exists rep_store_intake_source_portal_id_idx
  on public.rep_store_intake_submissions(source_portal_id);

create index if not exists rep_store_intake_review_queue_idx
  on public.rep_store_intake_submissions(review_queue);

create index if not exists rep_store_intake_review_admin_code_idx
  on public.rep_store_intake_submissions(review_admin_code);

update public.rep_store_intake_submissions
set
  source_portal_id = coalesce(source_portal_id, 'aactivated'),
  source_portal = coalesce(source_portal, 'AACTIVATED-RX'),
  source_route = coalesce(source_route, '/AACTIVATED/rep-intake'),
  review_queue = coalesce(review_queue, 'aactivated'),
  review_admin_code = coalesce(review_admin_code, 'GUY60'),
  review_admin_name = coalesce(review_admin_name, 'AACTIVATED-RX / Guy')
where upper(
  coalesce(internal_notes, '') || ' ' ||
  coalesce(parent_rep_or_admin_name, '') || ' ' ||
  coalesce(store_brand_name, '') || ' ' ||
  coalesce(store_type, '')
) like '%AACTIVATED%';

drop policy if exists "admin_manage_rep_store_intake" on public.rep_store_intake_submissions;
create policy "admin_manage_rep_store_intake"
on public.rep_store_intake_submissions
for all
to authenticated
using (
  public.my_role() = 'admin'
  or (
    public.my_role() = 'rx_plus_admin'
    and exists (
      select 1
      from public.reps r
      where r.profile_id = public.current_profile_id()
        and upper(r.rep_slug) = upper(public.rep_store_intake_submissions.review_admin_code)
    )
  )
)
with check (
  public.my_role() = 'admin'
  or (
    public.my_role() = 'rx_plus_admin'
    and exists (
      select 1
      from public.reps r
      where r.profile_id = public.current_profile_id()
        and upper(r.rep_slug) = upper(public.rep_store_intake_submissions.review_admin_code)
    )
  )
);
