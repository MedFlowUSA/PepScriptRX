import { anatoliaStorefront } from './anatolia';

export type WhiteLabelPortalId = 'empire' | 'ehwsub' | 'aactivated' | 'warxlabz' | 'peakform' | 'alphapride' | 'optimax' | 'ronin' | 'agprime' | 'vyigenix' | 'rockphorm' | 'aurora' | 'zenora' | 'physiopeptides' | 'ginto' | 'beastmode' | 'anatolia' | 'glow' | 'klow';

export type WhiteLabelPortal = {
  id: WhiteLabelPortalId;
  brandName: string;
  repName: string;
  repSlug: string;
  distributorSlug: string;
  backOfficePortal: 'admin' | 'rep';
  path: string;
  logoSrc: string;
};

export const WHITE_LABEL_PORTALS: WhiteLabelPortal[] = [
  {
    id: 'empire',
    brandName: 'Empire Health & Wellness',
    repName: 'Mark Ayala',
    repSlug: 'MARK65',
    distributorSlug: 'mark',
    backOfficePortal: 'admin',
    path: '/EmpireHealth&Wellness',
    logoSrc: '/marketing/empire-health-wellness-logo.png',
  },
  {
    id: 'ehwsub',
    brandName: 'Ellie',
    repName: 'Ellie Beyer',
    repSlug: 'EHWSUB',
    distributorSlug: 'ehwsub',
    backOfficePortal: 'rep',
    path: '/EHWSUB',
    logoSrc: '/logo-clean.png',
  },
  {
    id: 'aactivated',
    brandName: 'AACTIVATED-RX',
    repName: 'Guy',
    repSlug: 'GUY60',
    distributorSlug: 'guy',
    backOfficePortal: 'admin',
    path: '/AACTIVATED',
    logoSrc: '/marketing/aactivated-rx-logo-v2.png',
  },
  {
    id: 'warxlabz',
    brandName: 'WarXlabz',
    repName: 'Robert Luevano',
    repSlug: 'ROBERT',
    distributorSlug: 'robert',
    backOfficePortal: 'rep',
    path: '/warxlabz',
    logoSrc: '/marketing/warxlabz-logo.png',
  },
  {
    id: 'peakform',
    brandName: 'Peak Form Peptides',
    repName: 'Scott Bowman',
    repSlug: 'SCOTTB',
    distributorSlug: 'scott',
    backOfficePortal: 'rep',
    path: '/peakform',
    logoSrc: '/marketing/peakform-logo.png',
  },
  {
    id: 'alphapride',
    brandName: 'Alpha Pride Wellness',
    repName: 'John Ayala',
    repSlug: 'ALPHAPRIDE',
    distributorSlug: 'alpha',
    backOfficePortal: 'rep',
    path: '/alphapride',
    logoSrc: '/marketing/alphapride-logo.png',
  },
  {
    id: 'optimax',
    brandName: 'Optimax Peptide Therapy',
    repName: 'Gabriel Martinez',
    repSlug: 'GABE50',
    distributorSlug: 'optimax',
    backOfficePortal: 'admin',
    path: '/optimax-peptide-therapy',
    logoSrc: '/marketing/optimax-logo-clean.png',
  },
  {
    id: 'ronin',
    brandName: 'Ronin',
    repName: 'Ronin',
    repSlug: 'MGT1111',
    distributorSlug: 'ronin',
    backOfficePortal: 'admin',
    path: '/ronin',
    logoSrc: '/marketing/ronin-logo.png',
  },
  {
    id: 'agprime',
    brandName: 'AG Prime Lab',
    repName: 'Angel Gallardo',
    repSlug: 'AGPRIME45',
    distributorSlug: 'agprime',
    backOfficePortal: 'rep',
    path: '/agprimelab',
    logoSrc: '/marketing/ag-prime-lab-logo.png',
  },
  {
    id: 'vyigenix',
    brandName: 'Vyigenix Pharmaceuticals',
    repName: 'John Paul Theis',
    repSlug: 'VYIGENIX',
    distributorSlug: 'vyigenix',
    backOfficePortal: 'admin',
    path: '/vyigenix',
    logoSrc: '/marketing/vyigenix-logo.png',
  },
  {
    id: 'rockphorm',
    brandName: 'Rock Phorm',
    repName: 'Rick Diaz',
    repSlug: 'ROCKPHORM',
    distributorSlug: 'rockphorm',
    backOfficePortal: 'admin',
    path: '/rockphorm',
    logoSrc: '/marketing/rockphorm-logo.png',
  },
  {
    id: 'aurora',
    brandName: 'Aurora Labs',
    repName: 'Mike',
    repSlug: 'AURORA',
    distributorSlug: 'aurora',
    backOfficePortal: 'admin',
    path: '/aurora',
    logoSrc: '/marketing/aurora-logo.png',
  },
  {
    id: 'zenora',
    brandName: 'ZENORA Precision Wellness & Peptide Therapy',
    repName: 'Jessica Hinojosa',
    repSlug: 'JESS8',
    distributorSlug: 'zenora',
    backOfficePortal: 'rep',
    path: '/zenora',
    logoSrc: '/marketing/zenora-logo.jpeg',
  },
  {
    id: 'physiopeptides',
    brandName: 'PhysioPeptides',
    repName: 'Dr. Roman Felix',
    repSlug: 'PHYSIOPEPTIDES',
    distributorSlug: 'physiopeptides',
    backOfficePortal: 'admin',
    path: '/PhysioPeptides',
    logoSrc: '/marketing/physiopeptides-logo.png',
  },
  {
    id: 'ginto',
    brandName: 'Ginto Wellness Labs',
    repName: 'Ginto Wellness Labs',
    repSlug: 'GINTO',
    distributorSlug: 'ginto',
    backOfficePortal: 'rep',
    path: '/ginto',
    logoSrc: '/brands/ginto/ginto-logo.png',
  },
  {
    id: 'beastmode',
    brandName: 'BEASTMODE Performance Labs',
    repName: 'BEASTMODE Performance Labs',
    repSlug: 'BEASTMODE',
    distributorSlug: 'beastmode',
    backOfficePortal: 'admin',
    path: '/beastmode',
    logoSrc: '/brands/beastmode/beastmode-logo.jpeg',
  },
  {
    id: 'anatolia',
    brandName: anatoliaStorefront.brandName,
    repName: anatoliaStorefront.brandName,
    repSlug: 'MAIN',
    distributorSlug: anatoliaStorefront.slug,
    backOfficePortal: 'admin',
    path: '/anatolia',
    logoSrc: anatoliaStorefront.assets.logo,
  },
  {
    id: 'glow',
    brandName: 'GLOW',
    repName: 'Vanessa Cosio',
    repSlug: 'GLOW',
    distributorSlug: 'glow',
    backOfficePortal: 'admin',
    path: '/glow',
    logoSrc: '/brands/glow/glow-peptide-complex.png',
  },
  {
    id: 'klow',
    brandName: 'KLOW',
    repName: 'Rock Phorm',
    repSlug: 'ROCKPHORM',
    distributorSlug: 'rockphorm',
    backOfficePortal: 'admin',
    path: '/klow',
    logoSrc: '/brands/klow/klow-logo-wall.png',
  },
];

