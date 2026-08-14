import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import DashLayout from '../../components/layout/DashLayout';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  AACTIVATED_ADMIN_REP_CODE,
  AACTIVATED_PARENT_STORE_NAME,
  AACTIVATED_PARENT_STORE_SLUG,
  AACTIVATED_PARTNER_ADMIN_EMAIL,
  AACTIVATED_PARTNER_ADMIN_NAME,
  AACTIVATED_SOURCE_PORTAL,
  intakeApprovalStatus,
  isAactivatedIntake,
  isAactivatedOrder,
  isAactivatedPartnerAdmin,
  isAactivatedRep,
  isPlatformAdminRole,
} from '../../lib/aactivatedScope';
import type { CommissionLedger, PatientSubmission, Rep, RepStoreIntakeSubmission, RepStoreIntakeStatus } from '../../types';
import { ADMIN_NAV, RX_PLUS_ADMIN_NAV } from './adminNav';
import { getDistributorProducts } from '../../data/rxPlus';
import type { DistributorCatalogProduct } from '../../data/rxPlus';

type ToolMode =
  | 'dashboard'
  | 'commission'
  | 'leaderboard'
  | 'customer'
  | 'product'
  | 'store-settings'
  | 'pricing'
  | 'rep-store-manager'
  | 'product-lists'
  | 'feature-requests'
  | 'payouts'
  | 'scope-codes'
  | 'payment-audit'
  | 'zelle';

type Props = {
  mode: ToolMode;
};

type StoreSettingsDraft = {
  logoSrc: string;
  heroImage: string;
  supportContact: string;
  description: string;
  promoBanner: string;
  socialLinks: string;
};

type AactivatedPriceRow = {
  id?: string;
  product_id: string;
  product_name: string | null;
  retail_price: number;
  sale_price: number | null;
  is_active: boolean;
  featured: boolean;
  sort_order: number | null;
  product_note: string | null;
  bundle_group_key: string | null;
  bundle_group_name: string | null;
  bundle_discount_percent: number | null;
  bundle_discount_amount: number | null;
  bundle_note: string | null;
  updated_by: string | null;
  updated_at: string;
};

type PriceDraft = {
  retail_price: string;
  sale_price: string;
  is_active: boolean;
  featured: boolean;
  sort_order: string;
  product_note: string;
  bundle_group_key: string;
  bundle_group_name: string;
  bundle_discount_percent: string;
  bundle_discount_amount: string;
  bundle_note: string;
};

type PartnerCommissionSetting = {
  id?: string;
  store_scope: string;
  partner_admin_id: string | null;
  partner_admin_email: string;
  rep_id: string | null;
  rep_email: string | null;
  commission_type: string;
  commission_percent: number;
  tier_config: unknown[];
  override_percent: number | null;
  special_note: string | null;
  approval_required: boolean;
  approval_status: string;
  internal_notes: string | null;
  updated_at: string;
};

type PartnerProductList = {
  id: string;
  store_scope: string;
  list_name: string;
  list_type: string;
  default_pricing_mode: string;
  notes: string | null;
  status: string;
  updated_at: string;
};

type PartnerProductListItem = {
  id: string;
  product_list_id: string;
  product_id: string;
  product_name: string;
  strength: string | null;
  category: string | null;
  retail_price: number | null;
  is_visible: boolean;
  sort_order: number;
  pricing_mode: string;
  notes: string | null;
};

type PartnerRepStoreSetting = {
  id?: string;
  store_scope: string;
  rep_id: string | null;
  rep_email: string | null;
  rep_name: string | null;
  public_display_name: string | null;
  store_slug: string | null;
  storefront_path: string | null;
  product_list_id: string | null;
  product_list_name: string | null;
  pricing_mode: string;
  features: Record<string, boolean>;
  promo_config: Record<string, string | boolean | null>;
  status: string;
  updated_at: string;
};

type PartnerFeatureRequest = {
  id: string;
  request_title: string;
  priority: string;
  category: string;
  description: string;
  status: string;
  created_at: string;
};

type CommissionDraft = {
  commission_type: string;
  commission_percent: string;
  override_percent: string;
  special_note: string;
  internal_notes: string;
};

type RepStoreDraft = {
  public_display_name: string;
  store_slug: string;
  parent_rep_id: string;
  product_list_id: string;
  pricing_mode: string;
  status: string;
  features: Record<string, boolean>;
};

const AACTIVATED_STORE_SCOPE = 'AACTIVATEDRX';
const AACTIVATED_BRAND_ID = 'aactivated';

function isRepDescendant(reps: Rep[], candidateParentId: string, repId: string): boolean {
  const byId = new Map(reps.map((rep) => [rep.id, rep]));
  let current = byId.get(candidateParentId);
  const seen = new Set<string>();
  while (current?.parent_rep_id) {
    if (current.parent_rep_id === repId) return true;
    if (seen.has(current.parent_rep_id)) return true;
    seen.add(current.parent_rep_id);
    current = byId.get(current.parent_rep_id);
  }
  return false;
}
const MAX_PARTNER_COMMISSION_PERCENT = 50;
const HARD_MAX_COMMISSION_PERCENT = 70;

const EMPTY_STORE_SETTINGS: StoreSettingsDraft = {
  logoSrc: '/marketing/aactivated-rx-logo-v2.png',
  heroImage: '/marketing/aactivated-product-vial.png',
  supportContact: AACTIVATED_PARTNER_ADMIN_EMAIL,
  description: 'AACTIVATEDRX partner storefront.',
  promoBanner: '',
  socialLinks: '',
};

