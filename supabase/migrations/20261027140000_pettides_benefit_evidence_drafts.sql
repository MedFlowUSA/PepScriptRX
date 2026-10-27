-- New scientific/marketing copy is seeded as DRAFT under the established review
-- workflow. This does not approve claims, publish articles, or change sales settings.
begin;
insert into public.pettides_articles(slug,title,category,body,sources,review_note) values
('bpc-157-benefits-evidence','BPC-157: Potential Benefits and Evidence Limits','Peptides and Related Compounds',
$body$Research interest: connective-tissue repair. Experimental studies in rats reported improvements in healing measures after surgically induced Achilles tendon and ligament injuries. These findings concern specific rat injury models, not treatment outcomes in companion dogs or cats. [1][2]

What has been studied in dogs: a separate pharmacokinetic study measured how BPC-157 was processed in laboratory dogs and rats. It was not a clinical trial of injury treatment in pets. [3]

What this does not establish: these studies do not demonstrate pain relief, faster recovery, or a safe treatment regimen for pets, and they do not establish a benefit for the PetTides product. Findings cannot be transferred between species or formulations without appropriate evidence.

Questions for your veterinarian: what established options address the diagnosis, and is there relevant evidence in this animal species?$body$,
array['https://pubmed.ncbi.nlm.nih.gov/14554208/','https://pubmed.ncbi.nlm.nih.gov/20225319/','https://www.frontiersin.org/journals/pharmacology/articles/10.3389/fphar.2022.1026182/full'],
'DRAFT: original research sources checked during preparation. Veterinary/scientific and marketing review required before publication. No dosing or administration guidance.'),
('tb-500-benefits-evidence','TB-500: Research Interest, Identity, and Evidence Limits','Peptides and Related Compounds',
$body$Research interest: cell movement and tissue repair. A mouse study reported improved skin-wound repair with thymosin beta-4 and, in aged mice, a synthetic LKKTETQ fragment. This was not a study of the PetTides product or of clinical treatment in dogs or cats. [1]

Identity matters: a separate analytical study identified an acetylated fragment, Ac-LKKTETQ, in a preparation labeled TB-500. That finding does not verify the identity of every product bearing this name. Full-length thymosin beta-4, LKKTETQ, and Ac-LKKTETQ must not be treated as interchangeable. [2]

What this does not establish: these sources do not establish veterinary pain relief, injury recovery, safety, or effectiveness for PetTides TB-500. Product identity and formulation must be verified before deciding which evidence applies.

Questions for your veterinarian: what exactly is the substance, and what evidence addresses this formulation in the relevant species?$body$,
array['https://pubmed.ncbi.nlm.nih.gov/12581423/','https://pubmed.ncbi.nlm.nih.gov/22962027/'],
'PUBLICATION HOLD: verify PetTides compound identity and formulation against documentation; obtain veterinary/scientific and marketing review. Sources identify studied substances, not this product.'),
('wolverine-blend-benefits-evidence','Wolverine Blend: What Is Needed to Assess Benefits','Product Quality and Safety',
$body$Composition supplied by the product owner: BPC-157 (10 mg) plus TB-500 (10 mg). This is product information supplied for this draft, not a claim of independent identity or quality testing.

Research interest: connective-tissue repair. BPC-157 has been studied in experimental rat tendon injury, while separate research examined thymosin beta-4 and an LKKTETQ fragment in mouse skin-wound models. Neither study tested this blend. [1][2]

What this does not establish: ingredient-level research does not demonstrate combined benefits, synergy, faster recovery, pain relief, or safety for this 10 mg + 10 mg formulation in dogs or cats. The exact TB-500 identity also matters; full-length thymosin beta-4 and its fragments are not interchangeable. [3]

Reviewer action: confirm product specifications, match the evidence to the actual compounds and formulation, and assess the limits of any proposed claim. No veterinary treatment benefit is asserted.$body$,
array['https://pubmed.ncbi.nlm.nih.gov/14554208/','https://pubmed.ncbi.nlm.nih.gov/12581423/','https://pubmed.ncbi.nlm.nih.gov/22962027/'],
'PUBLICATION HOLD: user supplied TB-500 10 mg + BPC-157 10 mg on 2026-10-27. Confirm exact compound identities/formulation and obtain veterinary/scientific and marketing review. No combined-product efficacy evidence was verified.'),
('nad-plus-benefits-evidence','NAD+: Cellular Metabolism and Animal Aging Research','Pet Wellness Science',
$body$Research interest: cellular metabolism and cognitive aging. NAD+ is a coenzyme involved in cellular metabolism, not a peptide. Its biological role does not by itself establish a benefit from a particular product. [1]

What was observed: a randomized senior-dog trial tested an oral NAD+ precursor combined with a senolytic. The combination improved owner-assessed cognitive scores at three months; in-house cognitive testing and measured physical activity did not show between-group improvements. [1]

What this does not establish: the trial did not isolate each ingredient, test injectable NAD+, demonstrate longer lifespan, or establish a benefit for PetTides NAD+. Results in these dogs cannot establish benefits in cats.

Questions for your veterinarian: how relevant are this formulation and these outcomes to the animal, and what established care options should be considered?$body$,
array['https://pubmed.ncbi.nlm.nih.gov/38811634/'],
'DRAFT: original controlled-trial abstract checked. Veterinary/scientific and marketing review required. Do not extrapolate precursor-combination findings to injectable NAD+ or longevity claims.');
update public.pettides_concepts set description='BPC-157 (10 mg) + TB-500 (10 mg). Contact PetTides for product specifications.' where slug='wolverine-blend';
commit;
