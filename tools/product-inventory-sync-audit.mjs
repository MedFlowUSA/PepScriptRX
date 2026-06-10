import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const OUT_DIR = resolve('qa-artifacts/product-inventory-sync');
const SUMMARY_PATH = resolve(OUT_DIR, 'summary.json');
const MISSING_FROM_INVENTORY_PATH = resolve(OUT_DIR, 'missing-from-inventory.json');
const MISSING_METADATA_PATH = resolve(OUT_DIR, 'missing-metadata.json');
const DUPLICATE_CANDIDATES_PATH = resolve(OUT_DIR, 'duplicate-candidates.json');
const DRY_RUN_SQL_PATH = resolve(OUT_DIR, 'dry-run-seed.sql');
const SEED_PLAN_SQL_PATH = resolve(OUT_DIR, 'seed-plan.sql');
const SOURCE_EXPORT_PATH = resolve(OUT_DIR, 'source-export.json');
const PAGE_SIZE = 1000;

mkdirSync(OUT_DIR, { recursive: true });

const env = loadEnv();
const supabaseUrl = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  env.SUPABASE_SERVICE_ROLE_KEY ||
  env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || (!serviceKey && !anonKey)) {
  throw new Error('Missing VITE_SUPABASE_URL and Supabase key. Provide SUPABASE_SERVICE_ROLE_KEY for full audit coverage.');
}

const key = serviceKey || anonKey;
const mode = serviceKey ? 'service_role_read_only' : 'anon_limited_read_only';
const supabase = createClient(supabaseUrl, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const tableErrors = [];
const limitations = [];

if (!serviceKey) {
  limitations.push('SUPABASE_SERVICE_ROLE_KEY was not provided. Product Intelligence and inventory reads may be blocked by RLS.');
}

let [
  productIntelligenceRows,
  productIntelligenceAliases,
  productIntelligenceVisibility,
  publicProducts,
  inventoryItems,
  rxPlusProducts,
  distributorProducts,
] = await Promise.all([
  fetchAllRows('product_intelligence_products'),
  fetchAllRows('product_intelligence_aliases'),
  fetchAllRows('product_intelligence_store_visibility'),
  fetchAllRows('products'),
  fetchAllRows('inventory_items'),
  fetchAllRows('rx_plus_products'),
  fetchAllRows('distributor_products'),
]);

if (productIntelligenceRows.length === 0) {
  const fallback = readProductIntelligenceSeedRows();
  if (fallback.length > 0) {
    limitations.push('Live product_intelligence_products rows were unavailable or empty; Product Intelligence rows were parsed from the local seed migration.');
    productIntelligenceRows = fallback;
  }
}

const localMetadataEntries = readLocalProductMetadataEntries();
const aliasesByProductKey = groupBy(productIntelligenceAliases, (row) => row.product_key);
const visibilityByProductKey = groupBy(productIntelligenceVisibility, (row) => row.product_key);
const distributorProductsByProductId = groupBy(distributorProducts, (row) => row.product_id);

const productIntelligence = productIntelligenceRows
  .map((row) => normalizeProductIntelligence(row, aliasesByProductKey.get(row.product_key) ?? [], visibilityByProductKey.get(row.product_key) ?? []))
  .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0) || a.productKey.localeCompare(b.productKey));

const publicProductRecords = publicProducts
  .map((row) => normalizePublicProduct(row))
  .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0) || a.id.localeCompare(b.id));

const inventoryRecords = inventoryItems
  .map((row) => normalizeInventoryItem(row))
  .sort((a, b) => a.sku.localeCompare(b.sku));

const rxPlusRecords = rxPlusProducts
  .map((row) => normalizeRxPlusProduct(row, distributorProductsByProductId.get(row.id) ?? []))
  .sort((a, b) => a.sku.localeCompare(b.sku));

const publicProductIndex = buildCandidateIndex(publicProductRecords, candidatesForPublicProduct);
const inventoryIndex = buildCandidateIndex(inventoryRecords, candidatesForInventoryItem);
const rxPlusIndex = buildCandidateIndex(rxPlusRecords, candidatesForRxPlusProduct);
const localMetadataIndex = buildCandidateIndex(localMetadataEntries, candidatesForLocalMetadata);
const productIntelligenceIndex = buildCandidateIndex(productIntelligence, candidatesForProductIntelligence);

