-- Explicit owner publication authorization from the user on 2026-10-28.
-- Records owner authorization separately from professional review; never invents a reviewer.
begin;
alter table public.pettides_articles add column owner_publication_authorized_at timestamptz;
do $constraint$
declare c record;
begin
 for c in select conname from pg_constraint where conrelid='public.pettides_articles'::regclass and contype='c' and pg_get_constraintdef(oid) like '%reviewed_by%' loop
 execute format('alter table public.pettides_articles drop constraint %I',c.conname);
 end loop;
end $constraint$;
alter table public.pettides_articles add constraint pettides_publication_authority check (
 status not in ('approved','published') or
 (reviewed_by is not null and reviewed_at is not null and source_verified and cardinality(sources)>0) or
 (status='published' and owner_publication_authorized_at is not null and cardinality(sources)>0)
);
create or replace function public.pettides_article_review() returns trigger language plpgsql set search_path=public as $review$
begin
 if TG_OP='UPDATE' and (new.body,new.sources,new.title,new.category) is distinct from (old.body,old.sources,old.title,old.category) then
   new.status:='draft'; new.reviewed_by:=null; new.reviewed_at:=null; new.source_verified:=false; new.owner_publication_authorized_at:=null;
   return new;
 end if;
 if current_user='postgres' and current_setting('pettides.owner_publication',true)='2026-10-28-explicit-user-request' and new.status='published' and new.slug in ('bpc-157-benefits-evidence','tb-500-benefits-evidence','wolverine-blend-benefits-evidence','nad-plus-benefits-evidence') then
   new.owner_publication_authorized_at:=now();
   return new;
 end if;
 if TG_OP='INSERT' then new.owner_publication_authorized_at:=null;
 else new.owner_publication_authorized_at:=old.owner_publication_authorized_at; end if;
 if new.status='approved' and (TG_OP='INSERT' or old.status='in_review') then
   if not public.is_platform_admin() then raise exception 'Platform reviewer required'; end if;
   if not new.source_verified or cardinality(new.sources)=0 then raise exception 'Verify original sources before approval'; end if;
   new.reviewed_by:=auth.uid(); new.reviewed_at:=now();
 elsif new.status='published' then
   if TG_OP='INSERT' or old.status not in ('approved','published') then raise exception 'Approve before publishing'; end if;
   new.reviewed_by:=old.reviewed_by; new.reviewed_at:=old.reviewed_at;
 elsif new.status in ('draft','in_review') then
   new.reviewed_by:=null; new.reviewed_at:=null; new.owner_publication_authorized_at:=null;
 elsif TG_OP='UPDATE' and new.status='approved' and old.status='approved' then
   new.reviewed_by:=old.reviewed_by; new.reviewed_at:=old.reviewed_at;
 else raise exception 'Submit for review before approval'; end if;
 return new;
end $review$;
select set_config('pettides.owner_publication','2026-10-28-explicit-user-request',true);
update public.pettides_articles set status='published',review_note=review_note || E'\nPublished at the explicit request of the owner on 2026-10-28. Owner authorization is not a veterinary or professional review.'
where slug in ('bpc-157-benefits-evidence','tb-500-benefits-evidence','wolverine-blend-benefits-evidence','nad-plus-benefits-evidence');
select set_config('pettides.owner_publication','',true);
commit;
