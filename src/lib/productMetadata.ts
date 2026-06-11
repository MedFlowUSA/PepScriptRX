export type ProductMetadata = {
  commonName: string;
  technicalName: string;
  doseLabel: string;
};

export type ProductMetadataInput = {
  id?: string | null;
  sku?: string | null;
  name?: string | null;
  product_name?: string | null;
  strength?: string | null;
};

const PRODUCT_METADATA_ENTRIES: Array<ProductMetadata & { keys: string[] }> = [
  product(['retatrutide-5mg', 'retatrutide 5mg', 'reta-5mg', 'reta 5mg'], 'Retatrutide', 'Retatrutide', '5mg'),
  product(['retatrutide-10mg', 'retatrutide 10mg', 'reta-10mg', 'reta 10mg'], 'Retatrutide', 'Retatrutide', '10mg'),
  product(['retatrutide', 'reta', 'rt15', 'retatrutide-15mg', 'retatrutide 15mg', 'reta-15mg', 'reta 15mg'], 'Retatrutide', 'Retatrutide', '15mg'),
  product(['retatrutide-20mg', 'retatrutide 20mg', 'reta-20mg', 'reta 20mg'], 'Retatrutide', 'Retatrutide', '20mg'),
  product(['retatrutide-30mg', 'retatrutide 30mg', 'reta-30mg', 'reta 30mg'], 'Retatrutide', 'Retatrutide', '30mg'),
  product(['retatrutide-50mg', 'retatrutide 50mg', 'reta-50mg', 'reta 50mg'], 'Retatrutide', 'Retatrutide', '50mg'),
  product(['reta-oral-500mcg', 'reta oral 500mcg', 'retatrutide-oral-500mcg', 'retatrutide oral 500mcg'], 'Retatrutide Oral', 'Retatrutide', '500mcg'),
  product(['tirzepatide-10mg', 'tirzepatide 10mg', 'trizep-10mg', 'trizep 10mg', 'tirz-10mg', 'tirz 10mg'], 'Tirzepatide', 'Tirzepatide', '10mg'),
  product(['tirzepatide-15mg', 'tirzepatide 15mg', 'trizep-15mg', 'trizep 15mg', 'tirz-15mg', 'tirz 15mg'], 'Tirzepatide', 'Tirzepatide', '15mg'),
  product(['tirzepatide-20mg', 'tirzepatide 20mg', 'trizep-20mg', 'trizep 20mg', 'tirz-20mg', 'tirz 20mg'], 'Tirzepatide', 'Tirzepatide', '20mg'),
  product(['tirzepatide-30', 'tirzepatide-30mg', 'tirzepatide 30mg', 'tr30', 'trizep-30mg', 'trizep 30mg', 'tirz-30mg', 'tirz 30mg'], 'Tirzepatide', 'Tirzepatide', '30mg'),
  product(['tirzepatide-60', 'tirzepatide-60mg', 'tirzepatide 60mg', 'tr60', 'trizep-60mg', 'trizep 60mg', 'tirz-60mg', 'tirz 60mg'], 'Tirzepatide', 'Tirzepatide', '60mg'),
  product(['semaglutide-10', 'semaglutide-10mg', 'semaglutide 10mg', 'sema-10mg', 'sema 10mg', 'sm10'], 'Semaglutide', 'Semaglutide', '10mg'),
  product(['cagrisema', 'cs10', 'cagrilintide-semaglutide', 'cagrilintide semaglutide'], 'CagriSema', 'Cagrilintide / Semaglutide Blend', '2.4 mg + 2.4 mg, 4.8 mg total'),
  product(['cagrilintide-5mg', 'cagrilintide 5mg', 'cagri-5mg', 'cagri 5mg'], 'Cagrilintide', 'Cagrilintide', '5mg'),
  product(['aod-9604-5mg', 'aod9604-5mg', 'aod-9604 5mg'], 'AOD-9604', 'AOD-9604 / Anti-Obesity Drug 9604', '5mg'),
  product(['aod-9604-10mg', 'aod9604-10mg', 'aod-9604 10mg'], 'AOD-9604', 'AOD-9604 / Anti-Obesity Drug 9604', '10mg'),
  product(['bpc-157-5mg', 'bpc-157 5mg', 'bpc157-5mg', 'bpc157 5mg'], 'BPC-157', 'Body Protection Compound-157', '5mg'),
  product(['bpc-157-10mg', 'bpc-157 10mg', 'bpc157-10mg', 'bpc157 10mg'], 'BPC-157', 'Body Protection Compound-157', '10mg'),
  product(['tb-500-5mg', 'tb-500 5mg', 'tb500-5mg', 'tb500 5mg'], 'TB-500', 'Thymosin Beta-4 Fragment / TB-500', '5mg'),
  product(['tb-500-10mg', 'tb-500 10mg', 'tb500-10mg', 'tb500 10mg'], 'TB-500', 'Thymosin Beta-4 Fragment / TB-500', '10mg'),
  product(['wolverine-stack', 'wolverine-bpc-tb', 'wolverine-20', 'wolverine 20', 'bb20', 'bb 20', 'bpc-tb', 'bpc/tb', 'bpc-157-tb-500-blend', 'bpc-157 / tb-500 blend', 'bpc157 tb500 blend'], 'Wolverine Stack', 'BPC-157 / TB-500 Blend', 'BPC-157 10 mg + TB-500 10 mg, 20 mg total'),
  product(['glow-peptide-blend', 'glow', 'glow stack', 'glow70', 'glow 70', 'glow peptide blend', 'glow-glom-70mg', 'glom', 'glom70'], 'Glow Stack', 'BPC-157 / TB-500 / GHK-Cu Blend', '70 mg total'),
  product(['klow-peptide-blend', 'klow', 'klow peptide blend', 'klow stack'], 'Klow Peptide Blend', 'KPV / BPC-157 / TB-500 / GHK-Cu Blend', 'Blend'),
  product(['ghk-cu-100mg', 'ghk-cu 100mg', 'ghk-cu', 'ghk-cu 100 mg', 'ghkcu-100mg', 'ghkcu 100mg', 'cu100'], 'GHK-Cu', 'Copper Tripeptide-1 / GHK-Cu', '100mg'),
  product(['glutathione-1500mg', 'glutathione 1500mg', 'gluta-1500mg', 'gluta 1500mg'], 'Glutathione', 'L-Glutathione', '1,500mg'),
  product(['nad-100iu', 'nad+ 100iu', 'nad+ 100 iu'], 'NAD+', 'Nicotinamide Adenine Dinucleotide', '100 IU'),
  product(['nad-500iu', 'nad+ 500iu', 'nad+ 500 iu'], 'NAD+', 'Nicotinamide Adenine Dinucleotide', '500 IU'),
  product(['nad-1000iu', 'nad+ 1000iu', 'nad+ 1000 iu'], 'NAD+', 'Nicotinamide Adenine Dinucleotide', '1000 IU'),
  product(['nad-500mg', 'nad+ 500mg', 'nad+ 500 mg'], 'NAD+', 'Nicotinamide Adenine Dinucleotide', '500 mg'),
  product(['nad-1000mg', 'nad+ 1000mg', 'nad+ 1000 mg', 'nad-plus', 'nad+', 'nad plus'], 'NAD+', 'Nicotinamide Adenine Dinucleotide', '1000 mg'),
  product(['mots-c-10mg', 'mots-c 10mg', 'motsc-10mg', 'motsc 10mg', 'ms10'], 'MOTS-C', 'Mitochondrial-Derived Peptide MOTS-C', '10mg'),
  product(['tesamorelin-2mg', 'tesamorelin 2mg'], 'Tesamorelin', 'Tesamorelin Acetate', '2mg'),
  product(['tesamorelin-5mg', 'tesamorelin 5mg'], 'Tesamorelin', 'Tesamorelin Acetate', '5mg'),
  product(['tesamorelin-10mg', 'tesamorelin 10mg'], 'Tesamorelin', 'Tesamorelin Acetate', '10mg'),
  product(['cjc-1295-ipamorelin', 'cjc-ipamorelin-10mg', 'cjc + ipamorelin', 'cjc-1295 / ipamorelin', 'cjc ipa', 'cjcipa-10', 'cp10'], 'CJC-1295 / Ipamorelin', 'CJC-1295 / Ipamorelin Blend', '5 mg + 5 mg, 10 mg total'),
  product(['ipamorelin-5mg', 'ipamorelin 5mg', 'ipamorelin 5 mg', 'ipa5'], 'Ipamorelin', 'Ipamorelin', '5 mg'),
  product(['ipamorelin-10mg', 'ipamorelin 10mg', 'ipamorelin 10 mg', 'ipa10'], 'Ipamorelin', 'Ipamorelin', '10 mg'),
  product(['ipamorelin', 'ipa'], 'Ipamorelin', 'Ipamorelin', 'Standard'),
  product(['hgh-10iu', 'hgh 10 iu', 'hgh-100iu-kit', 'hgh 100iu kit', 'hgh-somatropin-100iu-kit', 'h10'], 'HGH / Somatropin', 'Somatropin', '10 IU x 10, 100 IU total'),
  product(['hgh-15iu', 'hgh 15 iu'], 'HGH / Somatropin', 'Somatropin', '15 IU'),
  product(['hgh-24iu', 'hgh 24 iu', 'hgh-240iu-kit', 'hgh 240iu kit', 'hgh-somatropin-240iu-kit', 'h24'], 'HGH / Somatropin', 'Somatropin', '24 IU x 10, 240 IU total'),
  product(['hgh-36iu', 'hgh 36 iu'], 'HGH / Somatropin', 'Somatropin', '36 IU'),
  product(['hgh-somatropin', 'hgh / somatropin', 'hgh'], 'HGH / Somatropin', 'Somatropin', 'IU / Standard'),
  product(['igf-1-lr3-1mg', 'igf-1 lr3'], 'IGF-1 LR3', 'Insulin-Like Growth Factor-1 LR3', '1mg'),
  product(['igf', 'igf1', 'igf-1', 'insulin growth factor one'], 'IGF-1', 'Insulin-Like Growth Factor-1', 'Standard'),
  product(['bac-water', 'bac-water-syringe-kit', 'bac water + syringe kit', 'bac water + 8-pack syringe kit'], 'BAC Water + Syringe Kit', 'Bacteriostatic Water + Injection Supply Kit', 'Kit'),
];

