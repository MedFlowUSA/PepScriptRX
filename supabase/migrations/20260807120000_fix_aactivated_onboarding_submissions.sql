-- Prevent PostgreSQL from parsing dynamic SQL predicates as array literals.
-- The previous text[] || text form fails whenever a predicate contains SQL
-- punctuation, blocking representatives from loading starter-kit choices.
create or replace function public.is_aactivated_starter_kit_rep()
returns boolean
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  pid uuid := public.current_profile_id();
  sql text;
  filters text[] := array[]::text[];
  text_columns text[] := array[
    'brand_id', 'parent_brand_id', 'custom_store_slug', 'assigned_store_slug',
    'brand_name', 'rep_channel', 'rep_tier', 'parent_type', 'store_scope'
  ];
  col text;
  result boolean := false;
begin
  if pid is null then return false; end if;

  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='reps' and column_name='rep_slug') then
    filters := array_append(filters, 'upper(coalesce(r.rep_slug, '''')) in (''GUY60'',''AACTIVATED'',''AACTIVATEDRX'',''VITALITYINS'',''BOSSIQUIT'')');
  end if;

  foreach col in array text_columns loop
    if exists (select 1 from information_schema.columns where table_schema='public' and table_name='reps' and column_name=col) then
      filters := array_append(filters, format('lower(coalesce(r.%I, '''')) like ''%%aactivated%%''', col));
    end if;
  end loop;

  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='reps' and column_name='managed_by_profile_id')
    and exists (select 1 from information_schema.columns where table_schema='public' and table_name='reps' and column_name='profile_id')
    and exists (select 1 from information_schema.columns where table_schema='public' and table_name='reps' and column_name='rep_slug') then
    filters := array_append(filters, 'r.managed_by_profile_id in (select profile_id from public.reps where upper(coalesce(rep_slug, '''')) = ''GUY60'')');
  end if;

  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='reps' and column_name='parent_rep_id')
    and exists (select 1 from information_schema.columns where table_schema='public' and table_name='reps' and column_name='id')
    and exists (select 1 from information_schema.columns where table_schema='public' and table_name='reps' and column_name='rep_slug') then
    filters := array_append(filters, 'r.parent_rep_id in (select id from public.reps where upper(coalesce(rep_slug, '''')) = ''GUY60'')');
  end if;

  if array_length(filters, 1) is null then return false; end if;
  sql := 'select exists (select 1 from public.reps r where r.profile_id = $1';
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='reps' and column_name='active') then
    sql := sql || ' and coalesce(r.active, true)';
  end if;
  sql := sql || ' and (' || array_to_string(filters, ' or ') || '))';
  execute sql into result using pid;
  return coalesce(result, false);
end;
$$;

grant execute on function public.is_aactivated_starter_kit_rep() to authenticated;
