-- Keep notification Edge Functions behind Supabase JWT verification while
-- allowing pg_net triggers to call them. Configure the database setting with
-- the project's service-role JWT outside of migrations:
--   alter database postgres set app.edge_function_jwt = '<service-role-jwt>';

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
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || coalesce(current_setting('app.edge_function_jwt', true), '')
      ),
      body := jsonb_build_object('record', row_to_json(new))::text
    );
  exception when others then
    raise warning 'notify_new_submission_webhook skipped: %', sqlerrm;
  end;

  return new;
end;
$$;

create or replace function public.notify_payment_sent_webhook()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if to_regnamespace('net') is null then
    return new;
  end if;

  if new.status = 'payment_sent' and (old.status is distinct from 'payment_sent') then
    begin
      perform net.http_post(
        url := 'https://ubfruugzofftwlomkqcl.supabase.co/functions/v1/notify-payment-sent',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || coalesce(current_setting('app.edge_function_jwt', true), '')
        ),
        body := jsonb_build_object('record', row_to_json(new))::text
      );
    exception when others then
      raise warning 'notify_payment_sent_webhook skipped: %', sqlerrm;
    end;
  end if;

  return new;
end;
$$;
