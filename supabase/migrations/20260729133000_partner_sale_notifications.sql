create table if not exists public.partner_sale_notifications (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.patient_submissions(id) on delete cascade,
  partner_brand_id text,
  partner_store_slug text,
  partner_scope_code text,
  recipient_email text not null,
  status text not null default 'pending' check (status in ('pending', 'sent', 'skipped', 'failed')),
  payment_provider text,
  email_provider_id text,
  error_message text,
  payload jsonb not null default '{}'::jsonb,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (submission_id, recipient_email)
);

alter table public.partner_sale_notifications enable row level security;

grant select on public.partner_sale_notifications to authenticated;
grant insert, update on public.partner_sale_notifications to service_role;

drop policy if exists "platform admins read partner sale notifications" on public.partner_sale_notifications;
create policy "platform admins read partner sale notifications"
on public.partner_sale_notifications
for select
to authenticated
using (
  public.is_admin()
  or public.is_current_profile_platform_admin()
  or exists (
    select 1
    from public.partner_brands b
    join public.profiles p
      on (p.id = auth.uid() or p.auth_user_id = auth.uid())
    where lower(coalesce(b.owner_email, '')) = lower(coalesce(p.email, p.owner_email, ''))
      and (
        b.brand_id = partner_sale_notifications.partner_brand_id
        or lower(b.store_slug) = lower(coalesce(partner_sale_notifications.partner_store_slug, ''))
        or upper(b.scope_code) = upper(coalesce(partner_sale_notifications.partner_scope_code, ''))
      )
  )
);
