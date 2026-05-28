import { useEffect, useMemo, useState } from 'react';
import DashLayout from '../../components/layout/DashLayout';
import { supabase } from '../../lib/supabase';

import { ADMIN_NAV } from './adminNav';

type AuditRow = {
  order_id: string;
  created_at: string;
  store_id: string | null;
  portal_id: string | null;
  admin_account_id: string | null;
  parent_admin_id: string | null;
  rep_id: string | null;
  rep_code: string | null;
  discount_code: string | null;
  customer_email: string | null;
  product_id: string | null;
  product_name: string | null;
  total_amount: number | null;
  store_name: string | null;
  admin_account: string | null;
  rep_account: string | null;
  source_portal: string | null;
  source_store: string | null;
  source_admin: string | null;
  source_rep: string | null;
  source_route: string | null;
  payment_provider: string | null;
  payment_status: string | null;
  paypal_order_id: string | null;
  paypal_capture_id: string | null;
  paypal_capture_status: string | null;
  commission_status: string | null;
  payout_status: string | null;
  fulfillment_status: string | null;
  platform_margin: number | null;
  wallet_entries_created: number | null;
  official_paypal_flow: boolean | null;
  legacy_paypal_config_exists: boolean | null;
  routing_warning: string | null;
};

function statusBadge(status?: string | null) {
  if (!status) return 'badge-default';
  if (status.includes('paid') || status.includes('COMPLETED')) return 'badge-success';
  if (status.includes('pending') || status.includes('payment_sent')) return 'badge-warning';
  if (status.includes('failed') || status.includes('reversed')) return 'badge-error';
  return 'badge-info';
}

function shortId(value?: string | null) {
  return value ? `${value.slice(0, 12)}${value.length > 12 ? '...' : ''}` : '-';
}