const PRODUCT_METADATA_BY_KEY = PRODUCT_METADATA_ENTRIES.reduce<Record<string, ProductMetadata>>((map, entry) => {
  entry.keys.forEach((key) => {
    map[normalizeProductKey(key)] = {
      commonName: entry.commonName,
      technicalName: entry.technicalName,
      doseLabel: entry.doseLabel,
    };
  });
  return map;
}, {});

export function getProductMetadata(input: ProductMetadataInput): ProductMetadata {
  const id = cleanText(input.id);
  const sku = cleanText(input.sku);
  const name = cleanText(input.name ?? input.product_name);
  const strength = cleanText(input.strength);
  const explicitDose = normalizeDoseLabel(strength) || strength;
  const derivedDose = explicitDose || extractDoseLabel(id) || extractDoseLabel(sku) || extractDoseLabel(name);
  const candidates = [
    strength ? `${name} ${strength}` : '',
    strength ? `${stripVialSuffix(name)} ${strength}` : '',
    strength ? `${stripPortalPrefix(id)} ${strength}` : '',
    strength ? `${stripPortalPrefix(sku)} ${strength}` : '',
    derivedDose ? `${name} ${derivedDose}` : '',
    derivedDose ? `${stripVialSuffix(name)} ${derivedDose}` : '',
    derivedDose ? `${stripPortalPrefix(id)} ${derivedDose}` : '',
    derivedDose ? `${stripPortalPrefix(sku)} ${derivedDose}` : '',
    id,
    stripPortalPrefix(id),
    sku,
    stripPortalPrefix(sku),
    name,
    stripVialSuffix(name),
  ];

  for (const candidate of candidates) {
    const metadata = PRODUCT_METADATA_BY_KEY[normalizeProductKey(candidate)];
    if (metadata) {
      return isMeaningfulDose(derivedDose) && isGenericDose(metadata.doseLabel)
        ? { ...metadata, doseLabel: derivedDose }
        : metadata;
    }
  }

  const fallbackDose = derivedDose || 'Standard';
  const fallbackName = stripDoseFromName(stripVialSuffix(name)) || stripPortalPrefix(id) || stripPortalPrefix(sku) || 'Product';
  return {
    commonName: fallbackName,
    technicalName: fallbackName,
    doseLabel: fallbackDose,
  };
}