const PORTAL_ALIASES: Record<string, WhiteLabelPortalId> = {
  empire: 'empire',
  empirehealth: 'empire',
  empirehealthwellness: 'empire',
  'empirehealth&wellness': 'empire',
  'empire-health-wellness': 'empire',
  mark: 'empire',
  mark65: 'empire',
  ehwsub: 'ehwsub',
  aactivated: 'aactivated',
  'aactivated-rx': 'aactivated',
  vitalityins: 'aactivated',
  guy: 'aactivated',
  guy60: 'aactivated',
  warxlabz: 'warxlabz',
  robert: 'warxlabz',
  peakform: 'peakform',
  'peak-form': 'peakform',
  scott: 'peakform',
  scottb: 'peakform',
  alphapride: 'alphapride',
  'alpha-pride': 'alphapride',
  'alpha-pride-wellness': 'alphapride',
  alpha: 'alphapride',
  alpha45: 'alphapride',
  john: 'alphapride',
  johnayala: 'alphapride',
  optimax: 'optimax',
  'optimax-peptide-therapy': 'optimax',
  optimaxpeptidetherapy: 'optimax',
  gabe: 'optimax',
  gabe50: 'optimax',
  gabriel: 'optimax',
  ronin: 'ronin',
  mgt1111: 'ronin',
  agprime: 'agprime',
  agprimelab: 'agprime',
  'ag-prime-lab': 'agprime',
  agprime45: 'agprime',
  angel45: 'agprime',
  angel: 'agprime',
  vyigenix: 'vyigenix',
  'vyigenix-pharmaceuticals': 'vyigenix',
  vyigenixpharmaceuticals: 'vyigenix',
  johnpaultheis: 'vyigenix',
  johntheis: 'vyigenix',
  rockphorm: 'rockphorm',
  'rock-phorm': 'rockphorm',
  rick: 'rockphorm',
  rickdiaz: 'rockphorm',
  rick50: 'rockphorm',
  aurora: 'aurora',
  auroralabs: 'aurora',
  'aurora-labs': 'aurora',
  mikeaurora: 'aurora',
  zenora: 'zenora',
  'zenora-precision-wellness': 'zenora',
  'zenora-precision-wellness-peptide-therapy': 'zenora',
  jess8: 'zenora',
  jessica: 'zenora',
  jessicahinojosa: 'zenora',
  physiopeptides: 'physiopeptides',
  'physio-peptides': 'physiopeptides',
  physio: 'physiopeptides',
  roman: 'physiopeptides',
  romanfelix: 'physiopeptides',
  drromanfelix: 'physiopeptides',
  ginto: 'ginto',
  gintowellnesslabs: 'ginto',
  'ginto-wellness-labs': 'ginto',
  beastmode: 'beastmode',
  'beastmode-performance-labs': 'beastmode',
  beastmodeperformancelabs: 'beastmode',
  anatolia: 'anatolia',
  anatoliawellness: 'anatolia',
  'anatolia-wellness-labs': 'anatolia',
  anatoliawellnesslabs: 'anatolia',
  turkiye: 'anatolia',
  glow: 'glow',
  glowsheerradiance: 'glow',
  'glow-sheer-radiance': 'glow',
  vanessacosio: 'glow',
  klow: 'klow',
  klowrecoveryradiance: 'klow',
  'klow-recovery-radiance': 'klow',
  türkiye: 'anatolia',
};

