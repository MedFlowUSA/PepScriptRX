create or replace function public.notify_new_submission_webhook()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if to_regnamespace('net') is null then
    return new;
  end if;

  begin
    perform net.http_post(
      url := 'https://ubfruugzofftwlomkqcl.supabase.co/functions/v1/notify-new-submission',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object('record', row_to_json(new))::text
    );
  exception when others then
    raise warning 'notify_new_submission_webhook skipped: %', sqlerrm;
  end;

  return new;
end;
$$;
