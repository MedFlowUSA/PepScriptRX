import type { PatientSubmission, Rep } from '../types';

export type StorefrontKey =
  | 'main'
  | 'aactivated'
  | 'empire'
  | 'rockphorm'
  | 'klow'
  | 'aurora'
  | 'physiopeptides'
  | 'optimax'
  | 'anatolia'
  | 'glow'
  | 'ginto'
  | 'vitality'
  | 'longevity-wellness'
  | 'beastmode'
  | 'viltrumpeptide'
  | 'paulrevere'
  | 'agprimelab'
  | 'alphapride'
  | 'peakform'
  | 'ronin'
  | 'vyigenix'
  | 'warxlabz'
  | 'zenora';

export type StorefrontFilter = '' | StorefrontKey;

export type StorefrontOption = {
  value: StorefrontFilter;
  label: string;
};

type StoreDefinition = {
  key: StorefrontKey;
  label: string;
  aliases: string[];
};

const STORE_DEFINITIONS: StoreDefinition[] = [
  {
    key: 'aactivated',
    label: 'AACTIVATED-RX',
    aliases: ['aactivated', 'aactivatedrx', 'vitalityins', 'guy60', 'bossiquit'],
  },
  {
    key: 'empire',
    label: 'Empire Health & Wellness',
    aliases: ['empire', 'empire health', 'ehwsub', 'mark65'],
  },
  {
    key: 'klow',
    label: 'KLOW Recovery + Radiance',
    aliases: ['klow', 'klow recovery'],
  },
  {
    key: 'aurora',
    label: 'Aurora Labs',
    aliases: ['aurora', 'aurora labs', 'mikeaurora'],
  },
  {
    key: 'physiopeptides',
    label: 'PhysioPeptides',
    aliases: ['physiopeptides', 'physio peptides'],
  },
  {
    key: 'optimax',
    label: 'Optimax Peptide Therapy',
    aliases: ['optimax', 'optimax peptide therapy', 'gabe50'],
  },
  {
    key: 'rockphorm',
    label: 'Rock Phorm',
    aliases: ['rockphorm', 'rock phorm', 'rick50'],
  },
  {
    key: 'anatolia',
    label: 'Anatolia Wellness Labs',
    aliases: ['anatolia', 'anatolia wellness labs'],
  },
  {
    key: 'glow',
    label: 'GLOW Sheer Radiance',
    aliases: ['glow', 'glow sheer radiance', 'glow&save25'],
  },
  {
    key: 'ginto',
    label: 'Ginto Wellness Labs',
    aliases: ['ginto', 'ginto wellness'],
  },
  {
    key: 'vitality',
    label: 'Vitality Institute Labs',
    aliases: ['vitality', 'vitality institute labs'],
  },
  {
    key: 'longevity-wellness',
    label: 'Longevity Wellness',
    aliases: ['longevity-wellness', 'longevity wellness', 'cynthia50', 'cynthia hunter'],
  },
  {
    key: 'beastmode',
    label: 'BEASTMODE Performance Labs',
    aliases: ['beastmode', 'beastmode performance labs'],
  },
  {
    key: 'viltrumpeptide',
    label: 'Viltrum Peptide',
    aliases: ['viltrumpeptide', 'viltrum peptide', 'viltrum', 'dean50'],
  },
  {
    key: 'paulrevere',
    label: 'Paul Revere Peptides',
    aliases: ['paulrevere', 'paul revere'],
  },
  {
    key: 'agprimelab',
    label: 'AG Prime Lab',
    aliases: ['agprimelab', 'ag prime lab', 'angel gallardo'],
  },
  {
    key: 'alphapride',
    label: 'Alpha Pride',
    aliases: ['alphapride', 'alpha pride'],
  },
  {
    key: 'peakform',
    label: 'PeakForm',
    aliases: ['peakform', 'peak form'],
  },
  {
    key: 'ronin',
    label: 'Ronin',
    aliases: ['ronin'],
  },
  {
    key: 'vyigenix',
    label: 'VYIgenix',
    aliases: ['vyigenix', 'vyi genix'],
  },
  {
    key: 'warxlabz',
    label: 'WarXLabz',
    aliases: ['warxlabz', 'war x labz', 'warx'],
  },
  {
    key: 'zenora',
    label: 'Zenora',
    aliases: ['zenora'],
  },
];

export const STOREFRONT_FILTERS: StorefrontOption[] = [
  { value: '', label: 'All storefronts' },
  { value: 'main', label: 'Main PepScriptRX' },
  ...STORE_DEFINITIONS.map(({ key, label }) => ({ value: key, label })),
];

const STORE_BY_KEY = new Map<StorefrontKey, StoreDefinition>([
  ['main', { key: 'main', label: 'Main PepScriptRX', aliases: ['main', 'pepscriptrx'] }],
  ...STORE_DEFINITIONS.map((definition) => [definition.key, definition] as const),
]);

export function getSubmissionStorefrontKey(submission: Partial<PatientSubmission>): StorefrontKey {
  const tokens = submissionTokens(submission);
  const matched = STORE_DEFINITIONS.find((definition) => (
    definition.aliases.some((alias) => tokens.some((token) => tokenMatchesAlias(token, alias)))
  ));

  return matched?.key ?? 'main';
}

export function getSubmissionStorefrontLabel(submission: Partial<PatientSubmission>): string {
  return getStorefrontLabel(getSubmissionStorefrontKey(submission));
}

export function getStorefrontLabel(key: StorefrontFilter): string {
  if (!key) return 'All storefronts';
  return STORE_BY_KEY.get(key)?.label ?? 'Main PepScriptRX';
}

export function matchesStorefront(submission: Partial<PatientSubmission>, storefrontFilter: StorefrontFilter): boolean {
  if (!storefrontFilter) return true;
  return getSubmissionStorefrontKey(submission) === storefrontFilter;
}

function submissionTokens(submission: Partial<PatientSubmission>): string[] {
  const rep = submission.rep as Partial<Rep> | undefined;
  return [
    submission.brand_id,
    submission.store_slug,
    submission.store_name,
    submission.source_portal,
    submission.source_route,
    submission.source_store,
    submission.checkout_scope_code,
    submission.checkout_scope_id,
    submission.referral_code,
    submission.discount_code,
    submission.admin_code,
    submission.source_admin,
    submission.source_rep,
    submission.parent_type,
    submission.account_type,
    submission.commission_owner,
    rep?.rep_slug,
    rep?.brand_name,
    rep?.custom_store_slug,
    rep?.brand_id,
    rep?.parent_brand_id,
    rep?.assigned_store_slug,
    rep?.rep_channel,
    rep?.rep_tier,
  ].map(normalizeToken).filter(Boolean);
}

function normalizeToken(value?: string | number | null): string {
  return String(value ?? '').trim().toLowerCase();
}

function tokenMatchesAlias(token: string, alias: string): boolean {
  const normalizedAlias = normalizeToken(alias);
  return token === normalizedAlias || token.includes(normalizedAlias);
}
