-- Additive preview only. No live catalog entries, prices, commissions or payment settings are changed.
begin;
create table public.pettides_concepts (
 slug text primary key check (slug in ('bpc-157','tb-500','wolverine-blend','nad-plus')),
 name text not null, description text not null, image text not null, article_slug text not null,
 provisional_price numeric(10,2) not null check (provisional_price >= 0),
 show_price boolean not null default false,
 cost numeric(10,2) check (cost >= 0),
 active boolean not null default false check (active = false),
 purchasable boolean not null default false check (purchasable = false),
 launch_checklist jsonb not null default '{"legal":false,"evidence":false,"quality":false,"labeling":false,"distribution":false}'
);
insert into public.pettides_concepts(slug,name,description,image,article_slug,provisional_price) values
 ('bpc-157','BPC-157','An investigational peptide concept. Evidence and product-specific review remain pending.','/brands/pettides/bpc-157.jpg','bpc-157-dogs',129),
 ('tb-500','TB-500','A compound concept requiring confirmation of exact identity and a separate evidence review.','/brands/pettides/tb-500.jpg','tb-500-thymosin-beta-4',139),
 ('wolverine-blend','Wolverine Blend','A blend concept. Composition and proportions have not been established.','/brands/pettides/wolverine-blend.jpg','product-quality',199),
 ('nad-plus','NAD+','A coenzyme concept, not a peptide. Product-specific evidence review remains pending.','/brands/pettides/nad-plus.jpg','nad-animal-aging',159);

alter table public.pettides_concepts enable row level security;
create policy platform_manage on public.pettides_concepts for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
revoke all on public.pettides_concepts from anon, authenticated;
grant select,insert,update,delete on public.pettides_concepts to authenticated;
-- Public prices are projected server-side; hidden planning prices and costs cannot be selected anonymously.
create function public.pettides_public_concepts() returns table(slug text,name text,description text,image text,article_slug text,public_price numeric)
language sql stable security definer set search_path=public as $$
 select slug,name,description,image,article_slug,case when show_price then provisional_price else null end from public.pettides_concepts order by case slug when 'bpc-157' then 1 when 'tb-500' then 2 when 'wolverine-blend' then 3 else 4 end;
$$;
revoke all on function public.pettides_public_concepts() from public;
grant execute on function public.pettides_public_concepts() to anon,authenticated;

create table public.pettides_articles (
 slug text primary key, title text not null, category text not null, body text not null,
 sources text[] not null default '{}', review_note text not null default '',
 status text not null default 'draft' check(status in ('draft','in_review','approved','published')),
 reviewed_by uuid, reviewed_at timestamptz,
 source_verified boolean not null default false,
 check(status not in ('approved','published') or (reviewed_by is not null and reviewed_at is not null and source_verified and cardinality(sources)>0))
);
alter table public.pettides_articles enable row level security;
create policy published_read on public.pettides_articles for select to anon,authenticated using(status='published');
create policy platform_manage on public.pettides_articles for all to authenticated using(public.is_platform_admin()) with check(public.is_platform_admin());
revoke all on public.pettides_articles from anon,authenticated;
grant select on public.pettides_articles to anon;
grant select,insert,update,delete on public.pettides_articles to authenticated;

-- Review identity is recorded only on an actual approval transition. Editing approved
-- substantive content invalidates that approval, even if the client requests publication.
create function public.pettides_article_review() returns trigger language plpgsql set search_path=public as $$
begin
 if TG_OP='UPDATE' and (new.body,new.sources,new.title,new.category) is distinct from (old.body,old.sources,old.title,old.category) then
   new.status:='draft'; new.reviewed_by:=null; new.reviewed_at:=null; new.source_verified:=false;
 elsif new.status='approved' and (TG_OP='INSERT' or old.status='in_review') then
   if not public.is_platform_admin() then raise exception 'Platform reviewer required'; end if;
   if not new.source_verified or cardinality(new.sources)=0 then raise exception 'Verify original sources before approval'; end if;
   new.reviewed_by:=auth.uid(); new.reviewed_at:=now();
 elsif new.status='published' then
   if TG_OP='INSERT' or old.status not in ('approved','published') then raise exception 'Approve before publishing'; end if;
   new.reviewed_by:=old.reviewed_by; new.reviewed_at:=old.reviewed_at;
 elsif new.status in ('draft','in_review') then
   new.reviewed_by:=null; new.reviewed_at:=null;
 elsif TG_OP='UPDATE' and new.status='approved' and old.status='approved' then
   new.reviewed_by:=old.reviewed_by; new.reviewed_at:=old.reviewed_at;
 else
   raise exception 'Submit for review before approval';
 end if;
 return new;
