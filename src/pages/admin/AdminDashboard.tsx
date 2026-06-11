import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashLayout from '../../components/layout/DashLayout';
import { supabase } from '../../lib/supabase';
import type { PatientSubmission, SubmissionStatus } from '../../types';
import { STATUS_LABELS, STATUS_COLORS, ALL_STATUSES } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { isAactivatedOrder, isAactivatedPartnerAdmin } from '../../lib/aactivatedScope';

import { ADMIN_NAV } from './adminNav';

interface Stats {
  total: number;
  new_submission: number;
  under_review: number;
  eligible: number;
  paid: number;
  fulfilled: number;
}

interface Revenue {
  total: number;
  thisMonth: number;
  lastMonth: number;
}

type StatusCounts = Partial<Record<string, number>>;

function netSubmissionRevenue(row: Pick<PatientSubmission, 'quoted_price' | 'order_total' | 'discount_amount'>): number {
  if (typeof row.order_total === 'number') return row.order_total;
  return Math.max(0, Number(row.quoted_price ?? 0) - Number(row.discount_amount ?? 0));
}

function OrdersBarChart({ daily }: { daily: { date: string; count: number }[] }) {
  if (daily.length === 0) return null;
  const maxCount = Math.max(...daily.map((d) => d.count), 1);
  const W = 700, H = 140;
  const pl = 28, pr = 8, pt = 12, pb = 30;
  const cW = W - pl - pr;
  const cH = H - pt - pb;
  const n = daily.length;
  const barW = Math.floor(cW / n) - 2;
  const today = new Date().toISOString().split('T')[0];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} aria-label="Daily submissions chart">
      {[0, Math.round(maxCount / 2), maxCount].map((v) => {
        const y = pt + (1 - v / maxCount) * cH;
        return (
          <g key={v}>
            <line x1={pl} x2={W - pr} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} />
            <text x={pl - 4} y={y + 4} textAnchor="end" fontSize={9} fill="var(--text-muted)">{v}</text>
          </g>
        );
      })}
      {daily.map((d, i) => {
        const x = pl + i * (cW / n);
        const bH = (d.count / maxCount) * cH;
        const isToday = d.date === today;
        const showLabel = i === 0 || i === n - 1 || i % 5 === 0;
        return (
          <g key={d.date}>
            <rect
              x={x + 1}
              y={pt + cH - bH}
              width={barW}
              height={bH}
              fill={isToday ? '#25C7D9' : 'rgba(37,199,217,.45)'}
              rx={2}
            >
              <title>{d.date}: {d.count} order{d.count !== 1 ? 's' : ''}</title>
            </rect>
            {showLabel && (
              <text x={x + barW / 2} y={H - pb + 14} textAnchor="middle" fontSize={9} fill="var(--text-muted)">
                {new Date(d.date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default function AdminDashboard() {
  const { profile } = useAuth();
  const [recent, setRecent] = useState<PatientSubmission[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, new_submission: 0, under_review: 0, eligible: 0, paid: 0, fulfilled: 0 });
  const [revenue, setRevenue] = useState<Revenue>({ total: 0, thisMonth: 0, lastMonth: 0 });
  const [statusCounts, setStatusCounts] = useState<StatusCounts>({});
  const [dailyCounts, setDailyCounts] = useState<{ date: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    const { data } = await supabase!
      .from('patient_submissions')
      .select('*, rep:reps!patient_submissions_rep_id_fkey(*)');
    if (!data) return;
    const scopedData = isAactivatedPartnerAdmin(profile)
      ? ((data as PatientSubmission[]) ?? []).filter(isAactivatedOrder)
      : ((data as PatientSubmission[]) ?? []);

    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const s: Stats = { total: scopedData.length, new_submission: 0, under_review: 0, eligible: 0, paid: 0, fulfilled: 0 };
    const counts: StatusCounts = {};
    const rev: Revenue = { total: 0, thisMonth: 0, lastMonth: 0 };

    scopedData.forEach((r) => {
      counts[r.status] = (counts[r.status] ?? 0) + 1;
      if (r.status === 'new_submission') s.new_submission++;
      else if (r.status === 'under_review' || r.status === 'physician_review' || r.status === 'fulfillment_review') s.under_review++;
      else if (r.status === 'eligible' || r.status === 'payment_sent') s.eligible++;
      else if (r.status === 'paid') s.paid++;
      else if (r.status === 'fulfilled') s.fulfilled++;

      if (r.status === 'paid' || r.status === 'fulfilled') {
        const orderRevenue = netSubmissionRevenue(r);
        const d = new Date(r.created_at);
        rev.total += orderRevenue;
        if (d >= thisMonthStart) rev.thisMonth += orderRevenue;
        else if (d >= lastMonthStart) rev.lastMonth += orderRevenue;
      }
    });

    const last30: { date: string; count: number }[] = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now);
      d.setDate(now.getDate() - (29 - i));
      return { date: d.toISOString().split('T')[0], count: 0 };
    });
    const last30Map = Object.fromEntries(last30.map((d) => [d.date, d]));
    scopedData.forEach((r) => {
      const day = r.created_at.split('T')[0];
      if (last30Map[day]) last30Map[day].count++;
    });

    setStats(s);
    setStatusCounts(counts);
    setRevenue(rev);
    setDailyCounts(last30);
  }, [profile]);

  const loadRecent = useCallback(async () => {
    const { data } = await supabase!
      .from('patient_submissions')
      .select('*, rep:reps!patient_submissions_rep_id_fkey(*)')
      .order('created_at', { ascending: false })
      .limit(isAactivatedPartnerAdmin(profile) ? 250 : 10);
    const nextRows = (data as PatientSubmission[]) ?? [];
    setRecent(isAactivatedPartnerAdmin(profile) ? nextRows.filter(isAactivatedOrder).slice(0, 10) : nextRows);
  }, [profile]);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    Promise.all([loadStats(), loadRecent()]).finally(() => setLoading(false));
  }, [loadStats, loadRecent]);

  const statCards = [
    { label: 'Total Orders', value: stats.total },
    { label: 'New / Unreviewed',  value: stats.new_submission },
    { label: 'Under Review',      value: stats.under_review },
    { label: 'Eligible / Quoted', value: stats.eligible },
    { label: 'Paid Orders',       value: stats.paid },
    { label: 'Fulfilled',         value: stats.fulfilled },
  ];

  const trend = revenue.lastMonth > 0
    ? ((revenue.thisMonth - revenue.lastMonth) / revenue.lastMonth * 100).toFixed(0)
    : null;

  return (
    <DashLayout title="Admin Dashboard" navItems={ADMIN_NAV} actions={
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link to="/admin/submissions" className="btn btn-primary btn-sm">View All Orders</Link>
        <Link to="/admin/rep-requests" className="btn btn-outline btn-sm">Rep Requests</Link>
      </div>
    }>
      {loading ? (
        <div className="flex items-center justify-center" style={{ padding: 64 }}>
          <div className="spinner" />
        </div>
      ) : (
        <>
          {/* Revenue metrics */}
          <div className="stats-grid mb-4">
            <div className="stat-card" style={{ gridColumn: 'span 2' }}>
              <div className="stat-value" style={{ color: 'var(--success)', fontSize: 28 }}>${revenue.total.toFixed(2)}</div>
              <div className="stat-label">Total Revenue (paid + fulfilled)</div>
            </div>
            <div className="stat-card">
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <div className="stat-value" style={{ color: 'var(--teal)' }}>${revenue.thisMonth.toFixed(2)}</div>
                {trend !== null && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: Number(trend) >= 0 ? 'var(--success)' : 'var(--error)' }}>
                    {Number(trend) >= 0 ? '▲' : '▼'} {Math.abs(Number(trend))}%
                  </span>
                )}
              </div>
              <div className="stat-label">This Month</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--text-muted)' }}>${revenue.lastMonth.toFixed(2)}</div>
              <div className="stat-label">Last Month</div>
            </div>
          </div>

          <div className="stats-grid mb-8">
            {statCards.map((s) => (
              <div key={s.label} className="stat-card">
                <div className="stat-value">{s.value}</div>
                <div className="stat-label">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="card mb-6">
            <div className="card-header" style={{ paddingBottom: 12 }}>
              <div className="card-title">Orders - last 30 days</div>
              <div className="card-subtitle">Today shown in full teal. Hover bars for daily count.</div>
            </div>
            <div className="card-body" style={{ paddingTop: 4 }}>
              <OrdersBarChart daily={dailyCounts} />
            </div>
          </div>

          <div className="card">
            <div className="card-header" style={{ paddingBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div className="card-title">Recent Orders</div>
              <Link to="/admin/submissions" className="btn btn-ghost btn-sm">View all →</Link>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Patient</th>
                    <th>Medication</th>
                    <th>State</th>
                    <th>Price Paid</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {recent.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>No submissions yet.</td></tr>
                  ) : recent.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--navy)' }}>{s.full_name}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{s.email}</div>
                      </td>
                      <td>{s.medication}</td>
                      <td>{s.state}</td>
                      <td>{s.current_price ? `$${s.current_price.toFixed(2)}` : '—'}</td>
                      <td>
                        <span className={`badge ${STATUS_COLORS[s.status as SubmissionStatus] ?? 'badge-default'}`}>
                          {STATUS_LABELS[s.status as SubmissionStatus] ?? s.status}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                        {new Date(s.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <Link to={`/admin/submissions/${s.id}`} className="table-link">Review →</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Status pipeline overview */}
          <div className="card mt-6">
            <div className="card-header" style={{ paddingBottom: 16 }}>
              <div className="card-title">Status Pipeline</div>
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {ALL_STATUSES.map((status) => {
                  const count = statusCounts[status] ?? 0;
                  return (
                    <Link
                      key={status}
                      to={`/admin/submissions?status=${status}`}
                      style={{ textDecoration: 'none', flex: '1 1 120px' }}
                    >
                      <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', textAlign: 'center', cursor: 'pointer', transition: 'all .15s', background: 'var(--card-soft)' }}
                        onMouseEnter={(e) => e.currentTarget.style.borderColor = 'var(--teal)'}
                        onMouseLeave={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                      >
                        <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy)' }}>{count}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{STATUS_LABELS[status]}</div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </DashLayout>
  );
}
