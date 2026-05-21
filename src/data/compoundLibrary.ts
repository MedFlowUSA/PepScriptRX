export type CompoundCategory =
  | 'GLP / Weight Management'
  | 'Recovery & Repair'
  | 'Growth Hormone / Performance'
  | 'Longevity & Anti-Aging'
  | 'Cognitive / Mood / Sleep'
  | 'Immune / Wellness';

export interface CompoundFAQ {
  q: string;
  a: string;
}

export interface Compound {
  id: string;
  name: string;
  altName?: string;
  category: CompoundCategory;
  tagline: string;
  overview: string;
  wellnessInterests: string[];
  strengths: string[];
  pairings: string[];
  faq: CompoundFAQ[];
  hasProduct: boolean;
  productPath?: string;
}

export const CATEGORIES: CompoundCategory[] = [
  'GLP / Weight Management',
  'Recovery & Repair',
  'Growth Hormone / Performance',
  'Longevity & Anti-Aging',
  'Cognitive / Mood / Sleep',
  'Immune / Wellness',
];

export const CATEGORY_ICONS: Record<CompoundCategory, string> = {
  'GLP / Weight Management':     '⚖',
  'Recovery & Repair':            '🔧',
  'Growth Hormone / Performance': '⚡',
  'Longevity & Anti-Aging':       '∞',
  'Cognitive / Mood / Sleep':     '🧠',
  'Immune / Wellness':            '🛡',
};

