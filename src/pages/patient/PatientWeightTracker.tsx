import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import DashLayout from '../../components/layout/DashLayout';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { patientNav } from './patientNav';

type WeightEntry = {
  id: string;
  weight: number;
  waist_inches: number | null;
  notes: string | null;
  recorded_at: string;
};

function WeightChart({ entries, goalWeight }: { entries: WeightEntry[]; goalWeight: number | null }) {
  if (entries.length === 0) return null;

  const sorted = [...entries].reverse();
  const weights = sorted.map((e) => e.weight);
  const rawMin = Math.min(...weights);
  const rawMax = Math.max(...weights);
  const pad4 = (rawMax - rawMin) * 0.15 || 5;
  const minW = rawMin - pad4;
  const maxW = goalWeight && goalWeight < rawMin ? goalWeight - pad4 : rawMax + pad4;
  const range = maxW - minW || 1;

  const W = 600, H = 200;
  const pl = 44, pr = 16, pt = 16, pb = 36;
  const cW = W - pl - pr;
  const cH = H - pt - pb;

  const n = sorted.length;
  const px = (i: number) => pl + (n === 1 ? cW / 2 : (i / (n - 1)) * cW);
  const py = (w: number) => pt + (1 - (w - minW) / range) * cH;

  const linePoints = sorted.map((e, i) => `${px(i)},${py(e.weight)}`).join(' ');
  const fillPoints = `${px(0)},${pt + cH} ${linePoints} ${px(n - 1)},${pt + cH}`;

  const yStep = range / 4;
  const yTicks = [0, 1, 2, 3, 4].map((k) => Math.round(minW + k * yStep));
  const xLabels = n <= 1 ? [0] : n === 2 ? [0, 1] : [0, Math.floor((n - 1) / 2), n - 1];

  const goalInRange = goalWeight !== null && goalWeight >= minW && goalWeight <= maxW;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block', overflow: 'visible' }} aria-label="Weight progress chart">
      {yTicks.map((w) => (
        <g key={w}>
          <line x1={pl} x2={W - pr} y1={py(w)} y2={py(w)} stroke="var(--border)" strokeWidth={1} />
          <text x={pl - 6} y={py(w) + 4} textAnchor="end" fontSize={10} fill="var(--text-muted)">{w}</text>
        </g>
      ))}

      <polygon points={fillPoints} fill="rgba(37,199,217,.09)" />

      {goalInRange && (
        <>
          <line x1={pl} x2={W - pr} y1={py(goalWeight!)} y2={py(goalWeight!)} stroke="#22c55e" strokeWidth={1.5} strokeDasharray="6,4" />
          <text x={W - pr} y={py(goalWeight!) - 5} textAnchor="end" fontSize={9} fill="#22c55e" fontWeight={700}>Goal {goalWeight} lb</text>
        </>
      )}

      <polyline points={linePoints} fill="none" stroke="#25C7D9" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />

      {sorted.map((e, i) => (
        <circle key={e.id} cx={px(i)} cy={py(e.weight)} r={4} fill="#25C7D9" stroke="#fff" strokeWidth={2}>
          <title>{e.weight} lb · {new Date(e.recorded_at).toLocaleDateString()}</title>
        </circle>
      ))}

      {xLabels.map((i) => (
        <text key={i} x={px(i)} y={H - pb + 16} textAnchor="middle" fontSize={10} fill="var(--text-muted)">
          {new Date(sorted[i].recorded_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </text>
      ))}
    </svg>
  );
}

export default function PatientWeightTracker() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [goalWeight, setGoalWeight] = useState<number | null>(null);
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    loadAll();
  }, [profile]);

  async function loadAll() {
    if (!supabase || !profile) { setLoading(false); return; }
    setLoading(true);
    const [{ data: weightData }, { data: goalData }] = await Promise.all([
      supabase.from('patient_weight_entries').select('*').eq('profile_id', profile.id).order('recorded_at', { ascending: false }),
      supabase.from('patient_goals').select('goal_weight').eq('profile_id', profile.id).maybeSingle(),
    ]);
    setEntries((weightData ?? []) as WeightEntry[]);
    setGoalWeight((goalData as { goal_weight: number | null } | null)?.goal_weight ?? null);
    setLoading(false);
  }

  async function addEntry(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !profile || !weight) return;
    setSaving(true);
    const { error } = await supabase.from('patient_weight_entries').insert({
      profile_id: profile.id,
      weight: Number(weight),
      waist_inches: waist ? Number(waist) : null,
      notes: notes || null,
      recorded_at: new Date().toISOString(),
    });
    if (!error) {
      setWeight('');
      setWaist('');
      setNotes('');
      await loadAll();
    }
    setSaving(false);
  }

  async function deleteEntry(id: string) {
    if (!supabase) return;
    setDeleting(id);
    await supabase.from('patient_weight_entries').delete().eq('id', id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setDeleting(null);
  }

  const stats = useMemo(() => {
    const newest = entries[0];
    const oldest = entries[entries.length - 1];
    const change = newest && oldest ? oldest.weight - newest.weight : null;
    return { newest, oldest, change };
  }, [entries]);

  return (
    <DashLayout title="Weight Tracker" navItems={patientNav}>
      <div style={{ display: 'grid', gap: 24 }}>
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Current weight</div>
            <div className="stat-value">{stats.newest ? `${stats.newest.weight} lb` : '--'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Starting entry</div>
            <div className="stat-value">{stats.oldest ? `${stats.oldest.weight} lb` : '--'}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total change</div>
            <div className="stat-value" style={{ color: stats.change !== null && stats.change > 0 ? 'var(--success)' : undefined }}>
              {stats.change !== null ? `${stats.change > 0 ? '-' : '+'}${Math.abs(stats.change).toFixed(1)} lb` : '--'}
            </div>
          </div>
          {goalWeight && (
            <div className="stat-card">
              <div className="stat-label">Goal weight</div>
              <div className="stat-value">{goalWeight} lb</div>
            </div>
          )}
        </div>

        {entries.length >= 2 && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Progress chart</div>
              {goalWeight && <div className="card-subtitle">Dashed green line = goal weight ({goalWeight} lb)</div>}
            </div>
            <div className="card-body">
              <WeightChart entries={entries} goalWeight={goalWeight} />
            </div>
          </div>
        )}

        <div className="detail-grid">
          <div className="card">
            <div className="card-header">
              <div className="card-title">Progress log</div>
              <div className="card-subtitle">Entries are private to your patient account.</div>
            </div>
            <div className="card-body">
              {loading ? (
                <div className="loading-screen"><div className="spinner" /><span>Loading entries...</span></div>
              ) : entries.length === 0 ? (
                <div className="empty-state" style={{ padding: 24 }}>
                  <div className="empty-state-title">No weight entries yet</div>
                  <div className="empty-state-desc">Add your first entry to start tracking progress.</div>
                </div>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {entries.map((entry) => (
                    <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                      <div>
                        <strong style={{ color: 'var(--navy)' }}>{entry.weight} lb</strong>
                        {entry.waist_inches && <span style={{ color: 'var(--text-muted)' }}> · {entry.waist_inches} in waist</span>}
                        {entry.notes && <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>{entry.notes}</div>}
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>{new Date(entry.recorded_at).toLocaleDateString()}</div>
                      </div>
                      <button
                        onClick={() => deleteEntry(entry.id)}
                        disabled={deleting === entry.id}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, padding: '2px 6px', borderRadius: 6, flexShrink: 0 }}
                        title="Delete entry"
                        aria-label="Delete entry"
                      >
                        {deleting === entry.id ? '...' : '×'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <div className="card-title">Add entry</div>
            </div>
            <div className="card-body">
              <form onSubmit={addEntry}>
                <div style={{ display: 'grid', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label form-required">Weight</label>
                    <input className="form-input" required type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Waist inches</label>
                    <input className="form-input" type="number" step="0.1" value={waist} onChange={(e) => setWaist(e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Notes</label>
                    <textarea className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} />
                  </div>
                  <button className="btn btn-primary" disabled={saving} style={{ justifyContent: 'center' }}>
                    {saving ? 'Saving...' : 'Add Weight Entry'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </DashLayout>
  );
}
