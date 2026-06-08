export type ProductMetadata = {
  commonName: string;
  technicalName: string;
  doseLabel: string;
};

export type ProductMetadataInput = {
  id?: string | null;
  name?: string | null;
  product_name?: string | null;
  strength?: string | null;
};

const PRODUCT_METADATA_ENTRIES: Array<ProductMetadata & { keys: string[] }> = [
  product(['retatrutide-5mg', 'retatrutide 5mg'], 'Retatrutide', 'Retatrutide', '5mg'),
  product(['retatrutide-10mg', 'retatrutide 10mg'], 'Retatrutide', 'Retatrutide', '10mg'),
  product(['retatrutide', 'retatrutide-15mg', 'retatrutide 15mg'], 'Retatrutide', 'Retatrutide', '15mg'),
  product(['retatrutide-20mg', 'retatrutide 20mg'], 'Retatrutide', 'Retatrutide', '20mg'),
  product(['retatrutide-30mg', 'retatrutide 30mg'], 'Retatrutide', 'Retatrutide', '30mg'),
  product(['tirzepatide-10mg', 'tirzepatide 10mg'], 'Tirzepatide', 'Tirzepatide', '10mg'),
  product(['tirzepatide-15mg', 'tirzepatide 15mg'], 'Tirzepatide', 'Tirzepatide', '15mg'),
  product(['tirzepatide-20mg', 'tirzepatide 20mg'], 'Tirzepatide', 'Tirzepatide', '20mg'),
  product(['tirzepatide-30', 'tirzepatide-30mg', 'tirzepatide 30mg'], 'Tirzepatide', 'Tirzepatide', '30mg'),
  product(['tirzepatide-60', 'tirzepatide-60mg', 'tirzepatide 60mg'], 'Tirzepatide', 'Tirzepatide', '60mg'),
  product(['semaglutide-10', 'semaglutide-10mg', 'semaglutide 10mg'], 'Semaglutide', 'Semaglutide', '10mg'),
  product(['cagrisema'], 'CagriSema', 'Cagrilintide / Semaglutide Blend', 'Blend'),
  product(['cagrilintide-5mg', 'cagrilintide 5mg'], 'Cagrilintide', 'Cagrilintide', '5mg'),
  product(['aod-9604-5mg', 'aod9604-5mg', 'aod-9604 5mg'], 'AOD-9604', 'AOD-9604 / Anti-Obesity Drug 9604', '5mg'),
  product(['aod-9604-10mg', 'aod9604-10mg', 'aod-9604 10mg'], 'AOD-9604', 'AOD-9604 / Anti-Obesity Drug 9604', '10mg'),
  product(['bpc-157-5mg', 'bpc-157 5mg'], 'BPC-157', 'Body Protection Compound-157', '5mg'),
  product(['bpc-157-10mg', 'bpc-157 10mg'], 'BPC-157', 'Body Protection Compound-157', '10mg'),
  product(['tb-500-5mg', 'tb-500 5mg'], 'TB-500', 'Thymosin Beta-4 Fragment / TB-500', '5mg'),
  product(['tb-500-10mg', 'tb-500 10mg'], 'TB-500', 'Thymosin Beta-4 Fragment / TB-500', '10mg'),
  product(['wolverine-stack', 'wolverine-bpc-tb', 'bpc-157-tb-500-blend', 'bpc-157 / tb-500 blend'], 'Wolverine Stack', 'BPC-157 / TB-500 Blend', 'Blend'),
  product(['glow-peptide-blend', 'glow', 'glow peptide blend'], 'Glow Peptide Blend', 'BPC-157 / TB-500 / GHK-Cu Blend', 'Blend'),
  product(['klow-peptide-blend', 'klow', 'klow peptide blend'], 'Klow Peptide Blend', 'KPV / BPC-157 / TB-500 / GHK-Cu Blend', 'Blend'),
  product(['ghk-cu-100mg', 'ghk-cu 100mg', 'ghk-cu', 'ghk-cu 100 mg'], 'GHK-Cu', 'Copper Tripeptide-1 / GHK-Cu', '100mg'),
  product(['glutathione-1500mg', 'glutathione 1500mg'], 'Glutathione', 'L-Glutathione', '1,500mg'),
  product(['nad-plus', 'nad+', 'nad-100iu', 'nad-500iu', 'nad-1000iu'], 'NAD+', 'Nicotinamide Adenine Dinucleotide', 'Standard'),
  product(['mots-c-10mg', 'mots-c 10mg', 'motsc-10mg'], 'MOTS-c', 'Mitochondrial-Derived Peptide MOTS-c', '10mg'),
  product(['tesamorelin-2mg', 'tesamorelin 2mg'], 'Tesamorelin', 'Tesamorelin Acetate', '2mg'),
  product(['tesamorelin-5mg', 'tesamorelin 5mg'], 'Tesamorelin', 'Tesamorelin Acetate', '5mg'),
  product(['tesamorelin-10mg', 'tesamorelin 10mg'], 'Tesamorelin', 'Tesamorelin Acetate', '10mg'),
  product(['cjc-1295-ipamorelin', 'cjc-ipamorelin-10mg', 'cjc + ipamorelin', 'cjc-1295 / ipamorelin'], 'CJC-1295 / Ipamorelin', 'CJC-1295 / Ipamorelin Blend', 'Blend'),
  product(['hgh-somatropin', 'hgh / somatropin', 'hgh'], 'HGH / Somatropin', 'Somatropin', 'IU / Standard'),
  product(['hgh-10iu', 'hgh 10 iu'], 'HGH / Somatropin', 'Somatropin', '10 IU'),
  product(['igf-1-lr3-1mg', 'igf-1 lr3'], 'IGF-1 LR3', 'Insulin-Like Growth Factor-1 LR3', '1mg'),
  product(['igf1', 'igf-1', 'insulin growth factor one'], 'IGF-1', 'Insulin-Like Growth Factor-1', 'Standard'),
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
  const name = cleanText(input.name ?? input.product_name);
  const strength = cleanText(input.strength);
  const candidates = [
    id,
    stripPortalPrefix(id),
    name,
    stripVialSuffix(name),
    strength ? `${name} ${strength}` : '',
    strength ? `${stripVialSuffix(name)} ${strength}` : '',
    strength ? `${stripPortalPrefix(id)} ${strength}` : '',
  ];

  for (const candidate of candidates) {
    const metadata = PRODUCT_METADATA_BY_KEY[normalizeProductKey(candidate)];
    if (metadata) return metadata;
  }

  const fallbackDose = normalizeDoseLabel(strength) || extractDoseLabel(name) || 'Standard';
  const fallbackName = stripDoseFromName(stripVialSuffix(name)) || stripPortalPrefix(id) || 'Product';
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
  return `${metadata.commonName} ${metadata.technicalName} ${metadata.doseLabel}`;
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
  return clean;
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
  return '';
}

function stripDoseFromName(value: string): string {
  return value
    .replace(/\b\d+(?:,\d{3})?(?:\.\d+)?\s*mg\b/gi, '')
    .replace(/\b\d+(?:,\d{3})?\s*iu\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}
