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

export default function AdminPayouts() {
  const [ledger, setLedger] = useState<CommissionLedger[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CommissionStatus | ''>('');
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    loadLedger();
  }, []);

  async function loadLedger() {
    if (!supabase) { setLoading(false); return; }
    const { data } = await supabase
      .from('commission_ledger')
      .select('*, rep:reps(rep_slug, payout_email), submission:patient_submissions(full_name, medication)')
      .order('created_at', { ascending: false });
    setLedger((data as CommissionLedger[]) ?? []);
    setLoading(false);
  }

  async function markPaid(id: string) {
    setUpdating(id);
    await supabase!.from('commission_ledger').update({ status: 'paid', payout_date: new Date().toISOString().slice(0, 10) }).eq('id', id);
    setLedger((prev) => prev.map((l) => l.id === id ? { ...l, status: 'paid', payout_date: new Date().toISOString().slice(0, 10) } : l));
    setUpdating(null);
  }

  const filtered = filter ? ledger.filter((l) => l.status === filter) : ledger;

  const totalPayable = ledger.filter((l) => l.status === 'payable').reduce((sum, l) => sum + l.commission_amount, 0);
  const totalPaid    = ledger.filter((l) => l.status === 'paid').reduce((sum, l) => sum + l.commission_amount, 0);

  return (
    <DashLayout title="Commission Payouts" navItems={ADMIN_NAV}>
      <div className="stats-grid mb-8">
        <div className="stat-card">
          <div className="stat-value">${totalPayable.toFixed(2)}</div>
          <div className="stat-label">Pending payouts</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">${totalPaid.toFixed(2)}</div>
          <div className="stat-label">Total paid out</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{ledger.filter((l) => l.status === 'payable').length}</div>
          <div className="stat-label">Ready to pay</div>
        </div>
      </div>

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

        {loading ? (
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
    </DashLayout>
  );
}
