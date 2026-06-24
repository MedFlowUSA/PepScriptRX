-- Keep Aurora Labs and its downline/sub-agent records active.

alter table public.reps
  add column if not exists active boolean not null default true,
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  update public.reps
  set
    active = true,
    updated_at = now()
  where rep_slug = 'AURORA'
     or rep_identifier = 'MIKEAURORA'
     or lower(coalesce(custom_store_slug, '')) = 'aurora'
     or parent_type = 'aurora_downline'
     or rep_channel = 'aurora_downline_rep'
     or parent_rep_id in (
      select id
      from public.reps
      where rep_slug = 'AURORA'
         or rep_identifier = 'MIKEAURORA'
    );

  if to_regclass('public.distributors') is not null then
    update public.distributors
    set
      is_active = true,
      white_label_enabled = true,
      updated_at = now()
    where slug = 'aurora'
       or portal_name = 'Aurora Labs';
  end if;

  if to_regclass('public.checkout_scopes') is not null then
    update public.checkout_scopes
    set
      is_active = true,
      updated_at = now()
    where scope_code = 'AURORA'
       or account_id = 'AURORA'
       or parent_account_id = 'AURORA'
       or scope_code in (
        select rep_slug
        from public.reps
        where lower(coalesce(custom_store_slug, '')) = 'aurora'
           or parent_type = 'aurora_downline'
           or rep_channel = 'aurora_downline_rep'
           or parent_rep_id in (
            select id
            from public.reps
            where rep_slug = 'AURORA'
               or rep_identifier = 'MIKEAURORA'
          )
      );
  end if;

  if to_regclass('public.partner_rep_commission_settings') is not null then
    update public.partner_rep_commission_settings
    set
      approval_required = false,
      approval_status = 'active',
      updated_at = now()
    where store_scope = 'AURORA'
       or rep_id in (
        select id
        from public.reps
        where lower(coalesce(custom_store_slug, '')) = 'aurora'
           or parent_type = 'aurora_downline'
           or rep_channel = 'aurora_downline_rep'
      );
  end if;

  if to_regclass('public.partner_rep_store_settings') is not null then
    update public.partner_rep_store_settings
    set
      status = 'active',
      activated_at = coalesce(activated_at, now()),
      disabled_at = null,
      updated_at = now()
    where store_scope = 'AURORA'
       or rep_id in (
        select id
        from public.reps
        where lower(coalesce(custom_store_slug, '')) = 'aurora'
           or parent_type = 'aurora_downline'
           or rep_channel = 'aurora_downline_rep'
      );
  end if;

  if to_regclass('public.partner_product_lists') is not null then
    update public.partner_product_lists
    set
      status = 'active',
      updated_at = now()
    where store_scope = 'AURORA';
  end if;
end $$;