end $$;
create trigger pettides_article_review before insert or update on public.pettides_articles for each row execute function public.pettides_article_review();

insert into public.pettides_articles(slug,title,category,body,sources,review_note) values
 ('animal-wellness-research','Understanding Animal Wellness Research','Understanding Research',
 'Research can raise useful questions without proving that a treatment works. Laboratory experiments, studies in other species, and controlled clinical studies in dogs or cats answer different questions. Findings cannot simply be transferred between them.

Safety depends on the species, formulation, route, and intended use. Discuss health concerns and established care options with a veterinarian. This draft requires authoritative sources and scientific review before publication.',
 '{}','Needs authoritative sources and scientific review.'),
 ('bpc-157-dogs','BPC-157: What Has Been Studied in Dogs?','Peptides and Related Compounds',
 'BPC-157 is an investigational peptide. A 2022 pharmacokinetic study examined its processing in rats and dogs, including distribution work in rats. See the linked original study.

This study does not establish treatment efficacy for injured dogs or a safe veterinary treatment regimen. It does not establish injury repair, pain relief, or recovery as benefits in pets.',
 array['https://www.frontiersin.org/journals/pharmacology/articles/10.3389/fphar.2022.1026182/full'],'Original study verified during preparation; independent scientific review pending.'),
 ('tb-500-thymosin-beta-4','TB-500 and Thymosin Beta-4: Understanding the Difference','Peptides and Related Compounds',
 'TB-500 and thymosin beta-4 should not be assumed to refer to the same compound. Evidence on one substance does not automatically apply to another.

Exact identity, formulation, species, route, safety, and quality need to be established before interpreting research. No veterinary benefit is established here. Hold publication until reliable sources identify the specific substances.',
 '{}','PUBLICATION HOLD: verify reliable compound identity sources before review.'),
 ('nad-animal-aging','NAD+ and Animal Aging Research','Pet Wellness Science',
 'NAD+ is a coenzyme involved in cellular metabolism, not a peptide. The linked senior-dog trial evaluated an oral NAD+ precursor combined with a senolytic ingredient.

That combination trial did not evaluate injectable NAD+, isolate the contribution of each ingredient, or establish longer lifespan. It does not substantiate claims that injectable NAD+ improves energy or cognition, reverses aging, or extends life in pets.',
 array['https://pmc.ncbi.nlm.nih.gov/articles/PMC11137034/'],'Source verified during preparation; scientific review pending. No extrapolation to injectable NAD+.'),
 ('veterinarian-questions','Questions to Ask Your Veterinarian About Emerging Products','Questions for Your Veterinarian',
 'What is my animal’s diagnosis, and what established treatment options are available? What evidence exists in this species?

What risks and interactions should we discuss? How can product quality and regulatory status be verified? How are adverse events reported?

These are discussion questions, not a recommendation to use PetTides concepts. This draft needs authoritative sources and veterinary review.',
 '{}','Needs authoritative sources and veterinary review.'),
 ('product-quality','Why Product Quality Matters in Animal Health Research','Product Quality and Safety',
 'Identity, purity, sterility where applicable, stability, and traceability are distinct quality considerations. Formulation and intended use matter when evaluating evidence.

A certificate or marketing claim alone does not establish safety or approval for animal use. No PetTides testing, certification, or approval is asserted. This draft needs authoritative quality sources and professional review.',
 '{}','Needs authoritative quality sources and professional review.');

