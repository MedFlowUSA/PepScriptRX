-- Fix ambiguous scope_code reference in checkout scope application RPC.

create or replace function public.apply_checkout_scope(
  p_submission_id uuid,
  p_scope_code text,
  p_attribution_source text default 'url'
)
returns table (
  valid boolean,
  scope_code text,
  display_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized text := public.normalize_checkout_scope_code(p_scope_code);
  source_value text := case
    when p_attribution_source in ('url', 'session', 'manual_checkout', 'admin_link', 'default') then p_attribution_source
    else 'url'
  end;
  scope_row public.checkout_scopes%rowtype;
begin
  if normalized is null then
    return query select false, null::text, null::text;
    return;
  end if;

  select s.*
  into scope_row
  from public.checkout_scopes s
  where s.scope_code = normalized
    and s.is_active = true
  limit 1;

  if scope_row.id is null then
    return query select false, null::text, null::text;
    return;
  end if;

  update public.patient_submissions ps
  set
    checkout_scope_code = scope_row.scope_code,
    checkout_scope_id = scope_row.id,
    attribution_source = source_value,
    source_portal = coalesce(nullif(ps.source_portal, ''), scope_row.scope_code),
    source_store = coalesce(ps.source_store, scope_row.account_id),
    source_admin = case when scope_row.account_type = 'admin' then scope_row.account_id else ps.source_admin end,
    source_rep = case when scope_row.account_type in ('rep', 'sub_account') then scope_row.account_id else ps.source_rep end,
    updated_at = now()
  where ps.id = p_submission_id
    and ps.status = 'payment_sent';

  return query select true, scope_row.scope_code, scope_row.display_name;
end;
$$;

grant execute on function public.apply_checkout_scope(uuid, text, text) to anon, authenticated;