export function productOrderLabel(input: ProductMetadataInput): string {
  const metadata = getProductMetadata(input);
  return metadata.doseLabel === 'Standard'
    ? metadata.commonName
    : `${metadata.commonName} ${metadata.doseLabel}`;
}

export function productMetaSearchText(input: ProductMetadataInput): string {
  const metadata = getProductMetadata(input);
  return [
    metadata.commonName,
    metadata.technicalName,
    metadata.doseLabel,
    cleanText(input.id),
    cleanText(input.sku),
    cleanText(input.name ?? input.product_name),
    cleanText(input.strength),
  ].join(' ');
}

function product(keys: string[], commonName: string, technicalName: string, doseLabel: string) {
  return { keys, commonName, technicalName, doseLabel };
}

function cleanText(value: unknown): string {
  return String(value ?? '').trim();
}

function normalizeProductKey(value: string): string {
  return stripPortalPrefix(value)
    .toLowerCase()
    .replace(/vial\b/g, '')
    .replace(/\bpack\b/g, '')
    .replace(/\s*\+\s*/g, '+')
    .replace(/[^a-z0-9+]+/g, '');
}

function stripPortalPrefix(value: string): string {
  return value.replace(/^(mark|robert|scott|alpha|optimax|ronin|agprime|vyigenix|rockphorm|zenora|guy|dist)-/i, '');
}