function bundleKeyFromLabel(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function defaultPriceDraft(product: DistributorCatalogProduct, index: number, row?: AactivatedPriceRow): PriceDraft {
  const retail = row?.retail_price ?? product.displayPrice ?? product.suggested_retail_price ?? 0;
  return {
    retail_price: String(retail),
    sale_price: row?.sale_price != null ? String(row.sale_price) : '',
    is_active: row?.is_active ?? true,
    featured: row?.featured ?? product.distributorProduct.featured,
    sort_order: String(row?.sort_order ?? index + 1),
    product_note: row?.product_note ?? '',
    bundle_group_key: row?.bundle_group_key ?? '',
    bundle_group_name: row?.bundle_group_name ?? '',
    bundle_discount_percent: row?.bundle_discount_percent != null ? String(row.bundle_discount_percent) : '',
    bundle_discount_amount: row?.bundle_discount_amount != null ? String(row.bundle_discount_amount) : '',
    bundle_note: row?.bundle_note ?? '',
  };
}

export default function AdminAactivatedPartnerTools({ mode }: Props) {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const focusedRepSlug = searchParams.get('rep')?.trim().toUpperCase() ?? '';
  const [orders, setOrders] = useState<PatientSubmission[]>([]);
  const [reps, setReps] = useState<Rep[]>([]);
  const [ledger, setLedger] = useState<CommissionLedger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [settings, setSettings] = useState<StoreSettingsDraft>(EMPTY_STORE_SETTINGS);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState('');
  const [priceRows, setPriceRows] = useState<AactivatedPriceRow[]>([]);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, PriceDraft>>({});
  const [priceSavingId, setPriceSavingId] = useState('');
  const [priceMessage, setPriceMessage] = useState('');
  const [commissionSettings, setCommissionSettings] = useState<PartnerCommissionSetting[]>([]);
  const [commissionDrafts, setCommissionDrafts] = useState<Record<string, CommissionDraft>>({});
  const [productLists, setProductLists] = useState<PartnerProductList[]>([]);
  const [productListItems, setProductListItems] = useState<PartnerProductListItem[]>([]);
  const [repStores, setRepStores] = useState<PartnerRepStoreSetting[]>([]);
  const [featureRequests, setFeatureRequests] = useState<PartnerFeatureRequest[]>([]);
  const [repRequests, setRepRequests] = useState<RepStoreIntakeSubmission[]>([]);
  const [repRequestSavingId, setRepRequestSavingId] = useState('');
  const [repRequestMessage, setRepRequestMessage] = useState('');
  const [repLoginSavingId, setRepLoginSavingId] = useState('');
  const [opsMessage, setOpsMessage] = useState('');
  const isPartnerAdmin = isAactivatedPartnerAdmin(profile);
  const canSeeProfit = isPlatformAdminRole(profile?.role);
  const navItems = profile?.role === 'rx_plus_admin' || profile?.role === 'partner_admin_full' ? RX_PLUS_ADMIN_NAV : ADMIN_NAV;

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.role]);

  async function loadData() {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    setError('');

    const [{ data: orderData, error: orderError }, { data: repData, error: repError }, { data: ledgerData, error: ledgerError }] = await Promise.all([
      supabase
        .from('patient_submissions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('reps')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('commission_ledger')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500),
    ]);

    const nextOrders = ((orderData as PatientSubmission[]) ?? []).filter(isAactivatedOrder);
    const guyRep = ((repData as Rep[]) ?? []).find((rep) => rep.rep_slug === AACTIVATED_ADMIN_REP_CODE);
    const nextReps = ((repData as Rep[]) ?? []).filter((rep) => isAactivatedRep(rep, guyRep?.profile_id ?? profile?.id, guyRep?.id));
    const aactivatedRepIds = new Set(nextReps.map((rep) => rep.id));
    const aactivatedOrderIds = new Set(nextOrders.map((order) => order.id));
    const nextLedger = ((ledgerData as CommissionLedger[]) ?? []).filter((row) => (
      aactivatedRepIds.has(row.rep_id)
      || aactivatedOrderIds.has(row.submission_id)
      || Boolean(row.submission && isAactivatedOrder(row.submission))
    ));

    if (orderError || repError) setError(orderError?.message || repError?.message || '');
    else if (ledgerError && !isPartnerAdmin) setError(ledgerError.message);

    setOrders(nextOrders);
    setReps(nextReps);
    setLedger(nextLedger);
    if (mode === 'store-settings') await loadStoreSettings();
    if (mode === 'pricing') await loadPricing();
    if (mode === 'dashboard') await Promise.all([loadPartnerOps(nextReps), loadRepRequests()]);
    else if (['commission', 'rep-store-manager', 'product-lists', 'feature-requests'].includes(mode)) await loadPartnerOps(nextReps);
    setLoading(false);
  }

  async function loadRepRequests() {
    if (!supabase) return;
    const { data, error: requestError } = await supabase
      .from('rep_store_intake_submissions')
      .select('*')
      .or([
        'source_portal_id.ilike.aactivated',
        'source_portal_id.ilike.AACTIVATEDRX',
        'source_portal_id.ilike.*AACTIVATED*',
        'source_portal.ilike.*AACTIVATED*',
        'source_url.ilike.*AACTIVATED*',
        'source_route.ilike.*AACTIVATED*',
        'review_queue.ilike.aactivated',
        'review_queue.ilike.*AACTIVATED*',
        'parent_store_slug.ilike.aactivated',
        'parent_store_slug.ilike.AACTIVATEDRX',
        'parent_store_slug.ilike.*AACTIVATED*',
        'parent_store_name.ilike.*AACTIVATED*',
        'parent_rep_or_admin_name.ilike.*AACTIVATED*',
        'parent_rep_or_admin_name.ilike.*GUY*',
        'store_brand_name.ilike.*AACTIVATED*',
        'review_admin_name.ilike.*GUY*',
        'internal_notes.ilike.*AACTIVATED*',
        'partner_admin_email.ilike.guy@aactivated.com',
        'approval_owner_email.ilike.guy@aactivated.com',
        `review_admin_code.ilike.${AACTIVATED_ADMIN_REP_CODE}`,
      ].join(','))
      .order('created_at', { ascending: false })
      .limit(100);
    if (requestError) {
      setError(requestError.message);
      return;
    }
    setRepRequests(((data as RepStoreIntakeSubmission[]) ?? []).filter(isAactivatedIntake));
  }

  async function loadPartnerOps(scopedReps = reps) {
    if (!supabase) return;
    const [
      { data: commissionData, error: commissionError },
      { data: listData, error: listError },
      { data: itemData, error: itemError },
      { data: storeData, error: storeError },
      { data: requestData, error: requestError },
    ] = await Promise.all([
      supabase.from('partner_rep_commission_settings').select('*').eq('store_scope', AACTIVATED_STORE_SCOPE).order('updated_at', { ascending: false }),
      supabase.from('partner_product_lists').select('*').eq('store_scope', AACTIVATED_STORE_SCOPE).order('created_at', { ascending: true }),
      supabase.from('partner_product_list_items').select('*').eq('store_scope', AACTIVATED_STORE_SCOPE).order('sort_order', { ascending: true }),
      supabase.from('partner_rep_store_settings').select('*').eq('store_scope', AACTIVATED_STORE_SCOPE).order('updated_at', { ascending: false }),
      supabase.from('partner_feature_requests').select('*').eq('store_scope', AACTIVATED_STORE_SCOPE).order('created_at', { ascending: false }),
    ]);
    const opsError = commissionError || listError || itemError || storeError || requestError;
    if (opsError) {
      setError(opsError.message);
      return;
    }
    const nextCommissionSettings = (commissionData as PartnerCommissionSetting[]) ?? [];
    setCommissionSettings(nextCommissionSettings);
    setProductLists((listData as PartnerProductList[]) ?? []);
    setProductListItems((itemData as PartnerProductListItem[]) ?? []);
    setRepStores((storeData as PartnerRepStoreSetting[]) ?? []);
    setFeatureRequests((requestData as PartnerFeatureRequest[]) ?? []);
    const byRepId = new Map(nextCommissionSettings.map((row) => [row.rep_id, row]));
    setCommissionDrafts(Object.fromEntries(scopedReps
      .filter((rep) => rep.rep_slug !== AACTIVATED_ADMIN_REP_CODE)
      .map((rep) => {
        const row = byRepId.get(rep.id);
        return [rep.id, {
          commission_type: row?.commission_type ?? rep.commission_type ?? 'flat_net_profit',
          commission_percent: String(row?.commission_percent ?? Number(rep.commission_rate ?? 0) * 100),
          override_percent: row?.override_percent != null ? String(row.override_percent) : '',
          special_note: row?.special_note ?? '',
          internal_notes: row?.internal_notes ?? '',
        }];
      })));
  }

  async function loadPricing() {
    if (!supabase) return;
    const { data, error: loadError } = await supabase
      .from('aactivated_store_product_prices')
      .select('*')
      .eq('store_slug', 'aactivated')
      .order('sort_order', { ascending: true })
      .order('product_id', { ascending: true });
    if (loadError) {
      setError(loadError.message);
      return;
    }
    const rows = (data as AactivatedPriceRow[]) ?? [];
    setPriceRows(rows);
    const byProductId = new Map(rows.map((row) => [row.product_id, row]));
    setPriceDrafts(Object.fromEntries(getDistributorProducts('guy').map((product, index) => {
      const row = byProductId.get(product.id);
      return [product.id, defaultPriceDraft(product, index, row)];
    })));
  }

  function buildPricePayload(product: DistributorCatalogProduct, index: number) {
    const draft = priceDrafts[product.id];
    const retailPrice = Number(draft?.retail_price);
    const salePrice = draft?.sale_price.trim() ? Number(draft.sale_price) : null;
    const sortOrder = draft?.sort_order.trim() ? Number(draft.sort_order) : null;
    const bundleDiscountPercent = draft?.bundle_discount_percent.trim() ? Number(draft.bundle_discount_percent) : null;
    const bundleDiscountAmount = draft?.bundle_discount_amount.trim() ? Number(draft.bundle_discount_amount) : null;
    const bundleGroupName = draft?.bundle_group_name.trim() || null;
    const bundleGroupKey = draft?.bundle_group_key.trim() || (bundleGroupName ? bundleKeyFromLabel(bundleGroupName) : '');
    if (!Number.isFinite(retailPrice) || retailPrice <= 0 || (salePrice != null && (!Number.isFinite(salePrice) || salePrice <= 0))) {
      return { error: `${product.product_name} ${product.strength}: retail and sale prices must be numeric and greater than 0.` };
    }
    if (bundleDiscountPercent != null && (!Number.isFinite(bundleDiscountPercent) || bundleDiscountPercent < 0 || bundleDiscountPercent > 100)) {
      return { error: `${product.product_name} ${product.strength}: bundle discount percent must be between 0 and 100.` };
    }
    if (bundleDiscountAmount != null && (!Number.isFinite(bundleDiscountAmount) || bundleDiscountAmount < 0)) {
      return { error: `${product.product_name} ${product.strength}: bundle discount amount must be 0 or greater.` };
    }
    return {
      payload: {
        store_slug: 'aactivated',
        product_id: product.id,
        product_name: `${product.product_name}${product.strength && product.strength !== 'Standard' ? ` ${product.strength}` : ''}`,
        retail_price: retailPrice,
        sale_price: salePrice,
        is_active: draft?.is_active ?? true,
        featured: draft?.featured ?? product.distributorProduct.featured,
        sort_order: Number.isFinite(sortOrder) ? sortOrder : index + 1,
        product_note: draft?.product_note.trim() || null,
        bundle_group_key: bundleGroupKey || null,
        bundle_group_name: bundleGroupName,
        bundle_discount_percent: bundleDiscountPercent,
        bundle_discount_amount: bundleDiscountAmount,
        bundle_note: draft?.bundle_note.trim() || null,
        updated_by: profile?.id,
        updated_at: new Date().toISOString(),
      },
    };
  }

  async function savePrice(product: DistributorCatalogProduct) {
    if (!supabase || !profile) return;
    const products = getDistributorProducts('guy');
    const productIndex = products.findIndex((item) => item.id === product.id);
    const built = buildPricePayload(product, productIndex >= 0 ? productIndex : 0);
    if (built.error || !built.payload) {
      setError(built.error || 'Pricing row could not be saved.');
      return;
    }
    setPriceSavingId(product.id);
    setPriceMessage('');
    setError('');
    const { error: saveError } = await supabase
      .from('aactivated_store_product_prices')
      .upsert(built.payload, { onConflict: 'store_slug,product_id' });
    if (saveError) setError(saveError.message);
    else {
      setPriceMessage(`${product.product_name} ${product.strength} pricing saved.`);
      await loadPricing();
    }
    setPriceSavingId('');
  }

  async function saveAllPrices() {
    if (!supabase || !profile) return;
    const products = getDistributorProducts('guy');
    const builtRows = products.map((product, index) => buildPricePayload(product, index));
    const invalid = builtRows.find((row) => row.error);
    if (invalid?.error) {
      setError(invalid.error);
      return;
    }
    const payloads = builtRows.flatMap((row) => (row.payload ? [row.payload] : []));
    setPriceSavingId('all');
    setPriceMessage('');
    setError('');
    const { error: saveError } = await supabase
      .from('aactivated_store_product_prices')
      .upsert(payloads, { onConflict: 'store_slug,product_id' });
    if (saveError) setError(saveError.message);
    else {
      setPriceMessage('All AACTIVATEDRX product manager changes saved.');
      await loadPricing();
    }
    setPriceSavingId('');
  }

  async function loadStoreSettings() {
    if (!supabase) return;
    const { data } = await supabase
      .from('partner_store_settings')
      .select('settings')
      .eq('store_slug', 'aactivated')
      .maybeSingle();
    const saved = (data as { settings?: Partial<StoreSettingsDraft> } | null)?.settings;
    if (saved) setSettings({ ...EMPTY_STORE_SETTINGS, ...saved });
  }

  async function saveStoreSettings() {
    if (!supabase || !profile) return;
    setSettingsSaving(true);
    setSettingsMessage('');
    setError('');
    const { error: saveError } = await supabase
      .from('partner_store_settings')
      .upsert({
        store_slug: 'aactivated',
        brand_id: AACTIVATED_BRAND_ID,
        store_name: AACTIVATED_PARENT_STORE_NAME,
        settings,
        updated_by: profile.id,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'store_slug' });
    if (saveError) setError(saveError.message);
    else setSettingsMessage('Store settings saved for AACTIVATEDRX.');
    setSettingsSaving(false);
  }

  async function writeOpsAudit(action: string, targetTable: string, targetId: string | null, newValue: unknown, auditNotes: string, repId?: string | null) {
    if (!supabase || !profile) return;
    await supabase.from('partner_rep_setup_audit').insert({
      store_scope: AACTIVATED_STORE_SCOPE,
      brand_id: AACTIVATED_BRAND_ID,
      actor_id: profile.id,
      actor_email: profile.email,
      action,
      target_table: targetTable,
      target_id: targetId,
      rep_id: repId ?? null,
      new_value: newValue,
      audit_notes: auditNotes,
    });
  }

  async function saveCommissionSetting(rep: Rep) {
    if (!supabase || !profile) return;
    const draft = commissionDrafts[rep.id];
    if (!draft?.commission_percent.trim()) {
      setError('Enter a custom commission percentage before saving this rep.');
      return;
    }
    const commissionPercent = Number(draft?.commission_percent);
    const overridePercent = draft?.override_percent.trim() ? Number(draft.override_percent) : null;
    if (!Number.isFinite(commissionPercent) || commissionPercent < 0) {
      setError('Commission percentage must be a positive number.');
      return;
    }
    if (commissionPercent > HARD_MAX_COMMISSION_PERCENT || (overridePercent != null && overridePercent > HARD_MAX_COMMISSION_PERCENT)) {
      setError(`Commission cannot exceed ${HARD_MAX_COMMISSION_PERCENT}% from this portal. Request platform approval instead.`);
      return;
    }
    const approvalRequired = commissionPercent > MAX_PARTNER_COMMISSION_PERCENT || (overridePercent != null && overridePercent > MAX_PARTNER_COMMISSION_PERCENT);
    setError('');
    setOpsMessage('');
    const payload = {
      store_scope: AACTIVATED_STORE_SCOPE,
      brand_id: AACTIVATED_BRAND_ID,
      partner_admin_id: profile.id,
      partner_admin_email: AACTIVATED_PARTNER_ADMIN_EMAIL,
      rep_id: rep.id,
      rep_email: rep.payout_email,
      commission_type: draft?.commission_type ?? 'flat_net_profit',
      commission_percent: commissionPercent,
      override_percent: overridePercent,
      special_note: draft?.special_note.trim() || null,
      approval_required: approvalRequired,
      approval_status: approvalRequired ? 'needs_platform_approval' : 'active',
      internal_notes: draft?.internal_notes.trim() || null,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
      created_by: profile.id,
    };
    const { data, error: saveError } = await supabase
      .from('partner_rep_commission_settings')
      .upsert(payload, { onConflict: 'store_scope,rep_id' })
      .select('id')
      .maybeSingle();
    if (saveError) {
      setError(saveError.message);
      return;
    }
    await writeOpsAudit('commission_setting_saved', 'partner_rep_commission_settings', (data as { id?: string } | null)?.id ?? null, payload, approvalRequired ? 'Commission saved as needs platform approval.' : 'Commission saved within partner limits.', rep.id);
    setOpsMessage(approvalRequired ? `${rep.rep_name || rep.rep_slug} commission saved and marked Needs Platform Approval.` : `${rep.rep_name || rep.rep_slug} commission saved.`);
    await loadPartnerOps(reps);
  }

  async function createProductList(listName: string, listType: string, productIds: string[], notes: string) {
    if (!supabase || !profile) return;
    setError('');
    setOpsMessage('');
    const { data: list, error: listError } = await supabase
      .from('partner_product_lists')
      .insert({
        store_scope: AACTIVATED_STORE_SCOPE,
        brand_id: AACTIVATED_BRAND_ID,
        partner_admin_id: profile.id,
        partner_admin_email: AACTIVATED_PARTNER_ADMIN_EMAIL,
        list_name: listName,
        list_type: listType,
        default_pricing_mode: 'aactivated_default',
        notes: notes.trim() || null,
        created_by: profile.id,
        updated_by: profile.id,
      })
      .select('*')
      .single();
    if (listError || !list) {
      setError(listError?.message || 'Product list could not be created.');
      return;
    }
    const selected = getDistributorProducts('guy').filter((product) => productIds.includes(product.id));
    if (selected.length > 0) {
      const { error: itemError } = await supabase.from('partner_product_list_items').insert(selected.map((product, index) => ({
        product_list_id: (list as PartnerProductList).id,
        store_scope: AACTIVATED_STORE_SCOPE,
        brand_id: AACTIVATED_BRAND_ID,
        product_id: product.id,
        product_name: product.product_name,
        strength: product.strength,
        category: product.category,
        retail_price: product.displayPrice,
        is_visible: true,
        sort_order: index + 1,
        pricing_mode: 'aactivated_default',
      })));
      if (itemError) {
        setError(itemError.message);
        return;
      }
    }
    await writeOpsAudit('product_list_created', 'partner_product_lists', (list as PartnerProductList).id, { list, productIds }, 'AACTIVATEDRX product list created.');
    setOpsMessage(`${listName} product list created.`);
    await loadPartnerOps(reps);
  }

  async function saveRepStore(rep: Rep, draft: RepStoreDraft) {
    if (!supabase || !profile) return;
    const list = productLists.find((row) => row.id === draft.product_list_id);
    const storeSlug = normalizeRepSlug(draft.store_slug || rep.rep_slug);
    const parentRepId = draft.parent_rep_id || null;
    const parentRep = parentRepId ? reps.find((row) => row.id === parentRepId) : null;
    if (parentRepId === rep.id) {
      setError('A rep cannot be assigned as their own upline.');
      return;
    }
    if (parentRepId && !parentRep) {
      setError('Selected upline could not be found in the AACTIVATEDRX rep roster.');
      return;
    }
    if (parentRepId && isRepDescendant(reps, parentRepId, rep.id)) {
      setError('That hierarchy move would create a loop. Choose a different upline.');
      return;
    }
    const parentType = parentRep?.rep_slug === AACTIVATED_ADMIN_REP_CODE ? 'aactivated_main_portal' : parentRep ? 'aactivated_downline_rep' : 'aactivated_main_portal';
    const payload = {
      store_scope: AACTIVATED_STORE_SCOPE,
      brand_id: AACTIVATED_BRAND_ID,
      partner_admin_id: profile.id,
      partner_admin_email: AACTIVATED_PARTNER_ADMIN_EMAIL,
      rep_id: rep.id,
      rep_email: rep.payout_email,
      rep_name: rep.rep_name || rep.rep_slug,
      public_display_name: draft.public_display_name.trim() || rep.rep_name || rep.rep_slug,
      store_slug: storeSlug,
      storefront_path: `/aactivated?rep=${encodeURIComponent(rep.rep_slug)}`,
      product_list_id: list?.id ?? null,
      product_list_name: list?.list_name ?? null,
      pricing_mode: draft.pricing_mode,
      features: draft.features,
      promo_config: {
        attribution_code: rep.rep_slug,
        referral_link: `/aactivated?rep=${encodeURIComponent(rep.rep_slug)}`,
        storefront_link: `/aactivated?rep=${encodeURIComponent(rep.rep_slug)}`,
        discount_code: rep.discount_code,
        hierarchy_parent_rep_id: parentRep?.id ?? null,
        hierarchy_parent_rep_slug: parentRep?.rep_slug ?? null,
        hierarchy_parent_name: parentRep?.rep_name ?? parentRep?.rep_slug ?? 'AACTIVATEDRX Main Portal',
        hierarchy_parent_type: parentType,
      },
      status: draft.status,
      activated_at: draft.status === 'active' ? new Date().toISOString() : null,
      disabled_at: draft.status === 'disabled' ? new Date().toISOString() : null,
      updated_by: profile.id,
      created_by: profile.id,
      updated_at: new Date().toISOString(),
    };
    const { error: repUpdateError } = await supabase
      .from('reps')
      .update({
        parent_rep_id: parentRep?.id ?? null,
        parent_type: parentType,
        custom_store_slug: AACTIVATED_PARENT_STORE_SLUG,
        assigned_store_slug: AACTIVATED_PARENT_STORE_SLUG,
        brand_id: AACTIVATED_BRAND_ID,
        parent_brand_id: AACTIVATED_BRAND_ID,
      })
      .eq('id', rep.id);
    if (repUpdateError) {
      setError(repUpdateError.message);
      return;
    }
    const { data, error: saveError } = await supabase
      .from('partner_rep_store_settings')
      .upsert(payload, { onConflict: 'store_scope,rep_id' })
      .select('id')
      .maybeSingle();
    if (saveError) {
      setError(saveError.message);
      return;
    }
    await writeOpsAudit('rep_hierarchy_saved', 'reps', rep.id, {
      rep_id: rep.id,
      rep_slug: rep.rep_slug,
      parent_rep_id: parentRep?.id ?? null,
      parent_rep_slug: parentRep?.rep_slug ?? null,
      parent_type: parentType,
    }, 'AACTIVATEDRX rep hierarchy updated by main portal.', rep.id);
    await writeOpsAudit(draft.status === 'active' ? 'rep_store_activated' : 'rep_store_saved', 'partner_rep_store_settings', (data as { id?: string } | null)?.id ?? null, payload, 'AACTIVATEDRX rep store settings saved.', rep.id);
    setOpsMessage(`${rep.rep_name || rep.rep_slug} store settings saved.`);
    await loadData();
  }

  async function grantRepPortalLogin(rep: Rep) {
    if (!supabase || !profile) return;
    const url = import.meta.env.VITE_SUPABASE_URL;
    if (!url) {
      setError('Supabase function URL is not configured.');
      return;
    }
    const email = rep.payout_email?.trim();
    if (!email) {
      setError('This rep needs a payout/login email before portal access can be granted.');
      return;
    }
    setRepLoginSavingId(rep.id);
    setError('');
    setOpsMessage('');
    const temporaryPassword = generateTemporaryPassword();
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setError('Admin session is missing. Please sign in again before granting rep portal access.');
      setRepLoginSavingId('');
      return;
    }

    try {
      const response = await fetch(`${url}/functions/v1/grant-rep-portal-login`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          repId: rep.id,
          email,
          fullName: rep.rep_name || rep.handle || rep.rep_slug,
          repSlug: rep.rep_slug,
          storeScope: AACTIVATED_STORE_SCOPE,
          redirectTo: `${window.location.origin}/rep`,
          temporaryPassword,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(String(payload.error ?? 'Rep portal login could not be granted.'));
        return;
      }
      await writeOpsAudit('rep_portal_login_granted', 'reps', rep.id, payload, 'AACTIVATEDRX rep portal login granted from Rep Store Manager.', rep.id);
      await copyTextIfPossible(temporaryPassword);
      setOpsMessage(`${rep.rep_name || rep.rep_slug} can now access the rep portal. Temporary password: ${temporaryPassword}`);
      await loadData();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Rep portal login could not be granted.');
    } finally {
      setRepLoginSavingId('');
    }
  }

  async function submitFeatureRequest(request: { request_title: string; priority: string; category: string; description: string }) {
    if (!supabase || !profile) return;
    if (!request.request_title.trim() || !request.description.trim()) {
      setError('Feature request title and description are required.');
      return;
    }
    const payload = {
      store_scope: AACTIVATED_STORE_SCOPE,
      brand_id: AACTIVATED_BRAND_ID,
      partner_admin_id: profile.id,
      partner_admin_email: AACTIVATED_PARTNER_ADMIN_EMAIL,
      request_title: request.request_title.trim(),
      priority: request.priority,
      category: request.category,
      description: request.description.trim(),
      status: 'New',
      created_by: profile.id,
      updated_by: profile.id,
    };
    const { data, error: saveError } = await supabase
      .from('partner_feature_requests')
      .insert(payload)
      .select('id')
      .single();
    if (saveError) {
      setError(saveError.message);
      return;
    }
    await writeOpsAudit('feature_request_submitted', 'partner_feature_requests', (data as { id?: string }).id ?? null, payload, 'Feature request submitted by AACTIVATEDRX partner admin.');
    setOpsMessage('Feature request submitted for platform admin review.');
    await loadPartnerOps(reps);
  }

  async function reviewRepRequest(row: RepStoreIntakeSubmission, nextStatus: RepStoreIntakeStatus) {
    if (!supabase || !profile) return;
    setRepRequestSavingId(row.id);
    setRepRequestMessage('');
    setError('');
    const nextNotes = `${row.internal_notes ? `${row.internal_notes}\n` : ''}${repRequestReviewNote(nextStatus, profile.full_name || profile.email)}`;
    const { error: saveError } = await supabase
      .from('rep_store_intake_submissions')
      .update({
        status: nextStatus,
        approval_status: intakeStatusToApprovalStatus(nextStatus),
        approval_notes: nextNotes,
        internal_notes: nextNotes,
      })
      .eq('id', row.id);
    setRepRequestSavingId('');
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setRepRequestMessage(`${row.full_name} marked ${approvalStatusLabelForIntake(intakeStatusToApprovalStatus(nextStatus))}.`);
    await loadRepRequests();
  }

  const paidOrders = useMemo(() => orders.filter((order) => order.status === 'paid' || order.status === 'fulfilled'), [orders]);
  const totalSales = paidOrders.reduce((sum, order) => sum + orderRevenue(order), 0);
  const pendingPayouts = ledger.filter((row) => row.status === 'pending' || row.status === 'payable').reduce((sum, row) => sum + Number(row.commission_amount ?? 0), 0);
  const paidPayouts = ledger.filter((row) => row.status === 'paid').reduce((sum, row) => sum + Number(row.commission_amount ?? 0), 0);
  const commissionEarned = pendingPayouts + paidPayouts;

  const repPerformance = useMemo(() => buildRepPerformance(reps, orders, ledger), [reps, orders, ledger]);
  const productPerformance = useMemo(() => buildProductPerformance(orders), [orders]);
  const customerStats = useMemo(() => buildCustomerStats(orders), [orders]);
  const monthlyTrends = useMemo(() => buildMonthlyTrends(paidOrders), [paidOrders]);

  return (
    <DashLayout title={titleForMode(mode)} navItems={navItems}>
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>
          {error && <div className="alert alert-error">{error}</div>}
          {opsMessage && <div className="alert alert-success">{opsMessage}</div>}
          {mode === 'dashboard' && (
            <PartnerOperatingDashboard
              orders={orders}
              paidOrders={paidOrders}
              reps={reps}
              ledger={ledger}
              repPerformance={repPerformance}
              productPerformance={productPerformance}
              customerStats={customerStats}
              monthlyTrends={monthlyTrends}
              productLists={productLists}
              repStores={repStores}
              featureRequests={featureRequests}
              repRequests={repRequests}
              repRequestSavingId={repRequestSavingId}
              repRequestMessage={repRequestMessage}
              totalSales={totalSales}
              commissionEarned={commissionEarned}
              pendingPayouts={pendingPayouts}
              paidPayouts={paidPayouts}
              canSeeProfit={canSeeProfit}
              onReviewRepRequest={reviewRepRequest}
              onGrantLogin={grantRepPortalLogin}
              repLoginSavingId={repLoginSavingId}
            />
          )}

          {mode === 'commission' && (
            <>
              <div className="stats-grid">
                <Stat label="Total sales" value={money(totalSales)} />
                <Stat label="Net profit" value={canSeeProfit ? money(estimateNetProfit(paidOrders)) : 'Scoped'} />
                <Stat label="Commission earned" value={money(commissionEarned)} />
                <Stat label="Commission owed" value={money(pendingPayouts)} />
                <Stat label="Pending payouts" value={money(pendingPayouts)} />
                <Stat label="Paid payouts" value={money(paidPayouts)} />
              </div>
              <SimpleTable
                title="Monthly Trends"
                columns={['Month', 'Orders', 'Revenue']}
                rows={monthlyTrends.map((row) => [row.month, String(row.orders), money(row.revenue)])}
              />
              <CommissionManager
                reps={reps.filter((rep) => rep.rep_slug !== AACTIVATED_ADMIN_REP_CODE)}
                ledger={ledger}
                settings={commissionSettings}
                drafts={commissionDrafts}
                setDrafts={setCommissionDrafts}
                onSave={saveCommissionSetting}
              />
              <PerformanceTable rows={repPerformance.slice(0, 8)} />
            </>
          )}

          {mode === 'rep-store-manager' && (
            <RepStoreManager
              reps={reps.filter((rep) => rep.rep_slug !== AACTIVATED_ADMIN_REP_CODE)}
              allReps={reps}
              orders={orders}
              settings={repStores}
              productLists={productLists}
              commissionSettings={commissionSettings}
              onSave={saveRepStore}
              onGrantLogin={grantRepPortalLogin}
              focusedRepSlug={focusedRepSlug}
            />
          )}

          {mode === 'product-lists' && (
            <ProductListBuilder
              lists={productLists}
              items={productListItems}
              onCreate={createProductList}
            />
          )}

          {mode === 'feature-requests' && (
            <FeatureRequestsPanel
              requests={featureRequests}
              onSubmit={submitFeatureRequest}
            />
          )}

          {mode === 'leaderboard' && <PerformanceTable rows={repPerformance} />}

          {mode === 'customer' && (
            <>
              <div className="stats-grid">
                <Stat label="New customers" value={String(customerStats.newCustomers)} />
                <Stat label="Repeat customers" value={String(customerStats.repeatCustomers)} />
                <Stat label="Abandoned checkouts" value={String(customerStats.abandonedCheckouts)} />
                <Stat label="Refill requests" value={String(customerStats.refillRequests)} />
              </div>
              <SimpleTable
                title="Recent AACTIVATEDRX Orders"
                columns={['Customer', 'Source / rep', 'Status', 'Submitted']}
                rows={orders.slice(0, 25).map((order) => [
                  order.email,
                  order.source_rep || order.referral_code || order.checkout_scope_code || AACTIVATED_SOURCE_PORTAL,
                  order.status,
                  formatDate(order.created_at),
                ])}
              />
            </>
          )}

          {mode === 'product' && (
            <SimpleTable
              title="Product Performance"
              columns={['Product', 'Units sold', 'Revenue', 'Conversion trend']}
              rows={productPerformance.map((row) => [row.product, String(row.units), money(row.revenue), row.trend])}
            />
          )}

          {mode === 'store-settings' && (
            <StoreSettingsPanel
              settings={settings}
              setSettings={setSettings}
              saving={settingsSaving}
              message={settingsMessage}
              onSave={saveStoreSettings}
            />
          )}

          {mode === 'pricing' && (
            <PricingManager
              rows={priceRows}
              drafts={priceDrafts}
              setDrafts={setPriceDrafts}
              savingId={priceSavingId}
              message={priceMessage}
              onSave={savePrice}
              onSaveAll={saveAllPrices}
            />
          )}

          {mode === 'payouts' && (
            <SimpleTable
              title="AACTIVATEDRX Payouts"
              columns={['Rep', 'Amount', 'Status', 'Created']}
              rows={ledger.map((row) => [
                row.rep?.rep_name || row.rep?.rep_slug || row.rep_id,
                money(Number(row.commission_amount ?? 0)),
                row.status,
                formatDate(row.created_at),
              ])}
            />
          )}

          {mode === 'scope-codes' && (
            <SimpleTable
              title="AACTIVATEDRX Scope Codes"
              columns={['Scope', 'Use', 'Owner']}
              rows={[
                ['VITALITYINS', 'AACTIVATEDRX main store checkout attribution', AACTIVATED_PARTNER_ADMIN_NAME],
                [AACTIVATED_ADMIN_REP_CODE, 'AACTIVATEDRX alternate / Guy scope', AACTIVATED_PARTNER_ADMIN_NAME],
              ]}
            />
          )}

          {mode === 'payment-audit' && (
            <SimpleTable
              title="AACTIVATEDRX Payment Audit"
              columns={['Order', 'Provider', 'Payment status', 'Payout status']}
              rows={orders.slice(0, 100).map((order) => [
                order.order_number || order.id.slice(0, 8),
                order.payment_provider || '-',
                order.payment_status || '-',
                order.payout_status || '-',
              ])}
            />
          )}

          {mode === 'zelle' && (
            <SimpleTable
              title="AACTIVATEDRX Manual Payments"
              columns={['Order', 'Customer', 'Status', 'Total']}
              rows={orders
                .filter((order) => order.payment_provider === 'zelle' || order.payment_provider === 'venmo')
                .map((order) => [
                  order.order_number || order.id.slice(0, 8),
                  order.email,
                  `${order.payment_provider || 'manual'} - ${order.payment_status || 'unknown'}`,
                  money(orderRevenue(order)),
                ])}
            />
          )}
        </div>
      )}
    </DashLayout>
  );
}

