import { useEffect, useMemo, useState } from 'react';
import DashLayout from '../../components/layout/DashLayout';
import { getDistributorProducts } from '../../data/rxPlus';
import { getPublicSiteUrl, supabase } from '../../lib/supabase';
import { normalizeCheckoutScopeCode } from '../../lib/checkoutScope';
import { ADMIN_NAV, RX_PLUS_ADMIN_NAV } from './adminNav';
import { useAuth } from '../../context/AuthContext';

type PromoRow = {
  id: string;
  created_at: string;
  is_active: boolean;
  store_scope_code: string;
  product_id: string | null;
  promo_title: string;
  discount_code: string;
  discount_amount: number;
  discount_type: 'fixed_amount' | 'percentage';
  discount_percent: number | null;
  expires_at: string | null;
  usage_limit: number | null;
  uses_count: number;
  rep_id: string | null;
  rep_slug: string | null;
  link_slug: string;
  notes: string | null;
};

type PromoForm = {
  store_scope_code: string;
  product_id: string;
  promo_title: string;
  discount_code: string;
  discount_type: 'fixed_amount' | 'percentage';
  discount_amount: string;
  discount_percent: string;
  expires_at: string;
  usage_limit: string;
  rep_id: string;
  notes: string;
};

type RepOption = {
  id: string;
  rep_slug: string;
  rep_name: string | null;
  payout_email: string | null;
};

const emptyForm: PromoForm = {
  store_scope_code: 'VITALITYINS',
  product_id: '',
  promo_title: '',
  discount_code: '',
  discount_type: 'fixed_amount',
  discount_amount: '25',
  discount_percent: '',
  expires_at: '',
  usage_limit: '',
  rep_id: '',
  notes: '',
};

const STORE_SCOPE_OPTIONS = [
  { value: 'VITALITYINS', label: 'AACTIVATEDRX main store' },
  { value: 'GUY60', label: 'AACTIVATEDRX alternate scope' },
];

