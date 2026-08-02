import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import DashLayout from '../../components/layout/DashLayout';
import { useAuth } from '../../context/AuthContext';
import { getDistributorProducts, type DistributorCatalogProduct } from '../../data/rxPlus';
import { getPartnerTenant, partnerCan, type PartnerTenantConfig } from '../../lib/partnerTenant';
import { getProductMetadata } from '../../lib/productMetadata';
import { supabase } from '../../lib/supabase';
import type { CommissionLedger, PatientSubmission, Rep } from '../../types';

export type PartnerStoreMode =
  | 'dashboard'
  | 'orders'
  | 'customers'
  | 'analytics'
  | 'reports'
  | 'products'
  | 'pricing'
  | 'discounts'
  | 'reps'
  | 'inventory'
  | 'store-settings';

type Props = {
  mode?: PartnerStoreMode;
};

type PriceDraft = {
  retail_price: string;
  is_enabled: boolean;
  featured: boolean;
};

const money = (value: number | null | undefined) => `$${Number(value ?? 0).toFixed(2)}`;

const MODE_MODULE: Partial<Record<PartnerStoreMode, Parameters<typeof partnerCan>[1]>> = {
  orders: 'orders',
  customers: 'customers',
  analytics: 'analytics',
  reports: 'reports',
  products: 'products',
  pricing: 'pricing',
  discounts: 'discounts',
  reps: 'reps',
  inventory: 'inventory',
  'store-settings': 'storefront',
};

