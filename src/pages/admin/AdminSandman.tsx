import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashLayout from '../../components/layout/DashLayout';
import { getDistributorProducts } from '../../data/rxPlus';
import { getProductMetadata } from '../../lib/productMetadata';
import { supabase } from '../../lib/supabase';
import type { CommissionLedger, PatientSubmission, Rep } from '../../types';
import { SANDMAN_ADMIN_NAV } from './adminNav';

type SandmanMode =
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
  mode?: SandmanMode;
};

const STORE_NAME = 'Sandman Wellness Labs';
const STORE_SLUG = 'sandman';
const SCOPE_CODE = 'SANDMAN';
const OWNER_EMAIL = 'tapjoshi@yahoo.com';
const LOGO_SRC = '/brands/sandman/sandman-logo.png';
const VIAL_SRC = '/brands/sandman/sandman-vial-placeholder.png';
const HERO_SRC = '/brands/sandman/sandman-basket-hero.png';

const money = (value: number | null | undefined) => `$${Number(value ?? 0).toFixed(2)}`;

export default function AdminSandman({ mode = 'dashboard' }: Props) {
  const [orders, setOrders] = useState<PatientSubmission[]>([]);
  const [reps, setReps] = useState<Rep[]>([]);
  const [ledger, setLedger] = useState<CommissionLedger[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const products = useMemo(() => getDistributorProducts(STORE_SLUG), []);
  const customers = useMemo(() => uniqueCustomers(orders), [orders]);
  const paidOrders = orders.filter((order) => order.status === 'paid' || order.status === 'fulfilled');
  const revenue = paidOrders.reduce((sum, order) => sum + Number(order.order_total ?? order.quoted_price ?? 0), 0);
  const netProfit = ledger
    .filter((row) => row.commission_role !== 'platform_margin_owner')
    .reduce((sum, row) => sum + Number(row.margin ?? 0), 0);
  const partnerCommission = ledger
    .filter((row) => row.commission_role === 'rep_commission_owner' || row.commission_role === 'scope_commission_owner')
    .reduce((sum, row) => sum + Number(row.commission_amount ?? 0), 0);

  useEffect(() => {
    void loadData();
  }, []);

  async function loadData() {
    if (!supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const [{ data: orderData, error: orderError }, { data: repData, error: repError }, { data: ledgerData, error: ledgerError }] = await Promise.all([
      supabase
        .from('patient_submissions')
        .select('*')
        .or([
          'brand_id.eq.sandman',
          'store_slug.eq.sandman',
          'checkout_scope_code.eq.SANDMAN',
          'source_portal.ilike.%Sandman Wellness Labs%',
          'source_store.eq.sandman',
          'source_admin.eq.SANDMAN',
          'source_rep.eq.SANDMAN',
          'admin_code.eq.SANDMAN',
          'referral_code.eq.SANDMAN',
        ].join(','))
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase
        .from('reps')
        .select('*')
        .or([
          'brand_id.eq.sandman',
          'assigned_store_slug.eq.sandman',
          'custom_store_slug.eq.sandman',
          'rep_slug.eq.SANDMAN',
        ].join(','))
        .order('created_at', { ascending: false }),
      supabase
        .from('commission_ledger')
        .select('*,submission:patient_submissions(*)')
        .order('created_at', { ascending: false })
        .limit(1000),
    ]);

    const nextOrders = ((orderData as PatientSubmission[]) ?? []).filter(isSandmanOrder);
    const orderIds = new Set(nextOrders.map((order) => order.id));
    const nextLedger = ((ledgerData as CommissionLedger[]) ?? []).filter((row) => (
      orderIds.has(row.submission_id)
      || Boolean(row.submission && isSandmanOrder(row.submission))
    ));

    if (orderError || repError) setError(orderError?.message || repError?.message || '');
    else if (ledgerError) setError(ledgerError.message);

    setOrders(nextOrders);
    setReps(((repData as Rep[]) ?? []).filter(isSandmanRep));
    setLedger(nextLedger);
    setLoading(false);
  }

  return (
    <DashLayout title={pageTitle(mode)} navItems={SANDMAN_ADMIN_NAV}>
      <div className="space-y-6">
        <ScopeBanner />
        {error && <div className="alert alert-error">{error}</div>}
        {loading ? (
          <div className="card"><div className="card-body">Loading Sandman data...</div></div>
        ) : (
          <>
            {(mode === 'dashboard' || mode === 'analytics') && (
              <>
                <div className="stats-grid">
                  <Stat label="Tracked orders" value={String(orders.length)} />
                  <Stat label="Customers" value={String(customers.length)} />
                  <Stat label="Paid revenue" value={money(revenue)} />
                  <Stat label="Partner commission" value={money(partnerCommission)} />
                </div>
                <div className="detail-grid">
                  <RecentOrders orders={orders.slice(0, 8)} />
                  <ReportPanel orders={orders} ledger={ledger} productCount={products.length} netProfit={netProfit} partnerCommission={partnerCommission} />
                </div>
              </>
            )}
            {mode === 'orders' && <OrdersTable orders={orders} />}
            {mode === 'customers' && <CustomersTable customers={customers} />}
            {mode === 'reports' && <SalesReports orders={orders} ledger={ledger} />}
            {mode === 'products' && <ProductsPanel products={products} />}
            {mode === 'pricing' && <PricingPanel products={products} />}
            {mode === 'discounts' && <DiscountPanel />}
            {mode === 'reps' && <RepPanel reps={reps} />}
            {mode === 'inventory' && <InventoryPanel products={products} />}
            {mode === 'store-settings' && <StoreSettings productCount={products.length} />}
          </>
        )}
      </div>
    </DashLayout>
  );
}

function ScopeBanner() {
  return (
    <div className="card" style={{ borderColor: 'rgba(201, 168, 106, .38)' }}>
      <div className="card-body" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <img src={LOGO_SRC} alt={STORE_NAME} style={{ width: 128, maxHeight: 74, objectFit: 'contain', borderRadius: 8 }} />
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontWeight: 900, color: 'var(--navy)' }}>Sandman Partner Admin</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5 }}>
            Store slug {STORE_SLUG}. Checkout scope {SCOPE_CODE}. Direct child of the main platform with no upline override. Commission is 50% of net profit after true landed cost.
          </div>
        </div>
        <a className="btn btn-primary btn-sm" href="/sandman" target="_blank" rel="noreferrer">Open Storefront</a>
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

