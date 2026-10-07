-- Private referral contracts. No invitations, emails, or payouts are sent by this migration.
create table public.referral_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique,
  created_at timestamptz not null default now()
);

create table public.referral_agreements (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.referral_accounts(id),
  version integer not null,
  revision integer not null default 0,
  status text not null default 'draft' check(status in ('draft','issued','partner_signed','signed','void')),
  company_name text not null default '',
  payout_schedule text not null default '',
  termination_terms text not null default '',
  contact_email text not null default '',
  terms text not null default '',
  terms_hash text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  partner_signature text,
  partner_consent text,
  partner_user_id uuid,
  partner_signed_at timestamptz,
  company_signature text,
  company_consent text,
  company_user_id uuid,
  company_signed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(account_id,version)
);
create table public.referral_signing_links (
  agreement_id uuid primary key references public.referral_agreements(id),
  token_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz
);
create table public.referral_customers (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.referral_accounts(id),
  email text not null unique check(email=lower(trim(email)) and position('@' in email)>1),
  introduced_at timestamptz not null,
  evidence text not null check(length(trim(evidence))>=5),
  created_by uuid not null,
  created_at timestamptz not null default now()
);
-- Cumulative, gross-basis facts, never additive webhook deltas. Repeating a
-- reconciliation cannot deduct a refund twice. cash_loss excludes refunded tax
-- and must be the UNION of refund/chargeback principal, net of recoveries.
create table public.referral_order_financials (
  order_id uuid primary key references public.patient_submissions(id),
  customer_id uuid not null references public.referral_customers(id),
  agreement_id uuid not null references public.referral_agreements(id),
  collected_gross numeric(14,2) not null check(collected_gross>=0),
  sales_tax numeric(14,2) not null check(sales_tax>=0 and sales_tax<=collected_gross),
  product_cost numeric(14,2) not null check(product_cost>=0),
  processing_fees numeric(14,2) not null check(processing_fees>=0),
  company_shipping numeric(14,2) not null check(company_shipping>=0),
  cash_loss numeric(14,2) not null check(cash_loss>=0 and cash_loss<=collected_gross-sales_tax),
  net_profit numeric(14,2) generated always as (collected_gross-sales_tax-product_cost-processing_fees-company_shipping-cash_loss) stored,
  commission numeric(14,2) generated always as (round((collected_gross-sales_tax-product_cost-processing_fees-company_shipping-cash_loss)*0.5,2)) stored,
  revision integer not null default 1,
  evidence text not null,
  source_order_hash text not null,
  reviewed_by uuid not null,
  reviewed_at timestamptz not null default now()
);
create table public.referral_payouts (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references public.referral_accounts(id),
  amount numeric(14,2) not null check(amount>0),
  reference text not null unique check(length(trim(reference))>=3),
  paid_at timestamptz not null,
  recorded_by uuid not null,
  created_at timestamptz not null default now()
);
create table public.referral_audit (
  id bigint generated always as identity primary key,
  account_id uuid not null references public.referral_accounts(id),
  agreement_id uuid references public.referral_agreements(id),
  actor_id uuid,
  action text not null,
  detail jsonb not null,
  created_at timestamptz not null default now()
);

