import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import DashLayout from '../../components/layout/DashLayout';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import type { CommissionLedger, PatientSubmission, Rep, SubmissionStatus } from '../../types';
import { ALL_STATUSES, STATUS_LABELS } from '../../types';
import {
  ROCKPHORM_ADMIN_EMAIL,
  ROCKPHORM_ADMIN_NAV,
  ROCKPHORM_COMMISSION_RATE,
  ROCKPHORM_LOGO_SRC,
  ROCKPHORM_SCOPE_CODE,
  ROCKPHORM_STORE_NAME,
  ROCKPHORM_STORE_SLUG,
  ROCKPHORM_VIAL_SRC,
  AURORA_ADMIN_EMAIL,
  AURORA_COMMISSION_RATE,
  AURORA_LOGO_SRC,
  AURORA_SCOPE_CODE,
  AURORA_STORE_NAME,
  AURORA_STORE_SLUG,
  AURORA_VIAL_SRC,
  PHYSIOPEPTIDES_COMMISSION_RATE,
  PHYSIOPEPTIDES_LOGO_SRC,
  PHYSIOPEPTIDES_SCOPE_CODE,
  PHYSIOPEPTIDES_STORE_NAME,
  PHYSIOPEPTIDES_STORE_SLUG,
  PHYSIOPEPTIDES_VIAL_SRC,
  isAuroraLabsAdmin,
  isAuroraLabsOrder,
  isAuroraLabsRep,
  isPhysioPeptidesAdmin,
  isPhysioPeptidesOrder,
  isPhysioPeptidesRep,
  isRockPhormOrder,
  isRockPhormRep,
} from '../../lib/rockPhormScope';
import {
  GLOW_COMMISSION_RATE,
  GLOW_LOGO_SRC,
  GLOW_SCOPE_CODE,
  GLOW_STORE_NAME,
  GLOW_STORE_SLUG,
  GLOW_VIAL_SRC,
  isGlowAdmin,
  isGlowOrder,
  isGlowRep,
} from '../../lib/glowScope';
import {
  ROCKPHORM_MASTER_PRODUCT_SELECT,
  ROCKPHORM_PRODUCT_SELECT,
  mapRockPhormProductRow,
  type RockPhormCatalogProduct,
  type RockPhormManagedProduct,
  type RockPhormProductRow,
} from '../../lib/rockPhormProducts';
import { getProductMetadata } from '../../lib/productMetadata';

type RockPhormMode =
  | 'dashboard'
  | 'orders'
  | 'customers'
  | 'products'
  | 'pricing'
  | 'commission'
  | 'store-settings'
  | 'reps';

type Props = {
  mode?: RockPhormMode;
};

const money = (value: number | null | undefined) => `$${Number(value ?? 0).toFixed(2)}`;

type ScopedStoreConfig = {
  storeName: string;
  storeSlug: string;
  scopeCode: string;
  ownerEmail: string;
  logoSrc: string;
  vialSrc: string;
  commissionRate: number;
  storefrontPath: string;
  downlineTier: string;
  downlineChannel: string;
  parentType: string;
  isOrder: (row: Partial<PatientSubmission>) => boolean;
  isRep: (row: Partial<Rep>) => boolean;
};

type ProductDraft = {
  product_name: string;
  strength: string;
  category: string;
  sku: string;
  retail_price: string;
  is_enabled: boolean;
  featured: boolean;
  description: string;
};

type DownlineRepDraft = {
  rep_name: string;
  payout_email: string;
  rep_slug: string;
  commission_percent: string;
};

const EMPTY_PRODUCT_DRAFT: ProductDraft = {
  product_name: '',
  strength: 'Standard',
  category: 'Rock Phorm Catalog',
  sku: '',
  retail_price: '',
  is_enabled: true,
  featured: false,
  description: '',
};

const EMPTY_DOWNLINE_REP_DRAFT: DownlineRepDraft = {
  rep_name: '',
  payout_email: '',
  rep_slug: '',
  commission_percent: '25',
};

function scopedStoreConfig(isAuroraAdmin: boolean, isPhysioAdmin: boolean, isGlowStoreAdmin: boolean): ScopedStoreConfig {
  if (isGlowStoreAdmin) {
    return {
      storeName: GLOW_STORE_NAME,
      storeSlug: GLOW_STORE_SLUG,
      scopeCode: GLOW_SCOPE_CODE,
      ownerEmail: 'vanessacosio@ymail.com',
      logoSrc: GLOW_LOGO_SRC,
      vialSrc: GLOW_VIAL_SRC,
      commissionRate: GLOW_COMMISSION_RATE,
      storefrontPath: '/glow',
      downlineTier: 'glow_downline_rep',
      downlineChannel: 'glow_downline_rep',
      parentType: 'glow_downline',
      isOrder: isGlowOrder,
      isRep: isGlowRep,
    };
  }
  if (isPhysioAdmin) {
    return {
      storeName: PHYSIOPEPTIDES_STORE_NAME,
      storeSlug: PHYSIOPEPTIDES_STORE_SLUG,
      scopeCode: PHYSIOPEPTIDES_SCOPE_CODE,
      ownerEmail: 'physiopeptides@gmail.com',
      logoSrc: PHYSIOPEPTIDES_LOGO_SRC,
      vialSrc: PHYSIOPEPTIDES_VIAL_SRC,
      commissionRate: PHYSIOPEPTIDES_COMMISSION_RATE,
      storefrontPath: '/PhysioPeptides',
      downlineTier: 'physiopeptides_downline_rep',
      downlineChannel: 'physiopeptides_downline_rep',
      parentType: 'physiopeptides_downline',
      isOrder: isPhysioPeptidesOrder,
      isRep: isPhysioPeptidesRep,
    };
  }
  if (isAuroraAdmin) {
    return {
      storeName: AURORA_STORE_NAME,
      storeSlug: AURORA_STORE_SLUG,
      scopeCode: AURORA_SCOPE_CODE,
      ownerEmail: AURORA_ADMIN_EMAIL,
      logoSrc: AURORA_LOGO_SRC,
      vialSrc: AURORA_VIAL_SRC,
      commissionRate: AURORA_COMMISSION_RATE,
      storefrontPath: '/aurora',
      downlineTier: 'aurora_downline_rep',
      downlineChannel: 'aurora_downline_rep',
      parentType: 'aurora_downline',
      isOrder: isAuroraLabsOrder,
      isRep: isAuroraLabsRep,
    };
  }
  return {
    storeName: ROCKPHORM_STORE_NAME,
    storeSlug: ROCKPHORM_STORE_SLUG,
    scopeCode: ROCKPHORM_SCOPE_CODE,
    ownerEmail: ROCKPHORM_ADMIN_EMAIL,
    logoSrc: ROCKPHORM_LOGO_SRC,
    vialSrc: ROCKPHORM_VIAL_SRC,
    commissionRate: ROCKPHORM_COMMISSION_RATE,
    storefrontPath: '/rockphorm',
    downlineTier: 'rockphorm_downline_rep',
    downlineChannel: 'rockphorm_downline_rep',
    parentType: 'rockphorm_downline',
    isOrder: isRockPhormOrder,
    isRep: isRockPhormRep,
  };
}

