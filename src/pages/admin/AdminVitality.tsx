import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashLayout from '../../components/layout/DashLayout';
import { getDistributorProducts } from '../../data/rxPlus';
import { getProductMetadata } from '../../lib/productMetadata';
import { supabase } from '../../lib/supabase';
import type { PatientSubmission } from '../../types';
import { VITALITY_ADMIN_NAV } from './adminNav';

type VitalityMode = 'dashboard' | 'orders' | 'customers' | 'analytics' | 'products' | 'store-settings';

type Props = {
  mode?: VitalityMode;
};

const STORE_NAME = 'Vitality Institute Labs';
const STORE_SLUG = 'vitality';
const SCOPE_CODE = 'VITALITY';
const LOGO_SRC = '/brands/vitality/vitality-logo.png';
const VIAL_SRC = '/brands/vitality/vitality-vial.png';
const HERO_SRC = '/brands/vitality/vitality-basket-hero.png';

const money = (value: number | null | undefined) => `$${Number(value ?? 0).toFixed(2)}`;

export default function AdminVitality({ mode = 'dashboard' }: Props) {
  const [orders, setOrders] = useState<PatientSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const products = useMemo(() => getDistributorProducts(STORE_SLUG), []);
  const customers = useMemo(() => uniqueCustomers(orders), [orders]);
  const paidOrders = orders.filter((order) => order.status === 'paid' || order.status === 'fulfilled');
  const revenue = paidOrders.reduce((sum, order) => sum + Number(order.order_total ?? order.quoted_price ?? 0), 0);
  const inquiryCount = orders.filter((order) => order.submission_type === 'inquiry').length;
  const productCategories = Array.from(new Set(products.map((product) => product.category))).length;

  useEffect(() => {
    void loadOrders();
  }, []);

  async function loadOrders() {
    if (!supabase) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');
    const { data, error: orderError } = await supabase
      .from('patient_submissions')
      .select('*')
      .or([
        'brand_id.eq.vitality',
        'store_slug.eq.vitality',
        'checkout_scope_code.eq.VITALITY',
        'source_portal.ilike.%Vitality Institute Labs%',
        'source_store.eq.vitality',
        'source_admin.eq.VITALITY',
        'source_rep.eq.VITALITY',
        'admin_code.eq.VITALITY',
      ].join(','))
      .order('created_at', { ascending: false })
      .limit(800);

    if (orderError) setError(orderError.message);
    else setOrders(((data as PatientSubmission[]) ?? []).filter(isVitalityOrder));
    setLoading(false);
  }

  return (
    <DashLayout title={pageTitle(mode)} navItems={VITALITY_ADMIN_NAV}>
      <div className="space-y-6">
        <ScopeBanner />
        {error && <div className="alert alert-error">{error}</div>}
        {loading ? (
          <div className="card"><div className="card-body">Loading Vitality data...</div></div>
        ) : (
          <>
            {(mode === 'dashboard' || mode === 'analytics') && (
              <>
                <div className="stats-grid">
                  <Stat label="Tracked orders" value={String(orders.length)} />
                  <Stat label="Customers" value={String(customers.length)} />
                  <Stat label="Paid revenue" value={money(revenue)} />
                  <Stat label="Commission" value="0%" />
                </div>
                <div className="detail-grid">
                  <RecentOrders orders={orders.slice(0, 8)} />
                  <ReportPanel orders={orders} productCount={products.length} productCategories={productCategories} inquiryCount={inquiryCount} />
                </div>
              </>
            )}
            {mode === 'orders' && <OrdersTable orders={orders} />}
            {mode === 'customers' && <CustomersTable customers={customers} />}
            {mode === 'products' && <ProductsPanel products={products} />}
            {mode === 'store-settings' && <StoreSettings productCount={products.length} />}
          </>
        )}
      </div>
    </DashLayout>
  );
}