function stripVialSuffix(value: string): string {
  return value.replace(/\s+vial\b/i, '').replace(/\s+vials\b/i, '').trim();
}

function normalizeDoseLabel(value: string): string {
  if (!value) return '';
  const clean = value.trim();
  if (/^standard$/i.test(clean)) return 'Standard';
  if (/^blend$/i.test(clean)) return 'Blend';
  if (/^kit$/i.test(clean) || /^supply$/i.test(clean)) return 'Kit';
  const iu = clean.match(/^(\d+(?:,\d{3})?)\s*iu$/i);
  if (iu) return `${iu[1]} IU`;
  const mg = clean.match(/^(\d+(?:,\d{3})?(?:\.\d+)?)\s*mg$/i);
  if (mg) return `${mg[1]}mg`;
  const mcg = clean.match(/^(\d+(?:,\d{3})?(?:\.\d+)?)\s*mcg$/i);
  if (mcg) return `${mcg[1]}mcg`;
  return clean;
}

function isGenericDose(value: string): boolean {
  return /^(standard|blend|kit|supply|iu\s*\/\s*standard)$/i.test(value.trim());
}

function isMeaningfulDose(value: string): boolean {
  return Boolean(value.trim()) && !isGenericDose(value);
}

function extractDoseLabel(value: string): string {
  const blend = value.match(/\bblend\b/i);
  if (blend) return 'Blend';
  const kit = value.match(/\bkit\b/i);
  if (kit) return 'Kit';
  const iu = value.match(/\b(\d+(?:,\d{3})?)\s*iu\b/i);
  if (iu) return `${iu[1]} IU`;
  const mg = value.match(/\b(\d+(?:,\d{3})?(?:\.\d+)?)\s*mg\b/i);
  if (mg) return `${mg[1]}mg`;
  const mcg = value.match(/\b(\d+(?:,\d{3})?(?:\.\d+)?)\s*mcg\b/i);
  if (mcg) return `${mcg[1]}mcg`;
  return '';
}

function stripDoseFromName(value: string): string {
  return value
    .replace(/\b\d+(?:,\d{3})?(?:\.\d+)?\s*mg\b/gi, '')
    .replace(/\b\d+(?:,\d{3})?(?:\.\d+)?\s*mcg\b/gi, '')
    .replace(/\b\d+(?:,\d{3})?\s*iu\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}
