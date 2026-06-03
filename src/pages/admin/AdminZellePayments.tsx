import { useEffect, useMemo, useState } from 'react';
import DashLayout from '../../components/layout/DashLayout';
import { supabase } from '../../lib/supabase';
import { adminUpdateZelleIntent } from '../../lib/zelle';
import { dollarsFromCents } from '../../config/zelle';
import { ADMIN_NAV } from './adminNav';

type ZelleQueueStatus = 'pending' | 'sent' | 'needs_info' | 'confirmed' | 'rejected' | 'expired' | 'cancelled';

type ZelleQueueRow = {
  id: string;
  order_id: string;
  status: ZelleQueueStatus;
  subtotal_cents: number;
  discount_cents: number;
  amount_due_cents: number;
  payment_reference: string;
  recipient_display_name: string;
  recipient_kind: string;
  recipient_value: string;
  sender_name: string | null;
  sender_email: string | null;
  sender_phone: string | null;
  claimed_amount_cents: number | null;
  expires_at: string;
  customer_marked_sent_at: string | null;
  confirmed_at: string | null;
  admin_note: string | null;
  created_at: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  medication: string | null;
  checkout_scope_code: string | null;
  source_portal: string | null;
  payment_status: string | null;
  order_status: string | null;
  proof_count: number;
};

const FILTERS: Array<'open' | ZelleQueueStatus | 'all'> = ['open', 'sent', 'needs_info', 'pending', 'confirmed', 'rejected', 'expired', 'all'];

export default function AdminZellePayments() {
  const [rows, setRows] = useState<ZelleQueueRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<(typeof FILTERS)[number]>('open');
  const [workingId, setWorkingId] = useState('');
  const [noteById, setNoteById] = useState<Record<string, string>>({});

  useEffect(() => {
    void loadRows();
  }, []);

  const filteredRows = useMemo(() => {
    if (filter === 'all') return rows;
    if (filter === 'open') return rows.filter((row) => ['pending', 'sent', 'needs_info'].includes(row.status));
    return rows.filter((row) => row.status === filter);
  }, [rows, filter]);

  const stats = useMemo(() => ({
    open: rows.filter((row) => ['pending', 'sent', 'needs_info'].includes(row.status)).length,
    sent: rows.filter((row) => row.status === 'sent').length,
    confirmed: rows.filter((row) => row.status === 'confirmed').length,
    pendingDollars: rows
      .filter((row) => ['pending', 'sent', 'needs_info'].includes(row.status))
      .reduce((sum, row) => sum + row.amount_due_cents, 0),
  }), [rows]);

  async function loadRows() {
    if (!supabase) {
      setError('Supabase is not configured.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase
      .from('admin_zelle_payment_queue')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(250);
    if (loadError) setError(loadError.message);
    else setRows((data as ZelleQueueRow[]) ?? []);
    setLoading(false);
  }

  async function runAction(row: ZelleQueueRow, action: 'admin-confirm' | 'admin-reject' | 'admin-needs-info' | 'admin-expire') {
    setWorkingId(row.id);
    setError('');
    try {
      await adminUpdateZelleIntent({ intentId: row.id, action, note: noteById[row.id] });
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update Zelle payment');
    }
    setWorkingId('');
  }

  return (
    <DashLayout title="Zelle Payments" navItems={ADMIN_NAV}>
      <div className="stats-grid mb-8">
        <div className="stat-card">
          <div className="stat-value">{stats.open}</div>
          <div className="stat-label">Open intents</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.sent}</div>
          <div className="stat-label">Marked sent</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.confirmed}</div>
          <div className="stat-label">Confirmed</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">${dollarsFromCents(stats.pendingDollars).toFixed(2)}</div>
          <div className="stat-label">Pending amount</div>
        </div>
      </div>

      {error && <div className="alert alert-error mb-4">{error}</div>}

      <div className="card mb-6">
        <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <div className="card-title">Manual Zelle review queue</div>
            <div className="card-subtitle">Proof uploads do not auto-confirm. Confirm only after the business account shows the matching payment.</div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <select className="form-select" value={filter} onChange={(event) => setFilter(event.target.value as typeof filter)}>
              {FILTERS.map((value) => (
                <option key={value} value={value}>{formatStatus(value)}</option>
              ))}
            </select>
            <button type="button" className="btn btn-outline" onClick={loadRows}>Refresh</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Order</th>
                <th>Zelle Details</th>
                <th>Status</th>
                <th>Admin Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6}>Loading Zelle payments...</td></tr>
              ) : filteredRows.length === 0 ? (
                <tr><td colSpan={6}>No Zelle payments found.</td></tr>
              ) : filteredRows.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(row.created_at)}</td>
                  <td>
                    <strong>{row.customer_name ?? 'Unknown customer'}</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{row.customer_email ?? '-'}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{row.customer_phone ?? '-'}</div>
                  </td>
                  <td>
                    <strong>{row.medication ?? '-'}</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>scope: {row.checkout_scope_code ?? '-'}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>payment: {row.payment_status ?? '-'}</div>
                  </td>
                  <td>
                    <strong>${dollarsFromCents(row.amount_due_cents).toFixed(2)}</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>discount ${dollarsFromCents(row.discount_cents).toFixed(2)}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>ref: {row.payment_reference}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>proofs: {row.proof_count}</div>
                    {row.sender_name && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>sender: {row.sender_name}</div>}
                  </td>
                  <td>
                    <span className={`badge ${badgeClass(row.status)}`}>{formatStatus(row.status)}</span>
                    <div style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 6 }}>expires {formatDate(row.expires_at)}</div>
                  </td>
                  <td style={{ minWidth: 260 }}>
                    <textarea
                      className="form-input"
                      rows={2}
                      placeholder="Admin note"
                      value={noteById[row.id] ?? row.admin_note ?? ''}
                      onChange={(event) => setNoteById((current) => ({ ...current, [row.id]: event.target.value }))}
                      style={{ marginBottom: 8 }}
                    />
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" className="btn btn-primary btn-sm" disabled={workingId === row.id || row.status === 'confirmed'} onClick={() => runAction(row, 'admin-confirm')}>
                        Confirm
                      </button>
                      <button type="button" className="btn btn-outline btn-sm" disabled={workingId === row.id || row.status === 'confirmed'} onClick={() => runAction(row, 'admin-needs-info')}>
                        Needs Info
                      </button>
                      <button type="button" className="btn btn-outline btn-sm" disabled={workingId === row.id || row.status === 'confirmed'} onClick={() => runAction(row, 'admin-reject')}>
                        Reject
                      </button>
                      <button type="button" className="btn btn-outline btn-sm" disabled={workingId === row.id || row.status === 'confirmed'} onClick={() => runAction(row, 'admin-expire')}>
                        Expire
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashLayout>
  );
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatStatus(value: string) {
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}

function badgeClass(status: ZelleQueueStatus) {
  if (status === 'confirmed') return 'badge-success';
  if (status === 'rejected' || status === 'expired' || status === 'cancelled') return 'badge-error';
  if (status === 'sent') return 'badge-teal';
  return 'badge-warning';
}