function RecentOrders({ orders }: { orders: PatientSubmission[] }) {
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">Recent Sandman Orders</div></div>
      <OrdersTable orders={orders} compact />
    </div>
  );
}

function ReportPanel({ orders, ledger, productCount, netProfit, partnerCommission }: {
  orders: PatientSubmission[];
  ledger: CommissionLedger[];
  productCount: number;
  netProfit: number;
  partnerCommission: number;
}) {
  const paidOrders = orders.filter((order) => order.status === 'paid' || order.status === 'fulfilled');
  const topProduct = topProductName(orders);
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">Sales Reports</div></div>
      <div className="card-body" style={{ display: 'grid', gap: 12 }}>
        <Detail label="Store attribution" value={STORE_NAME} />
        <Detail label="Checkout scope" value={SCOPE_CODE} />
        <Detail label="Paid order count" value={String(paidOrders.length)} />
        <Detail label="Catalog products" value={`${productCount} synchronized products`} />
        <Detail label="Top product" value={topProduct || 'No order data yet'} />
        <Detail label="Commission basis" value="50% of selling price minus true landed cost" />
        <Detail label="Net profit tracked" value={money(netProfit || ledger[0]?.margin)} />
        <Detail label="Partner commission tracked" value={money(partnerCommission)} />
      </div>
    </div>
  );
}

