-- Public checkout hardening follow-up:
-- The tokenized checkout RPC computes cost_of_goods server-side. Main catalog
-- products can have a true cost of 0, but patient_submissions.cost_of_goods is
-- not nullable in production, so normalize explicit null inserts before the
-- constraint is checked.

create or replace function public.normalize_patient_submission_cost_of_goods()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.cost_of_goods := coalesce(new.cost_of_goods, 0);
  return new;
end;
$$;

drop trigger if exists normalize_patient_submission_cost_of_goods_before_insert
  on public.patient_submissions;

create trigger normalize_patient_submission_cost_of_goods_before_insert
before insert or update of cost_of_goods
on public.patient_submissions
for each row
execute function public.normalize_patient_submission_cost_of_goods();

update public.patient_submissions
set cost_of_goods = 0
where cost_of_goods is null;