export default function AdminRockPhorm({ mode = 'dashboard' }: Props) {
  const { profile } = useAuth();
  const isAuroraAdmin = isAuroraLabsAdmin(profile);
  const isPhysioAdmin = isPhysioPeptidesAdmin(profile);
  const isGlowStoreAdmin = isGlowAdmin(profile);
  const storeConfig = useMemo(() => scopedStoreConfig(isAuroraAdmin, isPhysioAdmin, isGlowStoreAdmin), [isAuroraAdmin, isPhysioAdmin, isGlowStoreAdmin]);
  const [orders, setOrders] = useState<PatientSubmission[]>([]);
  const [ledger, setLedger] = useState<CommissionLedger[]>([]);
  const [reps, setReps] = useState<Rep[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<RockPhormManagedProduct[]>([]);
  const [masterProducts, setMasterProducts] = useState<RockPhormCatalogProduct[]>([]);
  const [productDrafts, setProductDrafts] = useState<Record<string, ProductDraft>>({});
  const [newProduct, setNewProduct] = useState<ProductDraft>(EMPTY_PRODUCT_DRAFT);
  const [savingProductId, setSavingProductId] = useState('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const loadData = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    setError('');

    const [
      { data: orderData, error: orderError },
      { data: ledgerData, error: ledgerError },
      { data: repData, error: repError },
      { data: productData, error: productError },
      { data: masterProductData, error: masterProductError },
    ] = await Promise.all([
      supabase
        .from('patient_submissions')
        .select('*, rep:reps!patient_submissions_rep_id_fkey(*)')
        .order('created_at', { ascending: false })
        .limit(800),
      supabase
        .from('commission_ledger')
        .select('*, rep:reps(*), submission:patient_submissions(*)')
        .order('created_at', { ascending: false })
        .limit(800),
      supabase
        .from('reps')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('distributor_products')
        .select(ROCKPHORM_PRODUCT_SELECT)
        .eq('distributor.slug', storeConfig.storeSlug)
        .order('featured', { ascending: false })
        .order('updated_at', { ascending: false }),
      supabase
        .from('rx_plus_products')
        .select(ROCKPHORM_MASTER_PRODUCT_SELECT)
        .eq('active', true)
        .order('category', { ascending: true })
        .order('product_name', { ascending: true }),
    ]);

    if (orderError || ledgerError || repError || productError || masterProductError) {
      setError(orderError?.message || ledgerError?.message || repError?.message || productError?.message || masterProductError?.message || `Could not load ${storeConfig.storeName} data.`);
    }

    const nextOrders = ((orderData as PatientSubmission[]) ?? []).filter(storeConfig.isOrder);
    const rockOrderIds = new Set(nextOrders.map((order) => order.id));
    const nextReps = ((repData as Rep[]) ?? []).filter(storeConfig.isRep);
    const rockRepIds = new Set(nextReps.map((rep) => rep.id));
    const nextLedger = ((ledgerData as CommissionLedger[]) ?? []).filter((row) => (
      rockRepIds.has(row.rep_id)
      || rockOrderIds.has(row.submission_id)
      || Boolean(row.submission && storeConfig.isOrder(row.submission))
    ));
    const nextProducts = ((productData as unknown as RockPhormProductRow[]) ?? [])
      .map(mapRockPhormProductRow)
      .filter((product): product is RockPhormManagedProduct => Boolean(product));

    setOrders(nextOrders);
    setLedger(nextLedger);
    setReps(nextReps);
    setCatalogProducts(nextProducts);
    setMasterProducts((masterProductData as RockPhormCatalogProduct[]) ?? []);
    setProductDrafts(Object.fromEntries(nextProducts.map((product) => [product.dbProductId, draftFromProduct(product)])));
    setLoading(false);
  }, [storeConfig]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const paidOrders = orders.filter((order) => order.status === 'paid' || order.status === 'fulfilled');
  const revenue = paidOrders.reduce((sum, order) => sum + Number(order.order_total ?? order.quoted_price ?? 0), 0);
  const pendingCommission = ledger
    .filter((row) => row.status === 'pending' || row.status === 'payable')
    .reduce((sum, row) => sum + Number(row.commission_amount ?? 0), 0);
  const paidCommission = ledger
    .filter((row) => row.status === 'paid')
    .reduce((sum, row) => sum + Number(row.commission_amount ?? 0), 0);
  const rockRep = reps.find((rep) => rep.rep_slug === storeConfig.scopeCode);
  const legacyReps = reps.filter((rep) => rep.rep_slug !== storeConfig.scopeCode);
  const customers = useMemo(() => {
    const byEmail = new Map<string, PatientSubmission>();
    orders.forEach((order) => {
      const key = String(order.email ?? '').toLowerCase();
      if (key && !byEmail.has(key)) byEmail.set(key, order);
    });
    return Array.from(byEmail.values());
  }, [orders]);

  async function updateOrderStatus(orderId: string, status: SubmissionStatus) {
    if (!supabase) return;
    setMessage('');
    setError('');
    const { error: updateError } = await supabase
      .from('patient_submissions')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', orderId);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setMessage('Order status updated.');
    await loadData();
  }

  function updateProductDraft(productId: string, patch: Partial<ProductDraft>) {
    setProductDrafts((current) => ({
      ...current,
      [productId]: {
        ...(current[productId] ?? EMPTY_PRODUCT_DRAFT),
        ...patch,
      },
    }));
  }

  async function saveProduct(product?: RockPhormManagedProduct) {
    if (!supabase) return;
    const productId = product?.dbProductId ?? '';
    const draft = product ? (productDrafts[productId] ?? draftFromProduct(product)) : newProduct;
    const retailPrice = Number(draft.retail_price);
    if (!draft.product_name.trim()) {
      setError('Product name is required.');
      return;
    }
    if (!Number.isFinite(retailPrice) || retailPrice <= 0) {
      setError('Retail price must be greater than 0.');
      return;
    }

    setSavingProductId(productId || 'new');
    setError('');
    setMessage('');
    const { error: saveError } = await supabase.rpc('rockphorm_upsert_catalog_product', {
      p_product_id: productId || null,
      p_product_name: draft.product_name.trim(),
      p_strength: draft.strength.trim() || 'Standard',
      p_category: draft.category.trim() || 'Rock Phorm Catalog',
      p_sku: draft.sku.trim(),
      p_retail_price: retailPrice,
      p_is_enabled: draft.is_enabled,
      p_featured: draft.featured,
      p_description: draft.description.trim() || null,
    });

    if (saveError) {
      setError(saveError.message);
    } else {
      setMessage(product ? `${draft.product_name} saved.` : `${draft.product_name} added to ${storeConfig.storeName}.`);
      if (!product) setNewProduct(EMPTY_PRODUCT_DRAFT);
      await loadData();
    }
    setSavingProductId('');
  }

  async function addCatalogProduct(product: RockPhormCatalogProduct) {
    if (!supabase) return;
    const retailPrice = Number(product.retail_price ?? product.suggested_retail_price ?? 0);
    if (!Number.isFinite(retailPrice) || retailPrice <= 0) {
      setError(`${product.product_name} does not have a valid retail price.`);
      return;
    }

    setSavingProductId(product.id);
    setError('');
    setMessage('');
    const { error: addError } = await supabase.rpc('rockphorm_upsert_catalog_product', {
      p_product_id: product.id,
      p_product_name: product.product_name,
      p_strength: product.strength || 'Standard',
      p_category: product.category || 'Rock Phorm Catalog',
      p_sku: product.sku,
      p_retail_price: retailPrice,
      p_is_enabled: true,
      p_featured: Boolean(product.featured),
      p_description: product.description || null,
    });

    if (addError) setError(addError.message);
    else {
      setMessage(`${product.product_name} ${product.strength ?? ''} added to ${storeConfig.storeName}.`);
      await loadData();
    }
    setSavingProductId('');
  }

  async function toggleProduct(product: RockPhormManagedProduct, isEnabled: boolean) {
    if (!supabase) return;
    setSavingProductId(product.dbProductId);
    setError('');
    setMessage('');
    const { error: toggleError } = await supabase.rpc('rockphorm_set_catalog_product_enabled', {
      p_product_id: product.dbProductId,
      p_is_enabled: isEnabled,
    });
    if (toggleError) setError(toggleError.message);
    else {
      setMessage(`${product.product_name} ${isEnabled ? 'restored to' : 'removed from'} the ${storeConfig.storeName} storefront.`);
      await loadData();
    }
    setSavingProductId('');
  }

  async function addDownlineRep(draft: DownlineRepDraft) {
    if (!supabase) return false;
    if (!rockRep?.id) {
      setError('Parent admin rep record is required before adding downline reps.');
      return false;
    }
    const repName = draft.rep_name.trim();
    const repSlug = draft.rep_slug.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
    const payoutEmail = draft.payout_email.trim().toLowerCase();
    const commissionRate = Number(draft.commission_percent) / 100;
    const maxDownlineCommissionRate = storeConfig.commissionRate;
    const maxDownlineCommissionPercent = Math.round(maxDownlineCommissionRate * 100);
    if (!repName || !repSlug) {
      setError('Rep name and rep code are required.');
      return false;
    }
    if (!Number.isFinite(commissionRate) || commissionRate < 0 || commissionRate > maxDownlineCommissionRate) {
      setError(`Commission percent must be between 0 and ${maxDownlineCommissionPercent}.`);
      return false;
    }

    setError('');
    setMessage('');
    const { error: insertError } = await supabase.from('reps').insert({
      profile_id: null,
      rep_name: repName,
      handle: repSlug,
      rep_identifier: repSlug,
      rep_slug: repSlug,
      commission_type: 'net_profit_after_true_cost',
      commission_rate: commissionRate,
      override_percent: 0,
      platform_percent: Math.max(0, 1 - storeConfig.commissionRate),
      rep_tier: storeConfig.downlineTier,
      discount_code: repSlug,
      discount_amount: 0,
      referral_path: `/r/${repSlug}`,
      attribution_locked: true,
      attribution_window_days: 60,
      payout_method: 'PayPal Pending',
      payout_email: payoutEmail || null,
      paypal_link: null,
      rep_channel: storeConfig.downlineChannel,
      custom_store_slug: storeConfig.storeSlug,
      brand_name: storeConfig.storeName,
      account_type: 'rep',
      parent_type: storeConfig.parentType,
      parent_rep_id: rockRep.id,
      managed_by_profile_id: rockRep.profile_id ?? null,
      active: true,
    });

    if (insertError) {
      setError(insertError.message);
      return false;
    }
    setMessage(`${repName} added under ${storeConfig.storeName}.`);
    await loadData();
    return true;
  }

  return (
    <DashLayout title={titleForMode(mode, storeConfig)} navItems={ROCKPHORM_ADMIN_NAV}>
      {loading ? (
        <div style={{ padding: 48, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>
          {message && <div className="alert alert-success">{message}</div>}
          {error && <div className="alert alert-error">{error}</div>}
          <RockPhormScopeBanner storeConfig={storeConfig} />

          {mode === 'dashboard' && (
            <>
              <StatsGrid
                cards={[
                  ['Orders', String(orders.length)],
                  ['Paid revenue', money(revenue)],
                  ['Commission owed', money(pendingCommission)],
                  ['Products', String(catalogProducts.filter((product) => product.dbEnabled).length)],
                  ['Full catalog', String(masterProducts.length)],
                  ['Customers', String(customers.length)],
                ]}
              />
              <div className="detail-grid">
                <RecentOrders orders={orders.slice(0, 8)} storeName={storeConfig.storeName} onUpdateStatus={updateOrderStatus} />
                <BrandPanel products={catalogProducts.filter((product) => product.dbEnabled).length} rep={rockRep} storeConfig={storeConfig} />
                {!isAuroraAdmin && !isPhysioAdmin && !isGlowStoreAdmin && <ManagedPartnerStores reps={reps} />}
              </div>
            </>
          )}

          {mode === 'orders' && <OrdersTable orders={orders} storeName={storeConfig.storeName} onUpdateStatus={updateOrderStatus} />}
          {mode === 'customers' && <CustomersTable customers={customers} storeName={storeConfig.storeName} />}
          {mode === 'products' && (
            <>
              <ProductCatalog
                products={catalogProducts}
                masterCount={masterProducts.length}
                drafts={productDrafts}
                savingProductId={savingProductId}
                storeConfig={storeConfig}
                onUpdateDraft={updateProductDraft}
                onSaveProduct={saveProduct}
                onToggleProduct={toggleProduct}
              />
              <MasterCatalogAccess
                products={masterProducts}
                assignedProductIds={new Set(catalogProducts.map((product) => product.dbProductId))}
                savingProductId={savingProductId}
                storeName={storeConfig.storeName}
                onAddProduct={addCatalogProduct}
              />
              <PricingTable
                products={catalogProducts}
                drafts={productDrafts}
                newProduct={newProduct}
                savingProductId={savingProductId}
                storeConfig={storeConfig}
                onUpdateDraft={updateProductDraft}
                onUpdateNewProduct={setNewProduct}
                onSaveProduct={saveProduct}
                onToggleProduct={toggleProduct}
              />
            </>
          )}
          {mode === 'pricing' && (
            <>
              <MasterCatalogAccess
                products={masterProducts}
                assignedProductIds={new Set(catalogProducts.map((product) => product.dbProductId))}
                savingProductId={savingProductId}
                storeName={storeConfig.storeName}
                onAddProduct={addCatalogProduct}
              />
              <PricingTable
                products={catalogProducts}
                drafts={productDrafts}
                newProduct={newProduct}
                savingProductId={savingProductId}
                storeConfig={storeConfig}
                onUpdateDraft={updateProductDraft}
                onUpdateNewProduct={setNewProduct}
                onSaveProduct={saveProduct}
                onToggleProduct={toggleProduct}
              />
            </>
          )}
          {mode === 'commission' && (
            <>
              <StatsGrid
                cards={[
                  ['Commission rate', `${Math.round(storeConfig.commissionRate * 100)}%`],
                  ['Pending/payable', money(pendingCommission)],
                  ['Paid', money(paidCommission)],
                  ['Ledger rows', String(ledger.length)],
                ]}
              />
              <CommissionTable ledger={ledger} storeConfig={storeConfig} />
            </>
          )}
          {mode === 'store-settings' && <StoreSettings rep={rockRep} products={catalogProducts.filter((product) => product.dbEnabled).length} storeConfig={storeConfig} />}
          {mode === 'reps' && <RepsTable rep={rockRep} legacyReps={legacyReps} storeConfig={storeConfig} onAddRep={addDownlineRep} />}
        </div>
      )}
    </DashLayout>
  );
}

function RockPhormScopeBanner({ storeConfig }: { storeConfig: ScopedStoreConfig }) {
  const { logoSrc, storeName, ownerEmail, storeSlug, scopeCode, commissionRate, storefrontPath } = storeConfig;
  return (
    <div className="card" style={{ borderColor: 'rgba(29,78,216,.18)' }}>
      <div className="card-body" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <img src={logoSrc} alt={storeName} style={{ width: 120, maxHeight: 54, objectFit: 'contain' }} />
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontWeight: 900, color: 'var(--navy)' }}>{storeName} Admin Scope</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5 }}>
            Admin owner {ownerEmail}. Store slug {storeSlug}. Checkout scope {scopeCode}. {storeName} compensation is {Math.round(commissionRate * 100)}% of net profit after true landing cost.
          </div>
        </div>
        <a className="btn btn-primary btn-sm" href={storefrontPath} target="_blank" rel="noreferrer">Open Storefront</a>
      </div>
    </div>
  );
}