export default function AdminAactivatedPromos() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<PromoRow[]>([]);
  const [form, setForm] = useState<PromoForm>(emptyForm);
  const [loading, setLoading] = useState(true);
  const [reps, setReps] = useState<RepOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const products = useMemo(() => getDistributorProducts('guy'), []);
  const navItems = profile?.role === 'rx_plus_admin' ? RX_PLUS_ADMIN_NAV : ADMIN_NAV;
  const origin = getPublicSiteUrl();

  useEffect(() => {
    void loadRows();
  }, []);

  async function loadRows() {
    if (!supabase) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const [{ data, error: loadError }, { data: repData }] = await Promise.all([
      supabase
        .from('aactivated_promo_links')
        .select('*')
        .order('created_at', { ascending: false }),
      supabase
        .from('reps')
        .select('id,rep_slug,rep_name,payout_email,active,brand_name,custom_store_slug,rep_channel,rep_tier')
        .eq('active', true)
        .order('rep_slug', { ascending: true }),
    ]);

    if (loadError) setError(loadError.message);
    else setRows((data as PromoRow[]) ?? []);
    setReps(((repData as Array<RepOption & { brand_name?: string | null; custom_store_slug?: string | null; rep_channel?: string | null; rep_tier?: string | null }>) ?? [])
      .filter((rep) => {
        const haystack = [rep.rep_slug, rep.brand_name, rep.custom_store_slug, rep.rep_channel, rep.rep_tier, rep.payout_email].filter(Boolean).join(' ').toUpperCase();
        return haystack.includes('AACTIVATED') || haystack.includes('GUY60') || haystack.includes('VITALITY') || haystack.includes('OMGBILLY');
      })
      .map(({ id, rep_slug, rep_name, payout_email }) => ({ id, rep_slug, rep_name, payout_email })));
    setLoading(false);
  }

  async function savePromo() {
    if (!supabase) {
      setError('Supabase is not configured, so promo links cannot be saved yet.');
      return;
    }

    const promoTitle = form.promo_title.trim();
    const discountCode = normalizeDiscountCode(form.discount_code || promoTitle);
    const amount = Math.max(0, Number(form.discount_amount || 0));
    const percent = Math.max(0, Number(form.discount_percent || 0));
    const scopeCode = normalizeCheckoutScopeCode(form.store_scope_code || 'VITALITYINS');
    const selectedRep = reps.find((rep) => rep.id === form.rep_id);

    if (!promoTitle || !discountCode || (form.discount_type === 'fixed_amount' ? amount <= 0 : percent <= 0)) {
      setError('Promo title, discount code, and a fixed amount or percentage discount are required.');
      return;
    }
    if (form.discount_type === 'percentage' && percent > 100) {
      setError('Percentage discounts must be 100% or less.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
    const linkSlug = buildPromoSlug(discountCode, promoTitle);

    const { error: saveError } = await supabase
      .from('aactivated_promo_links')
      .upsert({
        store_scope_code: scopeCode || 'VITALITYINS',
        product_id: form.product_id || null,
        promo_title: promoTitle,
        discount_code: discountCode,
        discount_type: form.discount_type,
        discount_amount: form.discount_type === 'fixed_amount' ? amount : 0,
        discount_percent: form.discount_type === 'percentage' ? percent : null,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
        usage_limit: form.usage_limit ? Math.max(1, Math.floor(Number(form.usage_limit))) : null,
        rep_id: selectedRep?.id ?? null,
        rep_slug: selectedRep?.rep_slug ?? null,
        link_slug: linkSlug,
        notes: form.notes.trim() || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'link_slug' });

    if (saveError) {
      setError(saveError.message);
    } else {
      setMessage('Promo link saved.');
      setForm(emptyForm);
      await loadRows();
    }
    setSaving(false);
  }

  async function togglePromo(row: PromoRow) {
    if (!supabase) return;
    setError('');
    const { error: updateError } = await supabase
      .from('aactivated_promo_links')
      .update({ is_active: !row.is_active, updated_at: new Date().toISOString() })
      .eq('id', row.id);
    if (updateError) setError(updateError.message);
    else await loadRows();
  }

  async function copyLink(row: PromoRow) {
    const link = buildPromoLink(origin, row);
    await navigator.clipboard.writeText(link);
    setCopiedId(row.id);
    window.setTimeout(() => setCopiedId(''), 1800);
  }

  const previewRow: PromoRow = {
    id: 'preview',
    created_at: new Date().toISOString(),
    is_active: true,
    store_scope_code: normalizeCheckoutScopeCode(form.store_scope_code || 'VITALITYINS'),
    product_id: form.product_id || null,
    promo_title: form.promo_title || 'Promo Title',
    discount_code: normalizeDiscountCode(form.discount_code || form.promo_title || 'PROMO'),
    discount_amount: form.discount_type === 'fixed_amount' ? Math.max(0, Number(form.discount_amount || 0)) : 0,
    discount_type: form.discount_type,
    discount_percent: form.discount_type === 'percentage' ? Math.max(0, Number(form.discount_percent || 0)) : null,
    expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
    usage_limit: form.usage_limit ? Math.max(1, Math.floor(Number(form.usage_limit))) : null,
    uses_count: 0,
    rep_id: form.rep_id || null,
    rep_slug: reps.find((rep) => rep.id === form.rep_id)?.rep_slug ?? null,
    link_slug: buildPromoSlug(form.discount_code || 'PROMO', form.promo_title || 'AACTIVATED'),
    notes: null,
  };

  return (
    <DashLayout title="AACTIVATEDRX Promo Links" navItems={navItems}>
      <div className="stats-grid mb-8">
        <div className="stat-card">
          <div className="stat-value">{rows.length}</div>
          <div className="stat-label">Saved promo links</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{rows.filter((row) => row.is_active).length}</div>
          <div className="stat-label">Active promos</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">AACTIVATED</div>
          <div className="stat-label">Storefront scope only</div>
        </div>
      </div>

      {error && <div className="alert alert-error mb-4">{error}</div>}
      {message && <div className="alert alert-success mb-4">{message}</div>}

      <div className="card mb-6">
        <div className="card-header">
          <div>
            <div className="card-title">Promo Code Manager</div>
            <div className="card-subtitle">Create server-authoritative fixed or percentage codes with expiration, usage caps, and optional rep ownership.</div>
          </div>
        </div>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
          <label className="form-group">
            <span className="form-label">Store / downline scope</span>
            <input
              className="form-input"
              list="aactivated-store-scopes"
              value={form.store_scope_code}
              onChange={(e) => setForm({ ...form, store_scope_code: e.target.value.toUpperCase() })}
              placeholder="VITALITYINS"
            />
            <datalist id="aactivated-store-scopes">
              {STORE_SCOPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </datalist>
          </label>

          <label className="form-group">
            <span className="form-label">Product</span>
            <select className="form-select" value={form.product_id} onChange={(e) => setForm({ ...form, product_id: e.target.value })}>
              <option value="">Any product / full catalog</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.product_name} {product.strength}
                </option>
              ))}
            </select>
          </label>

          <label className="form-group">
            <span className="form-label">Promo title</span>
            <input className="form-input" value={form.promo_title} onChange={(e) => setForm({ ...form, promo_title: e.target.value })} placeholder="Summer Recovery Offer" />
          </label>

          <label className="form-group">
            <span className="form-label">Discount code</span>
            <input className="form-input" value={form.discount_code} onChange={(e) => setForm({ ...form, discount_code: e.target.value.toUpperCase() })} placeholder="RECOVER25" />
          </label>

          <label className="form-group">
            <span className="form-label">Discount amount</span>
            <select className="form-select" value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as PromoForm['discount_type'] })}>
              <option value="fixed_amount">Fixed dollar</option>
              <option value="percentage">Percentage</option>
            </select>
          </label>

          {form.discount_type === 'fixed_amount' ? (
            <label className="form-group">
              <span className="form-label">Dollar discount</span>
              <input className="form-input" type="number" min="0" step="1" value={form.discount_amount} onChange={(e) => setForm({ ...form, discount_amount: e.target.value })} />
            </label>
          ) : (
            <label className="form-group">
              <span className="form-label">Percent discount</span>
              <input className="form-input" type="number" min="0" max="100" step="1" value={form.discount_percent} onChange={(e) => setForm({ ...form, discount_percent: e.target.value })} />
            </label>
          )}

          <label className="form-group">
            <span className="form-label">Expiration</span>
            <input className="form-input" type="datetime-local" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
          </label>

          <label className="form-group">
            <span className="form-label">Usage limit</span>
            <input className="form-input" type="number" min="1" step="1" value={form.usage_limit} onChange={(e) => setForm({ ...form, usage_limit: e.target.value })} placeholder="Unlimited" />
          </label>

          <label className="form-group">
            <span className="form-label">Rep owner</span>
            <select className="form-select" value={form.rep_id} onChange={(e) => setForm({ ...form, rep_id: e.target.value })}>
              <option value="">House / unassigned</option>
              {reps.map((rep) => (
                <option key={rep.id} value={rep.id}>
                  {rep.rep_slug} {rep.rep_name ? `- ${rep.rep_name}` : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="form-group" style={{ gridColumn: '1 / -1' }}>
            <span className="form-label">Internal notes</span>
            <input className="form-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Optional campaign note" />
          </label>

          <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 10 }}>
            <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>Generated link preview</div>
              <div style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all', color: 'var(--navy)' }}>
                {buildPromoLink(origin, previewRow)}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn btn-primary" type="button" onClick={savePromo} disabled={saving}>
                {saving ? 'Saving...' : 'Save Promo Code'}
              </button>
              <button className="btn btn-outline" type="button" onClick={() => setForm(emptyForm)}>Clear</button>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Saved Links</div>
            <div className="card-subtitle">Customers are sent to AACTIVATEDRX, and checkout keeps the selected scope attached.</div>
          </div>
          <button className="btn btn-outline btn-sm" type="button" onClick={loadRows}>Refresh</button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Promo</th>
                <th>Product</th>
                <th>Scope</th>
                <th>Discount</th>
                <th>Rep Owner</th>
                <th>Usage</th>
                <th>Expires</th>
                <th>Link</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 36 }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={10} style={{ textAlign: 'center', padding: 28, color: 'var(--text-muted)' }}>No promo links yet.</td></tr>
              ) : rows.map((row) => {
                const product = products.find((item) => item.id === row.product_id);
                const link = buildPromoLink(origin, row);
                return (
                  <tr key={row.id}>
                    <td>
                      <div style={{ fontWeight: 800, color: 'var(--navy)' }}>{row.promo_title}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.discount_code}</div>
                    </td>
                    <td>{product ? `${product.product_name} ${product.strength}` : 'Full catalog'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{row.store_scope_code}</td>
                    <td>{formatDiscount(row)}</td>
                    <td>{row.rep_slug || 'House'}</td>
                    <td>{row.usage_limit ? `${row.uses_count ?? 0}/${row.usage_limit}` : `${row.uses_count ?? 0} / unlimited`}</td>
                    <td>{row.expires_at ? new Date(row.expires_at).toLocaleString() : 'Never'}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>{link}</td>
                    <td><span className={`badge ${row.is_active ? 'badge-success' : 'badge-default'}`}>{row.is_active ? 'active' : 'inactive'}</span></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-outline btn-sm" type="button" onClick={() => copyLink(row)}>{copiedId === row.id ? 'Copied' : 'Copy'}</button>{' '}
                      <button className="btn btn-outline btn-sm" type="button" onClick={() => togglePromo(row)}>{row.is_active ? 'Disable' : 'Enable'}</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </DashLayout>
  );
}

function normalizeDiscountCode(value: string): string {
  return value.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
}

function buildPromoSlug(code: string, title: string): string {
  const base = `${normalizeDiscountCode(code) || 'PROMO'}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return base || 'aactivated-promo';
}

function buildPromoLink(origin: string, row: Pick<PromoRow, 'link_slug' | 'product_id'>): string {
  const params = new URLSearchParams({ promo: row.link_slug });
  if (row.product_id) params.set('product', row.product_id);
  return `${origin}/AACTIVATED?${params.toString()}`;
}

function formatDiscount(row: Pick<PromoRow, 'discount_type' | 'discount_percent' | 'discount_amount'>): string {
  return row.discount_type === 'percentage'
    ? `${Number(row.discount_percent ?? 0).toFixed(2).replace(/\.00$/, '')}%`
    : `$${Number(row.discount_amount ?? 0).toFixed(2)}`;
}