create function public.referral_contract_text(a public.referral_agreements) returns text
language sql stable set search_path=public as $$
 select format($terms$PRIVATE REFERRAL AND COMMISSION AGREEMENT - Version %s

Parties: %s, the legal entity operating PepScriptRX (Company), and %s, %s (Referrer).

1. Referral entitlement. Referrer earns 50%% of net profit on every order, including repeat orders, from customers he introduces. The Company records each introduced customer and the introduction date with supporting evidence. Orders on or after that date remain attributed to Referrer even if the customer returns directly or uses a different storefront. Existing introduced customers may be recorded with their actual introduction date. The agreement becomes effective when both parties have signed.

2. Calculation. Net profit equals collected revenue, excluding sales tax, less actual product cost, payment processing fees, shipping paid by the Company, and refunds or chargebacks excluding tax. Collected revenue is measured before refunds and chargebacks, which are deducted separately exactly once. A refund and chargeback for the same loss are a single deduction. Recoveries and corrected costs reverse the corresponding deduction. No other overhead or expense is deductible. Each order's commission is 50%% of net profit, rounded to the nearest cent in USD. Negative order commissions reduce the outstanding commission balance; no duplicate deduction is permitted. An overpayment is carried against future commissions, not automatically debited from Referrer's bank account.

3. Records and payouts. The Company maintains revenue, deductions, corrections, earned commissions and payout history. Unverified amounts remain pending review rather than being treated as zero costs. Payout schedule: %s

4. Termination and continuing commissions. %s

5. Electronic records and signatures. Electronic signing is optional and consent applies only to this agreement. A browser, email access, and a PDF reader or browser with PDF support are needed to access and retain it. Download or print a copy for your records. Before signing, either party may decline electronic signing and request a paper process from %s. Use that contact to request a free paper copy, update contact details, or withdraw consent to future electronic delivery. Withdrawal does not undo a signature already given. By checking the consent box and typing a name, each signer intends to sign this exact version electronically. The Company signer also confirms authority to bind the named legal entity.

6. Version control. The issued text is fixed. Both signatures, server timestamps, the text SHA-256 digest, and an audit record are retained. Changes require a new agreement signed by both parties; they do not alter this version. This private agreement is separate from all customer purchasing agreements.
$terms$,a.version,coalesce(nullif(a.company_name,''),'[COMPANY LEGAL NAME - ADMIN CONFIRMATION REQUIRED]'),(select name from public.referral_accounts where id=a.account_id),(select email from public.referral_accounts where id=a.account_id),coalesce(nullif(a.payout_schedule,''),'[PAYOUT SCHEDULE - ADMIN CONFIRMATION REQUIRED]'),coalesce(nullif(a.termination_terms,''),'[TERMINATION AND CONTINUING COMMISSIONS - ADMIN CONFIRMATION REQUIRED]'),coalesce(nullif(a.contact_email,''),'[COMPANY CONTACT EMAIL REQUIRED]'))
$$;

create function public.referral_lock_record() returns trigger language plpgsql set search_path=public as $$
begin
 if tg_table_name='referral_agreements' and tg_op='UPDATE' then
   if old.status='signed' then raise exception 'Signed agreement is immutable'; end if;
   if old.partner_signed_at is not null and (new.partner_signature,new.partner_consent,new.partner_user_id,new.partner_signed_at)
      is distinct from (old.partner_signature,old.partner_consent,old.partner_user_id,old.partner_signed_at)
   then raise exception 'Partner signature is immutable'; end if;
   if old.status<>'draft' and (new.terms,new.company_name,new.payout_schedule,new.termination_terms,new.contact_email,new.account_id,new.version,new.terms_hash)
      is distinct from (old.terms,old.company_name,old.payout_schedule,old.termination_terms,old.contact_email,old.account_id,old.version,old.terms_hash)
   then raise exception 'Issued agreement text is immutable'; end if;
   return new;
 end if;
 raise exception 'Record is immutable';
end $$;
create trigger referral_agreement_lock before update or delete on public.referral_agreements for each row execute function public.referral_lock_record();
create trigger referral_audit_lock before update or delete on public.referral_audit for each row execute function public.referral_lock_record();
create trigger referral_payout_lock before update or delete on public.referral_payouts for each row execute function public.referral_lock_record();
create trigger referral_customer_lock before update or delete on public.referral_customers for each row execute function public.referral_lock_record();

do $$ declare t text; begin
 foreach t in array array['referral_accounts','referral_agreements','referral_signing_links','referral_customers','referral_order_financials','referral_payouts','referral_audit'] loop
   execute format('alter table public.%I enable row level security',t);
   execute format('revoke all on public.%I from anon, authenticated',t);
   if t<>'referral_signing_links' then
     execute format('grant select on public.%I to authenticated',t);
     execute format('create policy platform_read on public.%I for select to authenticated using (public.is_platform_admin())',t);
   end if;
 end loop;
end $$;