export default function AdminPartnerStore({ mode = 'dashboard' }: Props) {
  const { profile } = useAuth();
  const tenant = getPartnerTenant(profile);
  const [orders, setOrders] = useState<PatientSubmission[]>([]);
  const [reps, setReps] = useState<Rep[]>([]);
  const [ledger, setLedger] = useState<CommissionLedger[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingProductId, setSavingProductId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const products = useMemo(() => (tenant ? getDistributorProducts(tenant.storeSlug) : []), [tenant]);
  const [priceDrafts, setPriceDrafts] = useState<Record<string, PriceDraft>>({});
  const navItems = useMemo(() => buildPartnerNav(tenant), [tenant]);
  const customers = useMemo(() => uniqueCustomers(orders), [orders]);
  const paidOrders = orders.filter((order) => order.status === 'paid' || order.status === 'fulfilled');
  const revenue = paidOrders.reduce((sum, order) => sum + Number(order.order_total ?? order.quoted_price ?? 0), 0);
  const partnerCommission = ledger
    .filter((row) => row.commission_role !== 'platform_margin_owner')
    .reduce((sum, row) => sum + Number(row.commission_amount ?? 0), 0);

  useEffect(() => {
    setPriceDrafts(Object.fromEntries(products.map((product) => [product.id, draftFromProduct(product)])));
  }, [products]);

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.brandId, tenant?.storeSlug, tenant?.scopeCode]);

  if (!tenant) return <Navigate to="/admin" replace />;
  const requiredModule = MODE_MODULE[mode];
  if (requiredModule && !partnerCan(profile, requiredModule)) return <Navigate to="/admin" replace />;

  async function loadData() {
    if (!supabase || !tenant) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');

    const [{ data: orderData, error: orderError }, { data: repData, error: repError }, { data: ledgerData, error: ledgerError }] = await Promise.all([
      supabase
        .from('patient_submissions')
        .select('*')
        .or(buildOrderScopeOr(tenant))
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase
        .from('reps')
        .select('*')
        .or(buildRepScopeOr(tenant))
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('commission_ledger')
        .select('*,submission:patient_submissions(*)')
        .order('created_at', { ascending: false })
        .limit(1000),
    ]);

    if (orderError) setError(orderError.message);
    if (repError) setError(repError.message);
    if (ledgerError) setError(ledgerError.message);

    const nextOrders = ((orderData as PatientSubmission[]) ?? []).filter((order) => isTenantOrder(order, tenant));
    const orderIds = new Set(nextOrders.map((order) => order.id));
    setOrders(nextOrders);
    setReps(((repData as Rep[]) ?? []).filter((rep) => isTenantRep(rep, tenant)));
    setLedger(((ledgerData as CommissionLedger[]) ?? []).filter((row) => (
      orderIds.has(row.submission_id) || (row.submission ? isTenantOrder(row.submission, tenant) : false)
    )));
    setLoading(false);
  }

  function updateDraft(productId: string, patch: Partial<PriceDraft>) {
    setPriceDrafts((current) => ({
      ...current,
      [productId]: {
        ...(current[productId] ?? draftFromProduct(products.find((product) => product.id === productId))),
        ...patch,
      },
    }));
  }

  async function saveProduct(product: DistributorCatalogProduct) {
    if (!supabase || !tenant) return;
    const draft = priceDrafts[product.id] ?? draftFromProduct(product);
    const retailPrice = Number(draft.retail_price);
    if (!Number.isFinite(retailPrice) || retailPrice <= 0) {
      setError('Retail price must be greater than 0.');
      return;
    }

    setSavingProductId(product.id);
    setMessage('');
    setError('');
    const { error: saveError } = await supabase.rpc('partner_upsert_distributor_product', {
      p_store_slug: tenant.storeSlug,
      p_product_id: product.id,
      p_retail_price: retailPrice,
      p_is_enabled: draft.is_enabled,
      p_featured: draft.featured,
    });
    if (saveError) setError(saveError.message);
    else setMessage(`${getProductMetadata(product).commonName} saved for ${tenant.brandName}.`);
    setSavingProductId('');
  }

  return (
    <DashLayout title={pageTitle(tenant, mode)} navItems={navItems}>
      <div className="space-y-6">
        <ScopeBanner tenant={tenant} />
        {message && <div className="alert alert-success">{message}</div>}
        {error && <div className="alert alert-error">{error}</div>}
        {loading ? (
          <div className="card"><div className="card-body">Loading {tenant.brandName} data...</div></div>
        ) : (
          <>
            {(mode === 'dashboard' || mode === 'analytics') && (
              <>
                <div className="stats-grid">
                  <Stat label="Tracked orders" value={String(orders.length)} />
                  <Stat label="Customers" value={String(customers.length)} />
                  <Stat label="Paid revenue" value={money(revenue)} />
                  <Stat label="Commission tracked" value={money(partnerCommission)} />
                </div>
                <div className="detail-grid">
                  <RecentOrders tenant={tenant} orders={orders.slice(0, 8)} />
                  <ReportPanel tenant={tenant} orders={orders} ledger={ledger} products={products} />
                </div>
              </>
            )}
            {mode === 'orders' && <OrdersTable tenant={tenant} orders={orders} />}
            {mode === 'customers' && <CustomersTable tenant={tenant} customers={customers} />}
            {mode === 'reports' && <SalesReports tenant={tenant} orders={orders} ledger={ledger} products={products} />}
            {mode === 'products' && <ProductsPanel tenant={tenant} products={products} />}
            {mode === 'pricing' && (
              <PricingPanel
                tenant={tenant}
                products={products}
                drafts={priceDrafts}
                savingProductId={savingProductId}
                onUpdateDraft={updateDraft}
                onSaveProduct={saveProduct}
              />
            )}
            {mode === 'discounts' && <DiscountPanel tenant={tenant} />}
            {mode === 'reps' && <RepsPanel tenant={tenant} reps={reps} />}
            {mode === 'inventory' && <InventoryPanel tenant={tenant} products={products} />}
            {mode === 'store-settings' && <StoreSettingsPanel tenant={tenant} products={products} />}
          </>
        )}
      </div>
    </DashLayout>
  );
}

function ScopeBanner({ tenant }: { tenant: PartnerTenantConfig }) {
  return (
    <div className="card">
      <div className="card-body" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontWeight: 900, color: 'var(--navy)' }}>{tenant.brandName} Partner Admin</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5 }}>
            Store slug {tenant.storeSlug}. Checkout scope {tenant.scopeCode}. Data shown here is scoped to this store.
          </div>
        </div>
        <a className="btn btn-primary btn-sm" href={tenant.storefrontPath} target="_blank" rel="noreferrer">Open Storefront</a>
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

function RecentOrders({ tenant, orders }: { tenant: PartnerTenantConfig; orders: PatientSubmission[] }) {
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">Recent Orders</div></div>
      <OrdersTable tenant={tenant} orders={orders} compact />
    </div>
  );
}