const productIntelligenceAuditRows = productIntelligence.map((item) => {
  const publicMatches = findMatches(item, publicProductIndex, candidatesForProductIntelligence);
  const inventoryMatches = findMatches(item, inventoryIndex, candidatesForProductIntelligence);
  const rxPlusMatches = findMatches(item, rxPlusIndex, candidatesForProductIntelligence);
  const localMetadataMatches = findMatches(item, localMetadataIndex, candidatesForProductIntelligence);

  return {
    ...item,
    matchedPublicProducts: publicMatches.map((row) => pickPublicProduct(row)),
    matchedInventoryItems: inventoryMatches.map((row) => pickInventoryItem(row)),
    matchedRxPlusProducts: rxPlusMatches.map((row) => pickRxPlusProduct(row)),
    matchedLocalMetadata: localMetadataMatches.map((row) => pickLocalMetadata(row)),
  };
});

const missingFromPublicProducts = productIntelligenceAuditRows
  .filter((item) => item.matchedPublicProducts.length === 0)
  .map((item) => missingRecord(item, 'products'));

const missingFromInventoryItems = productIntelligenceAuditRows
  .filter((item) => item.matchedInventoryItems.length === 0)
  .map((item) => missingRecord(item, 'inventory_items'));

const missingFromBothMainSurfaces = productIntelligenceAuditRows
  .filter((item) => item.matchedPublicProducts.length === 0 && item.matchedInventoryItems.length === 0)
  .map((item) => missingRecord(item, 'products_and_inventory_items'));

const publicProductsMissingProductIntelligence = publicProductRecords
  .filter((item) => findMatches(item, productIntelligenceIndex, candidatesForPublicProduct).length === 0)
  .map((item) => ({
    source: 'products',
    id: item.id,
    displayName: item.displayName,
    strength: item.strength,
    category: item.category,
    defaultRetailPrice: item.defaultRetailPrice,
    activeStatus: item.activeStatus,
    customerVisible: item.customerVisible,
    sellable: item.sellable,
  }));

const inventoryItemsMissingProductIntelligence = inventoryRecords
  .filter((item) => findMatches(item, productIntelligenceIndex, candidatesForInventoryItem).length === 0)
  .map((item) => ({
    source: 'inventory_items',
    sku: item.sku,
    displayName: item.displayName,
    strength: item.strength,
    defaultRetailPrice: item.defaultRetailPrice,
    costPerUnit: item.costPerUnit,
    trueLandingCost: item.trueLandingCost,
    quantityOnHand: item.quantityOnHand,
    stockStatus: item.stockStatus,
    activeStatus: item.activeStatus,
  }));

const rxPlusProductsMissingProductIntelligence = rxPlusRecords
  .filter((item) => findMatches(item, productIntelligenceIndex, candidatesForRxPlusProduct).length === 0)
  .map((item) => ({
    source: 'rx_plus_products',
    id: item.id,
    sku: item.sku,
    displayName: item.displayName,
    strength: item.strength,
    category: item.category,
    defaultRetailPrice: item.defaultRetailPrice,
    activeStatus: item.activeStatus,
    storeAvailability: item.storeAvailability,
  }));

const localMetadataMissingProductIntelligence = localMetadataEntries
  .filter((item) => findMatches(item, productIntelligenceIndex, candidatesForLocalMetadata).length === 0)
  .map((item) => pickLocalMetadata(item));

const nameVariantMismatches = collectNameVariantMismatches(productIntelligenceAuditRows);
const duplicateCandidates = collectDuplicateCandidates({
  productIntelligence,
  publicProducts: publicProductRecords,
  inventoryItems: inventoryRecords,
  rxPlusProducts: rxPlusRecords,
});
const unclearVariantNames = collectUnclearVariantNames({
  productIntelligence,
  publicProducts: publicProductRecords,
  inventoryItems: inventoryRecords,
  rxPlusProducts: rxPlusRecords,
});

const missingFromInventory = {
  generatedAt: new Date().toISOString(),
  dryRunOnly: true,
  definitions: {
    missingFromPublicProducts: 'Product Intelligence item has no match in public.products, which powers Main Admin Products & Pricing.',
    missingFromInventoryItems: 'Product Intelligence item has no match in inventory_items, which powers Main Admin Inventory & Margins.',
    missingFromBothMainSurfaces: 'Product Intelligence item is absent from both Main Admin product manager and inventory manager.',
  },
  missingFromPublicProducts,
  missingFromInventoryItems,
  missingFromBothMainSurfaces,
};