-- Reuse the existing contact capture infrastructure without creating a medical inquiry/order.
create policy pettides_platform_contact_read on public.portal_age_lead_captures for select to authenticated
using (portal_id='pettides' and public.is_platform_admin());
create policy pettides_contact_scope on public.portal_age_lead_captures as restrictive for select to authenticated
using (portal_id is distinct from 'pettides' or public.is_platform_admin());
create policy pettides_contact_rpc_only on public.portal_age_lead_captures as restrictive for insert to anon,authenticated
with check (portal_id is distinct from 'pettides');
create function public.pettides_join_interest(p_name text,p_email text,p_consent boolean) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not coalesce(p_consent,false) or p_email is null or length(trim(p_email))>254 or trim(p_email) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p_name)>100 then raise exception 'Valid contact and consent required'; end if;
 insert into public.portal_age_lead_captures(first_name,email,portal_id,portal_name,portal_path,path,age_confirmed)
 values(nullif(trim(p_name),''),lower(trim(p_email)),'pettides','PetTides','/pettides','/pettides#interest',false);
end $$;
revoke all on function public.pettides_join_interest(text,text,boolean) from public;
grant execute on function public.pettides_join_interest(text,text,boolean) to anon,authenticated;

-- Guard every shared order creation path, including direct/RPC/service-role writes.
-- Concept identifiers use a reserved namespace and never enter the saleable catalog.
create function public.pettides_is_order(payload jsonb) returns boolean language sql immutable as $$
 select jsonb_build_array(payload->'store_slug',payload->'store_name',payload->'brand_id',
   payload->'source_store',payload->'source_portal',payload->'source_route',payload->'checkout_scope_code',
   payload->'product_id',payload->'product_name',payload->'medication',payload->'order_items',payload->'selected_addons')::text ~* '(pettides|pet-tides)';
$$;
create function public.pettides_block_order() returns trigger language plpgsql set search_path=public as $$
begin
 if public.pettides_is_order(to_jsonb(new)) then raise exception 'PetTides is in preview. Concepts are not available for purchase.'; end if;
 return new;
end $$;
create trigger zzz_pettides_block_order before insert or update on public.patient_submissions for each row execute function public.pettides_block_order();
create function public.pettides_block_fulfillment() returns trigger language plpgsql set search_path=public as $$
begin
 if exists(select 1 from public.patient_submissions s where s.id=new.submission_id and public.pettides_is_order(to_jsonb(s))) then raise exception 'PetTides fulfillment is disabled'; end if;
 return new;
end $$;
create trigger pettides_block_fulfillment before insert or update on public.fulfillment_orders for each row execute function public.pettides_block_fulfillment();

create function public.pettides_discount_guard() returns trigger language plpgsql set search_path=public as $$
begin
 if upper(new.store_scope_code)='PETTIDES' or (TG_OP='UPDATE' and upper(old.store_scope_code)='PETTIDES') then
   if not public.is_platform_admin() then raise exception 'Platform administrator required'; end if;
   new.store_scope_code:='PETTIDES';
   new.is_active:=false;
 end if;
 return new;
end $$;
create trigger pettides_discount_guard before insert or update on public.aactivated_promo_links for each row execute function public.pettides_discount_guard();
create function public.pettides_prepare_discount() returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_platform_admin() then raise exception 'Platform administrator required'; end if;
 insert into public.aactivated_promo_links(is_active,store_scope_code,promo_title,discount_code,discount_amount,link_slug,notes)
 values(false,'PETTIDES','PetTides future discount planning','PETTIDES-PLANNING',0,'pettides-future-discount','Inactive planning record only. No public promo or checkout permitted.') on conflict(link_slug) do nothing;
end $$;
revoke all on function public.pettides_prepare_discount() from public;
grant execute on function public.pettides_prepare_discount() to authenticated;
commit;
