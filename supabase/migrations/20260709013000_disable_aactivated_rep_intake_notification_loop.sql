-- AACTIVATED rep requests should submit directly to the review queue.
-- Do not enqueue notification/webhook-style events or create any follow-on workflow.

drop trigger if exists queue_aactivated_rep_intake_notifications_trigger
on public.rep_store_intake_submissions;

drop function if exists public.queue_aactivated_rep_intake_notifications();

drop policy if exists "public_insert_rep_store_intake" on public.rep_store_intake_submissions;
create policy "public_insert_rep_store_intake"
on public.rep_store_intake_submissions
for insert
to anon, authenticated
with check (true);