const missingMetadata = {
  generatedAt: new Date().toISOString(),
  publicProductsMissingProductIntelligence,
  inventoryItemsMissingProductIntelligence,
  rxPlusProductsMissingProductIntelligence,
  localMetadataMissingProductIntelligence,
  nameVariantMismatches,
  unclearVariantNames,
};

const summary = {
  auditName: 'product-inventory-sync',
  generatedAt: new Date().toISOString(),
  mode,
  productionBase: 'https://pepscriptrx.vercel.app',
  safety: {
    readOnly: true,
    productionDataMutated: false,
    seedSqlExecuted: false,
    livePricingChanged: false,
    publicVisibilityChanged: false,
    checkoutOrCartChanged: false,
  },
  sourceOfTruth: {
    mainAdminProductManager: {
      table: 'public.products',
      adminPage: 'src/pages/admin/AdminProducts.tsx',
      publicVisibilityRule: "status in ('active','active_addon','manual_review','physician_review')",
    },
    mainAdminInventoryManager: {
      table: 'public.inventory_items',
      adminPage: 'src/pages/admin/AdminInventory.tsx',
      stockRule: 'current_qty > 0 and active = true means in stock; placeholders should use current_qty = 0 and active = false',
    },
    productIntelligence: {
      tables: [
        'public.product_intelligence_products',
        'public.product_intelligence_aliases',
        'public.product_intelligence_store_visibility',
      ],
      migration: 'supabase/migrations/20260609233000_product_intelligence_system.sql',
      localMetadataLayer: 'src/lib/productMetadata.ts',
    },
    storeSpecificCatalogs: {
      tables: ['public.rx_plus_products', 'public.distributor_products'],
      localSeed: 'src/data/rxPlus.ts',
      note: 'Dry-run placeholders are not mapped to distributor_products and are not forced onto storefronts.',
    },
  },
  counts: {
    productIntelligenceProducts: productIntelligence.length,
    localProductMetadataEntries: localMetadataEntries.length,
    mainAdminPublicProducts: publicProductRecords.length,
    mainAdminInventoryItems: inventoryRecords.length,
    rxPlusProducts: rxPlusRecords.length,
    distributorProductMappings: distributorProducts.length,
    missingFromPublicProducts: missingFromPublicProducts.length,
    missingFromInventoryItems: missingFromInventoryItems.length,
    missingFromBothMainSurfaces: missingFromBothMainSurfaces.length,
    publicProductsMissingProductIntelligence: publicProductsMissingProductIntelligence.length,
    inventoryItemsMissingProductIntelligence: inventoryItemsMissingProductIntelligence.length,
    rxPlusProductsMissingProductIntelligence: rxPlusProductsMissingProductIntelligence.length,
    localMetadataMissingProductIntelligence: localMetadataMissingProductIntelligence.length,
    duplicateCandidateGroups: duplicateCandidates.length,
    unclearVariantNames: unclearVariantNames.length,
    nameVariantMismatches: nameVariantMismatches.length,
  },
  tableErrors,
  limitations,
  artifactPaths: {
    summary: relativePath(SUMMARY_PATH),
    missingFromInventory: relativePath(MISSING_FROM_INVENTORY_PATH),
    missingMetadata: relativePath(MISSING_METADATA_PATH),
    duplicateCandidates: relativePath(DUPLICATE_CANDIDATES_PATH),
    dryRunSeedSql: relativePath(DRY_RUN_SQL_PATH),
    seedPlanSql: relativePath(SEED_PLAN_SQL_PATH),
    sourceExport: relativePath(SOURCE_EXPORT_PATH),
  },
};

writeJson(SUMMARY_PATH, summary);
writeJson(MISSING_FROM_INVENTORY_PATH, missingFromInventory);
writeJson(MISSING_METADATA_PATH, missingMetadata);
writeJson(DUPLICATE_CANDIDATES_PATH, {
  generatedAt: new Date().toISOString(),
  duplicateCandidates,
  unclearVariantNames,
});
writeJson(SOURCE_EXPORT_PATH, {
  generatedAt: new Date().toISOString(),
  productIntelligence: productIntelligenceAuditRows,
  mainAdminPublicProducts: publicProductRecords,
  mainAdminInventoryItems: inventoryRecords,
  rxPlusProducts: rxPlusRecords,
});
const dryRunSeedSql = buildDryRunSeedSql(missingFromPublicProducts, missingFromInventoryItems);
writeFileSync(DRY_RUN_SQL_PATH, dryRunSeedSql, 'utf8');
writeFileSync(SEED_PLAN_SQL_PATH, dryRunSeedSql, 'utf8');

console.log(JSON.stringify(summary, null, 2));

