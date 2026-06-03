export type WhiteLabelPortalId = 'empire' | 'ehwsub' | 'aactivated' | 'warxlabz' | 'peakform' | 'alphapride' | 'optimax' | 'ronin' | 'agprime' | 'vyigenix';

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
    brandName: 'PepScriptRX',
    repName: 'PepScriptRX',
    repSlug: 'ELLIEBEYER',
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
    path: '/aactivated',
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
];

const PORTAL_ALIASES: Record<string, WhiteLabelPortalId> = {
  empire: 'empire',
  empirehealthwellness: 'empire',
  'empirehealth&wellness': 'empire',
  'empire-health-wellness': 'empire',
  mark: 'empire',
  mark65: 'empire',
  ehwsub: 'ehwsub',
  aactivated: 'aactivated',
  'aactivated-rx': 'aactivated',
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
  const params = new URLSearchParams({
    portal: portalRole,
    brand: portal.id,
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
