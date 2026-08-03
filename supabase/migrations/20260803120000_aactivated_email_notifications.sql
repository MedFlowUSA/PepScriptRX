alter table public.partner_notification_events
  add column if not exists sent_at timestamptz,
  add column if not exists email_provider_id text,
  add column if not exists last_error_message text;

create or replace function public.notify_aactivated_rep_intake_email_webhook()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if to_regnamespace('net') is null then
    return new;
  end if;

  if coalesce(new.parent_store_slug, new.review_queue, new.source_portal_id) = 'aactivated'
     or lower(coalesce(new.partner_admin_email, new.approval_owner_email, '')) = 'guy@aactivated.com'
     or lower(coalesce(new.source_portal, '')) like '%aactivated%' then
    begin
      perform net.http_post(
        url := 'https://ubfruugzofftwlomkqcl.supabase.co/functions/v1/notify-rep-intake',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || coalesce(current_setting('app.edge_function_jwt', true), '')
        ),
        body := jsonb_build_object('record', row_to_json(new))::text
      );
    exception when others then
      raise warning 'notify_aactivated_rep_intake_email_webhook skipped: %', sqlerrm;
    end;
  end if;

  return new;
end;
$$;

drop trigger if exists zz_notify_aactivated_rep_intake_email on public.rep_store_intake_submissions;
create trigger zz_notify_aactivated_rep_intake_email
after insert on public.rep_store_intake_submissions
for each row execute function public.notify_aactivated_rep_intake_email_webhook();