async function fetchAllRows(table, select = '*') {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase.from(table).select(select).range(from, to);
    if (error) {
      tableErrors.push({ table, message: error.message });
      return rows;
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

function normalizeProductIntelligence(row, aliases, visibility) {
  return {
    source: 'product_intelligence_products',
    productKey: row.product_key,
    sku: row.sku,
    displayName: row.product_name,
    technicalName: row.scientific_name ?? '',
    akaNames: aliases.map((alias) => alias.alias).filter(Boolean).sort(),
    strength: normalizeStrength(row.strength),
    category: row.category,
    description: row.description ?? '',
    typicalUseCase: row.typical_use_case ?? '',
    components: row.components ?? [],
    defaultRetailPrice: numberOrNull(row.current_retail_price),
    supplierBoxCost: numberOrNull(row.supplier_box_cost),
    costPerUnit: numberOrNull(row.cost_per_unit),
    trueLandingCost: numberOrNull(row.true_landing_cost),
    activeStatus: row.active_status,
    sortOrder: row.sort_order,
    customerVisible: visibility.some((item) => item.visible),
    storeAvailability: visibility
      .map((item) => ({
        storeKey: item.store_key,
        storeName: item.store_name,
        visible: Boolean(item.visible),
        source: item.source,
      }))
      .sort((a, b) => a.storeKey.localeCompare(b.storeKey)),
  };
}

function normalizePublicProduct(row) {
  const customerVisible = ['active', 'active_addon', 'manual_review', 'physician_review'].includes(row.status);
  return {
    source: 'products',
    id: row.id,
    displayName: row.name,
    technicalName: '',
    akaNames: [],
    strength: extractStrength(row.name),
    category: row.category,
    defaultRetailPrice: numberOrNull(row.price),
    activeStatus: row.status,
    customerVisible,
    sellable: customerVisible,
    productType: row.product_type ?? '',
    displayNote: row.display_note ?? '',
    sortOrder: row.sort_order,
  };
}

function normalizeInventoryItem(row) {
  const quantityOnHand = Number(row.current_qty ?? 0);
  const active = Boolean(row.active);
  return {
    source: 'inventory_items',
    id: row.id,
    sku: row.sku,
    displayName: row.product_name,
    technicalName: '',
    akaNames: [],
    strength: normalizeStrength(row.strength),
    category: '',
    defaultRetailPrice: numberOrNull(row.retail_price),
    costPerUnit: numberOrNull(row.base_cost_per_vial),
    trueLandingCost: numberOrNull(row.true_landed_cost_per_vial),
    quantityOnHand,
    stockStatus: active && quantityOnHand > 0 ? 'in_stock' : 'out_of_stock',
    activeStatus: active ? 'active' : 'inactive',
    adminManageable: true,
    sellable: active && quantityOnHand > 0,
    notes: row.notes ?? '',
  };
}

function normalizeRxPlusProduct(row, mappings) {
  return {
    source: 'rx_plus_products',
    id: row.id,
    sku: row.sku,
    displayName: row.product_name,
    technicalName: '',
    akaNames: [],
    strength: normalizeStrength(row.strength),
    category: row.category,
    description: row.description ?? '',
    defaultRetailPrice: numberOrNull(row.suggested_retail_price),
    costPerUnit: numberOrNull(row.base_cost),
    activeStatus: row.active ? 'active' : 'inactive',
    customerVisible: Boolean(row.active),
    visibilityType: row.visibility_type,
    storeAvailability: mappings.map((mapping) => ({
      distributorId: mapping.distributor_id,
      enabled: Boolean(mapping.is_enabled),
      featured: Boolean(mapping.featured),
      customPrice: numberOrNull(mapping.custom_price),
      commissionRate: numberOrNull(mapping.commission_rate),
    })),
  };
}

function readLocalProductMetadataEntries() {
  const path = resolve('src/lib/productMetadata.ts');
  const source = readFileSync(path, 'utf8');
  const entries = [];
  const entryPattern = /product\(\[(?<keys>[\s\S]*?)\],\s*'(?<common>(?:\\'|[^'])*)',\s*'(?<technical>(?:\\'|[^'])*)',\s*'(?<dose>(?:\\'|[^'])*)'\)/g;
  for (const match of source.matchAll(entryPattern)) {
    const keys = Array.from(match.groups.keys.matchAll(/'((?:\\'|[^'])*)'/g)).map((keyMatch) => unescapeSql(keyMatch[1]));
    entries.push({
      source: 'src/lib/productMetadata.ts',
      keys,
      displayName: unescapeSql(match.groups.common),
      technicalName: unescapeSql(match.groups.technical),
      strength: normalizeStrength(unescapeSql(match.groups.dose)),
      akaNames: keys,
    });
  }
  return entries;
}

function readProductIntelligenceSeedRows() {
  const path = resolve('supabase/migrations/20260609233000_product_intelligence_system.sql');
  if (!existsSync(path)) return [];
  const source = readFileSync(path, 'utf8');
  const seedStart = source.indexOf('with seed(');
  const insertStart = source.indexOf('insert into public.product_intelligence_products', seedStart);
  if (seedStart === -1 || insertStart === -1) return [];
  const seedBlock = source.slice(seedStart, insertStart);
  const rows = [];
  for (const line of seedBlock.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('(')) continue;
    const tuple = trimmed.replace(/^\(/, '').replace(/\),?$/, '');
    const values = splitSqlTuple(tuple).map(parseSqlValue);
    if (values.length < 14) continue;
    const [
      product_key,
      product_name,
      scientific_name,
      sku,
      category,
      strength,
      units_per_box,
      supplier_box_cost,
      current_retail_price,
      active_status,
      description,
      typical_use_case,
      components,
      sort_order,
    ] = values;
    rows.push({
      product_key,
      product_name,
      scientific_name,
      sku,
      category,
      strength,
      units_per_box,
      supplier_box_cost,
      cost_per_unit: supplier_box_cost === null ? null : roundMoney(Number(supplier_box_cost) / Number(units_per_box || 1)),
      true_landing_cost: supplier_box_cost === null ? null : roundMoney((Number(supplier_box_cost) / Number(units_per_box || 1)) * 1.15),
      current_retail_price,
      active_status,
      description,
      typical_use_case,
      components,
      sort_order,
    });
  }
  return rows;
}

function splitSqlTuple(tuple) {
  const parts = [];
  let current = '';
  let inString = false;
  let braceDepth = 0;
  for (let index = 0; index < tuple.length; index += 1) {
    const char = tuple[index];
    const next = tuple[index + 1];
    if (char === "'" && inString && next === "'") {
      current += "''";
      index += 1;
      continue;
    }
    if (char === "'") inString = !inString;
    if (!inString && char === '{') braceDepth += 1;
    if (!inString && char === '}') braceDepth = Math.max(0, braceDepth - 1);
    if (char === ',' && !inString && braceDepth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function parseSqlValue(value) {
  const trimmed = value.trim();
  if (/^null$/i.test(trimmed)) return null;
  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    const inner = trimmed.slice(1, -1).replace(/''/g, "'");
    if (inner.startsWith('{') && inner.endsWith('}')) {
      const body = inner.slice(1, -1);
      if (!body) return [];
      return body.split(',').map((part) => part.replace(/^"|"$/g, ''));
    }
    return inner;
  }
  const number = Number(trimmed);
  return Number.isFinite(number) ? number : trimmed;
}

function candidatesForProductIntelligence(item) {
  const includeBare = shouldIncludeBareName(item.strength);
  return unique([
    item.productKey,
    item.sku,
    withStrength(item.displayName, item.strength),
    withStrength(item.technicalName, item.strength),
    includeBare ? item.displayName : '',
    includeBare ? item.technicalName : '',
    ...item.akaNames.map((alias) => (includeBare ? alias : '')),
    ...item.akaNames.map((alias) => withStrength(alias, item.strength)),
    ...item.components,
  ]);
}

function candidatesForPublicProduct(item) {
  const includeBare = shouldIncludeBareName(item.strength);
  return unique([
    item.id,
    item.displayName,
    stripVialSuffix(item.displayName),
    withStrength(stripDoseFromName(item.displayName), item.strength),
    includeBare ? stripDoseFromName(item.displayName) : '',
  ]);
}

function candidatesForInventoryItem(item) {
  const includeBare = shouldIncludeBareName(item.strength);
  return unique([
    item.sku,
    item.displayName,
    withStrength(item.displayName, item.strength),
    includeBare ? stripDoseFromName(item.displayName) : '',
  ]);
}

function candidatesForRxPlusProduct(item) {
  const includeBare = shouldIncludeBareName(item.strength);
  return unique([
    item.id,
    item.sku,
    item.displayName,
    withStrength(item.displayName, item.strength),
    includeBare ? stripDoseFromName(item.displayName) : '',
  ]);
}

function candidatesForLocalMetadata(item) {
  const includeBare = shouldIncludeBareName(item.strength);
  return unique([
    ...item.keys,
    includeBare ? item.displayName : '',
    includeBare ? item.technicalName : '',
    withStrength(item.displayName, item.strength),
    withStrength(item.technicalName, item.strength),
  ]);
}

function shouldIncludeBareName(strength) {
  const normalized = normalizeStrength(strength);
  return !normalized || ['Standard', 'Blend', 'Kit'].includes(normalized);
}

function buildCandidateIndex(rows, candidateFactory) {
  const map = new Map();
  for (const row of rows) {
    for (const candidate of candidateFactory(row)) {
      const key = normalizeKey(candidate);
      if (!key) continue;
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(row);
    }
  }
  return map;
}

function findMatches(item, index, candidateFactory) {
  const matches = new Map();
  for (const candidate of candidateFactory(item)) {
    const key = normalizeKey(candidate);
    if (!key) continue;
    for (const match of index.get(key) ?? []) {
      const id = match.productKey ?? match.id ?? match.sku ?? `${match.displayName}-${match.strength}`;
      matches.set(`${match.source}:${id}`, match);
    }
  }
  return Array.from(matches.values());
}

function missingRecord(item, missingSurface) {
  return {
    missingSurface,
    productKey: item.productKey,
    sku: item.sku,
    displayName: item.displayName,
    technicalName: item.technicalName,
    akaNames: item.akaNames,
    strength: item.strength,
    category: item.category,
    defaultRetailPrice: item.defaultRetailPrice,
    costPerUnit: item.costPerUnit,
    trueLandingCost: item.trueLandingCost,
    activeStatus: item.activeStatus,
    customerVisible: false,
    adminManageable: true,
    sellable: false,
    recommendedSafeDefaults: {
      quantity_on_hand: 0,
      stock_status: 'out_of_stock',
      product_status: 'inactive',
      inventory_active: false,
      customer_visible: false,
      admin_manageable: true,
      sellable: false,
    },
    storeAvailability: item.storeAvailability,
  };
}

function pickPublicProduct(row) {
  return {
    id: row.id,
    displayName: row.displayName,
    strength: row.strength,
    category: row.category,
    defaultRetailPrice: row.defaultRetailPrice,
    activeStatus: row.activeStatus,
    customerVisible: row.customerVisible,
    sellable: row.sellable,
  };
}

function pickInventoryItem(row) {
  return {
    sku: row.sku,
    displayName: row.displayName,
    strength: row.strength,
    defaultRetailPrice: row.defaultRetailPrice,
    quantityOnHand: row.quantityOnHand,
    stockStatus: row.stockStatus,
    activeStatus: row.activeStatus,
    sellable: row.sellable,
  };
}

function pickRxPlusProduct(row) {
  return {
    id: row.id,
    sku: row.sku,
    displayName: row.displayName,
    strength: row.strength,
    category: row.category,
    defaultRetailPrice: row.defaultRetailPrice,
    activeStatus: row.activeStatus,
    visibilityType: row.visibilityType,
  };
}

function pickLocalMetadata(row) {
  return {
    keys: row.keys,
    displayName: row.displayName,
    technicalName: row.technicalName,
    strength: row.strength,
  };
}

function collectNameVariantMismatches(rows) {
  const mismatches = [];
  for (const item of rows) {
    for (const product of item.matchedPublicProducts) {
      pushMismatch(mismatches, item, product, 'products');
    }
    for (const inventory of item.matchedInventoryItems) {
      pushMismatch(mismatches, item, inventory, 'inventory_items');
    }
    for (const rxPlus of item.matchedRxPlusProducts) {
      pushMismatch(mismatches, item, rxPlus, 'rx_plus_products');
    }
  }
  return mismatches;
}

function pushMismatch(mismatches, item, match, source) {
  const issues = [];
  if (item.strength && match.strength && normalizeStrength(item.strength) !== normalizeStrength(match.strength)) {
    issues.push({ field: 'strength', productIntelligence: item.strength, matchedValue: match.strength });
  }
  if (item.category && match.category && normalizeLoose(item.category) !== normalizeLoose(match.category)) {
    issues.push({ field: 'category', productIntelligence: item.category, matchedValue: match.category });
  }
  if (issues.length === 0) return;
  mismatches.push({
    productKey: item.productKey,
    displayName: item.displayName,
    matchedSource: source,
    matchedId: match.id ?? match.sku,
    matchedDisplayName: match.displayName,
    issues,
  });
}

function collectDuplicateCandidates(sources) {
  const allRows = Object.entries(sources).flatMap(([sourceName, rows]) =>
    rows.map((row) => ({
      sourceName,
      id: row.productKey ?? row.id ?? row.sku,
      sku: row.sku ?? null,
      displayName: row.displayName,
      strength: row.strength,
      category: row.category ?? '',
      defaultRetailPrice: row.defaultRetailPrice ?? null,
      activeStatus: row.activeStatus ?? null,
    })),
  );
  const groups = groupBy(allRows, (row) => normalizeKey(withStrength(stripDoseFromName(row.displayName), row.strength || extractStrength(row.displayName))));
  return Array.from(groups.entries())
    .filter(([key, rows]) => key && rows.length > 1)
    .map(([key, rows]) => ({ normalizedVariantKey: key, rows }))
    .sort((a, b) => b.rows.length - a.rows.length || a.normalizedVariantKey.localeCompare(b.normalizedVariantKey));
}

function collectUnclearVariantNames(sources) {
  return Object.entries(sources).flatMap(([sourceName, rows]) =>
    rows
      .filter((row) => {
        const name = row.displayName ?? '';
        const strength = normalizeStrength(row.strength) || extractStrength(name);
        const needsStrength = /(tirzepatide|semaglutide|retatrutide|bpc|tb-?500|nad|hgh|tesamorelin|aod|glutathione|ghk|mots|igf)/i.test(name);
        return needsStrength && (!strength || strength === 'Standard');
      })
      .map((row) => ({
        sourceName,
        id: row.productKey ?? row.id ?? row.sku,
        sku: row.sku ?? null,
        displayName: row.displayName,
        strength: row.strength,
        issue: 'Strength appears missing or generic for a variant-sensitive product.',
      })),
  );
}

function buildDryRunSeedSql(missingProducts, missingInventory) {
  const lines = [
    '-- Dry-run only. Do not execute until reviewed.',
    '-- Purpose: seed inactive/out-of-stock Main Admin placeholders from Product Intelligence.',
    '-- Safe defaults: products.status = inactive; inventory_items.current_qty = 0; inventory_items.active = false.',
    '-- Store-specific distributor mappings are intentionally not inserted here.',
    '',
    'begin;',
    '',
  ];

  if (missingProducts.length > 0) {
    lines.push('insert into public.products (');
    lines.push('  id, name, price, category, status, product_type, requires_prescription_upload,');
    lines.push('  requires_receipt_upload, requires_dob, requires_physician_review, display_note, sort_order');
    lines.push(') values');
    lines.push(missingProducts.map((item, index) => {
      const comma = index === missingProducts.length - 1 ? '' : ',';
      const productType = productTypeForCategory(item.category);
      return `  (${sqlString(item.productKey)}, ${sqlString(displayLabel(item))}, ${sqlNumber(item.defaultRetailPrice ?? 0)}, ${sqlString(item.category)}, 'inactive', ${sqlString(productType)}, false, false, ${productType === 'supply' || productType === 'accessory' ? 'false' : 'true'}, false, ${sqlString(seedNote(item))}, ${sqlNumber(sortOrderForSeed(index))})${comma}`;
    }).join('\n'));
    lines.push('on conflict (id) do nothing;');
    lines.push('');
  }

  if (missingInventory.length > 0) {
    lines.push('insert into public.inventory_items (');
    lines.push('  sku, product_name, strength, starting_qty, current_qty, base_total_cost,');
    lines.push('  base_cost_per_vial, allocated_shipping_per_vial, allocated_label_per_vial,');
    lines.push('  true_landed_cost_per_vial, retail_price, reorder_level, active, notes');
    lines.push(') values');
    lines.push(missingInventory.map((item, index) => {
      const comma = index === missingInventory.length - 1 ? '' : ',';
      return `  (${sqlString(item.sku || fallbackSku(item))}, ${sqlString(item.displayName)}, ${sqlString(item.strength || null)}, 0, 0, 0, 0, 0, 0, 0, ${sqlNullableNumber(item.defaultRetailPrice)}, 3, false, ${sqlString(seedNote(item))})${comma}`;
    }).join('\n'));
    lines.push('on conflict (sku) do nothing;');
    lines.push('');
  }

  lines.push('rollback;');
  lines.push('');
  return lines.join('\n');
}

function displayLabel(item) {
  const strength = normalizeStrength(item.strength);
  if (!strength || strength === 'Standard') return item.displayName;
  if (normalizeKey(item.displayName).includes(normalizeKey(strength))) return item.displayName;
  return `${item.displayName} ${strength} Vial`;
}

function productTypeForCategory(category) {
  const normalized = normalizeLoose(category);
  if (/reagent|functional|supply|water|kit/.test(normalized)) return 'supply';
  return 'manual_review';
}

function seedNote(item) {
  return `Seeded from Product Intelligence audit as inactive/out-of-stock placeholder. Product key: ${item.productKey}.`;
}

function fallbackSku(item) {
  return `PI-${String(item.productKey ?? item.displayName).toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48)}`;
}

function sortOrderForSeed(index) {
  return 10000 + index;
}

function withStrength(name, strength) {
  const cleanName = String(name ?? '').trim();
  const cleanStrength = normalizeStrength(strength);
  if (!cleanName) return '';
  if (!cleanStrength || cleanStrength === 'Standard') return cleanName;
  if (normalizeKey(cleanName).includes(normalizeKey(cleanStrength))) return cleanName;
  return `${cleanName} ${cleanStrength}`;
}

function extractStrength(value) {
  const text = String(value ?? '');
  const blend = text.match(/\bblend\b/i);
  if (blend) return 'Blend';
  const kit = text.match(/\bkit\b/i);
  if (kit) return 'Kit';
  const iu = text.match(/\b(\d+(?:,\d{3})?)\s*iu\b/i);
  if (iu) return `${iu[1]} IU`;
  const ml = text.match(/\b(\d+(?:\.\d+)?)\s*ml\b/i);
  if (ml) return `${ml[1]}ml`;
  const mg = text.match(/\b(\d+(?:,\d{3})?(?:\.\d+)?)\s*mg\b/i);
  if (mg) return `${mg[1]}mg`;
  return '';
}

function normalizeStrength(value) {
  const clean = String(value ?? '').trim();
  if (!clean) return '';
  if (/^standard$/i.test(clean)) return 'Standard';
  if (/^blend$/i.test(clean)) return 'Blend';
  if (/^(kit|supply)$/i.test(clean)) return 'Kit';
  const iu = clean.match(/^(\d+(?:,\d{3})?)\s*iu$/i);
  if (iu) return `${iu[1]} IU`;
  const ml = clean.match(/^(\d+(?:\.\d+)?)\s*ml$/i);
  if (ml) return `${ml[1]}ml`;
  const mg = clean.match(/^(\d+(?:,\d{3})?(?:\.\d+)?)\s*mg$/i);
  if (mg) return `${mg[1]}mg`;
  return clean;
}

function stripVialSuffix(value) {
  return String(value ?? '').replace(/\s+vials?\b/i, '').trim();
}

function stripDoseFromName(value) {
  return stripVialSuffix(value)
    .replace(/\b\d+(?:,\d{3})?(?:\.\d+)?\s*(mg|iu|ml)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/vial\b/g, '')
    .replace(/\bpack\b/g, '')
    .replace(/\bsyringe\b/g, '')
    .replace(/\+\s*/g, '+')
    .replace(/\band\b/g, '+')
    .replace(/[^a-z0-9+]+/g, '');
}

function normalizeLoose(value) {
  return String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function unique(values) {
  return Array.from(new Set(values.map((value) => String(value ?? '').trim()).filter(Boolean)));
}

function groupBy(items, keyFactory) {
  const map = new Map();
  for (const item of items) {
    const key = keyFactory(item);
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  }
  return map;
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function relativePath(path) {
  return path.replace(`${process.cwd()}\\`, '').replace(`${process.cwd()}/`, '').replace(/\\/g, '/');
}

function sqlString(value) {
  if (value === null || value === undefined) return 'null';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function sqlNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? String(number) : '0';
}

function sqlNullableNumber(value) {
  if (value === null || value === undefined || value === '') return 'null';
  return sqlNumber(value);
}

function unescapeSql(value) {
  return String(value ?? '').replace(/\\'/g, "'");
}

function loadEnv() {
  const files = ['.env', '.env.local'];
  const values = {};
  for (const file of files) {
    const path = resolve(file);
    if (!existsSync(path)) continue;
    const contents = readFileSync(path, 'utf8');
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim().replace(/^\uFEFF/, '');
      if (!trimmed || trimmed.startsWith('#')) continue;
      const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) continue;
      const [, key, raw] = match;
      const value = raw.trim().replace(/^['"]|['"]$/g, '');
      if (value || values[key] === undefined) values[key] = value;
    }
  }
  return values;
}

function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}