function PartnerOperatingDashboard({
  orders,
  paidOrders,
  reps,
  ledger,
  repPerformance,
  productPerformance,
  customerStats,
  monthlyTrends,
  productLists,
  repStores,
  featureRequests,
  repRequests,
  repRequestSavingId,
  repRequestMessage,
  totalSales,
  commissionEarned,
  pendingPayouts,
  paidPayouts,
  canSeeProfit,
  onReviewRepRequest,
  onGrantLogin,
  repLoginSavingId,
}: {
  orders: PatientSubmission[];
  paidOrders: PatientSubmission[];
  reps: Rep[];
  ledger: CommissionLedger[];
  repPerformance: ReturnType<typeof buildRepPerformance>;
  productPerformance: ReturnType<typeof buildProductPerformance>;
  customerStats: ReturnType<typeof buildCustomerStats>;
  monthlyTrends: ReturnType<typeof buildMonthlyTrends>;
  productLists: PartnerProductList[];
  repStores: PartnerRepStoreSetting[];
  featureRequests: PartnerFeatureRequest[];
  repRequests: RepStoreIntakeSubmission[];
  repRequestSavingId: string;
  repRequestMessage: string;
  totalSales: number;
  commissionEarned: number;
  pendingPayouts: number;
  paidPayouts: number;
  canSeeProfit: boolean;
  onReviewRepRequest: (row: RepStoreIntakeSubmission, nextStatus: RepStoreIntakeStatus) => void;
  onGrantLogin: (rep: Rep) => void;
  repLoginSavingId: string;
}) {
  const activeReps = reps.filter((rep) => rep.rep_slug !== AACTIVATED_ADMIN_REP_CODE && rep.active);
  const activeStores = repStores.filter((store) => store.status === 'active');
  const pendingOpsRequests = featureRequests.filter((request) => !['complete', 'completed', 'closed', 'done'].includes(request.status.toLowerCase()));
  const pendingRepRequests = repRequests.filter((request) => intakeApprovalStatus(request) === 'pending');
  const approvedRepRequests = repRequests.filter((request) => intakeApprovalStatus(request) === 'approved');
  const recentOrders = orders.slice(0, 8);
  const latestMonth = monthlyTrends[monthlyTrends.length - 1];
  const previousMonth = monthlyTrends[monthlyTrends.length - 2];
  const monthDelta = latestMonth && previousMonth ? latestMonth.revenue - previousMonth.revenue : latestMonth?.revenue ?? 0;
  const conversionWatch = orders.filter((order) => order.payment_status === 'unpaid' || order.status === 'cancelled_refunded').length;
  const netProfit = canSeeProfit ? estimateNetProfit(paidOrders) : 0;
  const liveProductLists = productLists.filter((list) => list.status !== 'archived');
  const payoutRows = ledger.slice(0, 6).map((row) => [
    row.rep?.rep_name || row.rep?.rep_slug || row.rep_id,
    money(Number(row.commission_amount ?? 0)),
    row.status,
    formatDate(row.created_at),
  ]);
  const repsByCode = new Map(reps.map((rep) => [rep.rep_slug.toUpperCase(), rep]));
  const storesByRepId = new Map(repStores.flatMap((store) => (store.rep_id ? [[store.rep_id, store]] : [])));
  const storesBySlug = new Map(repStores.flatMap((store) => (store.store_slug ? [[store.store_slug.toUpperCase(), store]] : [])));
  const launchRows = approvedRepRequests.slice(0, 8).map((request) => {
    const repCode = requestedRepCode(request);
    const matchingRep = repsByCode.get(repCode);
    const matchingStore = (matchingRep?.id ? storesByRepId.get(matchingRep.id) : undefined) ?? storesBySlug.get(repCode);
    return {
      request,
      repCode,
      matchingRep,
      matchingStore,
      checks: [
        { label: 'Rep account', done: Boolean(matchingRep) },
        { label: 'Store active', done: matchingStore?.status === 'active' },
        { label: 'Discount code', done: Boolean(matchingRep?.discount_code || matchingStore?.promo_config?.discount_code) },
        { label: 'Product list', done: Boolean(matchingStore?.product_list_id || matchingStore?.product_list_name) },
        { label: 'Payout email', done: Boolean(matchingRep?.payout_email || request.paypal_account) },
        { label: 'Portal login', done: Boolean(matchingRep?.profile_id) },
      ],
    };
  });

  const actionItems = [
    { label: 'Create Discount Code', detail: 'Backend promos and approval-safe custom offers', href: '/admin/aactivated-promos' },
    { label: 'Review Rep Requests', detail: 'Approve new applicants and attach them to the parent store', href: '/admin/rep-requests' },
    { label: 'Manage Starter Kits', detail: 'Package availability, contents, purchases, and fulfillment status', href: '/admin/starter-kits' },
    { label: 'Manage Sub Stores', detail: 'Rep store links, hierarchy, product lists, and login access', href: '/admin/rep-store-manager' },
    { label: 'Tune Storefront', detail: 'Branding, banner copy, support contact, and product order', href: '/admin/store-settings' },
    { label: 'Product Lists', detail: 'Build focused menus for reps and sub-store funnels', href: '/admin/product-lists' },
    { label: 'Pricing Manager', detail: 'Retail pricing, featured products, sale prices, and bundles', href: '/admin/pricing' },
  ];

  const healthItems = [
    {
      label: 'Sub stores',
      status: activeStores.length > 0 ? `${activeStores.length} live` : 'Needs setup',
      tone: activeStores.length > 0 ? 'badge-success' : 'badge-warning',
      href: '/admin/rep-store-manager',
    },
    {
      label: 'Product lists',
      status: liveProductLists.length > 0 ? `${liveProductLists.length} ready` : 'Needs list',
      tone: liveProductLists.length > 0 ? 'badge-success' : 'badge-warning',
      href: '/admin/product-lists',
    },
    {
      label: 'Commission owed',
      status: pendingPayouts > 0 ? money(pendingPayouts) : 'Clear',
      tone: pendingPayouts > 0 ? 'badge-warning' : 'badge-success',
      href: '/admin/payouts',
    },
    {
      label: 'Open ops requests',
      status: pendingOpsRequests.length > 0 ? String(pendingOpsRequests.length) : 'None',
      tone: pendingOpsRequests.length > 0 ? 'badge-warning' : 'badge-success',
      href: '/admin/feature-requests',
    },
  ];

  return (
    <>
      <div className="card" style={{ border: '1px solid rgba(8,145,178,.18)' }}>
        <div className="card-header" style={{ alignItems: 'flex-start' }}>
          <div>
            <div className="card-title">AACTIVATEDRX Operating Dashboard</div>
            <div className="card-subtitle">Store health, sub-store readiness, rep performance, payouts, and backend actions in one place.</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <a className="btn btn-outline btn-sm" href="/aactivated">Open Storefront</a>
            <a className="btn btn-primary btn-sm" href="/admin/aactivated-promos">Discount Codes</a>
          </div>
        </div>
      </div>

      <div className="stats-grid">
        <Stat label="Paid revenue" value={money(totalSales)} />
        <Stat label="Orders paid / fulfilled" value={String(paidOrders.length)} />
        <Stat label="Active reps" value={String(activeReps.length)} />
        <Stat label="Live sub stores" value={String(activeStores.length)} />
        <Stat label="Pending rep requests" value={String(pendingRepRequests.length)} />
        <Stat label="Commission earned" value={money(commissionEarned)} />
        <Stat label="Commission owed" value={money(pendingPayouts)} />
        <Stat label="Repeat customers" value={String(customerStats.repeatCustomers)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18, alignItems: 'start' }}>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Rep Request Queue</div>
              <div className="card-subtitle">Pending AACTIVATED applicants, including WIGG-style submissions.</div>
            </div>
            <a className="btn btn-outline btn-sm" href="/admin/rep-requests">Full Review</a>
          </div>
          <div className="card-body" style={{ display: 'grid', gap: 10 }}>
            {repRequestMessage && <div className="alert alert-success">{repRequestMessage}</div>}
            {pendingRepRequests.length === 0 ? (
              <div className="empty-state" style={{ padding: 18 }}>
                <div className="empty-state-title">No pending AACTIVATED rep requests</div>
                <div className="empty-state-desc">New applicants will appear here as soon as they submit the intake form.</div>
              </div>
            ) : pendingRepRequests.slice(0, 5).map((request) => (
              <div key={request.id} style={{ border: '1px solid rgba(15,23,42,.1)', borderRadius: 8, padding: 12, display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
                  <div>
                    <div style={{ color: 'var(--navy)', fontWeight: 950 }}>{request.full_name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{request.email} - {request.phone || 'No phone'}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>Desired code: {request.desired_rep_code || requestedRepCode(request)}</div>
                  </div>
                  <span className="badge badge-info">Pending</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary btn-sm" type="button" disabled={repRequestSavingId === request.id} onClick={() => onReviewRepRequest(request, 'ready_to_build')}>
                    {repRequestSavingId === request.id ? 'Saving...' : 'Approve'}
                  </button>
                  <button className="btn btn-outline btn-sm" type="button" disabled={repRequestSavingId === request.id} onClick={() => onReviewRepRequest(request, 'more_info_requested')}>
                    More Info
                  </button>
                  <button className="btn btn-outline btn-sm" type="button" disabled={repRequestSavingId === request.id} onClick={() => onReviewRepRequest(request, 'rejected')}>
                    Reject
                  </button>
                  <a className="btn btn-outline btn-sm" href="/admin/rep-requests">Open</a>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Rep Launch Checklist</div>
              <div className="card-subtitle">Approved reps that still need store setup, product list, code, payout, or login follow-through.</div>
            </div>
            <a className="btn btn-outline btn-sm" href="/admin/rep-store-manager">Stores</a>
          </div>
          <div className="card-body" style={{ display: 'grid', gap: 10 }}>
            {launchRows.length === 0 ? (
              <div className="empty-state" style={{ padding: 18 }}>
                <div className="empty-state-title">No approved reps waiting on launch</div>
                <div className="empty-state-desc">Approved requests will show here with setup status.</div>
              </div>
            ) : launchRows.map((row) => {
              const completeCount = row.checks.filter((check) => check.done).length;
              return (
                <div key={row.request.id} style={{ border: '1px solid rgba(15,23,42,.1)', borderRadius: 8, padding: 12, display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'start' }}>
                    <div>
                      <div style={{ color: 'var(--navy)', fontWeight: 950 }}>{row.request.full_name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{row.repCode} - {row.matchingStore?.storefront_path || '/aactivated'}</div>
                    </div>
                    <span className={`badge ${completeCount === row.checks.length ? 'badge-success' : 'badge-warning'}`}>
                      {completeCount}/{row.checks.length}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))', gap: 6 }}>
                    {row.checks.map((check) => (
                      <span
                        key={check.label}
                        className={`badge ${check.done ? 'badge-success' : 'badge-warning'}`}
                        style={{ justifyContent: 'center' }}
                      >
                        {check.done ? 'Done' : 'Needs'} {check.label}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <a className="btn btn-primary btn-sm" href={`/admin/rep-requests?bucket=approved&request=${encodeURIComponent(row.request.id)}`}>Finish Setup</a>
                    {row.matchingRep && !row.matchingRep.profile_id && (
                      <button
                        className="btn btn-outline btn-sm"
                        type="button"
                        disabled={repLoginSavingId === row.matchingRep.id}
                        onClick={() => onGrantLogin(row.matchingRep as Rep)}
                      >
                        {repLoginSavingId === row.matchingRep.id ? 'Creating Login...' : 'Create Temp Login'}
                      </button>
                    )}
                    {row.matchingRep?.profile_id && (
                      <button
                        className="btn btn-outline btn-sm"
                        type="button"
                        disabled={repLoginSavingId === row.matchingRep.id}
                        onClick={() => onGrantLogin(row.matchingRep as Rep)}
                      >
                        {repLoginSavingId === row.matchingRep.id ? 'Resetting...' : 'Reset Temp Password'}
                      </button>
                    )}
                    <a className="btn btn-outline btn-sm" href="/admin/rep-store-manager">Sub Store</a>
                    <a className="btn btn-outline btn-sm" href="/admin/aactivated-promos">Discount Code</a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18, alignItems: 'start' }}>
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Command Center</div>
              <div className="card-subtitle">Primary actions for AACTIVATEDRX operations.</div>
            </div>
          </div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {actionItems.map((item) => (
              <a
                key={item.href}
                href={item.href}
                style={{
                  display: 'grid',
                  gap: 5,
                  textDecoration: 'none',
                  color: 'inherit',
                  border: '1px solid rgba(15,23,42,.1)',
                  borderRadius: 8,
                  padding: 12,
                  background: '#fff',
                }}
              >
                <span style={{ color: 'var(--navy)', fontWeight: 950 }}>{item.label}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 12, lineHeight: 1.35 }}>{item.detail}</span>
              </a>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Readiness</div>
              <div className="card-subtitle">Sub-store, payout, and request status.</div>
            </div>
          </div>
          <div className="card-body" style={{ display: 'grid', gap: 10 }}>
            {healthItems.map((item) => (
              <a
                key={item.label}
                href={item.href}
                style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', textDecoration: 'none', color: 'inherit', borderBottom: '1px solid rgba(15,23,42,.08)', paddingBottom: 10 }}
              >
                <span style={{ color: 'var(--navy)', fontWeight: 900 }}>{item.label}</span>
                <span className={`badge ${item.tone}`}>{item.status}</span>
              </a>
            ))}
            <div style={{ display: 'grid', gap: 4, paddingTop: 2 }}>
              <div style={{ color: 'var(--text-muted)', fontSize: 12, fontWeight: 800, textTransform: 'uppercase' }}>This month</div>
              <div style={{ color: 'var(--navy)', fontSize: 20, fontWeight: 950 }}>{latestMonth ? money(latestMonth.revenue) : money(0)}</div>
              <div style={{ color: monthDelta >= 0 ? 'var(--success)' : 'var(--danger)', fontSize: 12, fontWeight: 800 }}>
                {monthDelta >= 0 ? '+' : ''}{money(monthDelta)} vs prior tracked month
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
        <SimpleTable
          title="Top Reps"
          columns={['Rep', 'Orders', 'Revenue', 'Commission']}
          rows={repPerformance.slice(0, 6).map((row) => [row.name, String(row.orders), money(row.revenue), money(row.commission)])}
        />
        <SimpleTable
          title="Top Products"
          columns={['Product', 'Units', 'Revenue', 'Trend']}
          rows={productPerformance.slice(0, 6).map((row) => [row.product, String(row.units), money(row.revenue), row.trend])}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
        <SimpleTable
          title="Recent AACTIVATEDRX Orders"
          columns={['Customer', 'Source / rep', 'Status', 'Submitted']}
          rows={recentOrders.map((order) => [
            order.email,
            order.source_rep || order.referral_code || order.checkout_scope_code || AACTIVATED_SOURCE_PORTAL,
            order.status,
            formatDate(order.created_at),
          ])}
        />
        <SimpleTable
          title="Recent Payout Activity"
          columns={['Rep', 'Amount', 'Status', 'Created']}
          rows={payoutRows}
        />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Customer Signal</div>
            <div className="card-subtitle">Checkout, refill, and retention snapshot.</div>
          </div>
        </div>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
          {[
            ['New customers', String(customerStats.newCustomers)],
            ['Repeat customers', String(customerStats.repeatCustomers)],
            ['Abandoned checkouts', String(conversionWatch)],
            ['Refill requests', String(customerStats.refillRequests)],
            ['Paid payouts', money(paidPayouts)],
            ['Open feature requests', String(pendingOpsRequests.length)],
            ['Net profit', canSeeProfit ? money(netProfit) : 'Scoped'],
          ].map(([label, value]) => (
            <div key={label} style={{ border: '1px solid rgba(15,23,42,.08)', borderRadius: 8, padding: 12, background: '#fff' }}>
              <div style={{ color: 'var(--navy)', fontSize: 18, fontWeight: 950 }}>{value}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11, fontWeight: 800, textTransform: 'uppercase' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function PricingManager({
  rows,
  drafts,
  setDrafts,
  savingId,
  message,
  onSave,
  onSaveAll,
}: {
  rows: AactivatedPriceRow[];
  drafts: Record<string, PriceDraft>;
  setDrafts: (drafts: Record<string, PriceDraft>) => void;
  savingId: string;
  message: string;
  onSave: (product: DistributorCatalogProduct) => void;
  onSaveAll: () => void;
}) {
  const rowMap = new Map(rows.map((row) => [row.product_id, row]));
  const baseProducts = getDistributorProducts('guy');
  const products = [...baseProducts].sort((a, b) => {
    const aDraft = drafts[a.id];
    const bDraft = drafts[b.id];
    const aSort = Number(aDraft?.sort_order || rowMap.get(a.id)?.sort_order || 9999);
    const bSort = Number(bDraft?.sort_order || rowMap.get(b.id)?.sort_order || 9999);
    return aSort - bSort || a.product_name.localeCompare(b.product_name) || a.id.localeCompare(b.id);
  });
  const storefrontTopTen = products
    .filter((product, index) => {
      const draft = drafts[product.id] ?? defaultPriceDraft(product, index, rowMap.get(product.id));
      return draft.is_active && draft.featured;
    })
    .slice(0, 10);

  function updateDraft(productId: string, patch: Partial<PriceDraft>) {
    const productIndex = baseProducts.findIndex((product) => product.id === productId);
    const product = baseProducts[productIndex];
    if (!product) return;
    const current = drafts[productId] ?? defaultPriceDraft(product, productIndex, rowMap.get(productId));
    setDrafts({
      ...drafts,
      [productId]: { ...current, ...patch },
    });
  }

  function moveProduct(productId: string, direction: 'top' | 'up' | 'down' | 'bottom') {
    const ordered = products.map((product) => product.id);
    const currentIndex = ordered.indexOf(productId);
    if (currentIndex < 0) return;
    const [moved] = ordered.splice(currentIndex, 1);
    const nextIndex = direction === 'top'
      ? 0
      : direction === 'bottom'
        ? ordered.length
        : direction === 'up'
          ? Math.max(0, currentIndex - 1)
          : Math.min(ordered.length, currentIndex + 1);
    ordered.splice(nextIndex, 0, moved);
    const nextDrafts = { ...drafts };
    ordered.forEach((id, index) => {
      const productIndex = baseProducts.findIndex((product) => product.id === id);
      const product = baseProducts[productIndex];
      if (!product) return;
      const current = nextDrafts[id] ?? defaultPriceDraft(product, productIndex, rowMap.get(id));
      nextDrafts[id] = { ...current, sort_order: String(index + 1) };
    });
    setDrafts(nextDrafts);
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">AACTIVATEDRX Pricing Manager</div>
          <div className="card-subtitle">Retail pricing, storefront order, visibility, and discounted bundle grouping for AACTIVATEDRX only.</div>
        </div>
        <button className="btn btn-primary" type="button" onClick={onSaveAll} disabled={savingId === 'all'}>
          {savingId === 'all' ? 'Saving All...' : 'Save All Product Changes'}
        </button>
      </div>
      <div className="card-body" style={{ display: 'grid', gap: 14 }}>
        {message && <div className="alert alert-success">{message}</div>}
        <div className="alert alert-info">
          Changes apply only to the AACTIVATEDRX storefront, cart, and checkout. Bundle discounts apply when a cart contains at least two products from the same bundle group. Historical orders keep the price captured at purchase time.
        </div>
        <div style={{ background: '#f8fbfc', border: '1px solid rgba(8,145,178,.18)', borderRadius: 12, padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'baseline', flexWrap: 'wrap', marginBottom: 10 }}>
            <div>
              <div style={{ color: '#0891b2', fontSize: 12, fontWeight: 950, letterSpacing: '.08em', textTransform: 'uppercase' }}>Storefront Top 10</div>
              <div style={{ color: 'var(--navy)', fontSize: 18, fontWeight: 950 }}>Products currently set to appear on the AACTIVATED main page</div>
            </div>
            <span className={`badge ${storefrontTopTen.length === 10 ? 'badge-success' : 'badge-warning'}`}>
              {storefrontTopTen.length}/10 selected
            </span>
          </div>
          {storefrontTopTen.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>No active featured products selected. Check “Top seller” on 10 products, adjust sort, then Save All.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
              {storefrontTopTen.map((product, index) => {
                const draft = drafts[product.id] ?? defaultPriceDraft(product, index, rowMap.get(product.id));
                return (
                  <div key={product.id} style={{ background: '#fff', border: '1px solid rgba(15,23,42,.08)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ color: '#0891b2', fontSize: 11, fontWeight: 950 }}>#{index + 1}</div>
                    <div style={{ color: 'var(--navy)', fontWeight: 900 }}>{product.product_name}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12 }}>{product.strength} · Sort {draft.sort_order || index + 1}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div style={{ position: 'sticky', top: 8, zIndex: 5, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', boxShadow: '0 10px 24px rgba(15,23,42,.08)' }}>
          <div>
            <div style={{ fontWeight: 900, color: 'var(--navy)' }}>Universal save</div>
            <div className="form-help">Move products, edit prices, set bundle groups, then save the full manager at once.</div>
          </div>
          <button className="btn btn-primary btn-sm" type="button" onClick={onSaveAll} disabled={savingId === 'all'}>
            {savingId === 'all' ? 'Saving...' : 'Save All'}
          </button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Move</th>
                <th>Product</th>
                <th>Retail Price</th>
                <th>Sale Price</th>
                <th>Visible</th>
                <th>Featured</th>
                <th>Sort</th>
                <th>Note / Bundle</th>
                <th>Last Updated</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {products.map((product, index) => {
                const row = rowMap.get(product.id);
                const draft = drafts[product.id] ?? defaultPriceDraft(product, index, row);
                const salePrice = draft.sale_price.trim() ? Number(draft.sale_price) : null;
                const retailPrice = Number(draft.retail_price);
                const marginWarning = Number.isFinite(retailPrice) && retailPrice > 0 && retailPrice < 50;
                const saleWarning = salePrice != null && salePrice > 0 && salePrice < 50;
                return (
                  <tr key={product.id}>
                    <td>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(34px, 1fr))', gap: 4, minWidth: 88 }}>
                        <button className="btn btn-outline btn-sm" type="button" onClick={() => moveProduct(product.id, 'top')} disabled={index === 0}>Top</button>
                        <button className="btn btn-outline btn-sm" type="button" onClick={() => moveProduct(product.id, 'up')} disabled={index === 0}>Up</button>
                        <button className="btn btn-outline btn-sm" type="button" onClick={() => moveProduct(product.id, 'down')} disabled={index === products.length - 1}>Down</button>
                        <button className="btn btn-outline btn-sm" type="button" onClick={() => moveProduct(product.id, 'bottom')} disabled={index === products.length - 1}>End</button>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 800, color: 'var(--navy)' }}>{product.product_name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{product.strength} - {product.category}</div>
                      {draft.bundle_group_name.trim() && <div style={{ fontSize: 11, color: '#0e7490', fontWeight: 800, marginTop: 4 }}>Bundle: {draft.bundle_group_name}</div>}
                    </td>
                    <td>
                      <input
                        className="form-input"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={draft.retail_price}
                        onChange={(event) => updateDraft(product.id, { retail_price: event.target.value })}
                        style={{ minWidth: 110 }}
                      />
                      {marginWarning && <div className="form-help" style={{ color: 'var(--warning)' }}>This price may be below the recommended margin. Confirm before saving.</div>}
                    </td>
                    <td>
                      <input
                        className="form-input"
                        type="number"
                        min="0.01"
                        step="0.01"
                        placeholder="Optional"
                        value={draft.sale_price}
                        onChange={(event) => updateDraft(product.id, { sale_price: event.target.value })}
                        style={{ minWidth: 110 }}
                      />
                      {saleWarning && <div className="form-help" style={{ color: 'var(--warning)' }}>This price may be below the recommended margin. Confirm before saving.</div>}
                    </td>
                    <td>
                      <label className="checkbox-item" style={{ alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={draft.is_active}
                          onChange={(event) => updateDraft(product.id, { is_active: event.target.checked })}
                        />
                        <span>{draft.is_active ? 'Active' : 'Hidden'}</span>
                      </label>
                    </td>
                    <td>
                      <label className="checkbox-item" style={{ alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={draft.featured}
                          onChange={(event) => updateDraft(product.id, { featured: event.target.checked })}
                        />
                        <span>{draft.featured ? 'Top seller' : 'Standard'}</span>
                      </label>
                    </td>
                    <td>
                      <input
                        className="form-input"
                        type="number"
                        min="1"
                        step="1"
                        value={draft.sort_order}
                        onChange={(event) => updateDraft(product.id, { sort_order: event.target.value })}
                        style={{ width: 86 }}
                      />
                    </td>
                    <td>
                      <div style={{ display: 'grid', gap: 8, minWidth: 280 }}>
                        <input
                          className="form-input"
                          value={draft.product_note}
                          placeholder="Optional storefront note"
                          onChange={(event) => updateDraft(product.id, { product_note: event.target.value })}
                        />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          <input
                            className="form-input"
                            value={draft.bundle_group_name}
                            placeholder="Bundle name"
                            onChange={(event) => updateDraft(product.id, { bundle_group_name: event.target.value })}
                          />
                          <input
                            className="form-input"
                            value={draft.bundle_group_key}
                            placeholder="Bundle key optional"
                            onChange={(event) => updateDraft(product.id, { bundle_group_key: event.target.value })}
                          />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                          <input
                            className="form-input"
                            type="number"
                            min="0"
                            max="100"
                            step="0.01"
                            value={draft.bundle_discount_percent}
                            placeholder="% off bundle"
                            onChange={(event) => updateDraft(product.id, { bundle_discount_percent: event.target.value })}
                          />
                          <input
                            className="form-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={draft.bundle_discount_amount}
                            placeholder="$ off bundle"
                            onChange={(event) => updateDraft(product.id, { bundle_discount_amount: event.target.value })}
                          />
                        </div>
                        <input
                          className="form-input"
                          value={draft.bundle_note}
                          placeholder="Bundle note shown on storefront"
                          onChange={(event) => updateDraft(product.id, { bundle_note: event.target.value })}
                        />
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row ? formatDate(row.updated_at) : 'Not changed'}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{row?.updated_by ? `By ${row.updated_by.slice(0, 8)}` : '-'}</div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-primary btn-sm" type="button" onClick={() => onSave(product)} disabled={savingId === product.id}>
                        {savingId === product.id ? 'Saving...' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StoreSettingsPanel({
  settings,
  setSettings,
  saving,
  message,
  onSave,
}: {
  settings: StoreSettingsDraft;
  setSettings: (settings: StoreSettingsDraft) => void;
  saving: boolean;
  message: string;
  onSave: () => void;
}) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">AACTIVATEDRX Store Settings</div>
          <div className="card-subtitle">Store-facing settings only. Platform settings and payment processor settings are not available here.</div>
        </div>
      </div>
      <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
        {message && <div className="alert alert-success" style={{ gridColumn: '1 / -1' }}>{message}</div>}
        {[
          ['logoSrc', 'Store logo'],
          ['heroImage', 'Hero image'],
          ['supportContact', 'Support contact'],
          ['description', 'Public description'],
          ['promoBanner', 'Promo banner'],
          ['socialLinks', 'Public social/contact links'],
        ].map(([key, label]) => (
          <label className="form-group" key={key}>
            <span className="form-label">{label}</span>
            <input
              className="form-input"
              value={settings[key as keyof StoreSettingsDraft]}
              onChange={(event) => setSettings({ ...settings, [key]: event.target.value })}
            />
          </label>
        ))}
        <div style={{ gridColumn: '1 / -1' }}>
          <button className="btn btn-primary" type="button" onClick={onSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
          <span className="text-muted text-sm" style={{ marginLeft: 12 }}>Saved under AACTIVATEDRX only.</span>
        </div>
      </div>
    </div>
  );
}

function CommissionManager({
  reps,
  ledger,
  settings,
  drafts,
  setDrafts,
  onSave,
}: {
  reps: Rep[];
  ledger: CommissionLedger[];
  settings: PartnerCommissionSetting[];
  drafts: Record<string, CommissionDraft>;
  setDrafts: (drafts: Record<string, CommissionDraft>) => void;
  onSave: (rep: Rep) => void;
}) {
  const settingMap = new Map(settings.map((row) => [row.rep_id, row]));

  function update(repId: string, patch: Partial<CommissionDraft>) {
    const current = drafts[repId] ?? {
      commission_type: 'flat_net_profit',
      commission_percent: '',
      override_percent: '',
      special_note: '',
      internal_notes: '',
    };
    setDrafts({ ...drafts, [repId]: { ...current, ...patch } });
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Scoped Commission Manager</div>
          <div className="card-subtitle">Rep-facing AACTIVATEDRX commissions only. Platform-only payout controls are locked.</div>
        </div>
      </div>
      <div className="card-body" style={{ display: 'grid', gap: 14 }}>
        <div className="alert alert-info">
          Guardrails: partner edits up to {MAX_PARTNER_COMMISSION_PERCENT}% save as active. Higher values are marked Needs Platform Approval. Values above {HARD_MAX_COMMISSION_PERCENT}% are blocked.
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Rep</th>
                <th>Structure</th>
                <th>Commission %</th>
                <th>Override %</th>
                <th>Payout Status</th>
                <th>Notes</th>
                <th>Approval</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {reps.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>No AACTIVATEDRX reps found.</td></tr>
              ) : reps.map((rep) => {
                const setting = settingMap.get(rep.id);
                const draft = drafts[rep.id] ?? {
                  commission_type: setting?.commission_type ?? rep.commission_type ?? 'flat_net_profit',
                  commission_percent: String(setting?.commission_percent ?? Number(rep.commission_rate ?? 0) * 100),
                  override_percent: setting?.override_percent != null ? String(setting.override_percent) : '',
                  special_note: setting?.special_note ?? '',
                  internal_notes: setting?.internal_notes ?? '',
                };
                const repLedger = ledger.filter((row) => row.rep_id === rep.id);
                const pending = repLedger.filter((row) => row.status === 'pending' || row.status === 'payable').reduce((sum, row) => sum + Number(row.commission_amount ?? 0), 0);
                const paid = repLedger.filter((row) => row.status === 'paid').reduce((sum, row) => sum + Number(row.commission_amount ?? 0), 0);
                const needsApproval = Number(draft.commission_percent) > MAX_PARTNER_COMMISSION_PERCENT || Number(draft.override_percent || 0) > MAX_PARTNER_COMMISSION_PERCENT;
                return (
                  <tr key={rep.id}>
                    <td>
                      <div style={{ fontWeight: 800, color: 'var(--navy)' }}>{rep.rep_name || rep.rep_slug}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{rep.payout_email || rep.rep_slug}</div>
                    </td>
                    <td>
                      <select className="form-select" value={draft.commission_type} onChange={(event) => update(rep.id, { commission_type: event.target.value })}>
                        <option value="flat_net_profit">Flat % of net profit</option>
                        <option value="tiered_net_profit">Tiered commission %</option>
                        <option value="override_downline">Override for downline reps</option>
                      </select>
                    </td>
                    <td><input className="form-input" type="number" min="0" max={HARD_MAX_COMMISSION_PERCENT} step="0.1" value={draft.commission_percent} onChange={(event) => update(rep.id, { commission_percent: event.target.value })} style={{ width: 110 }} /></td>
                    <td><input className="form-input" type="number" min="0" max={HARD_MAX_COMMISSION_PERCENT} step="0.1" placeholder="Optional" value={draft.override_percent} onChange={(event) => update(rep.id, { override_percent: event.target.value })} style={{ width: 110 }} /></td>
                    <td>
                      <div>Pending {money(pending)}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Paid {money(paid)}</div>
                    </td>
                    <td>
                      <input className="form-input" value={draft.special_note} placeholder="Special commission note" onChange={(event) => update(rep.id, { special_note: event.target.value })} />
                      <input className="form-input" value={draft.internal_notes} placeholder="Internal notes" onChange={(event) => update(rep.id, { internal_notes: event.target.value })} style={{ marginTop: 8 }} />
                    </td>
                    <td><span className={`badge ${needsApproval || setting?.approval_required ? 'badge-warning' : 'badge-success'}`}>{needsApproval || setting?.approval_required ? 'Needs Platform Approval' : 'Active'}</span></td>
                    <td style={{ textAlign: 'right' }}><button className="btn btn-primary btn-sm" type="button" onClick={() => onSave(rep)}>Save</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProductListBuilder({
  lists,
  items,
  onCreate,
}: {
  lists: PartnerProductList[];
  items: PartnerProductListItem[];
  onCreate: (listName: string, listType: string, productIds: string[], notes: string) => void;
}) {
  const products = getDistributorProducts('guy');
  const [listName, setListName] = useState('GLP Starter');
  const [listType, setListType] = useState('glp_starter');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [notes, setNotes] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>(() => products.filter((product) => product.category.includes('GLP')).map((product) => product.id));
  const categories = ['All', ...Array.from(new Set(products.map((product) => product.category)))];
  const visibleProducts = products.filter((product) => categoryFilter === 'All' || product.category === categoryFilter);
  const itemsByList = new Map<string, PartnerProductListItem[]>();
  items.forEach((item) => itemsByList.set(item.product_list_id, [...(itemsByList.get(item.product_list_id) ?? []), item]));

  function applyTemplate(nextType: string) {
    setListType(nextType);
    const templateName = nextType.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
    setListName(templateName === 'Glp Starter' ? 'GLP Starter' : templateName);
    const nextSelected = products.filter((product) => {
      if (nextType === 'full_catalog') return true;
      if (nextType === 'glp_starter') return product.category.includes('GLP');
      if (nextType === 'performance') return product.category.includes('Performance') || product.category.includes('Growth');
      if (nextType === 'recovery') return product.category.includes('Recovery');
      if (nextType === 'longevity') return product.category.includes('Longevity');
      return selectedIds.includes(product.id);
    }).map((product) => product.id);
    setSelectedIds(nextSelected);
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">AACTIVATEDRX Product List Builder</div>
            <div className="card-subtitle">Reusable product lists can be assigned to rep stores. Only AACTIVATEDRX-approved products are available.</div>
          </div>
        </div>
        <div className="card-body" style={{ display: 'grid', gap: 14 }}>
          <div className="form-grid-2">
            <label className="form-group">
              <span className="form-label">List name</span>
              <input className="form-input" value={listName} onChange={(event) => setListName(event.target.value)} />
            </label>
            <label className="form-group">
              <span className="form-label">Template</span>
              <select className="form-select" value={listType} onChange={(event) => applyTemplate(event.target.value)}>
                <option value="full_catalog">Full Catalog</option>
                <option value="glp_starter">GLP Starter</option>
                <option value="performance">Performance</option>
                <option value="recovery">Recovery</option>
                <option value="longevity">Longevity</option>
                <option value="custom">Custom List</option>
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <select className="form-select" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} style={{ maxWidth: 280 }}>
              {categories.map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
            <button className="btn btn-outline btn-sm" type="button" onClick={() => setSelectedIds(Array.from(new Set([...selectedIds, ...visibleProducts.map((product) => product.id)])))}>Select visible</button>
            <button className="btn btn-outline btn-sm" type="button" onClick={() => setSelectedIds(selectedIds.filter((id) => !visibleProducts.some((product) => product.id === id)))}>Deselect visible</button>
          </div>
          <label className="form-group">
            <span className="form-label">Notes</span>
            <textarea className="form-textarea" rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </label>
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Use</th><th>Product</th><th>Category</th><th>Retail Price</th><th>Visibility</th></tr></thead>
              <tbody>
                {visibleProducts.map((product) => (
                  <tr key={product.id}>
                    <td><input type="checkbox" checked={selectedIds.includes(product.id)} onChange={(event) => setSelectedIds(event.target.checked ? [...selectedIds, product.id] : selectedIds.filter((id) => id !== product.id))} /></td>
                    <td><strong>{product.product_name}</strong><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{product.strength}</div></td>
                    <td>{product.category}</td>
                    <td>{money(product.displayPrice ?? 0)}</td>
                    <td>{product.distributorProduct.is_enabled ? 'Visible' : 'Hidden'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-primary" type="button" onClick={() => onCreate(listName, listType, selectedIds, notes)}>Create Product List</button>
        </div>
      </div>
      <SimpleTable
        title="Saved Product Lists"
        columns={['List', 'Type', 'Products', 'Pricing Mode', 'Status', 'Updated']}
        rows={lists.map((list) => [
          list.list_name,
          list.list_type,
          String(itemsByList.get(list.id)?.length ?? 0),
          list.default_pricing_mode,
          list.status,
          formatDate(list.updated_at),
        ])}
      />
    </div>
  );
}

function RepStoreManager({
  reps,
  allReps,
  orders,
  settings,
  productLists,
  commissionSettings,
  onSave,
  onGrantLogin,
  focusedRepSlug,
}: {
  reps: Rep[];
  allReps: Rep[];
  orders: PatientSubmission[];
  settings: PartnerRepStoreSetting[];
  productLists: PartnerProductList[];
  commissionSettings: PartnerCommissionSetting[];
  onSave: (rep: Rep, draft: RepStoreDraft) => void;
  onGrantLogin: (rep: Rep) => void;
  focusedRepSlug: string;
}) {
  const settingMap = new Map(settings.map((row) => [row.rep_id, row]));
  const commissionMap = new Map(commissionSettings.map((row) => [row.rep_id, row]));
  const mainPortalRep = allReps.find((rep) => rep.rep_slug === AACTIVATED_ADMIN_REP_CODE);
  const parentableReps = allReps.filter((rep) => (
    rep.active !== false
    && isAactivatedRep(rep)
    && rep.account_type !== 'admin'
    && !String(rep.rep_tier ?? '').toLowerCase().includes('admin')
  ));
  const childCounts = allReps.reduce<Record<string, number>>((acc, rep) => {
    if (rep.parent_rep_id) acc[rep.parent_rep_id] = (acc[rep.parent_rep_id] ?? 0) + 1;
    return acc;
  }, {});
  const repById = new Map(allReps.map((rep) => [rep.id, rep]));
  const defaultFeatures = {
    product_library: true,
    mixing_center: true,
    certificates: true,
    customer_portal: true,
    peprxbot: true,
    discount_code_box: true,
    receipt_upload: true,
    rep_contact_card: true,
  };
  const [drafts, setDrafts] = useState<Record<string, RepStoreDraft>>({});
  const focusedRep = reps.find((rep) => rep.rep_slug.toUpperCase() === focusedRepSlug);

  useEffect(() => {
    if (!focusedRep) return;
    window.setTimeout(() => document.getElementById(`rep-store-${focusedRep.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
  }, [focusedRep]);

  function draftFor(rep: Rep): RepStoreDraft {
    const saved = settingMap.get(rep.id);
    return drafts[rep.id] ?? {
      public_display_name: saved?.public_display_name ?? rep.rep_name ?? rep.rep_slug,
      store_slug: saved?.store_slug ?? normalizeRepSlug(rep.rep_slug),
      parent_rep_id: rep.parent_rep_id ?? mainPortalRep?.id ?? '',
      product_list_id: saved?.product_list_id ?? productLists[0]?.id ?? '',
      pricing_mode: saved?.pricing_mode ?? 'aactivated_default',
      status: saved?.status ?? 'draft',
      features: { ...defaultFeatures, ...(saved?.features ?? {}) },
    };
  }

  function update(repId: string, patch: Partial<RepStoreDraft>) {
    const rep = reps.find((row) => row.id === repId);
    if (!rep) return;
    setDrafts({ ...drafts, [repId]: { ...draftFor(rep), ...patch } });
  }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">AACTIVATEDRX Rep Store Manager</div>
          <div className="card-subtitle">Configure rep stores, hierarchy/uplines, links, product lists, commission references, and storefront features.</div>
        </div>
      </div>
      {focusedRep && <div className="alert alert-success" style={{ margin: 16 }}><strong>{focusedRep.rep_name || focusedRep.rep_slug} is ready for store setup.</strong><br />Review the highlighted row, choose the store status and options, then select Save Store.</div>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Rep</th>
              <th>Hierarchy</th>
              <th>Store Setup</th>
              <th>Product List</th>
              <th>Pricing</th>
              <th>Features</th>
              <th>Sales / Orders</th>
              <th>Links</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {reps.length === 0 ? (
              <tr><td colSpan={9} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>No AACTIVATEDRX rep stores found.</td></tr>
            ) : reps.map((rep) => {
              const draft = draftFor(rep);
              const repOrders = orders.filter((order) => order.rep_id === rep.id || order.referral_code === rep.rep_slug || order.source_rep === rep.rep_slug || order.discount_code === rep.discount_code);
              const sales = repOrders.filter((order) => order.status === 'paid' || order.status === 'fulfilled').reduce((sum, order) => sum + orderRevenue(order), 0);
              const commission = commissionMap.get(rep.id);
              const storeLink = `/aactivated?rep=${encodeURIComponent(rep.rep_slug)}`;
              const checkoutAttributionLink = `/aactivated?rep=${encodeURIComponent(rep.rep_slug)}&scope=${encodeURIComponent(rep.rep_slug)}`;
              const absoluteStoreLink = typeof window !== 'undefined' ? `${window.location.origin}${storeLink}` : storeLink;
              const absoluteCheckoutLink = typeof window !== 'undefined' ? `${window.location.origin}${checkoutAttributionLink}` : checkoutAttributionLink;
              const parentRep = draft.parent_rep_id ? repById.get(draft.parent_rep_id) : null;
              const availableParents = parentableReps.filter((candidate) => (
                candidate.id !== rep.id
                && !isRepDescendant(allReps, candidate.id, rep.id)
              ));
              return (
                <tr id={`rep-store-${rep.id}`} key={rep.id} style={focusedRep?.id === rep.id ? { outline: '3px solid var(--teal)', outlineOffset: -3, background: 'rgba(17, 181, 196, .08)' } : undefined}>
                  <td><strong>{rep.rep_name || rep.rep_slug}</strong><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{rep.payout_email}</div></td>
                  <td>
                    <select className="form-select" value={draft.parent_rep_id} onChange={(event) => update(rep.id, { parent_rep_id: event.target.value })}>
                      {!mainPortalRep && <option value="">AACTIVATEDRX Main Portal</option>}
                      {mainPortalRep && <option value={mainPortalRep.id}>AACTIVATEDRX Main Portal / GUY60</option>}
                      {availableParents
                        .filter((candidate) => candidate.rep_slug !== AACTIVATED_ADMIN_REP_CODE)
                        .map((candidate) => (
                          <option key={candidate.id} value={candidate.id}>
                            Under {candidate.rep_name || candidate.rep_slug} ({candidate.rep_slug})
                          </option>
                        ))}
                    </select>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                      Upline: {parentRep ? `${parentRep.rep_name || parentRep.rep_slug} (${parentRep.rep_slug})` : 'AACTIVATEDRX Main Portal'}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      Direct downline: {childCounts[rep.id] ?? 0} rep{(childCounts[rep.id] ?? 0) === 1 ? '' : 's'}
                    </div>
                  </td>
                  <td>
                    <input className="form-input" value={draft.public_display_name} onChange={(event) => update(rep.id, { public_display_name: event.target.value })} placeholder="Display name" />
                    <input className="form-input" value={draft.store_slug} onChange={(event) => update(rep.id, { store_slug: event.target.value })} placeholder="Store slug" style={{ marginTop: 8 }} />
                    <select className="form-select" value={draft.status} onChange={(event) => update(rep.id, { status: event.target.value })} style={{ marginTop: 8 }}>
                      <option value="draft">Draft</option>
                      <option value="active">Active</option>
                      <option value="disabled">Disabled</option>
                    </select>
                  </td>
                  <td>
                    <select className="form-select" value={draft.product_list_id} onChange={(event) => update(rep.id, { product_list_id: event.target.value })}>
                      <option value="">Full AACTIVATEDRX Catalog</option>
                      {productLists.map((list) => <option key={list.id} value={list.id}>{list.list_name}</option>)}
                    </select>
                  </td>
                  <td>
                    <select className="form-select" value={draft.pricing_mode} onChange={(event) => update(rep.id, { pricing_mode: event.target.value })}>
                      <option value="aactivated_default">Default AACTIVATEDRX pricing</option>
                      <option value="rep_override">Rep-specific override if enabled</option>
                      <option value="sale_price">Apply sale price where enabled</option>
                    </select>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{commission ? `${commission.commission_type} / ${commission.commission_percent}%` : 'No custom commission yet'}</div>
                  </td>
                  <td>
                    <FeatureToggleGrid features={draft.features} onChange={(features) => update(rep.id, { features })} />
                  </td>
                  <td>{money(sales)}<div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{repOrders.length} orders</div></td>
                  <td>
                    {rep.profile_id ? (
                      <span className="badge badge-success">Rep portal linked</span>
                    ) : (
                      <button className="btn btn-outline btn-sm" type="button" onClick={() => onGrantLogin(rep)}>
                        Grant Login + Temp PW
                      </button>
                    )}
                    <div style={{ fontFamily: 'monospace', fontSize: 12, marginTop: 8 }}>{storeLink}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                      <a className="btn btn-outline btn-sm" href={storeLink} target="_blank" rel="noreferrer">Preview Store</a>
                      <button className="btn btn-outline btn-sm" type="button" onClick={() => copyTextIfPossible(absoluteStoreLink)}>Copy Store Link</button>
                      <button className="btn btn-outline btn-sm" type="button" onClick={() => copyTextIfPossible(absoluteCheckoutLink)}>Copy Checkout Link</button>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>Code: {rep.discount_code || rep.rep_slug}</div>
                  </td>
                  <td style={{ textAlign: 'right' }}><button className="btn btn-primary btn-sm" type="button" onClick={() => onSave(rep, draft)}>Save Store</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FeatureToggleGrid({ features, onChange }: { features: Record<string, boolean>; onChange: (features: Record<string, boolean>) => void }) {
  const labels: Record<string, string> = {
    product_library: 'Product library',
    mixing_center: 'Mixing center',
    certificates: 'COA / certificates',
    customer_portal: 'Customer portal',
    peprxbot: 'Ask PEPRXbot',
    discount_code_box: 'Discount box',
    receipt_upload: 'Receipt upload',
    rep_contact_card: 'Rep contact card',
  };
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      {Object.entries(labels).map(([key, label]) => (
        <label className="checkbox-item" key={key}>
          <input type="checkbox" checked={features[key] !== false} onChange={(event) => onChange({ ...features, [key]: event.target.checked })} />
          <span>{label}</span>
        </label>
      ))}
    </div>
  );
}

function generateTemporaryPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const values = new Uint32Array(16);
  crypto.getRandomValues(values);
  const body = Array.from(values, (value) => chars[value % chars.length]).join('');
  return `PsRX-${body}!9`;
}

async function copyTextIfPossible(value: string) {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    // Clipboard permissions vary by browser; the success banner still shows the value.
  }
}

function FeatureRequestsPanel({ requests, onSubmit }: { requests: PartnerFeatureRequest[]; onSubmit: (request: { request_title: string; priority: string; category: string; description: string }) => void }) {
  const [draft, setDraft] = useState({ request_title: '', priority: 'medium', category: 'Storefront', description: '' });
  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Store Improvement Notes</div>
            <div className="card-subtitle">Submit scoped AACTIVATEDRX requests for platform admin review.</div>
          </div>
        </div>
        <div className="card-body" style={{ display: 'grid', gap: 14 }}>
          <div className="form-grid-2">
            <label className="form-group">
              <span className="form-label">Request title</span>
              <input className="form-input" value={draft.request_title} onChange={(event) => setDraft({ ...draft, request_title: event.target.value })} />
            </label>
            <label className="form-group">
              <span className="form-label">Priority</span>
              <select className="form-select" value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </label>
          </div>
          <label className="form-group">
            <span className="form-label">Category</span>
            <select className="form-select" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
              {['Storefront', 'Products', 'Pricing', 'Commissions', 'Reps', 'Orders', 'Marketing', 'Other'].map((category) => <option key={category} value={category}>{category}</option>)}
            </select>
          </label>
          <label className="form-group">
            <span className="form-label">Description</span>
            <textarea className="form-textarea" rows={5} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
          </label>
          <button className="btn btn-primary" type="button" onClick={() => {
            onSubmit(draft);
            setDraft({ request_title: '', priority: 'medium', category: 'Storefront', description: '' });
          }}>Submit Request</button>
        </div>
      </div>
      <SimpleTable
        title="Submitted Feature Requests"
        columns={['Title', 'Priority', 'Category', 'Status', 'Created']}
        rows={requests.map((request) => [request.request_title, request.priority, request.category, request.status, formatDate(request.created_at)])}
      />
    </div>
  );
}

function PerformanceTable({ rows }: { rows: ReturnType<typeof buildRepPerformance> }) {
  return (
    <SimpleTable
      title="Rep Performance Leaderboard"
      columns={['Rep name', 'Orders', 'Revenue', 'Commission', 'Status', 'Last activity']}
      rows={rows.map((row) => [row.name, String(row.orders), money(row.revenue), money(row.commission), row.status, row.lastActivity])}
    />
  );
}

function SimpleTable({ title, columns, rows }: { title: string; columns: string[]; rows: string[][] }) {
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">{title}</div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>{columns.map((column) => <th key={column}>{column}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={columns.length} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>No AACTIVATEDRX records found.</td></tr>
            ) : rows.map((row, index) => (
              <tr key={`${title}-${index}`}>
                {row.map((cell, cellIndex) => <td key={`${title}-${index}-${cellIndex}`}>{cell || '-'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function buildRepPerformance(reps: Rep[], orders: PatientSubmission[], ledger: CommissionLedger[]) {
  return reps
    .filter((rep) => rep.rep_slug !== AACTIVATED_ADMIN_REP_CODE)
    .map((rep) => {
      const repOrders = orders.filter((order) => (
        order.rep_id === rep.id
        || order.referral_code === rep.rep_slug
        || order.source_rep === rep.rep_slug
        || order.discount_code === rep.discount_code
      ));
      const repLedger = ledger.filter((row) => row.rep_id === rep.id);
      const paid = repOrders.filter((order) => order.status === 'paid' || order.status === 'fulfilled');
      return {
        name: rep.rep_name || rep.handle || rep.rep_slug,
        orders: repOrders.length,
        revenue: paid.reduce((sum, order) => sum + orderRevenue(order), 0),
        commission: repLedger.reduce((sum, row) => sum + Number(row.commission_amount ?? 0), 0),
        status: rep.active ? 'Active' : 'Inactive',
        lastActivity: repOrders[0] ? formatDate(repOrders[0].created_at) : '-',
      };
    })
    .sort((a, b) => b.revenue - a.revenue || b.orders - a.orders);
}

function buildProductPerformance(orders: PatientSubmission[]) {
  const map = new Map<string, { product: string; units: number; revenue: number }>();
  orders.forEach((order) => {
    const name = order.product_name || order.medication || 'Unspecified product';
    const current = map.get(name) ?? { product: name, units: 0, revenue: 0 };
    current.units += Math.max(1, Array.isArray(order.order_items) ? order.order_items.length : 1);
    if (order.status === 'paid' || order.status === 'fulfilled') current.revenue += orderRevenue(order);
    map.set(name, current);
  });
  return Array.from(map.values())
    .sort((a, b) => b.revenue - a.revenue || b.units - a.units)
    .map((row) => ({ ...row, trend: row.revenue > 0 ? 'Converting' : 'Watching' }));
}

function buildCustomerStats(orders: PatientSubmission[]) {
  const byEmail = new Map<string, number>();
  orders.forEach((order) => byEmail.set(order.email, (byEmail.get(order.email) ?? 0) + 1));
  return {
    newCustomers: Array.from(byEmail.values()).filter((count) => count === 1).length,
    repeatCustomers: Array.from(byEmail.values()).filter((count) => count > 1).length,
    abandonedCheckouts: orders.filter((order) => order.payment_status === 'unpaid' || order.status === 'cancelled_refunded').length,
    refillRequests: orders.filter((order) => /refill/i.test(String(order.submission_type ?? order.inquiry_notes ?? ''))).length,
  };
}

function buildMonthlyTrends(orders: PatientSubmission[]) {
  const map = new Map<string, { month: string; orders: number; revenue: number }>();
  orders.forEach((order) => {
    const month = order.created_at.slice(0, 7);
    const current = map.get(month) ?? { month, orders: 0, revenue: 0 };
    current.orders += 1;
    current.revenue += orderRevenue(order);
    map.set(month, current);
  });
  return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
}

function orderRevenue(order: PatientSubmission): number {
  return Number(order.order_total ?? order.quoted_price ?? order.current_price ?? 0);
}

function estimateNetProfit(orders: PatientSubmission[]): number {
  return orders.reduce((sum, order) => sum + Math.max(0, orderRevenue(order) - Number(order.cost_of_goods ?? 0)), 0);
}

function money(value: number): string {
  return `$${Number(value ?? 0).toFixed(2)}`;
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
}

function requestedRepCode(row: RepStoreIntakeSubmission): string {
  const base = row.desired_rep_code || row.store_brand_name || row.full_name || 'AACTIVATEDREP';
  return base
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 24) || 'AACTIVATEDREP';
}

function intakeStatusToApprovalStatus(status: RepStoreIntakeStatus): string {
  if (status === 'ready_to_build' || status === 'launched') return 'approved';
  if (status === 'rejected') return 'rejected';
  if (status === 'more_info_requested') return 'more_info_requested';
  return 'pending';
}

function approvalStatusLabelForIntake(status: string): string {
  if (status === 'pending') return 'Pending';
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  if (status === 'more_info_requested') return 'More Info Requested';
  return status.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
}

function repRequestReviewNote(status: RepStoreIntakeStatus, adminName: string): string {
  const action = status === 'ready_to_build'
    ? 'Approved from the AACTIVATEDRX dashboard.'
    : status === 'more_info_requested'
      ? 'More information requested from the AACTIVATEDRX dashboard.'
      : status === 'rejected'
        ? 'Rejected from the AACTIVATEDRX dashboard.'
        : `Updated to ${approvalStatusLabelForIntake(intakeStatusToApprovalStatus(status))} from the AACTIVATEDRX dashboard.`;
  return `${action} Reviewed by ${adminName}.`;
}

function normalizeRepSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'aactivated-rep';
}

function titleForMode(mode: ToolMode): string {
  switch (mode) {
    case 'dashboard': return 'AACTIVATEDRX Dashboard';
    case 'commission': return 'Commission Center';
    case 'rep-store-manager': return 'Rep Store Manager';
    case 'product-lists': return 'Product Lists';
    case 'feature-requests': return 'Feature Requests';
    case 'leaderboard': return 'Rep Performance Leaderboard';
    case 'customer': return 'Customer Activity Center';
    case 'product': return 'Product Performance Dashboard';
    case 'store-settings': return 'Store Settings';
    case 'pricing': return 'Pricing Manager';
    case 'payouts': return 'Payouts';
    case 'scope-codes': return 'Scope Codes';
    case 'payment-audit': return 'PayPal Audit';
    case 'zelle': return 'Manual Payments';
    default: return AACTIVATED_PARENT_STORE_NAME;
  }
}
