-- Primary-source enrichment of existing drafts only; preserves reviewed content and sales settings.
begin;
do $enrich$
declare item record; current_article public.pettides_articles%rowtype;
begin
 for item in select * from (values
('bpc-157-benefits-evidence','https://pubmed.ncbi.nlm.nih.gov/21030672/',$copy$Mechanistic context: experiments with rat Achilles tendon explants and cultured rat tendon fibroblasts reported increased tendon outgrowth, cell migration, and survival under oxidative stress, associated with FAK/paxillin signaling. The study did not find a direct increase in fibroblast proliferation. These laboratory findings do not establish clinical recovery in dogs or cats. [4]$copy$),
('tb-500-benefits-evidence','https://pubmed.ncbi.nlm.nih.gov/17108969/',$copy$Related research: work on full-length thymosin beta-4 examined coronary-vessel development in mice and cell mobilization and vessel formation in adult epicardial explants. This is evidence about a particular molecule and experimental setting; it does not establish cardiac benefits for PetTides TB-500 or make its fragments interchangeable with full-length thymosin beta-4. [3]$copy$),
('wolverine-blend-benefits-evidence','https://pubmed.ncbi.nlm.nih.gov/21030672/',$copy$Ingredient-level mechanism: a separate BPC-157 study used rat tendon explants and cultured tendon cells to investigate outgrowth, migration, and survival. It did not test this combination, establish synergy, or demonstrate a clinical benefit in companion animals. [4]$copy$),
('nad-plus-benefits-evidence','https://pubmed.ncbi.nlm.nih.gov/27304511/',$copy$Mechanistic context: mouse and cell experiments linked the NAD-consuming enzyme CD38 to age-associated NAD depletion and mitochondrial dysfunction through a SIRT3-dependent mechanism. This helps explain research interest in NAD biology; it is not a trial demonstrating benefits from the PetTides product in dogs or cats. [2]$copy$)) as additions(slug,url,paragraph) loop
  select * into current_article from public.pettides_articles where slug=item.slug for update;
  if not found then raise exception 'Missing expected draft: %',item.slug; end if;
  if current_article.status <> 'draft' then raise exception 'Preserve reviewed content; manual reconciliation required: %',item.slug; end if;
  if not (item.url=any(current_article.sources)) then
   if position('What this does not establish:' in current_article.body)=0 then raise exception 'Draft changed; reconcile enrichment: %',item.slug; end if;
   update public.pettides_articles set
    body=replace(body,'What this does not establish:',item.paragraph || E'\n\n' || 'What this does not establish:'),
    sources=array_append(sources,item.url),
    review_note=coalesce(review_note,'') || E'\n2026-10-27: PSPeptides used as a research lead; added independently checked primary-source context. Vendor claims, protocols, and quality assurances do not verify PetTides. Review still required.'
   where slug=item.slug;
  end if;
 end loop;
end;
$enrich$;
commit;