export default function AdminPaymentAudit() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'all' | 'warnings' | 'official' | 'missing'>('warnings');

  useEffect(() => {
    loadRows();
  }, []);

  async function loadRows() {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase
      .from('admin_paypal_routing_audit')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(250);

    if (loadError) {
      setError(loadError.message);
    } else {
      setRows((data as AuditRow[]) ?? []);
    }
    setLoading(false);
  }

  const visibleRows = useMemo(() => {
    if (filter === 'warnings') return rows.filter((row) => row.routing_warning || row.legacy_paypal_config_exists);
    if (filter === 'official') return rows.filter((row) => row.official_paypal_flow);
    if (filter === 'missing') return rows.filter((row) => row.payment_status === 'paid' && !row.official_paypal_flow);
    return rows;
  }, [filter, rows]);

  const warningCount = rows.filter((row) => row.routing_warning || row.legacy_paypal_config_exists).length;
  const officialCount = rows.filter((row) => row.official_paypal_flow).length;
  const paidMissingCaptureCount = rows.filter((row) => row.payment_status === 'paid' && !row.official_paypal_flow).length;
  const paidWithoutWalletCount = rows.filter((row) => row.payment_status === 'paid' && Number(row.wallet_entries_created ?? 0) === 0).length;
  const officialClientConfigured = Boolean(import.meta.env.VITE_PAYPAL_CLIENT_ID);

  return (
    <DashLayout title="PayPal Routing Audit" navItems={ADMIN_NAV}>
      <div className="stats-grid mb-8">
        <div className="stat-card">
          <div className="stat-value" style={{ color: officialClientConfigured ? 'var(--success)' : 'var(--error)' }}>
            {officialClientConfigured ? 'Configured' : 'Missing'}
          </div>
          <div className="stat-label">VITE_PAYPAL_CLIENT_ID</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{officialCount}</div>
          <div className="stat-label">Official PayPal captures</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: warningCount > 0 ? 'var(--error)' : 'var(--success)' }}>{warningCount}</div>
          <div className="stat-label">Legacy / routing warnings</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: paidMissingCaptureCount + paidWithoutWalletCount > 0 ? 'var(--error)' : undefined }}>
            {paidMissingCaptureCount}/{paidWithoutWalletCount}
          </div>
          <div className="stat-label">Missing capture / wallet</div>
        </div>
      </div>

      {!officialClientConfigured && (
        <div className="alert alert-error mb-4">
          Legacy PayPal configuration detected. The official frontend PayPal client ID is missing, so checkout should remain unavailable until Vercel has VITE_PAYPAL_CLIENT_ID.
        </div>
      )}

      {warningCount > 0 && (
        <div className="alert alert-error mb-4">
          Legacy PayPal configuration detected. Review the warning rows below before accepting more payments from affected portals.
        </div>
      )}

      <div className="card">
        <div className="filter-bar" style={{ borderBottom: '1px solid var(--border)', gap: 12 }}>
          <select className="form-select" style={{ maxWidth: 220 }} value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="warnings">Warnings only</option>
            <option value="missing">Paid without capture evidence</option>
            <option value="official">Official PayPal captures</option>
            <option value="all">All recent orders</option>
          </select>
          <span className="text-muted text-sm" style={{ marginLeft: 'auto' }}>{visibleRows.length} result{visibleRows.length !== 1 ? 's' : ''}</span>
          <button className="btn btn-outline btn-sm" onClick={loadRows}>Refresh</button>
        </div>

        {error && (
          <div className="alert alert-error" style={{ margin: 16 }}>
            Payment audit view could not load: {error}
          </div>
        )}

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Portal / Store</th>
                  <th>Admin / Rep</th>
                  <th>Customer / Product</th>
                  <th>Total</th>
                  <th>Provider</th>
                  <th>PayPal IDs</th>
                  <th>Status</th>
                  <th>Ledger</th>
                  <th>Official Flow</th>
                  <th>Warning</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>No matching payment routing records.</td></tr>
                ) : visibleRows.map((row) => (
                  <tr key={row.order_id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{row.source_portal || row.store_name || row.portal_id || 'main'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Order {shortId(row.order_id)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Store {row.source_store || row.store_name || '-'}</div>
                      {row.store_id && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Store {shortId(row.store_id)}</div>}
                    </td>
                    <td>
                      <div style={{ fontWeight: 700 }}>{row.source_admin || row.admin_account || row.admin_account_id || 'Platform'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.source_rep || row.rep_account || row.rep_code || '-'}</div>
                      {row.parent_admin_id && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Parent {shortId(row.parent_admin_id)}</div>}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{row.customer_email || '-'}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.product_name || row.product_id || '-'}</div>
                    </td>
                    <td style={{ fontWeight: 800 }}>${Number(row.total_amount ?? 0).toFixed(2)}</td>
                    <td>
                      <span className={`badge ${statusBadge(row.payment_provider)}`}>{row.payment_provider || 'not set'}</span>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      <div>Order: {shortId(row.paypal_order_id)}</div>
                      <div>Capture: {shortId(row.paypal_capture_id)}</div>
                    </td>
                    <td>
                      <div><span className={`badge ${statusBadge(row.payment_status)}`}>{row.payment_status || '-'}</span></div>
                      <div style={{ marginTop: 4 }}><span className={`badge ${statusBadge(row.paypal_capture_status)}`}>{row.paypal_capture_status || '-'}</span></div>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      <div>Commission: <strong>{row.commission_status || 'pending'}</strong></div>
                      <div>Payout: <strong>{row.payout_status || 'pending'}</strong></div>
                      <div>Fulfillment: <strong>{row.fulfillment_status || 'pending'}</strong></div>
                      <div>Wallet: <strong>{Number(row.wallet_entries_created ?? 0)}</strong></div>
                      <div>Platform: <strong>${Number(row.platform_margin ?? 0).toFixed(2)}</strong></div>
                    </td>
                    <td>
                      <span className={`badge ${row.official_paypal_flow ? 'badge-success' : 'badge-warning'}`}>
                        {row.official_paypal_flow ? 'verified' : 'needs review'}
                      </span>
                    </td>
                    <td style={{ maxWidth: 260 }}>
                      {row.routing_warning ? (
                        <div style={{ color: 'var(--error)', fontSize: 12, lineHeight: 1.45 }}>{row.routing_warning}</div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashLayout>
  );
}