function StatsGrid({ cards }: { cards: [string, string][] }) {
  return (
    <div className="stats-grid">
      {cards.map(([label, value]) => (
        <div className="stat-card" key={label}>
          <div className="stat-value">{value}</div>
          <div className="stat-label">{label}</div>
        </div>
      ))}
    </div>
  );
}

function RecentOrders({ orders, storeName, onUpdateStatus }: { orders: PatientSubmission[]; storeName: string; onUpdateStatus: (id: string, status: SubmissionStatus) => void }) {
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">Recent {storeName} Orders</div></div>
      <OrdersTable orders={orders} storeName={storeName} onUpdateStatus={onUpdateStatus} compact />
    </div>
  );
}

function OrdersTable({ orders, storeName, onUpdateStatus, compact = false }: { orders: PatientSubmission[]; storeName: string; onUpdateStatus: (id: string, status: SubmissionStatus) => void; compact?: boolean }) {
  return (
    <div className={compact ? '' : 'card'}>
      {!compact && <div className="card-header"><div className="card-title">{storeName} Orders</div></div>}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Customer</th>
              <th>Product</th>
              <th>Amount</th>
              <th>Attribution</th>
              <th>Status</th>
              <th>Submitted</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No {storeName} orders yet.</td></tr>
            ) : orders.map((order) => (
              <tr key={order.id}>
                <td>
                  <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{order.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{order.email}</div>
                </td>
                <td>{order.medication || order.product_name || '-'}</td>
                <td>{money(order.order_total ?? order.quoted_price)}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{order.checkout_scope_code || order.admin_code || order.source_admin || order.referral_code || '-'}</td>
                <td>
                  <select
                    className="form-select"
                    style={{ minWidth: 170, padding: '5px 8px', fontSize: 13 }}
                    value={order.status}
                    onChange={(event) => onUpdateStatus(order.id, event.target.value as SubmissionStatus)}
                  >
                    {ALL_STATUSES.map((status) => <option key={status} value={status}>{STATUS_LABELS[status]}</option>)}
                  </select>
                </td>
                <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{new Date(order.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomersTable({ customers, storeName }: { customers: PatientSubmission[]; storeName: string }) {
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">{storeName} Customers & Leads</div></div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Last Product</th><th>Last Seen</th></tr></thead>
          <tbody>
            {customers.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No customers yet.</td></tr>
            ) : customers.map((customer) => (
              <tr key={customer.email}>
                <td>{customer.full_name}</td>
                <td>{customer.email}</td>
                <td>{customer.phone}</td>
                <td>{customer.medication}</td>
                <td>{new Date(customer.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ProductCatalog({
  products,
  masterCount,
  drafts,
  savingProductId,
  storeConfig,
  onUpdateDraft,
  onSaveProduct,
  onToggleProduct,
}: {
  products: RockPhormManagedProduct[];
  masterCount: number;
  drafts: Record<string, ProductDraft>;
  savingProductId: string;
  storeConfig: ScopedStoreConfig;
  onUpdateDraft: (productId: string, patch: Partial<ProductDraft>) => void;
  onSaveProduct: (product?: RockPhormManagedProduct) => void;
  onToggleProduct: (product: RockPhormManagedProduct, isEnabled: boolean) => void;
}) {
  const { storeName, scopeCode, vialSrc } = storeConfig;
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">{storeName} Product Catalog</div>
          <div className="card-subtitle">{products.filter((product) => product.dbEnabled).length} active {storeName} products. {masterCount} total platform catalog products available.</div>
        </div>
      </div>
      <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
        {products.length === 0 ? (
          <div style={{ gridColumn: '1 / -1', padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
            No {storeName} products are configured yet.
          </div>
        ) : products.map((product) => {
          const draft = drafts[product.dbProductId] ?? draftFromProduct(product);
          const saving = savingProductId === product.dbProductId;
          const metadata = getProductMetadata(product);
          return (
            <div key={product.id} style={{ border: '1px solid var(--border)', borderRadius: 8, padding: 14, display: 'grid', gap: 10 }}>
              <img src={vialSrc} alt={`${storeName} vial`} style={{ width: '100%', height: 120, objectFit: 'contain' }} />
              <div>
                <div style={{ fontWeight: 900, color: 'var(--navy)' }}>{metadata.commonName}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Technical: {metadata.technicalName}</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>Dose: {metadata.doseLabel} - {product.category}</div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                <span style={{ fontWeight: 900 }}>{money(product.displayPrice)}</span>
                <span className={product.dbEnabled ? 'badge badge-success' : 'badge badge-default'}>{product.dbEnabled ? 'Available' : 'Hidden'}</span>
              </div>
              <label className="form-group" style={{ margin: 0 }}>
                <span className="form-label">{storeName} retail price</span>
                <input
                  className="form-input"
                  type="number"
                  min="0"
                  step="0.01"
                  value={draft.retail_price}
                  onChange={(event) => onUpdateDraft(product.dbProductId, { retail_price: event.target.value })}
                />
              </label>
              <div style={{ fontFamily: 'monospace', fontSize: 11, color: 'var(--text-muted)' }}>{scopeCode} / {product.sku}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary btn-sm"
                  type="button"
                  disabled={saving}
                  onClick={() => onSaveProduct(product)}
                >
                  {saving ? 'Saving...' : 'Save Price'}
                </button>
                <button
                  className={product.dbEnabled ? 'btn btn-outline btn-sm' : 'btn btn-primary btn-sm'}
                  type="button"
                  disabled={saving}
                  onClick={() => onToggleProduct(product, !product.dbEnabled)}
                >
                  {product.dbEnabled ? 'Remove From Store' : 'Restore Product'}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MasterCatalogAccess({
  products,
  assignedProductIds,
  savingProductId,
  storeName,
  onAddProduct,
}: {
  products: RockPhormCatalogProduct[];
  assignedProductIds: Set<string>;
  savingProductId: string;
  storeName: string;
  onAddProduct: (product: RockPhormCatalogProduct) => void;
}) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('All');
  const categories = useMemo(() => ['All', ...Array.from(new Set(products.map((product) => product.category).filter(Boolean))).sort()], [products]);
  const visibleProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products
      .filter((product) => category === 'All' || product.category === category)
      .filter((product) => {
        if (!q) return true;
        return [
          product.product_name,
          product.strength,
          product.category,
          product.sku,
          product.display_name,
        ].some((value) => String(value ?? '').toLowerCase().includes(q));
      })
      .sort((a, b) => {
        const assignedA = assignedProductIds.has(a.id);
        const assignedB = assignedProductIds.has(b.id);
        if (assignedA !== assignedB) return assignedA ? 1 : -1;
        return `${a.category} ${a.product_name} ${a.strength}`.localeCompare(`${b.category} ${b.product_name} ${b.strength}`);
      });
  }, [assignedProductIds, category, products, query]);

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Full Platform Catalog Access</div>
          <div className="card-subtitle">Add any active platform catalog product to {storeName}, then manage {storeName}-specific pricing below.</div>
        </div>
      </div>
      <div className="card-body" style={{ display: 'grid', gap: 14 }}>
        <div className="form-grid-2">
          <label className="form-group">
            <span className="form-label">Search catalog</span>
            <input className="form-input" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search name, SKU, category, strength" />
          </label>
          <label className="form-group">
            <span className="form-label">Category</span>
            <select className="form-select" value={category} onChange={(event) => setCategory(event.target.value)}>
              {categories.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
        </div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Product</th><th>Category</th><th>Base Retail</th><th>Status</th><th /></tr></thead>
          <tbody>
            {visibleProducts.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No catalog products match this filter.</td></tr>
            ) : visibleProducts.map((product) => {
              const assigned = assignedProductIds.has(product.id);
              const price = Number(product.retail_price ?? product.suggested_retail_price ?? 0);
              const metadata = getProductMetadata(product);
              return (
                <tr key={product.id}>
                  <td>
                    <strong>{metadata.commonName}</strong>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Technical: {metadata.technicalName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Dose: {metadata.doseLabel} / <span style={{ fontFamily: 'monospace' }}>{product.sku}</span></div>
                  </td>
                  <td>{product.category}</td>
                  <td>{money(price)}</td>
                  <td>{assigned ? <span className="badge badge-success">In {storeName}</span> : <span className="badge badge-default">Available</span>}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button
                      className={assigned ? 'btn btn-outline btn-sm' : 'btn btn-primary btn-sm'}
                      type="button"
                      disabled={assigned || savingProductId === product.id}
                      onClick={() => onAddProduct(product)}
                    >
                      {assigned ? 'Added' : savingProductId === product.id ? 'Adding...' : `Add to ${storeName}`}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PricingTable({
  products,
  drafts,
  newProduct,
  savingProductId,
  storeConfig,
  onUpdateDraft,
  onUpdateNewProduct,
  onSaveProduct,
  onToggleProduct,
}: {
  products: RockPhormManagedProduct[];
  drafts: Record<string, ProductDraft>;
  newProduct: ProductDraft;
  savingProductId: string;
  storeConfig: ScopedStoreConfig;
  onUpdateDraft: (productId: string, patch: Partial<ProductDraft>) => void;
  onUpdateNewProduct: (draft: ProductDraft) => void;
  onSaveProduct: (product?: RockPhormManagedProduct) => void;
  onToggleProduct: (product: RockPhormManagedProduct, isEnabled: boolean) => void;
}) {
  const { storeName, scopeCode, commissionRate } = storeConfig;
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Product Pricing & Availability</div>
          <div className="card-subtitle">Changes save to the live {storeName} storefront catalog.</div>
        </div>
      </div>
      <div className="card-body" style={{ display: 'grid', gap: 14, borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontWeight: 900, color: 'var(--navy)' }}>Add {storeName} Product</div>
        <div className="form-grid-2">
          <label className="form-group">
            <span className="form-label">Product name</span>
            <input className="form-input" value={newProduct.product_name} onChange={(event) => onUpdateNewProduct({ ...newProduct, product_name: event.target.value })} />
          </label>
          <label className="form-group">
            <span className="form-label">Strength</span>
            <input className="form-input" value={newProduct.strength} onChange={(event) => onUpdateNewProduct({ ...newProduct, strength: event.target.value })} />
          </label>
          <label className="form-group">
            <span className="form-label">Category</span>
            <input className="form-input" value={newProduct.category} onChange={(event) => onUpdateNewProduct({ ...newProduct, category: event.target.value })} />
          </label>
          <label className="form-group">
            <span className="form-label">SKU</span>
            <input className="form-input" value={newProduct.sku} onChange={(event) => onUpdateNewProduct({ ...newProduct, sku: event.target.value })} placeholder="ROCKPHORM-..." />
          </label>
          <label className="form-group">
            <span className="form-label">Retail price</span>
            <input className="form-input" type="number" min="0" step="0.01" value={newProduct.retail_price} onChange={(event) => onUpdateNewProduct({ ...newProduct, retail_price: event.target.value })} />
          </label>
          <label className="form-group">
            <span className="form-label">Description</span>
            <input className="form-input" value={newProduct.description} onChange={(event) => onUpdateNewProduct({ ...newProduct, description: event.target.value })} />
          </label>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <label className="checkbox-item"><input type="checkbox" checked={newProduct.is_enabled} onChange={(event) => onUpdateNewProduct({ ...newProduct, is_enabled: event.target.checked })} /><span>Available on storefront</span></label>
          <label className="checkbox-item"><input type="checkbox" checked={newProduct.featured} onChange={(event) => onUpdateNewProduct({ ...newProduct, featured: event.target.checked })} /><span>Featured</span></label>
          <button className="btn btn-primary btn-sm" type="button" disabled={savingProductId === 'new'} onClick={() => onSaveProduct()}>
            {savingProductId === 'new' ? 'Adding...' : 'Add Product'}
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Product</th><th>Strength</th><th>Category</th><th>Retail</th><th>Featured</th><th>Available</th><th>Checkout Attribution</th><th /></tr></thead>
          <tbody>
            {products.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No {storeName} products are configured yet.</td></tr>
            ) : products.map((product) => {
              const draft = drafts[product.dbProductId] ?? draftFromProduct(product);
              const canEditDetails = isRockPhormOwnedProduct(product);
              const metadata = getProductMetadata(product);
              return (
                <tr key={product.id}>
                  <td>
                    <input className="form-input" value={draft.product_name} disabled={!canEditDetails} onChange={(event) => onUpdateDraft(product.dbProductId, { product_name: event.target.value })} />
                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>Display: {metadata.commonName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Technical: {metadata.technicalName}</div>
                    <input className="form-input" value={draft.sku} disabled={!canEditDetails} onChange={(event) => onUpdateDraft(product.dbProductId, { sku: event.target.value })} style={{ marginTop: 6, fontFamily: 'monospace', fontSize: 12 }} />
                    {!canEditDetails && <div style={{ marginTop: 6, fontSize: 11, color: 'var(--text-muted)' }}>Shared catalog item. {storeName} controls price and availability.</div>}
                  </td>
                  <td>
                    <input className="form-input" value={draft.strength} disabled={!canEditDetails} onChange={(event) => onUpdateDraft(product.dbProductId, { strength: event.target.value })} />
                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text-muted)' }}>Dose: {metadata.doseLabel}</div>
                  </td>
                  <td><input className="form-input" value={draft.category} disabled={!canEditDetails} onChange={(event) => onUpdateDraft(product.dbProductId, { category: event.target.value })} /></td>
                  <td><input className="form-input" type="number" min="0" step="0.01" value={draft.retail_price} onChange={(event) => onUpdateDraft(product.dbProductId, { retail_price: event.target.value })} /></td>
                  <td><input type="checkbox" checked={draft.featured} onChange={(event) => onUpdateDraft(product.dbProductId, { featured: event.target.checked })} /></td>
                  <td><input type="checkbox" checked={draft.is_enabled} onChange={(event) => onUpdateDraft(product.dbProductId, { is_enabled: event.target.checked })} /></td>
                  <td>
                    <div style={{ fontFamily: 'monospace', fontSize: 12 }}>{scopeCode}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{Math.round(commissionRate * 100)}% net profit</div>
                  </td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-primary btn-sm" type="button" disabled={savingProductId === product.dbProductId} onClick={() => onSaveProduct(product)}>
                      {savingProductId === product.dbProductId ? 'Saving...' : 'Save'}
                    </button>
                    <button
                      className="btn btn-outline btn-sm"
                      type="button"
                      disabled={savingProductId === product.dbProductId}
                      onClick={() => onToggleProduct(product, !product.dbEnabled)}
                      style={{ marginLeft: 8 }}
                    >
                      {product.dbEnabled ? 'Remove' : 'Restore'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CommissionTable({ ledger, storeConfig }: { ledger: CommissionLedger[]; storeConfig: ScopedStoreConfig }) {
  const { storeName } = storeConfig;
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">{storeName} Commission Ledger</div></div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Owner</th><th>Order</th><th>Margin</th><th>Rate</th><th>Amount</th><th>Status</th><th>Date</th></tr></thead>
          <tbody>
            {ledger.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No commission rows yet.</td></tr>
            ) : ledger.map((row) => (
              <tr key={row.id}>
                <td>{row.owner_label || (row.rep as Rep | undefined)?.rep_name || storeName}</td>
                <td>{row.submission_id.slice(0, 8)}</td>
                <td>{money(row.margin)}</td>
                <td>{Math.round(Number(row.commission_rate ?? 0) * 100)}%</td>
                <td style={{ fontWeight: 800 }}>{money(row.commission_amount)}</td>
                <td>{row.status}</td>
                <td>{new Date(row.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StoreSettings({ rep, products, storeConfig }: { rep?: Rep; products: number; storeConfig: ScopedStoreConfig }) {
  const { storeName, logoSrc, vialSrc, storeSlug, scopeCode, ownerEmail, commissionRate } = storeConfig;
  return (
    <div className="detail-grid">
      <div className="card">
        <div className="card-header"><div className="card-title">Branding Assets</div></div>
        <div className="card-body" style={{ display: 'grid', gap: 16 }}>
          <img src={logoSrc} alt={`${storeName} logo`} style={{ maxWidth: 220, maxHeight: 90, objectFit: 'contain' }} />
          <img src={vialSrc} alt={`${storeName} vial`} style={{ maxWidth: 220, maxHeight: 220, objectFit: 'contain' }} />
        </div>
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">Storefront Settings</div></div>
        <div className="card-body" style={{ display: 'grid', gap: 10 }}>
          <Detail label="Store slug" value={storeSlug} />
          <Detail label="Scope/code" value={scopeCode} />
          <Detail label="Owner email" value={ownerEmail} />
          <Detail label="Rep row" value={rep?.active ? 'Active admin store' : 'Needs review'} />
          <Detail label="Commission" value={`${Math.round(commissionRate * 100)}% net profit after true landing cost`} />
          <Detail label="Products" value={`${products} enabled`} />
        </div>
      </div>
    </div>
  );
}

function BrandPanel({ products, rep, storeConfig }: { products: number; rep?: Rep; storeConfig: ScopedStoreConfig }) {
  const { storeName, scopeCode, storeSlug } = storeConfig;
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">Admin Access</div></div>
      <div className="card-body" style={{ display: 'grid', gap: 10 }}>
        <Detail label="Role" value="admin" />
        <Detail label="Admin scope" value={scopeCode} />
        <Detail label="Store" value={storeSlug} />
        <Detail label="Products" value={`${products} enabled`} />
        <Detail label="Rep record" value={rep?.active ? `${storeName} active` : 'Needs review'} />
      </div>
    </div>
  );
}

function ManagedPartnerStores({ reps }: { reps: Rep[] }) {
  const auroraRep = reps.find((rep) => normalizeRepToken(rep.rep_slug) === AURORA_SCOPE_CODE);
  const auroraCommissionRate = Number.isFinite(Number(auroraRep?.commission_rate))
    ? Number(auroraRep?.commission_rate)
    : AURORA_COMMISSION_RATE;

  return (
    <div className="card">
      <div className="card-header"><div className="card-title">Managed Partner Stores</div></div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Store</th><th>Scope</th><th>Owner</th><th>Commission</th><th>Status</th><th /></tr></thead>
          <tbody>
            <tr>
              <td>{AURORA_STORE_NAME}</td>
              <td>{AURORA_SCOPE_CODE}</td>
              <td>{AURORA_ADMIN_EMAIL}</td>
              <td>{Math.round(auroraCommissionRate * 100)}% net profit</td>
              <td><span className={auroraRep?.active === false ? 'badge badge-default' : 'badge badge-success'}>{auroraRep?.active === false ? 'Inactive' : 'Active'}</span></td>
              <td style={{ textAlign: 'right' }}><a className="btn btn-outline btn-sm" href="/aurora" target="_blank" rel="noreferrer">Open</a></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RepsTable({
  rep,
  legacyReps,
  storeConfig,
  onAddRep,
}: {
  rep?: Rep;
  legacyReps: Rep[];
  storeConfig: ScopedStoreConfig;
  onAddRep: (draft: DownlineRepDraft) => Promise<boolean>;
}) {
  const [draft, setDraft] = useState<DownlineRepDraft>(EMPTY_DOWNLINE_REP_DRAFT);
  const [saving, setSaving] = useState(false);
  const maxCommissionPercent = Math.round(storeConfig.commissionRate * 100);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const saved = await onAddRep(draft);
    if (saved) setDraft(EMPTY_DOWNLINE_REP_DRAFT);
    setSaving(false);
  }

  return (
    <div className="card">
      <div className="card-header"><div className="card-title">{storeConfig.storeName} Reps & Downline</div></div>
      <div className="card-body">
        <form onSubmit={submit} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, alignItems: 'end' }}>
          <label>
            <span className="form-label">Rep name</span>
            <input className="form-input" value={draft.rep_name} onChange={(event) => setDraft((current) => ({ ...current, rep_name: event.target.value }))} placeholder="New rep name" />
          </label>
          <label>
            <span className="form-label">Rep code</span>
            <input className="form-input" value={draft.rep_slug} onChange={(event) => setDraft((current) => ({ ...current, rep_slug: event.target.value.toUpperCase() }))} placeholder="REP_CODE" />
          </label>
          <label>
            <span className="form-label">Payout email</span>
            <input className="form-input" type="email" value={draft.payout_email} onChange={(event) => setDraft((current) => ({ ...current, payout_email: event.target.value }))} placeholder="pending@example.com" />
          </label>
          <label>
            <span className="form-label">Commission (%)</span>
            <input className="form-input" type="number" min="0" max={maxCommissionPercent} step="1" value={draft.commission_percent} onChange={(event) => setDraft((current) => ({ ...current, commission_percent: event.target.value }))} />
          </label>
          <button className="btn btn-primary" type="submit" disabled={saving || !rep?.id}>
            {saving ? 'Adding...' : `Add ${storeConfig.storeName} Rep`}
          </button>
        </form>
        <div style={{ marginTop: 10, color: 'var(--text-muted)', fontSize: 12, fontWeight: 700 }}>
          New reps are attached under {rep?.rep_slug ?? 'the current admin rep'} and cannot exceed {maxCommissionPercent}% commission.
        </div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Name</th><th>Slug</th><th>Role</th><th>Email</th><th>Commission</th><th>Status</th></tr></thead>
          <tbody>
            {rep && (
              <tr>
                <td>{rep.rep_name}</td>
                <td>{rep.rep_slug}</td>
                <td>{rep.rep_tier}</td>
                <td>{rep.payout_email}</td>
                <td>{formatCommissionRate(rep.commission_rate)}</td>
                <td><span className="badge badge-success">Active admin store</span></td>
              </tr>
            )}
            {legacyReps.map((legacy) => (
              <tr key={legacy.id}>
                <td>{legacy.rep_name}</td>
                <td>{legacy.rep_slug}</td>
                <td>{legacy.rep_channel}</td>
                <td>{legacy.payout_email}</td>
                <td>{formatCommissionRate(legacy.commission_rate)}</td>
                <td><span className="badge badge-default">{legacy.active ? 'Review' : 'Retired'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{value}</span>
    </div>
  );
}

function normalizeRepToken(value?: string | null): string {
  return String(value ?? '').trim().toUpperCase();
}

function formatCommissionRate(value?: number | null): string {
  const rate = Number(value ?? 0);
  return Number.isFinite(rate) ? `${Math.round(rate * 100)}%` : '0%';
}

function draftFromProduct(product: RockPhormManagedProduct): ProductDraft {
  return {
    product_name: product.product_name ?? '',
    strength: product.strength ?? 'Standard',
    category: product.category ?? 'Rock Phorm Catalog',
    sku: product.sku ?? '',
    retail_price: String(product.displayPrice ?? product.suggested_retail_price ?? 0),
    is_enabled: product.dbEnabled,
    featured: product.dbFeatured,
    description: product.description ?? '',
  };
}

function isRockPhormOwnedProduct(product: RockPhormManagedProduct): boolean {
  return String(product.sku ?? '').toUpperCase().startsWith('ROCKPHORM-')
    || String((product as RockPhormManagedProduct & { partner_slug?: string | null }).partner_slug ?? '').toLowerCase() === ROCKPHORM_STORE_SLUG;
}

function titleForMode(mode: RockPhormMode, storeConfig: ScopedStoreConfig) {
  const { storeName } = storeConfig;
  switch (mode) {
    case 'orders':
      return `${storeName} Orders`;
    case 'customers':
      return `${storeName} Customers`;
    case 'products':
      return `${storeName} Products`;
    case 'pricing':
      return `${storeName} Pricing`;
    case 'commission':
      return `${storeName} Commission`;
    case 'store-settings':
      return `${storeName} Settings`;
    case 'reps':
      return `${storeName} Reps`;
    default:
      return `${storeName} Dashboard`;
  }
}
