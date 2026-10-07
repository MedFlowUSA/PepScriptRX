-- Keep recipient identity in private rows, not in distributed source.
create or replace function public.referral_contract_text(a public.referral_agreements) returns text
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

create or replace function public.referral_admin(p_action text,p_data jsonb default '{}'::jsonb) returns jsonb
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