function ReportPanel({ tenant, orders, ledger, products }: {
  tenant: PartnerTenantConfig;
  orders: PatientSubmission[];
  ledger: CommissionLedger[];
  products: DistributorCatalogProduct[];
}) {
  const paidOrders = orders.filter((order) => order.status === 'paid' || order.status === 'fulfilled');
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">Store Report</div></div>
      <div className="card-body" style={{ display: 'grid', gap: 12 }}>
        <Detail label="Store attribution" value={tenant.brandName} />
        <Detail label="Checkout scope" value={tenant.scopeCode} />
        <Detail label="Paid order count" value={String(paidOrders.length)} />
        <Detail label="Catalog products" value={`${products.length} configured products`} />
        <Detail label="Top product" value={topProductName(orders) || 'No order data yet'} />
        <Detail label="Ledger rows" value={String(ledger.length)} />
      </div>
    </div>
  );
}

function OrdersTable({ tenant, orders, compact = false }: { tenant: PartnerTenantConfig; orders: PatientSubmission[]; compact?: boolean }) {
  return (
    <div className={compact ? '' : 'card'}>
      {!compact && <div className="card-header"><div className="card-title">{tenant.brandName} Orders</div></div>}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Customer</th><th>Product</th><th>Amount</th><th>Attribution</th><th>Status</th><th>Submitted</th></tr></thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No orders yet.</td></tr>
            ) : orders.map((order) => (
              <tr key={order.id}>
                <td>
                  <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{order.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{order.email}</div>
                </td>
                <td>{order.medication || order.product_name || '-'}</td>
                <td>{money(order.order_total ?? order.quoted_price)}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{order.checkout_scope_code || order.store_name || tenant.scopeCode}</td>
                <td><span className="badge badge-info">{order.status}</span></td>
                <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{new Date(order.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CustomersTable({ tenant, customers }: { tenant: PartnerTenantConfig; customers: PatientSubmission[] }) {
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">{tenant.brandName} Customers</div></div>
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
                <td>{customer.medication || customer.product_name || '-'}</td>
                <td>{new Date(customer.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SalesReports({ tenant, orders, ledger, products }: {
  tenant: PartnerTenantConfig;
  orders: PatientSubmission[];
  ledger: CommissionLedger[];
  products: DistributorCatalogProduct[];
}) {
  const paidOrders = orders.filter((order) => order.status === 'paid' || order.status === 'fulfilled');
  const totalCommission = ledger
    .filter((row) => row.commission_role !== 'platform_margin_owner')
    .reduce((sum, row) => sum + Number(row.commission_amount ?? 0), 0);
  return (
    <div className="detail-grid">
      <ReportPanel tenant={tenant} orders={orders} ledger={ledger} products={products} />
      <div className="card">
        <div className="card-header"><div className="card-title">Commission Summary</div></div>
        <div className="card-body" style={{ display: 'grid', gap: 10 }}>
          <Detail label="Paid orders" value={String(paidOrders.length)} />
          <Detail label="Commission tracked" value={money(totalCommission)} />
          <Detail label="Scope" value={`${tenant.brandName} only`} />
        </div>
      </div>
    </div>
  );
}

function ProductsPanel({ tenant, products }: { tenant: PartnerTenantConfig; products: DistributorCatalogProduct[] }) {
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">Product Visibility</div></div>
      <ProductTable tenant={tenant} products={products} />
    </div>
  );
}

function PricingPanel({
  tenant,
  products,
  drafts,
  savingProductId,
  onUpdateDraft,
  onSaveProduct,
}: {
  tenant: PartnerTenantConfig;
  products: DistributorCatalogProduct[];
  drafts: Record<string, PriceDraft>;
  savingProductId: string;
  onUpdateDraft: (productId: string, patch: Partial<PriceDraft>) => void;
  onSaveProduct: (product: DistributorCatalogProduct) => void;
}) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Pricing Manager</div>
          <div className="card-subtitle">Changes save to the live {tenant.brandName} storefront catalog.</div>
        </div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Product</th><th>Strength</th><th>Retail</th><th>Featured</th><th>Available</th><th /></tr></thead>
          <tbody>
            {products.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No products are configured yet.</td></tr>
            ) : products.map((product) => {
              const draft = drafts[product.id] ?? draftFromProduct(product);
              const meta = getProductMetadata(product);
              return (
                <tr key={product.id}>
                  <td>
                    <div style={{ fontWeight: 800, color: 'var(--navy)' }}>{meta.commonName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{product.sku}</div>
                  </td>
                  <td>{meta.doseLabel}</td>
                  <td>
                    <input
                      className="form-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={draft.retail_price}
                      onChange={(event) => onUpdateDraft(product.id, { retail_price: event.target.value })}
                    />
                  </td>
                  <td><input type="checkbox" checked={draft.featured} onChange={(event) => onUpdateDraft(product.id, { featured: event.target.checked })} /></td>
                  <td><input type="checkbox" checked={draft.is_enabled} onChange={(event) => onUpdateDraft(product.id, { is_enabled: event.target.checked })} /></td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="btn btn-primary btn-sm" type="button" disabled={savingProductId === product.id} onClick={() => onSaveProduct(product)}>
                      {savingProductId === product.id ? 'Saving...' : 'Save'}
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

function InventoryPanel({ tenant, products }: { tenant: PartnerTenantConfig; products: DistributorCatalogProduct[] }) {
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">{tenant.brandName} Inventory</div></div>
      <ProductTable tenant={tenant} products={products} />
    </div>
  );
}

function ProductTable({ tenant, products }: { tenant: PartnerTenantConfig; products: DistributorCatalogProduct[] }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Product</th><th>Category</th><th>Strength</th><th>Price</th><th>Status</th></tr></thead>
        <tbody>
          {products.length === 0 ? (
            <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No products are configured for {tenant.brandName}.</td></tr>
          ) : products.map((product) => {
            const meta = getProductMetadata(product);
            return (
              <tr key={product.id}>
                <td>
                  <div style={{ fontWeight: 800, color: 'var(--navy)' }}>{meta.commonName}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{product.description}</div>
                </td>
                <td>{product.category}</td>
                <td>{meta.doseLabel}</td>
                <td>{money(product.displayPrice)}</td>
                <td><span className="badge badge-success">Visible</span></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DiscountPanel({ tenant }: { tenant: PartnerTenantConfig }) {
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">Discount Codes</div></div>
      <div className="card-body" style={{ display: 'grid', gap: 10 }}>
        <Detail label="Store code" value={tenant.scopeCode} />
        <Detail label="Scope" value={`${tenant.brandName} only`} />
        <Link className="btn btn-primary btn-sm" to="/admin/aactivated-promos">Open Discount Code Manager</Link>
      </div>
    </div>
  );
}

function RepsPanel({ tenant, reps }: { tenant: PartnerTenantConfig; reps: Rep[] }) {
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">{tenant.brandName} Reps</div></div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Rep</th><th>Code</th><th>Email</th><th>Status</th></tr></thead>
          <tbody>
            {reps.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No reps found for this store.</td></tr>
            ) : reps.map((rep) => (
              <tr key={rep.id}>
                <td>{rep.rep_name || rep.handle || rep.rep_slug}</td>
                <td style={{ fontFamily: 'monospace' }}>{rep.rep_slug}</td>
                <td>{rep.payout_email || '-'}</td>
                <td><span className={`badge ${rep.active ? 'badge-success' : 'badge-default'}`}>{rep.active ? 'Active' : 'Inactive'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StoreSettingsPanel({ tenant, products }: { tenant: PartnerTenantConfig; products: DistributorCatalogProduct[] }) {
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">Store Settings</div></div>
      <div className="card-body" style={{ display: 'grid', gap: 10 }}>
        <Detail label="Brand" value={tenant.brandName} />
        <Detail label="Storefront" value={tenant.storefrontPath} />
        <Detail label="Catalog products" value={String(products.length)} />
        <Detail label="Access level" value={tenant.accessLevel.replace(/_/g, ' ')} />
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid rgba(15,23,42,.08)', paddingBottom: 8 }}>
      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{label}</span>
      <span style={{ color: 'var(--navy)', fontWeight: 800, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function buildPartnerNav(tenant: PartnerTenantConfig | null) {
  if (!tenant) return [];
  const nav = [
    { module: 'dashboard', label: 'Dashboard', path: '/admin', icon: '01' },
    { module: 'orders', label: 'Orders', path: '/admin/submissions', icon: '02' },
    { module: 'customers', label: 'Customers', path: '/admin/leads', icon: '03' },
    { module: 'products', label: 'Products', path: '/admin/products', icon: '04' },
    { module: 'pricing', label: 'Pricing Manager', path: '/admin/pricing', icon: '05' },
    { module: 'discounts', label: 'Discount Codes', path: '/admin/aactivated-promos', icon: '06' },
    { module: 'analytics', label: 'Analytics', path: '/admin/analytics', icon: '07' },
    { module: 'reports', label: 'Sales Reports', path: '/admin/commission-center', icon: '08' },
    { module: 'reps', label: 'Reps', path: '/admin/reps', icon: '09' },
    { module: 'inventory', label: 'Inventory', path: '/admin/inventory', icon: '10' },
    { module: 'storefront', label: 'Store Settings', path: '/admin/store-settings', icon: '11' },
    { module: 'marketing', label: 'Marketing Assets', path: '/admin/marketing-assets', icon: '12' },
  ] as const;
  return nav.filter((item) => item.module === 'dashboard' || tenant.modules.includes(item.module));
}

function buildOrderScopeOr(tenant: PartnerTenantConfig): string {
  return [
    `brand_id.eq.${tenant.brandId}`,
    `store_slug.eq.${tenant.storeSlug}`,
    `checkout_scope_code.eq.${tenant.scopeCode}`,
    `source_store.eq.${tenant.storeSlug}`,
    `source_admin.eq.${tenant.scopeCode}`,
    `source_rep.eq.${tenant.scopeCode}`,
    `admin_code.eq.${tenant.scopeCode}`,
    `referral_code.eq.${tenant.scopeCode}`,
  ].join(',');
}

function buildRepScopeOr(tenant: PartnerTenantConfig): string {
  return [
    `brand_id.eq.${tenant.brandId}`,
    `parent_brand_id.eq.${tenant.brandId}`,
    `assigned_store_slug.eq.${tenant.storeSlug}`,
    `custom_store_slug.eq.${tenant.storeSlug}`,
    `rep_slug.eq.${tenant.scopeCode}`,
  ].join(',');
}

function isTenantOrder(order: Partial<PatientSubmission>, tenant: PartnerTenantConfig): boolean {
  const scope = tenant.scopeCode.toUpperCase();
  const values = [
    order.brand_id,
    order.store_slug,
    order.source_store,
    order.source_admin,
    order.source_rep,
    order.admin_code,
    order.referral_code,
    order.checkout_scope_code,
  ];
  return values.some((value) => {
    const token = String(value ?? '').trim();
    return token.toLowerCase() === tenant.brandId
      || token.toLowerCase() === tenant.storeSlug
      || token.toUpperCase() === scope;
  });
}

function isTenantRep(rep: Partial<Rep>, tenant: PartnerTenantConfig): boolean {
  const scope = tenant.scopeCode.toUpperCase();
  return [
    rep.brand_id,
    rep.parent_brand_id,
    rep.assigned_store_slug,
    rep.custom_store_slug,
    rep.rep_slug,
    rep.rep_tier,
    rep.rep_channel,
  ].some((value) => {
    const token = String(value ?? '').trim();
    return token.toLowerCase() === tenant.brandId
      || token.toLowerCase() === tenant.storeSlug
      || token.toUpperCase() === scope;
  });
}

function uniqueCustomers(orders: PatientSubmission[]): PatientSubmission[] {
  const seen = new Set<string>();
  return orders.filter((order) => {
    const key = String(order.email ?? '').trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function topProductName(orders: PatientSubmission[]): string {
  const counts = new Map<string, number>();
  orders.forEach((order) => {
    const name = order.medication || order.product_name || 'Unknown';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  });
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

function draftFromProduct(product?: DistributorCatalogProduct): PriceDraft {
  return {
    retail_price: String(product?.displayPrice ?? product?.suggested_retail_price ?? ''),
    is_enabled: product?.distributorProduct.is_enabled ?? true,
    featured: product?.distributorProduct.featured ?? false,
  };
}

function pageTitle(tenant: PartnerTenantConfig, mode: PartnerStoreMode): string {
  const labels: Record<PartnerStoreMode, string> = {
    dashboard: 'Dashboard',
    orders: 'Orders',
    customers: 'Customers',
    analytics: 'Analytics',
    reports: 'Sales Reports',
    products: 'Products',
    pricing: 'Pricing Manager',
    discounts: 'Discount Codes',
    reps: 'Reps',
    inventory: 'Inventory',
    'store-settings': 'Store Settings',
  };
  return `${tenant.brandName} ${labels[mode]}`;
}
