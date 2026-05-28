import { useEffect, useMemo, useState } from 'react';
import DashLayout from '../../components/layout/DashLayout';
import { supabase } from '../../lib/supabase';
import { ADMIN_NAV } from './adminNav';
import { isValidCheckoutScopeFormat, normalizeCheckoutScopeCode } from '../../lib/checkoutScope';

type CheckoutScopeRow = {
  id: string;
  scope_code: string;
  display_name: string;
  account_type: 'platform' | 'admin' | 'rep' | 'portal' | 'store' | 'sub_account';
  account_id: string | null;
  parent_account_id: string | null;
  is_active: boolean;
  default_commission_rate: number;
  notes: string | null;
  created_at: string;
};

type ScopeForm = {
  scope_code: string;
  display_name: string;
  account_type: CheckoutScopeRow['account_type'];
  account_id: string;
  parent_account_id: string;
  default_commission_rate: string;
  notes: string;
};

const emptyForm: ScopeForm = {
  scope_code: '',
  display_name: '',
  account_type: 'rep',
  account_id: '',
  parent_account_id: '',
  default_commission_rate: '0',
  notes: '',
};

export default function AdminScopeCodes() {
  const [rows, setRows] = useState<CheckoutScopeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [form, setForm] = useState<ScopeForm>(emptyForm);

  useEffect(() => {
    loadRows();
  }, []);

  async function loadRows() {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase
      .from('checkout_scopes')
      .select('*')
      .order('scope_code');
    if (loadError) setError(loadError.message);
    else setRows((data as CheckoutScopeRow[]) ?? []);
    setLoading(false);
  }

  const activeCount = rows.filter((row) => row.is_active).length;
  const linkOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://pepscriptrx.vercel.app';

  const normalizedFormCode = useMemo(() => normalizeCheckoutScopeCode(form.scope_code), [form.scope_code]);

  async function saveScope() {
    if (!supabase) return;
    const scopeCode = normalizedFormCode;
    if (!isValidCheckoutScopeFormat(scopeCode)) {
      setError('Scope code must use uppercase letters, numbers, hyphen, or underscore only.');
      return;
    }
    const rate = Math.max(0, Math.min(100, Number(form.default_commission_rate || 0))) / 100;
    const { error: saveError } = await supabase.from('checkout_scopes').upsert({
      scope_code: scopeCode,
      display_name: form.display_name.trim() || scopeCode,
      account_type: form.account_type,
      account_id: form.account_id.trim() || null,
      parent_account_id: form.parent_account_id.trim() || null,
      default_commission_rate: rate,
      notes: form.notes.trim() || null,
      is_active: true,
    }, { onConflict: 'scope_code' });

    if (saveError) {
      setError(saveError.message);
      return;
    }
    setForm(emptyForm);
    await loadRows();
  }

  async function toggleScope(row: CheckoutScopeRow) {
    if (!supabase) return;
    const { error: toggleError } = await supabase
      .from('checkout_scopes')
      .update({ is_active: !row.is_active })
      .eq('id', row.id);
    if (toggleError) setError(toggleError.message);
    else await loadRows();
  }

  function editScope(row: CheckoutScopeRow) {
    setForm({
      scope_code: row.scope_code,
      display_name: row.display_name,
      account_type: row.account_type,
      account_id: row.account_id ?? '',
      parent_account_id: row.parent_account_id ?? '',
      default_commission_rate: String(Math.round(Number(row.default_commission_rate ?? 0) * 100)),
      notes: row.notes ?? '',
    });
  }

  return (
    <DashLayout title="Checkout Scope Codes" navItems={ADMIN_NAV}>
      <div className="stats-grid mb-8">
        <div className="stat-card">
          <div className="stat-value">{rows.length}</div>
          <div className="stat-label">Total scopes</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{activeCount}</div>
          <div className="stat-label">Active scopes</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">PayPal</div>
          <div className="stat-label">Central merchant remains PepScriptRX</div>
        </div>
      </div>

      {error && <div className="alert alert-error mb-4">{error}</div>}

      <div className="card mb-6">
        <div className="card-header">
          <div>
            <div className="card-title">Create / Edit Scope</div>
            <div className="card-subtitle">Scope codes attach attribution at checkout only. They are not discount codes.</div>
          </div>
        </div>
        <div className="card-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14 }}>
          <label className="form-group">
            <span className="form-label">Scope code</span>
            <input className="form-input" value={form.scope_code} onChange={(e) => setForm({ ...form, scope_code: e.target.value.toUpperCase() })} placeholder="VITALITYINS" />
          </label>
          <label className="form-group">
            <span className="form-label">Display name</span>
            <input className="form-input" value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="VITALITYINS" />
          </label>
          <label className="form-group">
            <span className="form-label">Account type</span>
            <select className="form-select" value={form.account_type} onChange={(e) => setForm({ ...form, account_type: e.target.value as ScopeForm['account_type'] })}>
              <option value="platform">Platform</option>
              <option value="admin">Admin</option>
              <option value="rep">Rep</option>
              <option value="portal">Portal</option>
              <option value="store">Store</option>
              <option value="sub_account">Sub-account</option>
            </select>
          </label>
          <label className="form-group">
            <span className="form-label">Account ID / code</span>
            <input className="form-input" value={form.account_id} onChange={(e) => setForm({ ...form, account_id: e.target.value })} placeholder="MARK65" />
          </label>
          <label className="form-group">
            <span className="form-label">Parent account</span>
            <input className="form-input" value={form.parent_account_id} onChange={(e) => setForm({ ...form, parent_account_id: e.target.value })} placeholder="Optional" />
          </label>
          <label className="form-group">
            <span className="form-label">Internal share %</span>
            <input className="form-input" type="number" min="0" max="100" value={form.default_commission_rate} onChange={(e) => setForm({ ...form, default_commission_rate: e.target.value })} />
          </label>
          <label className="form-group" style={{ gridColumn: '1 / -1' }}>
            <span className="form-label">Notes</span>
            <input className="form-input" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Internal note" />
          </label>
          <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" onClick={saveScope}>Save Scope</button>
            <button className="btn btn-outline" onClick={() => setForm(emptyForm)}>Clear</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Active Checkout Attribution</div>
            <div className="card-subtitle">Generated links point to the centralized checkout, not separate public portal pages.</div>
          </div>
          <button className="btn btn-outline btn-sm" onClick={loadRows}>Refresh</button>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Scope</th>
                <th>Account</th>
                <th>Internal Share</th>
                <th>Checkout Link</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 36 }}><div className="spinner" style={{ margin: '0 auto' }} /></td></tr>
              ) : rows.map((row) => {
                const link = `${linkOrigin}/checkout?scope=${encodeURIComponent(row.scope_code)}`;
                return (
                  <tr key={row.id}>
                    <td>
                      <div style={{ fontWeight: 800, color: 'var(--navy)' }}>{row.scope_code}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.display_name}</div>
                    </td>
                    <td>
                      <span className="badge badge-info">{row.account_type}</span>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{row.account_id || 'platform'}</div>
                    </td>
                    <td>{Math.round(Number(row.default_commission_rate ?? 0) * 100)}%</td>
                    <td style={{ fontSize: 12, fontFamily: 'monospace', wordBreak: 'break-all' }}>{link}</td>
                    <td><span className={`badge ${row.is_active ? 'badge-success' : 'badge-default'}`}>{row.is_active ? 'active' : 'inactive'}</span></td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => editScope(row)}>Edit</button>{' '}
                      <button className="btn btn-outline btn-sm" onClick={() => toggleScope(row)}>{row.is_active ? 'Disable' : 'Enable'}</button>
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
