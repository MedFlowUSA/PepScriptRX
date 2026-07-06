const STORE_PREFIXES = [
  'agprime',
  'alpha',
  'anatolia',
  'aurora',
  'ginto',
  'glow',
  'mark',
  'optimax',
  'physiopeptides',
  'robert',
  'rockphorm',
  'ronin',
  'scott',
  'vyigenix',
  'zenora',
  'guy',
  'ehwsub',
  'dist',
];

const SUPPLY_TERMS = ['bac-water', 'syringe', 'pen-kit', 'kit', 'pack'];

export function mixingCenterPath(product?: { id?: string | null; product_name?: string | null; name?: string | null; strength?: string | null } | null) {
  const slug = product ? mixingProductSlug(product) : '';
  return slug ? `/mixing/${slug}` : '/mixing';
}

export function scopedMixingCenterPath(
  product: { id?: string | null; product_name?: string | null; name?: string | null; strength?: string | null } | null | undefined,
  portalPath?: string | null,
) {
  const path = mixingCenterPath(product);
  if (!portalPath) return path;
  return path.replace(/^\/mixing/, `${portalPath.replace(/\/+$/, '')}/mixing`);
}

export function mixingProductSlug(product: { id?: string | null; product_name?: string | null; name?: string | null; strength?: string | null }) {
  const rawId = normalizeSlug(product.id ?? '');
  if (rawId && !SUPPLY_TERMS.some((term) => rawId.includes(term))) {
    return stripStorePrefixes(rawId).replace(/mg\b/g, '');
  }

  const name = normalizeSlug(product.product_name ?? product.name ?? '');
  const strength = normalizeSlug(product.strength ?? '');
  if (!name || SUPPLY_TERMS.some((term) => name.includes(term))) return '';
  if (!strength || strength === 'standard' || strength === 'blend') return name;
  return `${name}-${strength}`.replace(/mg\b/g, '');
}

function stripStorePrefixes(value: string) {
  let next = value;
  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of STORE_PREFIXES) {
      if (next.startsWith(`${prefix}-`)) {
        next = next.slice(prefix.length + 1);
        changed = true;
      }
    }
  }
  return next;
}

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .replace(/\+/g, ' plus ')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-');
}