function OrdersTable({ orders, compact = false }: { orders: PatientSubmission[]; compact?: boolean }) {
  return (
    <div className={compact ? '' : 'card'}>
      {!compact && <div className="card-header"><div className="card-title">Sandman Orders</div></div>}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Customer</th><th>Product</th><th>Amount</th><th>Attribution</th><th>Status</th><th>Submitted</th></tr></thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No Sandman orders yet.</td></tr>
            ) : orders.map((order) => (
              <tr key={order.id}>
                <td>
                  <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{order.full_name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{order.email}</div>
                </td>
                <td>{order.medication || order.product_name || '-'}</td>
                <td>{money(order.order_total ?? order.quoted_price)}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{order.checkout_scope_code || order.store_name || STORE_NAME}</td>
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

function CustomersTable({ customers }: { customers: PatientSubmission[] }) {
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">Sandman Customers</div></div>
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

function SalesReports({ orders, ledger }: { orders: PatientSubmission[]; ledger: CommissionLedger[] }) {
  const paidOrders = orders.filter((order) => order.status === 'paid' || order.status === 'fulfilled');
  return (
    <div className="detail-grid">
      <ReportPanel
        orders={orders}
        ledger={ledger}
        productCount={getDistributorProducts(STORE_SLUG).length}
        netProfit={ledger.reduce((sum, row) => sum + Number(row.margin ?? 0), 0)}
        partnerCommission={ledger.filter((row) => row.commission_role !== 'platform_margin_owner').reduce((sum, row) => sum + Number(row.commission_amount ?? 0), 0)}
      />
      <div className="card">
        <div className="card-header"><div className="card-title">Commission Formula</div></div>
        <div className="card-body" style={{ display: 'grid', gap: 10 }}>
          <Detail label="Selling price" value="Customer product subtotal after discounts" />
          <Detail label="True landed cost" value="Product, fulfillment, shipping, and payment costs tracked by platform" />
          <Detail label="Net profit" value="Selling price minus true landed cost" />
          <Detail label="Sandman share" value="50% of net profit" />
          <Detail label="Platform share" value="50% of net profit" />
          <Detail label="Paid orders" value={String(paidOrders.length)} />
        </div>
      </div>
    </div>
  );
}

function ProductsPanel({ products }: { products: ReturnType<typeof getDistributorProducts> }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Product Visibility</div>
          <div className="card-subtitle">Sandman mirrors the PepScriptRX catalog. Visibility and product list settings are scoped to Sandman only.</div>
        </div>
      </div>
      <ProductTable products={products} showStatus />
    </div>
  );
}

function PricingPanel({ products }: { products: ReturnType<typeof getDistributorProducts> }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Pricing Manager</div>
          <div className="card-subtitle">Current Sandman catalog prices follow the preserved platform pricing engine.</div>
        </div>
      </div>
      <ProductTable products={products} showCommission />
    </div>
  );
}

function InventoryPanel({ products }: { products: ReturnType<typeof getDistributorProducts> }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Inventory Visibility</div>
          <div className="card-subtitle">Inventory synchronization remains platform-managed; this view is scoped to Sandman-visible catalog items.</div>
        </div>
      </div>
      <ProductTable products={products} showStatus />
    </div>
  );
}

function ProductTable({ products, showCommission = false, showStatus = false }: {
  products: ReturnType<typeof getDistributorProducts>;
  showCommission?: boolean;
  showStatus?: boolean;
}) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Product</th><th>Category</th><th>Strength</th><th>Price</th><th>{showCommission ? 'Commission' : 'Status'}</th></tr></thead>
        <tbody>
          {products.map((product) => {
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
                <td>
                  {showCommission
                    ? <span className="badge badge-success">50% net profit</span>
                    : showStatus
                      ? <span className="badge badge-success">Visible</span>
                      : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function DiscountPanel() {
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">Discount Codes</div></div>
      <div className="card-body" style={{ display: 'grid', gap: 10 }}>
        <Detail label="Store code" value={SCOPE_CODE} />
        <Detail label="Default customer discount" value="None" />
        <Detail label="Scope" value="Sandman Wellness Labs only" />
        <Detail label="Commission impact" value="Discounts reduce selling price before the net-profit split" />
      </div>
    </div>
  );
}

function RepPanel({ reps }: { reps: Rep[] }) {
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">Rep Management</div></div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Name</th><th>Code</th><th>Email</th><th>Commission</th><th>Status</th></tr></thead>
          <tbody>
            {reps.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No Sandman reps found.</td></tr>
            ) : reps.map((rep) => (
              <tr key={rep.id}>
                <td>{rep.rep_name}</td>
                <td style={{ fontFamily: 'monospace' }}>{rep.rep_slug}</td>
                <td>{rep.payout_email}</td>
                <td>{Math.round(Number(rep.commission_rate ?? 0) * 100)}%</td>
                <td><span className={rep.active ? 'badge badge-success' : 'badge badge-default'}>{rep.active ? 'Active' : 'Inactive'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StoreSettings({ productCount }: { productCount: number }) {
  return (
    <div className="detail-grid">
      <div className="card">
        <div className="card-header"><div className="card-title">Brand Assets</div></div>
        <div className="card-body" style={{ display: 'grid', gap: 16 }}>
          <img src={LOGO_SRC} alt={`${STORE_NAME} logo`} style={{ maxWidth: 240, maxHeight: 120, objectFit: 'contain', borderRadius: 8 }} />
          <img src={VIAL_SRC} alt={`${STORE_NAME} vial`} style={{ maxWidth: 220, maxHeight: 260, objectFit: 'cover', borderRadius: 8 }} />
          <img src={HERO_SRC} alt={`${STORE_NAME} hero`} style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 8 }} />
        </div>
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">Store Configuration</div></div>
        <div className="card-body" style={{ display: 'grid', gap: 10 }}>
          <Detail label="Store name" value={STORE_NAME} />
          <Detail label="URL" value="/sandman" />
          <Detail label="Owner" value={`Dr. Tapan Joshi / ${OWNER_EMAIL}`} />
          <Detail label="Scope/code" value={SCOPE_CODE} />
          <Detail label="Products" value={`${productCount} synchronized products`} />
          <Detail label="Hierarchy" value="Main Platform > Sandman Wellness Labs" />
          <Detail label="Upline overrides" value="None" />
          <Link className="btn btn-outline btn-sm" to="/admin/marketing-assets">Open Marketing Assets</Link>
        </div>
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

function uniqueCustomers(orders: PatientSubmission[]) {
  const byEmail = new Map<string, PatientSubmission>();
  orders.forEach((order) => {
    const key = String(order.email ?? '').toLowerCase();
    if (key && !byEmail.has(key)) byEmail.set(key, order);
  });
  return Array.from(byEmail.values());
}

function topProductName(orders: PatientSubmission[]) {
  const counts = new Map<string, number>();
  orders.forEach((order) => {
    const name = order.medication || order.product_name || '';
    if (!name) return;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  });
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';
}

function isSandmanOrder(order: Partial<PatientSubmission>) {
  const tokens = [
    order.brand_id,
    order.store_slug,
    order.store_name,
    order.checkout_scope_code,
    order.source_portal,
    order.source_store,
    order.source_admin,
    order.source_rep,
    order.admin_code,
    order.referral_code,
    order.discount_code,
  ].join(' ').toLowerCase();

  return tokens.includes('sandman');
}

function isSandmanRep(rep: Partial<Rep>) {
  const tokens = [
    rep.brand_id,
    rep.parent_brand_id,
    rep.assigned_store_slug,
    rep.custom_store_slug,
    rep.brand_name,
    rep.rep_slug,
    rep.rep_channel,
    rep.rep_tier,
  ].join(' ').toLowerCase();

  return tokens.includes('sandman');
}

function pageTitle(mode: SandmanMode) {
  if (mode === 'orders') return 'Sandman Orders';
  if (mode === 'customers') return 'Sandman Customers';
  if (mode === 'analytics') return 'Sandman Analytics';
  if (mode === 'reports') return 'Sandman Sales Reports';
  if (mode === 'products') return 'Sandman Products';
  if (mode === 'pricing') return 'Sandman Pricing Manager';
  if (mode === 'discounts') return 'Sandman Discount Codes';
  if (mode === 'reps') return 'Sandman Rep Management';
  if (mode === 'inventory') return 'Sandman Inventory';
  if (mode === 'store-settings') return 'Sandman Store Settings';
  return 'Sandman Dashboard';
}