function ScopeBanner() {
  return (
    <div className="card" style={{ borderColor: 'rgba(126, 34, 206, .22)' }}>
      <div className="card-body" style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <img src={LOGO_SRC} alt={STORE_NAME} style={{ width: 128, maxHeight: 70, objectFit: 'contain' }} />
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontWeight: 900, color: 'var(--navy)' }}>Vitality Partner Admin</div>
          <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5 }}>
            Store slug {STORE_SLUG}. Checkout scope {SCOPE_CODE}. Patient acquisition and marketing attribution are active. Commission, payouts, rep payouts, earnings, and commission editing are disabled.
          </div>
        </div>
        <a className="btn btn-primary btn-sm" href="/vitality" target="_blank" rel="noreferrer">Open Storefront</a>
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
      <div className="card-header"><div className="card-title">Recent Vitality Orders</div></div>
      <OrdersTable orders={orders} compact />
    </div>
  );
}

function ReportPanel({ orders, productCount, productCategories, inquiryCount }: { orders: PatientSubmission[]; productCount: number; productCategories: number; inquiryCount: number }) {
  const paidOrders = orders.filter((order) => order.status === 'paid' || order.status === 'fulfilled');
  const topProduct = topProductName(orders);
  return (
    <div className="card">
      <div className="card-header"><div className="card-title">Reports</div></div>
      <div className="card-body" style={{ display: 'grid', gap: 12 }}>
        <Detail label="Store attribution" value={STORE_NAME} />
        <Detail label="Checkout scope" value={SCOPE_CODE} />
        <Detail label="Paid order count" value={String(paidOrders.length)} />
        <Detail label="Inquiry leads" value={String(inquiryCount)} />
        <Detail label="Catalog products" value={`${productCount} across ${productCategories} categories`} />
        <Detail label="Top product" value={topProduct || 'No order data yet'} />
        <Detail label="Payout eligibility" value="Disabled - platform retains 100% of profit" />
      </div>
    </div>
  );
}

function OrdersTable({ orders, compact = false }: { orders: PatientSubmission[]; compact?: boolean }) {
  return (
    <div className={compact ? '' : 'card'}>
      {!compact && <div className="card-header"><div className="card-title">Vitality Orders</div></div>}
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Customer</th><th>Product</th><th>Amount</th><th>Attribution</th><th>Status</th><th>Submitted</th></tr></thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 32, color: 'var(--text-muted)' }}>No Vitality orders yet.</td></tr>
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
      <div className="card-header"><div className="card-title">Vitality Customers</div></div>
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

function ProductsPanel({ products }: { products: ReturnType<typeof getDistributorProducts> }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Product Visibility</div>
          <div className="card-subtitle">Vitality mirrors the main PepScriptRX catalog. Pricing is locked to platform pricing and no commission settings are exposed.</div>
        </div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead><tr><th>Product</th><th>Category</th><th>Strength</th><th>Price</th><th>Status</th></tr></thead>
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
                  <td><span className="badge badge-success">Visible</span></td>
                </tr>
              );
            })}
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
          <img src={LOGO_SRC} alt={`${STORE_NAME} logo`} style={{ maxWidth: 240, maxHeight: 120, objectFit: 'contain' }} />
          <img src={VIAL_SRC} alt={`${STORE_NAME} vial`} style={{ maxWidth: 180, maxHeight: 240, objectFit: 'contain' }} />
          <img src={HERO_SRC} alt={`${STORE_NAME} hero`} style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 8 }} />
        </div>
      </div>
      <div className="card">
        <div className="card-header"><div className="card-title">Store Customization</div></div>
        <div className="card-body" style={{ display: 'grid', gap: 10 }}>
          <Detail label="Store name" value={STORE_NAME} />
          <Detail label="URL" value="/vitality" />
          <Detail label="Scope/code" value={SCOPE_CODE} />
          <Detail label="Products" value={`${productCount} synchronized products`} />
          <Detail label="Palette" value="Deep violet, royal purple, lavender, white, champagne gold" />
          <Detail label="Financial modules" value="Hidden for 0% marketing partner" />
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

function isVitalityOrder(order: PatientSubmission) {
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
  ].join(' ').toLowerCase();

  return tokens.includes('vitality') || tokens.includes('vitality institute labs');
}

function pageTitle(mode: VitalityMode) {
  if (mode === 'orders') return 'Vitality Orders';
  if (mode === 'customers') return 'Vitality Customers';
  if (mode === 'analytics') return 'Vitality Analytics';
  if (mode === 'products') return 'Vitality Products';
  if (mode === 'store-settings') return 'Vitality Store Settings';
  return 'Vitality Dashboard';
}
