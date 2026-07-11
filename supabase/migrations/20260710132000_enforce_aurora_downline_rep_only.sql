-- Aurora Labs account model:
--   Mike / Aurora is the only Aurora admin account.
--   Everyone under Aurora must remain a rep-only account.

alter table public.profiles
  add column if not exists auth_user_id uuid,
  add column if not exists admin_scope text,
  add column if not exists store_slug text,
  add column if not exists owner_email text,
  add column if not exists updated_at timestamptz not null default now();

alter table public.reps
  add column if not exists rep_channel text not null default 'company_direct',
  add column if not exists rep_tier text not null default 'standard_rep',
  add column if not exists custom_store_slug text,
  add column if not exists brand_name text,
  add column if not exists account_type text,
  add column if not exists parent_type text,
  add column if not exists parent_rep_id uuid references public.reps(id) on delete set null,
  add column if not exists managed_by_profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists updated_at timestamptz not null default now();

do $$
declare
  aurora_rep_id uuid;
  mike_profile_id uuid;
begin
  select r.id, r.profile_id
    into aurora_rep_id, mike_profile_id
  from public.reps r
  where r.rep_slug = 'AURORA'
     or r.rep_identifier = 'MIKEAURORA'
  order by case when r.rep_slug = 'AURORA' then 0 else 1 end, r.created_at desc
  limit 1;

  if aurora_rep_id is null then
    raise notice 'Aurora parent rep AURORA / MIKEAURORA was not found. Skipping Aurora downline rep-only enforcement.';
    return;
  end if;

  update public.reps r
  set
    account_type = 'rep',
    parent_type = 'aurora_downline',
    rep_channel = 'aurora_downline_rep',
    rep_tier = 'aurora_downline_rep',
    parent_rep_id = aurora_rep_id,
    managed_by_profile_id = coalesce(r.managed_by_profile_id, mike_profile_id),
    custom_store_slug = 'aurora',
    brand_name = 'Aurora Labs',
    active = true,
    updated_at = now()
  where r.id <> aurora_rep_id
    and (
      upper(coalesce(r.rep_slug, '')) in (
        'AURORAJL',
        'MEGDEL',
        'D026FIR',
        'AURORAET',
        'AURORATO',
        'AURORAGE',
        'AURORARM'
      )
      or r.parent_rep_id = aurora_rep_id
    );

  update public.profiles p
  set
    role = 'rep',
    admin_scope = 'AURORA',
    store_slug = 'aurora',
    owner_email = 'mnsgroup107@gmail.com',
    updated_at = now()
  where p.id <> coalesce(mike_profile_id, '00000000-0000-0000-0000-000000000000'::uuid)
    and lower(coalesce(p.email, '')) <> 'mnsgroup107@gmail.com'
    and (
      p.id in (
        select r.profile_id
        from public.reps r
        where r.profile_id is not null
          and r.id <> aurora_rep_id
          and (
            upper(coalesce(r.rep_slug, '')) in (
              'AURORAJL',
              'MEGDEL',
              'D026FIR',
              'AURORAET',
              'AURORATO',
              'AURORAGE',
              'AURORARM'
            )
            or r.parent_rep_id = aurora_rep_id
          )
      )
      or lower(coalesce(p.email, '')) in (
        'dustylatv@gmail.com',
        'delgado.megan@yahoo.com',
        'queentort333@yahoo.com',
        'wienathompson@gmail.com',
        'successexpresspromos@gmail.com',
        'espinoza.gabriela13@gmail.com',
        'rayslaoffice@gmail.com'
      )
    );

  update public.checkout_scopes c
  set
    account_type = 'rep',
    parent_account_id = 'AURORA',
    is_active = true,
    updated_at = now()
  where upper(coalesce(c.scope_code, '')) in (
    'AURORAJL',
    'MEGDEL',
    'D026FIR',
    'AURORAET',
    'AURORATO',
    'AURORAGE',
    'AURORARM'
  );
end $$;