-- Security-invoker view also obeys patient_submissions RLS. No financial rows
-- are silently created with guessed costs. New and repeat orders enter review.
create view public.referral_order_review with (security_invoker=true) as
select s.id order_id, s.created_at, s.email, s.status order_status, c.id customer_id,c.account_id,
 f.agreement_id,f.collected_gross,f.sales_tax,f.product_cost,f.processing_fees,f.company_shipping,f.cash_loss,
 f.net_profit,f.commission,coalesce(f.revision,0) revision,f.evidence,f.reviewed_at,
 (f.order_id is null or f.source_order_hash<>encode(sha256(convert_to(to_jsonb(s)::text,'UTF8')),'hex')) needs_review
from public.patient_submissions s join public.referral_customers c
 on lower(trim(s.email))=c.email and s.created_at>=c.introduced_at
left join public.referral_order_financials f on f.order_id=s.id;
grant select on public.referral_order_review to authenticated;

create function public.referral_admin(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path=public as $$
declare a public.referral_agreements; acct uuid; token text; result jsonb; old_f public.referral_order_financials;
 f public.referral_order_financials; c public.referral_customers; order_row public.patient_submissions;
begin
 if auth.uid() is null or not public.is_platform_admin() then raise exception 'Platform administrator required'; end if;
 select id into strict acct from public.referral_accounts;
 -- Serialize account mutations, including concurrent payout and reconciliation.
 perform 1 from public.referral_accounts where id=acct for update;
 if p_action='new_draft' then
   if exists(select 1 from public.referral_agreements where account_id=acct and status in ('draft','issued','partner_signed')) then
     raise exception 'Complete or void the current unsigned draft first';
   end if;
   insert into public.referral_agreements(account_id,version)
   select acct,coalesce(max(version),0)+1 from public.referral_agreements where account_id=acct returning * into a;
   update public.referral_agreements set terms=public.referral_contract_text(a) where id=a.id returning * into a;
   result:=to_jsonb(a);
 elsif p_action in ('save','issue','rotate_link','void','countersign') then
   select * into strict a from public.referral_agreements where id=(p_data->>'id')::uuid and account_id=acct for update;
   if a.revision<>(p_data->>'revision')::integer or p_data->>'revision' is null then raise exception 'Version changed; reload before proceeding'; end if;
   if p_action='save' then
     if a.status<>'draft' then raise exception 'Only drafts can be edited'; end if;
     a.company_name:=trim(coalesce(p_data->>'company_name',''));
     a.payout_schedule:=trim(coalesce(p_data->>'payout_schedule',''));
     a.termination_terms:=trim(coalesce(p_data->>'termination_terms',''));
     a.contact_email:=trim(coalesce(p_data->>'contact_email',''));
     if length(a.company_name)>200 or length(a.payout_schedule)>4000 or length(a.termination_terms)>4000 then raise exception 'Terms too long'; end if;
     update public.referral_agreements set company_name=a.company_name,payout_schedule=a.payout_schedule,
       termination_terms=a.termination_terms,contact_email=a.contact_email,terms=public.referral_contract_text(a),revision=revision+1
       where id=a.id returning * into a;
   elsif p_action in ('issue','rotate_link') then
     if (p_action='issue' and a.status<>'draft') or (p_action='rotate_link' and a.status<>'issued') then raise exception 'Agreement cannot be issued in this state'; end if;
     if p_data->>'confirmed' is distinct from 'true' or length(a.company_name)<2 or length(a.payout_schedule)<5
       or length(a.termination_terms)<10 or a.contact_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
       or (a.company_name||a.payout_schedule||a.termination_terms) ~* '\[|\]|TBD|TODO|CONFIRMATION REQUIRED'
       then raise exception 'Confirm the legal entity, payout schedule, continuation after termination, and contact email'; end if;
     if p_action='issue' then
       update public.referral_agreements set status='issued',reviewed_by=auth.uid(),reviewed_at=now(),
       terms_hash=encode(sha256(convert_to(terms,'UTF8')),'hex'),revision=revision+1 where id=a.id returning * into a;
     else
       update public.referral_agreements set revision=revision+1 where id=a.id returning * into a;
     end if;
     token:=replace(gen_random_uuid()::text||gen_random_uuid()::text,'-','');
     insert into public.referral_signing_links(agreement_id,token_hash,expires_at)
       values(a.id,encode(sha256(convert_to(token,'UTF8')),'hex'),now()+interval '7 days')
       on conflict(agreement_id) do update set token_hash=excluded.token_hash,expires_at=excluded.expires_at,consumed_at=null;
   elsif p_action='void' then
     if a.status not in ('draft','issued') then raise exception 'A signature already exists; preserve this version'; end if;
     update public.referral_agreements set status='void',revision=revision+1 where id=a.id returning * into a;
     delete from public.referral_signing_links where agreement_id=a.id;
   else
     if a.status<>'partner_signed' or p_data->>'consent' is distinct from 'true' or length(trim(coalesce(p_data->>'signature','')))<3
       or length(p_data->>'signature')>200 or (p_data->>'signature') ~ '[^ -~]'
       or auth.uid()=a.partner_user_id then raise exception 'Partner signature, separate authorized company signer, and consent required'; end if;
     update public.referral_agreements set status='signed',company_signature=trim(p_data->>'signature'),company_user_id=auth.uid(),
       company_consent='I have read this version, can access and retain it, consent to electronic records and signatures, and intend my typed name to be my signature. I am authorized to bind the Company.',
       company_signed_at=now(),revision=revision+1 where id=a.id returning * into a;
   end if;
   result:=to_jsonb(a);
 elsif p_action='attribute' then
   if (p_data->>'introduced_at')::timestamptz>now() then raise exception 'Introduction date cannot be in the future'; end if;
   insert into public.referral_customers(account_id,email,introduced_at,evidence,created_by)
   values(acct,lower(trim(p_data->>'email')),(p_data->>'introduced_at')::timestamptz,trim(p_data->>'evidence'),auth.uid()) returning * into c;
   result:=to_jsonb(c);
 elsif p_action='reconcile' then
   select * into strict order_row from public.patient_submissions where id=(p_data->>'order_id')::uuid;
   select * into strict c from public.referral_customers where account_id=acct and email=lower(trim(order_row.email)) and introduced_at<=order_row.created_at;
   select * into strict a from public.referral_agreements where id=(p_data->>'agreement_id')::uuid and account_id=acct and status='signed';
   if length(trim(coalesce(p_data->>'evidence','')))<5 or p_data->>'confirmed' is distinct from 'true' then raise exception 'Reviewed gross-basis accounting and supporting evidence required'; end if;
   select * into old_f from public.referral_order_financials where order_id=order_row.id;
   if coalesce(old_f.revision,0) is distinct from (p_data->>'revision')::integer then raise exception 'Financials changed; reload'; end if;
   if old_f.agreement_id is not null and old_f.agreement_id<>a.id then raise exception 'An order cannot change its signed agreement'; end if;
   insert into public.referral_order_financials(order_id,customer_id,agreement_id,collected_gross,sales_tax,product_cost,processing_fees,company_shipping,cash_loss,evidence,reviewed_by,source_order_hash)
   values(order_row.id,c.id,a.id,(p_data->>'collected_gross')::numeric,(p_data->>'sales_tax')::numeric,(p_data->>'product_cost')::numeric,
     (p_data->>'processing_fees')::numeric,(p_data->>'company_shipping')::numeric,(p_data->>'cash_loss')::numeric,p_data->>'evidence',auth.uid(),encode(sha256(convert_to(to_jsonb(order_row)::text,'UTF8')),'hex'))
   on conflict(order_id) do update set collected_gross=excluded.collected_gross,sales_tax=excluded.sales_tax,product_cost=excluded.product_cost,
     processing_fees=excluded.processing_fees,company_shipping=excluded.company_shipping,cash_loss=excluded.cash_loss,evidence=excluded.evidence,
     reviewed_by=auth.uid(),reviewed_at=now(),source_order_hash=excluded.source_order_hash,revision=referral_order_financials.revision+1 returning * into f;
   result:=jsonb_build_object('before',to_jsonb(old_f),'after',to_jsonb(f),'commission_adjustment',f.commission-coalesce(old_f.commission,0));
 elsif p_action='record_payout' then
   if exists(select 1 from public.referral_order_review where account_id=acct and revision>0 and needs_review) then raise exception 'An order changed after reconciliation; review it before recording payout'; end if;
   if (p_data->>'paid_at')::timestamptz>now() then raise exception 'Record completed payouts only'; end if;
   if (p_data->>'amount')::numeric>(select coalesce(sum(financial.commission),0) from public.referral_order_financials financial join public.referral_customers customer on customer.id=financial.customer_id where customer.account_id=acct)
      -(select coalesce(sum(amount),0) from public.referral_payouts where account_id=acct) then raise exception 'Payout exceeds unpaid commissions'; end if;
   insert into public.referral_payouts(account_id,amount,reference,paid_at,recorded_by)
   values(acct,(p_data->>'amount')::numeric,trim(p_data->>'reference'),(p_data->>'paid_at')::timestamptz,auth.uid()) returning to_jsonb(referral_payouts.*) into result;
 else raise exception 'Unknown action'; end if;
 insert into public.referral_audit(account_id,agreement_id,actor_id,action,detail) values(acct,a.id,auth.uid(),p_action,result);
 -- Never persist the raw invitation secret in the audit trail.
 if token is not null then result:=result||jsonb_build_object('token',token); end if;
 return result;
end $$;

create function public.referral_signer(p_id uuid,p_token text default '',p_signature text default null,p_consent boolean default false,p_terms_hash text default null) returns jsonb
language plpgsql security definer set search_path=public as $$
declare a public.referral_agreements; acct public.referral_accounts; link public.referral_signing_links; verified boolean;
begin
 select * into a from public.referral_agreements where id=p_id for update;
 select * into acct from public.referral_accounts where id=a.account_id;
 -- Email must come from the authenticated Auth record, never a submitted address.
 select exists(select 1 from auth.users u where u.id=auth.uid() and lower(u.email)=acct.email and u.email_confirmed_at is not null) into verified;
 if not verified or a.id is null then raise exception 'Agreement unavailable'; end if;
 if a.status in ('partner_signed','signed') and a.partner_user_id=auth.uid() and p_signature is null then
   return to_jsonb(a);
 end if;
 select * into link from public.referral_signing_links where agreement_id=a.id;
 if a.status<>'issued' or link.token_hash is null or link.token_hash<>encode(sha256(convert_to(coalesce(p_token,''),'UTF8')),'hex')
   or link.expires_at<=now() or link.consumed_at is not null then raise exception 'Agreement unavailable or link expired'; end if;
 -- Require a fresh email OTP, not merely an old confirmed-email password session.
 if not exists(select 1 from jsonb_array_elements(coalesce(auth.jwt()->'amr','[]'::jsonb)) x
   where x->>'method'='otp' and (x->>'timestamp')::numeric>=extract(epoch from now()-interval '15 minutes'))
   then raise exception 'Verify your email with a fresh code before opening or signing'; end if;
 if p_signature is not null then
   if not p_consent or trim(p_signature)<>acct.name or p_terms_hash is distinct from a.terms_hash then raise exception 'Consent, full legal name, and current agreement text required'; end if;
   update public.referral_agreements set status='partner_signed',partner_signature=trim(p_signature),partner_user_id=auth.uid(),partner_signed_at=now(),revision=revision+1
     ,partner_consent='I have read this version, can access and retain it, consent to electronic records and signatures, and intend my typed name to be my signature.'
     where id=a.id returning * into a;
   update public.referral_signing_links set consumed_at=now() where agreement_id=a.id;
   insert into public.referral_audit(account_id,agreement_id,actor_id,action,detail)
     values(acct.id,a.id,auth.uid(),'partner_signed',jsonb_build_object('terms_hash',a.terms_hash,'consent',true,'signature',a.partner_signature,'verified_email',acct.email,'signed_at',a.partner_signed_at,'authentication','fresh_email_otp'));
 end if;
 return to_jsonb(a);
end $$;

revoke all on function public.referral_contract_text(public.referral_agreements),public.referral_lock_record(),public.referral_admin(text,jsonb),public.referral_signer(uuid,text,text,boolean,text) from public,anon,authenticated;
grant execute on function public.referral_admin(text,jsonb),public.referral_signer(uuid,text,text,boolean,text) to authenticated;

-- Provision the recipient and draft through the private release process.
-- Never place actual recipient details or signed contract data in public source.
