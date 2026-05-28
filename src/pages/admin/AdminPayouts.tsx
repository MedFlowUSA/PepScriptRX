import { useEffect, useState } from 'react';
import DashLayout from '../../components/layout/DashLayout';
import { supabase } from '../../lib/supabase';
import type { CommissionLedger, CommissionStatus } from '../../types';

import { ADMIN_NAV } from './adminNav';

const STATUS_COLOR: Record<CommissionStatus, string> = {
  pending: 'badge-warning',
  payable: 'badge-info',
  paid:    'badge-success',
  reversed:'badge-error',
};

type PayoutRecord = {
  id: string;
  submission_id: string | null;
  recipient_type: 'admin' | 'rep' | 'override';
  recipient_email: string;
  amount: number;
  pct: number;
  currency: string;
  status: 'pending' | 'sent' | 'failed';
  paypal_batch_id: string | null;
  error_message: string | null;
  created_at: string;
  submission?: { full_name: string; medication: string } | null;
};

const PAYOUT_STATUS_COLOR: Record<PayoutRecord['status'], string> = {
  pending: 'badge-warning',
  sent:    'badge-success',
  failed:  'badge-error',
};

export default function AdminPayouts() {
  const [tab, setTab] = useState<'ledger' | 'auto'>('ledger');

  // Commission ledger state
  const [ledger, setLedger] = useState<CommissionLedger[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(true);
  const [filter, setFilter] = useState<CommissionStatus | ''>('');
  const [updating, setUpdating] = useState<string | null>(null);

  // Manual PayPal payout state
  const [payouts, setPayouts] = useState<PayoutRecord[]>([]);
  const [payoutsLoading, setPayoutsLoading] = useState(true);
  const [retrying, setRetrying] = useState<string | null>(null);

  useEffect(() => {
    loadLedger();
    loadPayouts();
  }, []);

  async function loadLedger() {
    if (!supabase) { setLedgerLoading(false); return; }
    const { data } = await supabase
      .from('commission_ledger')
      .select('*, rep:reps(rep_slug, payout_email), submission:patient_submissions(full_name, medication)')
      .order('created_at', { ascending: false });
    setLedger((data as CommissionLedger[]) ?? []);
    setLedgerLoading(false);
  }

  async function loadPayouts() {
    if (!supabase) { setPayoutsLoading(false); return; }
    const { data } = await supabase
      .from('payouts')
      .select('*, submission:patient_submissions(full_name, medication)')
      .order('created_at', { ascending: false });
    setPayouts((data as PayoutRecord[]) ?? []);
    setPayoutsLoading(false);
  }

  async function markPaid(id: string) {
    setUpdating(id);
    await supabase!.from('commission_ledger').update({ status: 'paid', payout_date: new Date().toISOString().slice(0, 10) }).eq('id', id);
    setLedger((prev) => prev.map((l) => l.id === id ? { ...l, status: 'paid', payout_date: new Date().toISOString().slice(0, 10) } : l));
    setUpdating(null);
  }

  async function retryPayout(submissionId: string) {
    if (!submissionId) return;
    setRetrying(submissionId);
    try {
      const { data: { session } } = await supabase!.auth.getSession();
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/process-payout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({ submission_id: submissionId }),
      });
      await loadPayouts();
    } finally {
      setRetrying(null);
    }
  }

  const filtered = filter ? ledger.filter((l) => l.status === filter) : ledger;

  const totalPayable = ledger.filter((l) => l.status === 'payable').reduce((sum, l) => sum + l.commission_amount, 0);
  const totalPaid    = ledger.filter((l) => l.status === 'paid').reduce((sum, l) => sum + l.commission_amount, 0);

  const autoSent   = payouts.filter((p) => p.status === 'sent').reduce((s, p) => s + p.amount, 0);
  const autoFailed = payouts.filter((p) => p.status === 'failed').length;

  return (
    <DashLayout title="Commission Payouts" navItems={ADMIN_NAV}>
      <div className="stats-grid mb-8">
        <div className="stat-card">
          <div className="stat-value">${totalPayable.toFixed(2)}</div>
          <div className="stat-label">Ledger: pending payouts</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">${totalPaid.toFixed(2)}</div>
          <div className="stat-label">Ledger: total paid</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">${autoSent.toFixed(2)}</div>
          <div className="stat-label">Sent via manual PayPal payout</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: autoFailed > 0 ? 'var(--error)' : undefined }}>{autoFailed}</div>
          <div className="stat-label">Failed payouts</div>
        </div>
      </div>

      <div className="tab-bar mb-4">
        <button className={`tab-btn ${tab === 'ledger' ? 'active' : ''}`} onClick={() => setTab('ledger')}>Commission Ledger</button>
        <button className={`tab-btn ${tab === 'auto' ? 'active' : ''}`} onClick={() => setTab('auto')}>
          Manual PayPal Payouts
          {autoFailed > 0 && <span className="badge badge-error" style={{ marginLeft: 8 }}>{autoFailed}</span>}
        </button>
      </div>

      {tab === 'ledger' && (
        <div className="card">
          <div className="filter-bar" style={{ borderBottom: '1px solid var(--border)' }}>
            <select className="form-select" style={{ maxWidth: 200 }} value={filter} onChange={(e) => setFilter(e.target.value as CommissionStatus | '')}>
              <option value="">All statuses</option>
              <option value="pending">Pending</option>
              <option value="payable">Payable</option>
              <option value="paid">Paid</option>
              <option value="reversed">Reversed</option>
            </select>
          </div>

          {ledgerLoading ? (
            <div style={{ padding: 48, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Rep</th>
                    <th>Payout Email</th>
                    <th>Gross Sale</th>
                    <th>Rate</th>
                    <th>Commission</th>
                    <th>Status</th>
                    <th>Payout Date</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>No commission records.</td></tr>
                  ) : filtered.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{(entry.submission as unknown as { full_name: string })?.full_name}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{(entry.submission as unknown as { medication: string })?.medication}</div>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--navy)' }}>{(entry.rep as unknown as { rep_slug: string })?.rep_slug}</td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{(entry.rep as unknown as { payout_email: string })?.payout_email || '—'}</td>
                      <td>${entry.gross_sale?.toFixed(2)}</td>
                      <td>{(entry.commission_rate * 100).toFixed(0)}%</td>
                      <td style={{ fontWeight: 700, color: 'var(--navy)' }}>${entry.commission_amount?.toFixed(2)}</td>
                      <td><span className={`badge ${STATUS_COLOR[entry.status as CommissionStatus]}`}>{entry.status}</span></td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{entry.payout_date || '—'}</td>
                      <td>
                        {entry.status === 'payable' && (
                          <button
                            className="btn btn-success btn-sm"
                            disabled={updating === entry.id}
                            onClick={() => markPaid(entry.id)}
                          >
                            {updating === entry.id ? '…' : 'Mark Paid'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'auto' && (
        <div className="card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ flex: 1, fontSize: 13, color: 'var(--text-muted)' }}>
              PayPal payouts are manual. Review pending commission records before sending any payout.
            </div>
            <button className="btn btn-outline btn-sm" onClick={loadPayouts}>Refresh</button>
          </div>

          {payoutsLoading ? (
            <div style={{ padding: 48, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Customer / Medication</th>
                    <th>Recipient</th>
                    <th>Email</th>
                    <th>Amount</th>
                    <th>Split</th>
                    <th>Status</th>
                    <th>PayPal Batch ID</th>
                    <th>Date</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.length === 0 ? (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>No payout records yet. Payouts are only sent from manual admin actions.</td></tr>
                  ) : payouts.map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{p.submission?.full_name ?? '—'}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.submission?.medication ?? '—'}</div>
                      </td>
                      <td>
                        <span className={`badge ${p.recipient_type === 'admin' ? 'badge-info' : 'badge-default'}`}>
                          {p.recipient_type}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{p.recipient_email}</td>
                      <td style={{ fontWeight: 700, color: 'var(--navy)' }}>${p.amount?.toFixed(2)}</td>
                      <td style={{ fontSize: 13 }}>{p.pct}%</td>
                      <td>
                        <span className={`badge ${PAYOUT_STATUS_COLOR[p.status]}`}>{p.status}</span>
                        {p.status === 'failed' && p.error_message && (
                          <div style={{ fontSize: 11, color: 'var(--error)', marginTop: 4, maxWidth: 200, wordBreak: 'break-word' }}>
                            {p.error_message.slice(0, 120)}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {p.paypal_batch_id ? p.paypal_batch_id.slice(0, 18) + '…' : '—'}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(p.created_at).toLocaleDateString()}</td>
                      <td>
                        {(p.status === 'failed' || p.status === 'pending') && p.submission_id && (
                          <button
                            className="btn btn-sm btn-outline"
                            disabled={retrying === p.submission_id}
                            onClick={() => retryPayout(p.submission_id!)}
                          >
                            {retrying === p.submission_id ? '…' : 'Retry'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </DashLayout>
  );
}