export const compounds: Compound[] = [
  // ── GLP / Weight Management ──────────────────────────────────────
  {
    id: 'retatrutide',
    name: 'Retatrutide',
    category: 'GLP / Weight Management',
    tagline: 'Triple-receptor metabolic support — the next frontier in weight management research.',
    overview:
      'Retatrutide is a triple-receptor agonist commonly researched for its simultaneous activity at the GLP-1, GIP, and glucagon receptors. This multi-pathway approach has generated significant interest in metabolic wellness research circles as a next-generation option beyond dual GLP/GIP compounds. It is currently the subject of ongoing clinical evaluation.',
    wellnessInterests: ['Metabolic support', 'Appetite regulation', 'Body composition', 'Blood sugar balance'],
    strengths: ['2 mg/mL', '5 mg/mL', '10 mg/mL'],
    pairings: ['AOD-9604', 'NAD+', 'MOTS-C'],
    faq: [
      {
        q: 'How does Retatrutide differ from Tirzepatide?',
        a: 'While Tirzepatide targets two receptors (GLP-1 and GIP), Retatrutide is researched as a triple agonist that also includes the glucagon receptor, which may support additional metabolic pathways. Eligibility and suitability are determined by a licensed provider.',
      },
      {
        q: 'Is Retatrutide available through PepScriptRX?',
        a: 'Availability depends on your state, prescription status, and licensed provider review. Submit a refill request to check your eligibility.',
      },
      {
        q: 'Do I need a prescription for Retatrutide?',
        a: 'Yes. All GLP-related compounds require review and authorization from a licensed provider. PepScriptRX connects eligible customers through its licensed partner network.',
      },
    ],
    hasProduct: true,
    productPath: '/start',
  },
  {
    id: 'tirzepatide',
    name: 'Tirzepatide',
    category: 'GLP / Weight Management',
    tagline: 'Dual-pathway metabolic support — one of the most widely researched weight management peptides available.',
    overview:
      'Tirzepatide is a dual GIP and GLP-1 receptor agonist that has been extensively studied in clinical settings for its role in metabolic health and body weight regulation. It is widely discussed in wellness communities for its dual-action mechanism, which targets both incretin pathways simultaneously. Often compared favorably to single GLP-1 agents in research settings.',
    wellnessInterests: ['Metabolic health', 'Weight management', 'Appetite control', 'Blood sugar regulation'],
    strengths: ['2.5 mg/mL', '5 mg/mL', '7.5 mg/mL', '10 mg/mL', '12.5 mg/mL', '15 mg/mL'],
    pairings: ['AOD-9604', 'NAD+', 'Glutathione'],
    faq: [
      {
        q: 'Is Tirzepatide the same as Mounjaro or Zepbound?',
        a: 'Tirzepatide is the active compound in branded products like Mounjaro and Zepbound. Compounded Tirzepatide is often explored as a more accessible option when reviewed through a licensed provider.',
      },
      {
        q: 'How is Tirzepatide typically administered?',
        a: 'In clinical and wellness settings, Tirzepatide is generally administered via subcutaneous injection, typically once weekly. Your provider will outline the appropriate protocol for your situation.',
      },
    ],
    hasProduct: true,
    productPath: '/start',
  },
  {
    id: 'semaglutide',
    name: 'Semaglutide',
    category: 'GLP / Weight Management',
    tagline: 'The gold standard GLP-1 — widely studied for metabolic health and appetite regulation.',
    overview:
      'Semaglutide is a GLP-1 receptor agonist and one of the most extensively researched compounds in the metabolic wellness space. It is commonly associated with appetite reduction, improved blood sugar balance, and body composition changes in clinical research. Its once-weekly dosing profile makes it a practical option in wellness settings when reviewed by a licensed provider.',
    wellnessInterests: ['Appetite regulation', 'Weight management', 'Metabolic health', 'Cardiovascular wellness interest'],
    strengths: ['1 mg/mL', '2 mg/mL', '2.5 mg/mL', '5 mg/mL'],
    pairings: ['B-12', 'NAD+', 'AOD-9604', 'Glutathione'],
    faq: [
      {
        q: 'Is Semaglutide the same as Ozempic or Wegovy?',
        a: 'Semaglutide is the active compound in branded products like Ozempic and Wegovy. Compounded Semaglutide may be available through licensed providers as part of a refill or wellness program.',
      },
      {
        q: 'Can Semaglutide be paired with other compounds?',
        a: 'Stacking decisions should always be made with a licensed provider. Common wellness pairings discussed in research settings include B-12 and NAD+.',
      },
    ],
    hasProduct: true,
    productPath: '/start',
  },
  {
    id: 'cagrisema',
    name: 'CagriSema',
    altName: 'Cagrilintide + Semaglutide',
    category: 'GLP / Weight Management',
    tagline: 'A synergistic dual-compound blend — combining two of the most promising metabolic peptides in one formulation.',
    overview:
      'CagriSema is a combination formulation of Cagrilintide and Semaglutide, commonly discussed in metabolic research for its potential synergistic activity across both amylin and GLP-1 pathways. This dual-mechanism approach is of significant interest to researchers exploring next-generation weight management strategies beyond single-agent GLP therapy.',
    wellnessInterests: ['Metabolic support', 'Satiety regulation', 'Body composition', 'Dual-pathway research'],
    strengths: ['Various — provider-specified per protocol'],
    pairings: ['NAD+', 'Glutathione', 'MOTS-C'],
    faq: [
      {
        q: 'What makes CagriSema different from Semaglutide alone?',
        a: 'CagriSema adds Cagrilintide — a long-acting amylin analog — to the GLP-1 action of Semaglutide, potentially engaging additional satiety pathways that GLP-1 alone does not address.',
      },
      {
        q: 'Is CagriSema available as a compounded product?',
        a: 'Availability varies by state, prescription status, and licensed provider review. Submit a refill request to check eligibility.',
      },
    ],
    hasProduct: false,
  },
  {
    id: 'cagrilintide',
    name: 'Cagrilintide',
    category: 'GLP / Weight Management',
    tagline: 'A long-acting amylin analog often explored for its role in satiety and metabolic regulation.',
    overview:
      'Cagrilintide is a long-acting synthetic amylin analog that has attracted attention in metabolic research for its distinct satiety-signaling mechanism. Unlike GLP-1 agonists, Cagrilintide targets the amylin receptor pathway — a complementary approach often discussed in research for its potential to address metabolic wellness from a different biological angle.',
    wellnessInterests: ['Satiety signaling', 'Metabolic balance', 'Appetite regulation', 'Amylin pathway research'],
    strengths: ['Available through expanded partner catalog'],
    pairings: ['Semaglutide (as CagriSema)', 'NAD+'],
    faq: [
      {
        q: 'How does the amylin pathway differ from the GLP-1 pathway?',
        a: 'GLP-1 primarily works through incretin signaling, while amylin analogs like Cagrilintide act through central satiety and gastric motility pathways — a different but potentially complementary mechanism.',
      },
    ],
    hasProduct: false,
  },
  {
    id: 'aod-9604',
    name: 'AOD-9604',
    altName: 'Anti-Obesity Drug Fragment 176-191',
    category: 'GLP / Weight Management',
    tagline: 'A peptide fragment associated with fat metabolism research — without the growth-promoting effects of full HGH.',
    overview:
      'AOD-9604 is a synthetic peptide fragment derived from amino acids 176–191 of human growth hormone. It is commonly researched for its potential role in lipolysis (fat breakdown) and its lack of insulin-related activity, which makes it of interest in wellness circles separate from full HGH protocols. It is often paired with GLP compounds in wellness programs.',
    wellnessInterests: ['Fat metabolism research', 'Body composition', 'Metabolic support', 'Lipolysis interest'],
    strengths: ['300 mcg/mL', '500 mcg/mL', '1 mg/mL'],
    pairings: ['Semaglutide', 'Tirzepatide', 'CJC-1295 + Ipamorelin'],
    faq: [
      {
        q: 'Is AOD-9604 the same as HGH?',
        a: 'No. AOD-9604 is a small fragment of the HGH molecule specifically associated with lipolytic activity. It does not have the growth-promoting or insulin-related effects of full HGH.',
      },
      {
        q: 'Can AOD-9604 be used alongside GLP compounds?',
        a: 'This is a commonly discussed pairing in wellness settings. Any stacking decisions should be reviewed with a licensed provider.',
      },
    ],
    hasProduct: true,
    productPath: '/start',
  },

  // ── Recovery & Repair ────────────────────────────────────────────
  {
    id: 'wolverine',
    name: 'Wolverine Stack',
    altName: 'BPC-157 + TB-500',
    category: 'Recovery & Repair',
    tagline: 'The legendary recovery blend — BPC-157 and TB-500 combined for comprehensive tissue and repair support.',
    overview:
      'The "Wolverine" stack is a popular pre-blended combination of BPC-157 and TB-500, two of the most widely researched recovery peptides. Named for its reputation in wellness and sports recovery communities, this blend is commonly discussed for its potential synergistic support of tissue repair, inflammation modulation, and physical resilience. It remains one of the most requested compounded peptide combinations.',
    wellnessInterests: ['Tissue repair support', 'Recovery acceleration', 'Inflammation modulation', 'Joint and tendon wellness'],
    strengths: ['BPC-157 250 mcg + TB-500 2 mg/mL', 'BPC-157 500 mcg + TB-500 5 mg/mL'],
    pairings: ['GHK-Cu', 'NAD+', 'Tesamorelin'],
    faq: [
      {
        q: 'Why is this called the Wolverine stack?',
        a: 'The nickname emerged in wellness and fitness communities as a reference to the combination\'s reputation for supporting accelerated recovery. It is not a clinical or pharmaceutical term.',
      },
      {
        q: 'Can I get BPC-157 and TB-500 separately?',
        a: 'Yes. Both compounds are available individually through PepScriptRX\'s partner catalog. The pre-blended Wolverine formulation is simply a convenience option.',
      },
    ],
    hasProduct: true,
    productPath: '/start',
  },
  {
    id: 'bpc-157',
    name: 'BPC-157',
    altName: 'Body Protective Compound 157',
    category: 'Recovery & Repair',
    tagline: 'One of the most researched recovery peptides — commonly associated with tissue repair, gut health, and inflammation support.',
    overview:
      'BPC-157 is a synthetic pentadecapeptide derived from a protein found in gastric juice. It is one of the most extensively studied peptides in the recovery and repair category, with a wide body of preclinical research examining its role in tissue healing, tendon repair, gut mucosal integrity, and inflammation modulation. It is commonly used in sports recovery and wellness settings.',
    wellnessInterests: ['Tissue repair', 'Gut health support', 'Tendon and ligament wellness', 'Inflammation modulation', 'Wound healing'],
    strengths: ['250 mcg/mL', '500 mcg/mL', '1 mg/mL'],
    pairings: ['TB-500 (Wolverine Stack)', 'GHK-Cu', 'KPV', 'Ipamorelin'],
    faq: [
      {
        q: 'Is BPC-157 naturally occurring?',
        a: 'BPC-157 is a synthetic peptide based on a partial sequence derived from a gastric juice protein. It is not found in nature in this form but is inspired by a naturally occurring protein.',
      },
      {
        q: 'How is BPC-157 typically used in wellness settings?',
        a: 'It may be used subcutaneously or intramuscularly. Some wellness practitioners also discuss oral or site-specific administration. Your provider will recommend the appropriate approach.',
      },
    ],
    hasProduct: true,
    productPath: '/start',
  },
  {
    id: 'tb-500',
    name: 'TB-500',
    altName: 'Thymosin Beta-4 Fragment',
    category: 'Recovery & Repair',
    tagline: 'A synthetic peptide associated with tissue repair, flexibility, and recovery from physical stress.',
    overview:
      'TB-500 is a synthetic fragment of Thymosin Beta-4, a naturally occurring peptide found throughout the body. It is commonly researched for its role in promoting healing of muscle, tendon, ligament, and other soft tissues. TB-500 has gained significant popularity in athletic recovery and wellness communities for its potential to support flexibility, reduce recovery time, and promote overall physical resilience.',
    wellnessInterests: ['Muscle repair', 'Tendon healing', 'Flexibility support', 'Athletic recovery', 'Inflammation modulation'],
    strengths: ['2 mg/mL', '5 mg/mL', '10 mg vial'],
    pairings: ['BPC-157 (Wolverine Stack)', 'GHK-Cu', 'Ipamorelin', 'CJC-1295'],
    faq: [
      {
        q: 'Is TB-500 the same as Thymosin Beta-4?',
        a: 'TB-500 is a synthetic fragment of Thymosin Beta-4. It shares key structural properties of the active region of the full protein and is commonly used as a more practical alternative in research and wellness settings.',
      },
      {
        q: 'Can TB-500 be used for injury recovery?',
        a: 'TB-500 is commonly discussed in wellness settings for recovery support. It is not a medical treatment, and any use should be reviewed with a licensed provider.',
      },
    ],
    hasProduct: true,
    productPath: '/start',
  },
  {
    id: 'ghk-cu',
    name: 'GHK-Cu',
    altName: 'Copper Peptide',
    category: 'Recovery & Repair',
    tagline: 'A naturally occurring copper peptide widely discussed for skin health, wound healing, and anti-aging support.',
    overview:
      'GHK-Cu (Glycine-Histidine-Lysine-Copper) is a naturally occurring copper-binding peptide found in human plasma, saliva, and urine. It has been the subject of significant research interest for its potential role in wound healing, skin repair, antioxidant activity, and anti-aging at the cellular level. Its wide range of researched applications makes it a versatile compound in the wellness space.',
    wellnessInterests: ['Skin health and repair', 'Wound healing support', 'Antioxidant activity', 'Collagen support', 'Hair follicle wellness'],
    strengths: ['1 mg/mL', '2 mg/mL (topical and injectable options)'],
    pairings: ['BPC-157', 'Epithalon', 'NAD+', 'SS-31'],
    faq: [
      {
        q: 'Is GHK-Cu naturally produced by the body?',
        a: 'Yes. GHK-Cu is a naturally occurring peptide found in human plasma. Levels are known to decline with age, which has made it of interest in longevity and anti-aging research.',
      },
      {
        q: 'Can GHK-Cu be used topically?',
        a: 'GHK-Cu is widely used in topical formulations in skincare. Injectable forms are also available through compounding pharmacies when reviewed by a licensed provider.',
      },
    ],
    hasProduct: true,
    productPath: '/start',
  },
  {
    id: 'kpv',
    name: 'KPV',
    altName: 'Lysine-Proline-Valine',
    category: 'Recovery & Repair',
    tagline: 'A tripeptide derived from alpha-MSH — often discussed for its anti-inflammatory and gut-supportive properties.',
    overview:
      'KPV is a tripeptide derived from the C-terminal end of alpha-MSH (alpha-Melanocyte Stimulating Hormone), a naturally occurring anti-inflammatory peptide. Research has focused on KPV\'s potential role in modulating inflammatory responses, particularly in the gut. It has generated interest in wellness settings for its possible supportive role in inflammatory gut conditions and wound healing.',
    wellnessInterests: ['Anti-inflammatory support', 'Gut mucosal wellness', 'Wound healing', 'Skin health'],
    strengths: ['1 mg/mL', '5 mg/mL'],
    pairings: ['BPC-157', 'TB-500', 'Glutathione'],
    faq: [
      {
        q: 'How does KPV support gut health?',
        a: 'KPV is researched for its ability to interact with immune cells in the gut lining, potentially modulating inflammatory pathways. This is an area of active preclinical research interest.',
      },
    ],
    hasProduct: false,
  },

  // ── Growth Hormone / Performance ─────────────────────────────────
  {
    id: 'tesamorelin',
    name: 'Tesamorelin',
    category: 'Growth Hormone / Performance',
    tagline: 'A growth hormone-releasing peptide with one of the strongest clinical research profiles in its class.',
    overview:
      'Tesamorelin is a synthetic analog of Growth Hormone-Releasing Hormone (GHRH) that has been the subject of extensive clinical research, including approved applications in specific clinical populations. In wellness settings, it is commonly discussed for its effects on growth hormone output, body composition, and visceral fat reduction. It is considered one of the more precisely studied GHRH analogs available.',
    wellnessInterests: ['Growth hormone support', 'Body composition', 'Visceral fat reduction', 'Metabolic performance'],
    strengths: ['1 mg/mL', '2 mg/mL'],
    pairings: ['Ipamorelin', 'CJC-1295', 'NAD+', 'BPC-157'],
    faq: [
      {
        q: 'How does Tesamorelin differ from CJC-1295?',
        a: 'Both are GHRH analogs, but Tesamorelin has a stronger clinical research profile and a shorter half-life, making it more pulse-like in its GH-releasing action compared to the extended-release profile of CJC-1295 with DAC.',
      },
      {
        q: 'Do I need a prescription for Tesamorelin?',
        a: 'Yes. Tesamorelin requires a licensed provider review. PepScriptRX connects eligible customers through its licensed partner network.',
      },
    ],
    hasProduct: true,
    productPath: '/start',
  },
  {
    id: 'cjc-1295',
    name: 'CJC-1295',
    altName: 'Modified GRF 1-29 with DAC',
    category: 'Growth Hormone / Performance',
    tagline: 'A long-acting GHRH analog commonly explored for sustained growth hormone support.',
    overview:
      'CJC-1295 is a synthetic GHRH analog modified with a Drug Affinity Complex (DAC) for extended half-life. Unlike shorter GHRH peptides, CJC-1295 with DAC is designed to provide sustained growth hormone-releasing activity over several days, making it a popular option in wellness protocols focused on GH optimization. It is commonly paired with GHRP peptides like Ipamorelin for a synergistic effect.',
    wellnessInterests: ['Sustained GH support', 'Body composition', 'Recovery and repair', 'Performance optimization'],
    strengths: ['2 mg/mL', '5 mg/mL'],
    pairings: ['Ipamorelin (most common)', 'Tesamorelin', 'BPC-157', 'NAD+'],
    faq: [
      {
        q: 'What is the difference between CJC-1295 with DAC and without DAC?',
        a: 'CJC-1295 without DAC (also called Modified GRF 1-29) has a much shorter half-life and is designed for pulsed GH release. CJC-1295 with DAC has an extended duration of action of several days, often preferred for once or twice weekly dosing in wellness protocols.',
      },
      {
        q: 'Why is CJC-1295 so often paired with Ipamorelin?',
        a: 'CJC-1295 stimulates the GHRH receptor while Ipamorelin acts on the ghrelin receptor — two complementary pathways. Together, they are researched for a synergistic GH pulse with a favorable effect profile.',
      },
    ],
    hasProduct: true,
    productPath: '/start',
  },
  {
    id: 'cjc-ipamorelin',
    name: 'CJC-1295 + Ipamorelin',
    category: 'Growth Hormone / Performance',
    tagline: 'The most popular growth hormone peptide pairing — synergistic GH pulse support in one convenient blend.',
    overview:
      'The CJC-1295 + Ipamorelin combination is the most widely used growth hormone peptide stack in wellness settings. By combining a GHRH analog (CJC-1295) with a selective GHRP (Ipamorelin), this blend is researched for its ability to produce synergistic, amplified GH release with a favorable safety profile compared to older GHRP compounds. It is commonly discussed for body composition, recovery, sleep quality, and anti-aging wellness applications.',
    wellnessInterests: ['GH optimization', 'Body composition', 'Recovery support', 'Sleep quality', 'Anti-aging wellness'],
    strengths: ['CJC 2 mg + Ipamorelin 2 mg/mL', 'CJC 5 mg + Ipamorelin 5 mg/mL'],
    pairings: ['BPC-157', 'NAD+', 'Tesamorelin', 'AOD-9604'],
    faq: [
      {
        q: 'When is the best time to use this combination?',
        a: 'In wellness settings, this combination is often discussed for use before sleep to align with the body\'s natural nocturnal GH pulse. Your provider will recommend the appropriate timing and protocol.',
      },
      {
        q: 'Is this combination safe to use long-term?',
        a: 'Long-term use should always be monitored by a licensed provider. This combination is generally considered to have a favorable profile in research settings, but individual response varies.',
      },
    ],
    hasProduct: true,
    productPath: '/start',
  },
  {
    id: 'ipamorelin',
    name: 'Ipamorelin',
    category: 'Growth Hormone / Performance',
    tagline: 'A selective GH secretagogue known for clean, pulse-based growth hormone release with a minimal side effect profile.',
    overview:
      'Ipamorelin is a selective growth hormone secretagogue and GHRP (Growth Hormone Releasing Peptide) that stimulates GH release by acting on ghrelin receptors in the pituitary. It is widely favored in wellness research for its high selectivity — meaning it stimulates GH release without significant cortisol, prolactin, or ACTH elevation that is associated with older GHRPs. This makes it one of the most widely used GH-related peptides in wellness protocols.',
    wellnessInterests: ['Clean GH release', 'Body composition', 'Recovery support', 'Sleep optimization', 'Anti-aging wellness'],
    strengths: ['5 mg/mL', '2 mg/mL'],
    pairings: ['CJC-1295 (most common)', 'Sermorelin', 'BPC-157', 'TB-500'],
    faq: [
      {
        q: 'What makes Ipamorelin different from older GHRPs like GHRP-6?',
        a: 'Ipamorelin is highly selective for GH release with minimal effect on cortisol, prolactin, and appetite — a common concern with older GHRPs like GHRP-6. This makes it more suitable for sustained wellness use under provider supervision.',
      },
    ],
    hasProduct: true,
    productPath: '/start',
  },
  {
    id: 'sermorelin',
    name: 'Sermorelin',
    category: 'Growth Hormone / Performance',
    tagline: 'One of the original growth hormone-releasing peptides — widely used in wellness and anti-aging research.',
    overview:
      'Sermorelin is a synthetic analog of the first 29 amino acids of endogenous GHRH (Growth Hormone-Releasing Hormone). It has one of the longest histories in the GH peptide category, with clinical use dating back decades. In wellness settings, it is commonly discussed for its ability to stimulate the pituitary\'s natural GH release — a physiologically driven approach often preferred in anti-aging wellness programs.',
    wellnessInterests: ['Pituitary GH stimulation', 'Anti-aging wellness', 'Body composition', 'Sleep quality', 'Recovery'],
    strengths: ['3 mg/mL', '6 mg/mL', '9 mg/mL'],
    pairings: ['Ipamorelin', 'NAD+', 'BPC-157'],
    faq: [
      {
        q: 'How does Sermorelin compare to CJC-1295?',
        a: 'Sermorelin has a shorter half-life and stimulates more natural, pulse-like GH release. CJC-1295 offers a longer-acting option. Some wellness practitioners prefer Sermorelin for its more physiologic GH profile.',
      },
      {
        q: 'Is Sermorelin suitable for anti-aging wellness programs?',
        a: 'Sermorelin is one of the most discussed peptides in the anti-aging wellness space due to its pituitary-stimulating mechanism. Suitability is always determined by a licensed provider.',
      },
    ],
    hasProduct: true,
    productPath: '/start',
  },
  {
    id: 'hgh',
    name: 'HGH',
    altName: 'Human Growth Hormone / Somatropin',
    category: 'Growth Hormone / Performance',
    tagline: 'Recombinant human growth hormone — available through prescription for qualifying wellness and clinical applications.',
    overview:
      'Human Growth Hormone (HGH / Somatropin) is a recombinant form of the naturally occurring growth hormone produced by the anterior pituitary gland. Unlike peptides that stimulate GH release, recombinant HGH directly provides the hormone itself. It is used in specific clinical settings and explored in wellness contexts for body composition, recovery, and metabolic support when prescribed by a licensed provider.',
    wellnessInterests: ['Direct GH supplementation', 'Body composition', 'Recovery support', 'Metabolic performance', 'Anti-aging research'],
    strengths: ['4 IU', '10 IU', '36 IU (Norditropin-style vials)'],
    pairings: ['AOD-9604', 'Ipamorelin', 'NAD+', 'Tesamorelin'],
    faq: [
      {
        q: 'Is HGH available through PepScriptRX?',
        a: 'HGH requires a valid prescription from a licensed provider. Availability through our partner network depends on state law, provider approval, and your individual clinical profile.',
      },
      {
        q: 'How does HGH differ from GH-releasing peptides?',
        a: 'GH-releasing peptides (CJC-1295, Ipamorelin, Sermorelin) stimulate your pituitary to produce its own GH. Recombinant HGH provides the hormone directly, bypassing the pituitary. The appropriate approach depends on individual goals and provider evaluation.',
      },
    ],
    hasProduct: false,
  },
  {
    id: 'mk-677',
    name: 'MK-677',
    altName: 'Ibutamoren',
    category: 'Growth Hormone / Performance',
    tagline: 'An orally active growth hormone secretagogue widely discussed in performance and longevity wellness communities.',
    overview:
      'MK-677 (Ibutamoren) is an orally active, non-peptide growth hormone secretagogue that mimics the action of ghrelin to stimulate GH and IGF-1 release. Unlike injectable GH peptides, MK-677 is taken orally — a key practical advantage in wellness settings. It is widely discussed for its effects on body composition, sleep quality, recovery, and appetite stimulation. Long-term oral dosing makes it a unique option in the GH category.',
    wellnessInterests: ['Oral GH stimulation', 'Body composition', 'Sleep quality', 'Appetite and recovery support', 'IGF-1 optimization'],
    strengths: ['10 mg capsules', '25 mg capsules'],
    pairings: ['CJC-1295 + Ipamorelin', 'NAD+', 'Epithalon', 'BPC-157'],
    faq: [
      {
        q: 'Is MK-677 a SARM?',
        a: 'No. MK-677 is not a selective androgen receptor modulator (SARM). It is a ghrelin mimetic and GH secretagogue with a different mechanism of action entirely.',
      },
      {
        q: 'Does MK-677 increase appetite?',
        a: 'Appetite stimulation is a commonly discussed effect of MK-677 due to its ghrelin-mimetic mechanism. This is a consideration worth discussing with your licensed provider.',
      },
    ],
    hasProduct: false,
  },

  // ── Longevity & Anti-Aging ────────────────────────────────────────
  {
    id: 'nad',
    name: 'NAD+',
    altName: 'Nicotinamide Adenine Dinucleotide',
    category: 'Longevity & Anti-Aging',
    tagline: 'A coenzyme central to cellular energy and DNA repair — widely explored in longevity and anti-aging research.',
    overview:
      'NAD+ (Nicotinamide Adenine Dinucleotide) is a coenzyme found in every living cell and plays a central role in energy metabolism, DNA repair, and cellular signaling. NAD+ levels are known to decline with age, and this decline has been linked to many hallmarks of aging in research settings. Injectable NAD+ is commonly discussed for its potential to support energy, cognitive clarity, metabolism, and cellular resilience.',
    wellnessInterests: ['Cellular energy support', 'DNA repair', 'Cognitive clarity', 'Metabolic health', 'Anti-aging research', 'Addiction recovery support'],
    strengths: ['100 mg/mL', '250 mg/mL', '500 mg IV formulations'],
    pairings: ['Glutathione', 'MOTS-C', 'SS-31', 'Epithalon', 'B-12'],
    faq: [
      {
        q: 'Is there a difference between IV NAD+ and oral NAD+ precursors like NMN or NR?',
        a: 'IV/IM NAD+ bypasses digestive conversion and delivers the coenzyme directly into circulation. Oral precursors (NMN, NR) must be converted by the body. The relative bioavailability advantage of IV NAD+ is a commonly discussed topic in longevity research.',
      },
      {
        q: 'How often is NAD+ typically administered in wellness settings?',
        a: 'Protocols vary widely. Some practitioners use periodic IV infusions while others use frequent IM injections. Your provider will recommend the approach that aligns with your wellness goals.',
      },
    ],
    hasProduct: true,
    productPath: '/start',
  },
  {
    id: 'glutathione',
    name: 'Glutathione',
    altName: 'GSH / Master Antioxidant',
    category: 'Longevity & Anti-Aging',
    tagline: "Often called the body's master antioxidant — widely researched for cellular protection and detoxification support.",
    overview:
      "Glutathione is a tripeptide (Glutamine-Cysteine-Glycine) naturally produced by the liver and is the body's most abundant intracellular antioxidant. It plays a critical role in neutralizing free radicals, supporting immune function, and assisting in detoxification processes. Injectable glutathione is widely used in wellness settings for its potential to support skin health, energy, and cellular protection in ways that oral forms cannot match due to poor bioavailability.",
    wellnessInterests: ['Antioxidant support', 'Detoxification', 'Skin brightening and health', 'Immune function', 'Liver support'],
    strengths: ['200 mg/mL', '600 mg/mL', '1000 mg/mL IV push'],
    pairings: ['NAD+', 'B-12', 'Vitamin C IV', 'KPV'],
    faq: [
      {
        q: 'Why is injectable glutathione preferred over oral supplements?',
        a: 'Oral glutathione has poor bioavailability because it is largely broken down in the digestive tract. IV and IM forms bypass this limitation, delivering the compound more directly into the bloodstream.',
      },
    ],
    hasProduct: true,
    productPath: '/start',
  },
  {
    id: 'mots-c',
    name: 'MOTS-C',
    altName: 'Mitochondrial ORF of the 12S rRNA type-C',
    category: 'Longevity & Anti-Aging',
    tagline: 'A mitochondria-derived peptide gaining significant attention in longevity and metabolic health research.',
    overview:
      "MOTS-C is a recently discovered mitochondria-derived peptide encoded within mitochondrial DNA. It is one of the most exciting emerging compounds in longevity research, commonly associated with metabolic regulation, exercise mimicry, insulin sensitivity, and cellular stress resistance. MOTS-C levels are known to decline with age and physical decline, placing it at the intersection of anti-aging and metabolic wellness.",
    wellnessInterests: ['Metabolic health', 'Longevity research', 'Exercise performance support', 'Insulin sensitivity', 'Cellular stress resilience'],
    strengths: ['5 mg/mL', '10 mg/mL'],
    pairings: ['NAD+', 'SS-31', 'Epithalon', 'Glutathione'],
    faq: [
      {
        q: 'Is MOTS-C related to exercise?',
        a: 'MOTS-C has been studied as a potential "exercise mimetic" — a compound that may replicate some of the metabolic benefits of physical activity at the cellular level. This is an area of active research interest.',
      },
    ],
    hasProduct: false,
  },
  {
    id: 'epithalon',
    name: 'Epithalon',
    altName: 'Epithalamin / AEDG Peptide',
    category: 'Longevity & Anti-Aging',
    tagline: 'A tetrapeptide associated with telomere support and pineal gland regulation — a staple of longevity research.',
    overview:
      'Epithalon (AEDG) is a synthetic tetrapeptide derived from Epithalamin, a polypeptide naturally produced by the pineal gland. It is one of the most studied peptides in longevity research, commonly associated with telomerase activation, telomere lengthening, melatonin regulation, and the modulation of neuroendocrine aging. It has been researched for decades in Eastern European longevity medicine and is gaining mainstream wellness attention.',
    wellnessInterests: ['Telomere support', 'Pineal gland regulation', 'Sleep optimization', 'Anti-aging research', 'Immune modulation'],
    strengths: ['5 mg/mL', '10 mg vial'],
    pairings: ['NAD+', 'MOTS-C', 'SS-31', 'GHK-Cu', 'DSIP'],
    faq: [
      {
        q: 'What is the significance of telomere support?',
        a: 'Telomeres are protective caps at the ends of chromosomes that shorten with each cell division. Shortened telomeres are associated with cellular aging. Epithalon is researched for its potential to activate telomerase, an enzyme that may help maintain telomere length.',
      },
      {
        q: 'How is Epithalon typically used in longevity protocols?',
        a: 'Epithalon is often used in cyclic protocols, commonly discussed as periodic courses (e.g., 10–20 days) repeated annually or semi-annually. Your provider will recommend the appropriate protocol.',
      },
    ],
    hasProduct: false,
  },
  {
    id: 'ss-31',
    name: 'SS-31',
    altName: 'Elamipretide / Bendavia',
    category: 'Longevity & Anti-Aging',
    tagline: 'A mitochondria-targeting peptide researched for cellular energy restoration and organ protection.',
    overview:
      'SS-31 (Elamipretide) is a cell-permeable tetrapeptide that selectively targets the inner mitochondrial membrane. It is researched for its role in improving mitochondrial efficiency, reducing oxidative stress at the cellular level, and protecting mitochondrial function under conditions of stress or aging. SS-31 is considered one of the most mechanistically targeted compounds in the longevity category.',
    wellnessInterests: ['Mitochondrial health', 'Cellular energy restoration', 'Oxidative stress reduction', 'Organ protection research', 'Longevity'],
    strengths: ['5 mg/mL'],
    pairings: ['NAD+', 'MOTS-C', 'Epithalon', 'GHK-Cu'],
    faq: [
      {
        q: 'How does SS-31 target mitochondria?',
        a: 'SS-31 has an alternating aromatic-cationic structure that allows it to accumulate preferentially in the inner mitochondrial membrane, where it interacts with cardiolipin to stabilize the electron transport chain and reduce oxidative stress.',
      },
    ],
    hasProduct: false,
  },

  // ── Cognitive / Mood / Sleep ──────────────────────────────────────
  {
    id: 'selank',
    name: 'Selank',
    category: 'Cognitive / Mood / Sleep',
    tagline: 'A nootropic peptide researched for anxiety reduction, cognitive clarity, and mood stability.',
    overview:
      'Selank is a synthetic analog of the endogenous peptide tuftsin, developed by the Institute of Molecular Genetics in Russia. It is commonly researched for its anxiolytic (anxiety-reducing) properties without the sedation associated with traditional anti-anxiety compounds. Selank has also been discussed for its potential cognitive-enhancing and mood-stabilizing effects, and it is often used as a nasal spray in research settings.',
    wellnessInterests: ['Anxiety modulation', 'Cognitive clarity', 'Mood support', 'Stress resilience', 'Memory support'],
    strengths: ['300 mcg/mL (nasal)', '500 mcg/mL (injectable)'],
    pairings: ['Semax', 'DSIP', 'Oxytocin'],
    faq: [
      {
        q: 'Is Selank sedating?',
        a: 'Selank is generally researched for anxiolytic effects without significant sedation — a key distinction from compounds like benzodiazepines. Individual responses vary.',
      },
      {
        q: 'Is Selank available as a nasal spray?',
        a: 'Yes. Selank is commonly formulated as a nasal spray for convenient administration. Injectable options are also available.',
      },
    ],
    hasProduct: false,
  },
  {
    id: 'semax',
    name: 'Semax',
    altName: 'ACTH 4-7 Pro-Gly-Pro',
    category: 'Cognitive / Mood / Sleep',
    tagline: 'Derived from ACTH — widely discussed for cognitive enhancement, focus, and neuroprotective properties.',
    overview:
      'Semax is a synthetic nootropic peptide based on a fragment of ACTH (Adrenocorticotropic Hormone), modified for enhanced stability and activity. It has been extensively researched in Russia for its potential cognitive and neuroprotective properties. Semax is commonly discussed for supporting focus, memory, mood, and brain resilience. It is one of the most studied nootropic peptides and is available in both nasal and injectable forms.',
    wellnessInterests: ['Cognitive enhancement', 'Focus and memory', 'Neuroprotection', 'Mood support', 'Stroke recovery research'],
    strengths: ['300 mcg/mL', '600 mcg/mL (nasal spray)'],
    pairings: ['Selank', 'NAD+', 'DSIP'],
    faq: [
      {
        q: 'How does Semax support cognition?',
        a: 'Semax is researched for its effects on BDNF (Brain-Derived Neurotrophic Factor), dopaminergic signaling, and serotonin activity — pathways commonly associated with memory, focus, and mood.',
      },
    ],
    hasProduct: false,
  },
  {
    id: 'dsip',
    name: 'DSIP',
    altName: 'Delta Sleep-Inducing Peptide',
    category: 'Cognitive / Mood / Sleep',
    tagline: "Naturally present in the brain — researched for its role in promoting restorative sleep and stress modulation.",
    overview:
      'DSIP (Delta Sleep-Inducing Peptide) is a naturally occurring nonapeptide found in the brain, peripheral organs, and plasma. As the name suggests, it has been researched primarily for its role in sleep regulation, particularly in promoting the deeper, more restorative delta-wave sleep phases. DSIP is also discussed in wellness settings for potential stress-reduction and hormonal modulation effects.',
    wellnessInterests: ['Sleep quality', 'Delta-wave sleep support', 'Stress modulation', 'HGH pulse support during sleep', 'Recovery optimization'],
    strengths: ['5 mg/mL'],
    pairings: ['Epithalon', 'Selank', 'CJC-1295 + Ipamorelin'],
    faq: [
      {
        q: 'When is DSIP typically administered?',
        a: 'DSIP is most commonly discussed for use prior to sleep to support the natural sleep cycle. Your provider will recommend appropriate timing and dosing for your protocol.',
      },
    ],
    hasProduct: false,
  },
  {
    id: 'vip',
    name: 'VIP',
    altName: 'Vasoactive Intestinal Peptide',
    category: 'Cognitive / Mood / Sleep',
    tagline: 'A regulatory neuropeptide with wide-ranging research interest across immune, neurological, and respiratory health.',
    overview:
      'VIP (Vasoactive Intestinal Peptide) is a naturally occurring 28-amino acid neuropeptide found throughout the nervous system and peripheral tissues. It plays a broad regulatory role and has been researched for its potential anti-inflammatory effects, circadian rhythm regulation, lung and gut health, and immune modulation. VIP has attracted particular interest in the context of inflammatory and post-viral wellness support.',
    wellnessInterests: ['Neurological health', 'Immune modulation', 'Lung and respiratory wellness', 'Gut support', 'Circadian rhythm regulation'],
    strengths: ['100 mcg/mL (nasal)', '50 mcg/mL (injectable)'],
    pairings: ['Thymosin Alpha-1', 'BPC-157', 'KPV'],
    faq: [
      {
        q: 'Is VIP relevant for post-viral recovery?',
        a: 'VIP has been discussed in research settings related to inflammatory and post-viral conditions due to its anti-inflammatory and immune-regulatory properties. This is an emerging area of wellness interest.',
      },
    ],
    hasProduct: false,
  },
  {
    id: 'oxytocin',
    name: 'Oxytocin',
    altName: "The Bonding Hormone",
    category: 'Cognitive / Mood / Sleep',
    tagline: "Often called the 'bonding hormone' — researched for its role in social connection, mood, and stress response.",
    overview:
      "Oxytocin is a naturally occurring neuropeptide hormone produced in the hypothalamus and released by the pituitary gland. Often called the 'bonding' or 'love hormone,' it plays a key role in social behavior, emotional bonding, stress response, and uterine function. In wellness settings, oxytocin is discussed for its potential to support mood, social connection, anxiety relief, and even sexual wellness.",
    wellnessInterests: ['Mood support', 'Social bonding', 'Stress reduction', 'Anxiety modulation', 'Sexual wellness'],
    strengths: ['100 IU/mL (nasal)', '10 IU/mL (injectable)'],
    pairings: ['Selank', 'DSIP', 'Semax'],
    faq: [
      {
        q: 'Can oxytocin be used for social anxiety?',
        a: 'Oxytocin has been researched in clinical settings for its potential to reduce social anxiety and support prosocial behavior. These findings are in research settings and individual responses vary significantly.',
      },
    ],
    hasProduct: false,
  },

  // ── Immune / Wellness ─────────────────────────────────────────────
  {
    id: 'thymosin-alpha-1',
    name: 'Thymosin Alpha-1',
    altName: 'Tα1',
    category: 'Immune / Wellness',
    tagline: 'One of the most researched immune-modulating peptides — widely discussed for adaptive immune support.',
    overview:
      'Thymosin Alpha-1 is a naturally occurring peptide derived from Thymosin Fraction 5, originally isolated from thymic tissue. It is one of the most extensively researched immune-modulating peptides and has been evaluated in clinical settings for immunodeficiency, chronic infections, and vaccine response enhancement. In wellness settings, it is commonly discussed for supporting immune resilience, particularly during recovery or immunocompromised states.',
    wellnessInterests: ['Immune modulation', 'Adaptive immune support', 'Antiviral wellness interest', 'Recovery support', 'Autoimmune research'],
    strengths: ['1.5 mg/mL', '3 mg/mL'],
    pairings: ['LL-37', 'Glutathione', 'NAD+', 'VIP'],
    faq: [
      {
        q: 'Is Thymosin Alpha-1 related to the thymus gland?',
        a: 'Yes. It is derived from the thymus, the gland responsible for T-cell maturation. Thymosin Alpha-1 is researched for its role in supporting T-cell-mediated immune responses.',
      },
      {
        q: 'Is Thymosin Alpha-1 FDA-approved?',
        a: 'Thymosin Alpha-1 (Zadaxin) is approved in some countries outside the US for specific clinical indications. In the US, it is available through compounding pharmacies with a licensed provider prescription.',
      },
    ],
    hasProduct: true,
    productPath: '/start',
  },
  {
    id: 'thymalin',
    name: 'Thymalin',
    altName: 'Thymus Peptide Complex',
    category: 'Immune / Wellness',
    tagline: 'A thymus-derived peptide complex associated with immune regulation and longevity research.',
    overview:
      'Thymalin is a polypeptide complex isolated from the thymus gland, closely related to Thymosin Alpha-1 but representing a broader fraction of thymic peptides. It has a substantial research history in Eastern European medicine, where it has been studied for immune restoration, longevity, and neuroendocrine regulation. Thymalin is often discussed in anti-aging and immune wellness protocols alongside Epithalon.',
    wellnessInterests: ['Immune restoration', 'Longevity research', 'Thymic support', 'Neuroendocrine regulation'],
    strengths: ['10 mg/mL'],
    pairings: ['Thymosin Alpha-1', 'Epithalon', 'NAD+'],
    faq: [
      {
        q: 'How does Thymalin differ from Thymosin Alpha-1?',
        a: 'Thymosin Alpha-1 is a single, well-characterized peptide. Thymalin is a complex mixture of thymic peptides, representing a broader fraction of thymic signaling molecules. Both support immune function through thymic pathways.',
      },
    ],
    hasProduct: false,
  },
  {
    id: 'll-37',
    name: 'LL-37',
    altName: 'Human Cathelicidin Antimicrobial Peptide',
    category: 'Immune / Wellness',
    tagline: 'The only known human cathelicidin — researched for immune defense, antimicrobial activity, and wound healing.',
    overview:
      'LL-37 is the only human cathelicidin antimicrobial peptide — a naturally occurring innate immune defense peptide produced by neutrophils, macrophages, and epithelial cells. It is researched for its broad antimicrobial activity, role in wound healing, and immunomodulatory functions. LL-37 bridges the gap between innate immune defense and adaptive immune activation, making it of broad research interest in immunity and tissue repair.',
    wellnessInterests: ['Innate immune support', 'Antimicrobial defense', 'Wound healing', 'Skin health', 'Respiratory immunity research'],
    strengths: ['5 mg/mL'],
    pairings: ['Thymosin Alpha-1', 'BPC-157', 'GHK-Cu'],
    faq: [
      {
        q: 'Is LL-37 naturally produced by the body?',
        a: 'Yes. LL-37 is the sole member of the cathelicidin family of antimicrobial peptides in humans and is naturally produced by immune cells and epithelial tissues as part of the innate immune response.',
      },
    ],
    hasProduct: false,
  },
  {
    id: 'b12',
    name: 'B-12',
    altName: 'Methylcobalamin / Cyanocobalamin',
    category: 'Immune / Wellness',
    tagline: 'An essential B vitamin critical for neurological function, energy metabolism, and red blood cell production.',
    overview:
      'Vitamin B-12 (available as Methylcobalamin or Cyanocobalamin) is an essential micronutrient required for neurological function, DNA synthesis, red blood cell formation, and energy metabolism. B-12 deficiency is common, particularly among individuals on GLP-1 medications, vegans, older adults, and those with absorption issues. Injectable B-12 bypasses digestive absorption, making it a highly effective and frequently requested wellness supplement.',
    wellnessInterests: ['Energy support', 'Neurological health', 'Red blood cell production', 'GLP-1 complement', 'Mood and cognitive support'],
    strengths: ['1000 mcg/mL', '5000 mcg/mL'],
    pairings: ['Semaglutide', 'Tirzepatide', 'NAD+', 'Glutathione'],
    faq: [
      {
        q: 'Why is B-12 often paired with GLP-1 medications?',
        a: 'GLP-1 compounds are associated with reduced food intake, which can increase the risk of B-12 deficiency — especially if dietary sources of B-12 are limited. Injectable B-12 is a common complement in GLP-based wellness programs.',
      },
      {
        q: 'Is Methylcobalamin better than Cyanocobalamin?',
        a: 'Methylcobalamin is the biologically active form and does not require hepatic conversion. Cyanocobalamin is more shelf-stable and widely available. Both are effective — your provider can recommend the appropriate form.',
      },
    ],
    hasProduct: true,
    productPath: '/start',
  },
];
