import { useEffect, useMemo, useState } from 'react';
import DashLayout from '../../components/layout/DashLayout';
import { supabase } from '../../lib/supabase';
import { ADMIN_NAV } from './adminNav';

type Row = {
  status: string;
  quoted_price: number | null;
  current_price: number | null;
  estimated_savings: number | null;
  medication: string | null;
  state: string | null;
  created_at: string;
};

// ── Horizontal bar chart ───────────────────────────────────────────────────────
function HBar({ data, color = '#25C7D9', valuePrefix = '', valueSuffix = '' }: {
  data: { label: string; value: number }[];
  color?: string;
  valuePrefix?: string;
  valueSuffix?: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {data.map((d) => (
        <div key={d.label} style={{ display: 'grid', gridTemplateColumns: '130px 1fr 64px', gap: 10, alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--navy)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.label}</div>
          <div style={{ height: 10, background: 'var(--surface-2)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${(d.value / max) * 100}%`, background: color, borderRadius: 6, transition: 'width .4s ease' }} />
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'right', whiteSpace: 'nowrap' }}>
            {valuePrefix}{typeof d.value === 'number' && valuePrefix === '$' ? d.value.toFixed(0) : d.value.toLocaleString()}{valueSuffix}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Monthly SVG line chart ─────────────────────────────────────────────────────
function MonthlyChart({ months }: { months: { label: string; revenue: number; count: number }[] }) {
  if (months.length === 0) return null;
  const W = 700, H = 180, pl = 56, pr = 12, pt = 12, pb = 32;
  const cW = W - pl - pr, cH = H - pt - pb;
  const n = months.length;
  const px = (i: number) => pl + (n <= 1 ? cW / 2 : (i / (n - 1)) * cW);

  // Revenue line
  const maxRev = Math.max(...months.map((m) => m.revenue), 1);
  const pyR = (v: number) => pt + (1 - v / maxRev) * cH;
  const revPts = months.map((m, i) => `${px(i)},${pyR(m.revenue)}`).join(' ');
  const revFill = `${px(0)},${pt + cH} ${revPts} ${px(n - 1)},${pt + cH}`;

  // Count bars (secondary axis — scale independently)
  const maxCount = Math.max(...months.map((m) => m.count), 1);
  const barW = Math.max(6, (cW / n) - 6);

  const yRevTicks = [0, 0.5, 1].map((f) => Math.round(maxRev * f));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} aria-label="Monthly revenue and submissions chart">
      {yRevTicks.map((v) => {
        const y = pyR(v);
        return (
          <g key={v}>
            <line x1={pl} x2={W - pr} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} />
            <text x={pl - 4} y={y + 4} textAnchor="end" fontSize={9} fill="var(--text-muted)">${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}</text>
          </g>
        );
      })}

      {/* Count bars */}
      {months.map((m, i) => {
        const bH = (m.count / maxCount) * cH * 0.6;
        const x = px(i) - barW / 2;
        return (
          <rect key={`bar-${i}`} x={x} y={pt + cH - bH} width={barW} height={bH} rx={2} fill="rgba(168,85,247,.2)">
            <title>{m.label}: {m.count} submissions</title>
          </rect>
        );
      })}

      {/* Revenue area */}
      <polygon points={revFill} fill="rgba(37,199,217,.1)" />
      <polyline points={revPts} fill="none" stroke="#25C7D9" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {months.map((m, i) => (
        <circle key={i} cx={px(i)} cy={pyR(m.revenue)} r={3.5} fill="#25C7D9" stroke="#fff" strokeWidth={1.5}>
          <title>{m.label}: ${m.revenue.toFixed(2)} revenue</title>
        </circle>
      ))}

      {/* X labels */}
      {months.map((m, i) => (
        <text key={`lbl-${i}`} x={px(i)} y={H - pb + 14} textAnchor="middle" fontSize={9} fill="var(--text-muted)">{m.label}</text>
      ))}
    </svg>
  );
}

// ── Funnel ────────────────────────────────────────────────────────────────────
function Funnel({ stages }: { stages: { label: string; count: number; color: string }[] }) {
  const max = stages[0]?.count || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {stages.map((s, i) => {
        const pct = ((s.count / max) * 100).toFixed(1);
        const dropPct = i > 0 ? (((stages[i - 1].count - s.count) / (stages[i - 1].count || 1)) * 100).toFixed(0) : null;
        return (
          <div key={s.label}>
            {dropPct !== null && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 2 }}>↓ {dropPct}% drop</div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: '100%', height: 36, background: 'var(--surface-2)', borderRadius: 6, overflow: 'hidden', position: 'relative' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${pct}%`, background: s.color, borderRadius: 6, opacity: 0.85, transition: 'width .5s ease' }} />
                <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 12px', height: '100%', fontSize: 13, fontWeight: 700 }}>
                  <span style={{ color: 'var(--navy)' }}>{s.label}</span>
                  <span style={{ color: 'var(--navy)' }}>{s.count.toLocaleString()} ({pct}%)</span>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function AdminAnalytics() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase
      .from('patient_submissions')
      .select('status, quoted_price, current_price, estimated_savings, medication, state, created_at')
      .then(({ data }) => {
        setRows((data as Row[]) ?? []);
        setLoading(false);
      });
  }, []);

  const analytics = useMemo(() => {
    if (rows.length === 0) return null;

    // ── Top stats
    const paid = rows.filter((r) => r.status === 'paid' || r.status === 'fulfilled');
    const fulfilled = rows.filter((r) => r.status === 'fulfilled');
    const totalRevenue = paid.reduce((s, r) => s + (r.quoted_price ?? 0), 0);
    const totalSavings = rows.reduce((s, r) => s + (r.estimated_savings ?? 0), 0);
    const avgOrderValue = paid.length > 0 ? totalRevenue / paid.length : 0;
    const conversionRate = rows.length > 0 ? (fulfilled.length / rows.length) * 100 : 0;

    // ── Monthly (last 12)
    const now = new Date();
    const months: { key: string; label: string; revenue: number; count: number }[] = [];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        key: d.toISOString().slice(0, 7),
        label: d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
        revenue: 0,
        count: 0,
      });
    }
    const monthMap = Object.fromEntries(months.map((m) => [m.key, m]));
    rows.forEach((r) => {
      const key = r.created_at.slice(0, 7);
      if (monthMap[key]) {
        monthMap[key].count++;
        if ((r.status === 'paid' || r.status === 'fulfilled') && r.quoted_price) {
          monthMap[key].revenue += r.quoted_price;
        }
      }
    });

    // ── Funnel
    const statusCount = (s: string) => rows.filter((r) => r.status === s).length;
    const inReview = rows.filter((r) => ['under_review', 'physician_review', 'fulfillment_review'].includes(r.status)).length;
    const funnelStages = [
      { label: 'Submitted', count: rows.length, color: '#25C7D9' },
      { label: 'In Review', count: inReview + statusCount('eligible') + statusCount('payment_sent') + statusCount('paid') + statusCount('fulfilled'), color: '#a855f7' },
      { label: 'Eligible / Quoted', count: statusCount('eligible') + statusCount('payment_sent') + statusCount('paid') + statusCount('fulfilled'), color: '#f59e0b' },
      { label: 'Paid', count: statusCount('paid') + statusCount('fulfilled'), color: '#3b82f6' },
      { label: 'Fulfilled', count: statusCount('fulfilled'), color: '#22c55e' },
    ];

    // ── Medication breakdown
    const medMap: Record<string, number> = {};
    rows.forEach((r) => { if (r.medication) medMap[r.medication] = (medMap[r.medication] ?? 0) + 1; });
    const medications = Object.entries(medMap).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));

    // ── State breakdown (top 10)
    const stateMap: Record<string, number> = {};
    rows.forEach((r) => { if (r.state) stateMap[r.state] = (stateMap[r.state] ?? 0) + 1; });
    const states = Object.entries(stateMap).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([label, value]) => ({ label, value }));

    // ── Revenue by medication
    const medRevMap: Record<string, number> = {};
    paid.forEach((r) => {
      if (r.medication && r.quoted_price) medRevMap[r.medication] = (medRevMap[r.medication] ?? 0) + r.quoted_price;
    });
    const medRevenue = Object.entries(medRevMap).sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }));

    return { totalRevenue, totalSavings, avgOrderValue, conversionRate, months, funnelStages, medications, states, medRevenue };
  }, [rows]);

  return (
    <DashLayout title="Analytics" navItems={ADMIN_NAV}>
      {loading ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : !analytics ? (
        <div className="empty-state"><div className="empty-state-title">No submission data yet.</div></div>
      ) : (
        <div style={{ display: 'grid', gap: 24 }}>

          {/* ── Top KPIs */}
          <div className="stats-grid">
            <div className="stat-card" style={{ gridColumn: 'span 2' }}>
              <div className="stat-value" style={{ color: 'var(--success)', fontSize: 28 }}>${analytics.totalRevenue.toFixed(2)}</div>
              <div className="stat-label">Total Revenue (paid + fulfilled)</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--teal)' }}>${analytics.avgOrderValue.toFixed(2)}</div>
              <div className="stat-label">Avg Order Value</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: analytics.conversionRate > 20 ? 'var(--success)' : 'var(--warning)' }}>
                {analytics.conversionRate.toFixed(1)}%
              </div>
              <div className="stat-label">Fulfillment Rate</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--navy)' }}>${analytics.totalSavings.toFixed(2)}</div>
              <div className="stat-label">Total Savings Offered</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{rows.length}</div>
              <div className="stat-label">Total Submissions</div>
            </div>
          </div>

          {/* ── Monthly chart */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Revenue &amp; Submissions — Last 12 Months</div>
              <div className="card-subtitle">Teal line = revenue (left axis) · Purple bars = submission count (scaled)</div>
            </div>
            <div className="card-body">
              <MonthlyChart months={analytics.months} />
            </div>
          </div>

          {/* ── Funnel */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Conversion Funnel</div>
              <div className="card-subtitle">Shows cumulative counts at each pipeline stage</div>
            </div>
            <div className="card-body">
              <Funnel stages={analytics.funnelStages} />
            </div>
          </div>

          <div className="detail-grid">
            {/* ── Medication breakdown */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Submissions by Medication</div>
              </div>
              <div className="card-body">
                {analytics.medications.length === 0
                  ? <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No data.</p>
                  : <HBar data={analytics.medications} color="#25C7D9" />
                }
              </div>
            </div>

            {/* ── Revenue by medication */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Revenue by Medication</div>
              </div>
              <div className="card-body">
                {analytics.medRevenue.length === 0
                  ? <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No paid orders yet.</p>
                  : <HBar data={analytics.medRevenue} color="#22c55e" valuePrefix="$" />
                }
              </div>
            </div>
          </div>

          {/* ── State breakdown */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Top States</div>
              <div className="card-subtitle">By submission count</div>
            </div>
            <div className="card-body">
              {analytics.states.length === 0
                ? <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No data.</p>
                : <HBar data={analytics.states} color="#a855f7" />
              }
            </div>
          </div>

        </div>
      )}
    </DashLayout>
  );
}