export function getWhiteLabelPortal(value?: string | null): WhiteLabelPortal | null {
  if (!value) return null;
  const key = normalizePortalKey(value);
  const id = PORTAL_ALIASES[key] ?? WHITE_LABEL_PORTALS.find((portal) => (
    normalizePortalKey(portal.id) === key ||
    normalizePortalKey(portal.path) === key ||
    normalizePortalKey(portal.repSlug) === key ||
    normalizePortalKey(portal.distributorSlug) === key ||
    normalizePortalKey(portal.brandName) === key
  ))?.id;

  return id ? WHITE_LABEL_PORTALS.find((portal) => portal.id === id) ?? null : null;
}

export function buildPortalLoginPath(portal: WhiteLabelPortal, portalRole: 'patient' | 'rep' | 'admin'): string {
  const brand = portal.id === 'klow' && portalRole !== 'patient' ? 'rockphorm' : portal.id;
  const params = new URLSearchParams({
    portal: portalRole,
    brand,
  });
  return `/login?${params.toString()}`;
}

export function buildPortalSignupPath(portal: WhiteLabelPortal): string {
  const params = new URLSearchParams({ brand: portal.id });
  return `/patient/signup?${params.toString()}`;
}

function normalizePortalKey(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\/[^/]+/i, '')
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}
