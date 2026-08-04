-- Durable, claim-based retries for notification delivery. Existing rows are
-- intentionally excluded so deployment cannot replay historical notifications.

alter table public.payment_notification_outbox
  add column if not exists next_attempt_at timestamptz,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists last_http_status integer,
  add column if not exists locked_at timestamptz,
  add column if not exists lock_token uuid,
  add column if not exists terminal_at timestamptz,
  add column if not exists max_attempts integer not null default 8,
  add column if not exists retry_eligible boolean not null default false;

update public.payment_notification_outbox
set next_attempt_at = coalesce(next_attempt_at, available_at, created_at)
where next_attempt_at is null;

alter table public.payment_notification_outbox
  alter column next_attempt_at set default now(),
  alter column next_attempt_at set not null,
  alter column retry_eligible set default true;

alter table public.payment_notification_outbox
  drop constraint if exists payment_notification_outbox_status_check;
alter table public.payment_notification_outbox
  add constraint payment_notification_outbox_status_check
  check (status in ('pending','processing','sent','failed','terminal_failed'));

create index if not exists payment_notification_outbox_due_idx
  on public.payment_notification_outbox(next_attempt_at, id)
  where retry_eligible and status in ('pending','failed');

create or replace function public.claim_payment_notification_outbox(p_limit integer default 10)
returns setof public.payment_notification_outbox
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_token uuid := gen_random_uuid();
begin
  return query
  with due as (
    select id
    from public.payment_notification_outbox
    where retry_eligible
      and status in ('pending','failed')
      and attempts < max_attempts
      and next_attempt_at <= now()
      and (locked_at is null or locked_at < now() - interval '5 minutes')
    order by next_attempt_at, id
    for update skip locked
    limit greatest(1, least(coalesce(p_limit,10), 50))
  )
  update public.payment_notification_outbox o
  set status='processing', attempts=o.attempts+1, last_attempt_at=now(),
      locked_at=now(), lock_token=v_token, updated_at=now()
  from due
  where o.id=due.id
  returning o.*;
end;
$$;

create or replace function public.complete_payment_notification_outbox(
  p_id uuid,
  p_lock_token uuid,
  p_succeeded boolean,
  p_temporary_failure boolean,
  p_http_status integer default null,
  p_error_category text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_row public.payment_notification_outbox%rowtype;
  v_delay_seconds integer;
begin
  select * into v_row from public.payment_notification_outbox
  where id=p_id and status='processing' and lock_token=p_lock_token
  for update;
  if not found then return jsonb_build_object('result','claim_lost'); end if;

  if p_succeeded then
    update public.payment_notification_outbox
    set status='sent', delivered_at=now(), last_http_status=p_http_status,
        last_error_category=null, locked_at=null, lock_token=null, updated_at=now()
    where id=p_id;
    return jsonb_build_object('result','sent');
  end if;

  if p_temporary_failure and v_row.attempts < v_row.max_attempts then
    v_delay_seconds := least(21600, 30 * power(2, greatest(0,v_row.attempts-1))::integer)
      + floor(random()*16)::integer;
    update public.payment_notification_outbox
    set status='failed', next_attempt_at=now()+make_interval(secs=>v_delay_seconds),
        last_http_status=p_http_status, last_error_category=left(coalesce(p_error_category,'temporary_failure'),100),
        locked_at=null, lock_token=null, updated_at=now()
    where id=p_id;
    return jsonb_build_object('result','retry_scheduled','delay_seconds',v_delay_seconds);
  end if;

  update public.payment_notification_outbox
  set status='terminal_failed', terminal_at=now(), last_http_status=p_http_status,
      last_error_category=left(coalesce(p_error_category,
        case when v_row.attempts >= v_row.max_attempts then 'retry_limit_exhausted' else 'permanent_failure' end),100),
      locked_at=null, lock_token=null, updated_at=now()
  where id=p_id;
  return jsonb_build_object('result','terminal_failed');
end;
$$;

revoke all on function public.claim_payment_notification_outbox(integer) from public;
revoke all on function public.complete_payment_notification_outbox(uuid,uuid,boolean,boolean,integer,text) from public;
grant execute on function public.claim_payment_notification_outbox(integer) to service_role;
grant execute on function public.complete_payment_notification_outbox(uuid,uuid,boolean,boolean,integer,text) to service_role;

comment on column public.payment_notification_outbox.retry_eligible is
  'Existing rows remain false during migration, preventing deployment-time replay; newly finalized orders default true.';
