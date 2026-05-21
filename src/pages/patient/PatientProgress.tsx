import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import DashLayout from '../../components/layout/DashLayout';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { patientNav } from './patientNav';

const GOOGLE_FIT_CLIENT_ID = import.meta.env.VITE_GOOGLE_FIT_CLIENT_ID as string | undefined;
const FIT_SCOPE = 'https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.body.read';

type WeightEntry = {
  id: string;
  weight: number;
  waist_inches: number | null;
  recorded_at: string;
};

type ActivityEntry = {
  id: string;
  logged_date: string;
  steps: number | null;
  active_minutes: number | null;
  notes: string | null;
  source: string;
};

type Goals = {
  goal_weight: number | null;
  starting_weight: number | null;
  height_inches: number | null;
  activity_goal: string | null;
};

// ─── SVG line chart ───────────────────────────────────────────────────────────
function LineChart({ data, label, color, goalLine }: {
  data: { x: string; y: number }[];
  label: string;
  color: string;
  goalLine?: number | null;
}) {
  if (data.length < 2) return null;
  const W = 600, H = 180, pl = 44, pr = 16, pt = 12, pb = 32;
  const cW = W - pl - pr;
  const cH = H - pt - pb;
  const ys = data.map((d) => d.y);
  const rawMin = Math.min(...ys), rawMax = Math.max(...ys);
  const pad = (rawMax - rawMin) * 0.15 || 4;
  const minY = rawMin - pad;
  const maxY = goalLine && goalLine < rawMin ? goalLine - pad : rawMax + pad;
  const range = maxY - minY || 1;
  const n = data.length;
  const px = (i: number) => pl + (n === 1 ? cW / 2 : (i / (n - 1)) * cW);
  const py = (v: number) => pt + (1 - (v - minY) / range) * cH;
  const pts = data.map((d, i) => `${px(i)},${py(d.y)}`).join(' ');
  const fill = `${px(0)},${pt + cH} ${pts} ${px(n - 1)},${pt + cH}`;
  const yTicks = [0, 1, 2, 3, 4].map((k) => Math.round(minY + (k / 4) * range));
  const xLabels = n <= 1 ? [0] : n === 2 ? [0, 1] : [0, Math.floor((n - 1) / 2), n - 1];
  const goalInRange = goalLine != null && goalLine >= minY && goalLine <= maxY;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} aria-label={label}>
      {yTicks.map((v) => (
        <g key={v}>
          <line x1={pl} x2={W - pr} y1={py(v)} y2={py(v)} stroke="var(--border)" strokeWidth={1} />
          <text x={pl - 6} y={py(v) + 4} textAnchor="end" fontSize={10} fill="var(--text-muted)">{v}</text>
        </g>
      ))}
      <polygon points={fill} fill={`${color}18`} />
      {goalInRange && (
        <>
          <line x1={pl} x2={W - pr} y1={py(goalLine!)} y2={py(goalLine!)} stroke="#22c55e" strokeWidth={1.5} strokeDasharray="6,4" />
          <text x={W - pr} y={py(goalLine!) - 4} textAnchor="end" fontSize={9} fill="#22c55e" fontWeight={700}>Goal {goalLine} lb</text>
        </>
      )}
      <polyline points={pts} fill="none" stroke={color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {data.map((d, i) => (
        <circle key={i} cx={px(i)} cy={py(d.y)} r={3.5} fill={color} stroke="#fff" strokeWidth={1.5}>
          <title>{d.y} · {d.x}</title>
        </circle>
      ))}
      {xLabels.map((i) => (
        <text key={i} x={px(i)} y={H - pb + 14} textAnchor="middle" fontSize={10} fill="var(--text-muted)">
          {new Date(data[i].x).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </text>
      ))}
    </svg>
  );
}

// ─── SVG bar chart (steps) ────────────────────────────────────────────────────
function StepsBarChart({ data, stepGoal }: { data: ActivityEntry[]; stepGoal: number }) {
  const recent = [...data].sort((a, b) => a.logged_date.localeCompare(b.logged_date)).slice(-14);
  if (recent.length === 0) return null;
  const W = 600, H = 160, pl = 44, pr = 16, pt = 10, pb = 32;
  const cW = W - pl - pr;
  const cH = H - pt - pb;
  const maxSteps = Math.max(...recent.map((d) => d.steps ?? 0), stepGoal, 1);
  const barW = Math.max(8, cW / recent.length - 6);
  const gap = cW / recent.length;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} aria-label="Steps bar chart">
      {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
        const v = Math.round(maxSteps * frac);
        const y = pt + (1 - frac) * cH;
        return (
          <g key={frac}>
            <line x1={pl} x2={W - pr} y1={y} y2={y} stroke="var(--border)" strokeWidth={1} />
            <text x={pl - 6} y={y + 4} textAnchor="end" fontSize={9} fill="var(--text-muted)">{v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}</text>
          </g>
        );
      })}
      {/* goal line */}
      {stepGoal <= maxSteps && (
        <line x1={pl} x2={W - pr} y1={pt + (1 - stepGoal / maxSteps) * cH} y2={pt + (1 - stepGoal / maxSteps) * cH} stroke="#22c55e" strokeWidth={1.5} strokeDasharray="5,3" />
      )}
      {recent.map((entry, i) => {
        const steps = entry.steps ?? 0;
        const barH = (steps / maxSteps) * cH;
        const x = pl + gap * i + (gap - barW) / 2;
        const y = pt + cH - barH;
        const met = steps >= stepGoal;
        return (
          <g key={entry.id}>
            <rect x={x} y={y} width={barW} height={barH} rx={3} fill={met ? '#22c55e' : '#25C7D9'} opacity={0.85}>
              <title>{steps.toLocaleString()} steps · {entry.logged_date}</title>
            </rect>
            <text x={x + barW / 2} y={H - pb + 14} textAnchor="middle" fontSize={9} fill="var(--text-muted)">
              {new Date(entry.logged_date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Progress bar ─────────────────────────────────────────────────────────────
function GoalProgressBar({ current, start, goal }: { current: number; start: number; goal: number }) {
  const total = Math.abs(start - goal);
  const lost = Math.max(0, start - current);
  const pct = total > 0 ? Math.min(100, (lost / total) * 100) : 0;
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
        <span>Started: {start} lb</span>
        <span style={{ fontWeight: 700, color: 'var(--navy)' }}>{pct.toFixed(1)}% to goal</span>
        <span>Goal: {goal} lb</span>
      </div>
      <div style={{ height: 14, background: 'var(--surface-2)', borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg, #25C7D9, #22c55e)', borderRadius: 8, transition: 'width 0.5s ease' }} />
      </div>
      <div style={{ marginTop: 6, fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>
        Lost {(start - current).toFixed(1)} lb · {(current - goal).toFixed(1)} lb to go
      </div>
    </div>
  );
}

// ─── BMI util ─────────────────────────────────────────────────────────────────
function calcBmi(weightLb: number, heightIn: number) {
  return (703 * weightLb) / (heightIn * heightIn);
}
function bmiCategory(bmi: number) {
  if (bmi < 18.5) return { label: 'Underweight', color: '#3b82f6' };
  if (bmi < 25)   return { label: 'Normal',      color: '#22c55e' };
  if (bmi < 30)   return { label: 'Overweight',  color: '#f59e0b' };
  return               { label: 'Obese',         color: '#ef4444' };
}

// ─── Google Fit ───────────────────────────────────────────────────────────────
function parseStepGoal(activityGoal: string | null): number {
  if (!activityGoal) return 8000;
  const n = parseInt(activityGoal.replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 8000;
}

async function fetchGoogleFitSteps(accessToken: string): Promise<{ date: string; steps: number; activeMinutes: number }[]> {
  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const body = {
    aggregateBy: [
      { dataTypeName: 'com.google.step_count.delta' },
      { dataTypeName: 'com.google.active_minutes' },
    ],
    bucketByTime: { durationMillis: 86400000 },
    startTimeMillis: thirtyDaysAgo,
    endTimeMillis: now,
  };
  const res = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('Google Fit request failed');
  const json = await res.json();
  const results: { date: string; steps: number; activeMinutes: number }[] = [];
  for (const bucket of json.bucket ?? []) {
    const dateMs = parseInt(bucket.startTimeMillis, 10);
    const date = new Date(dateMs).toISOString().slice(0, 10);
    let steps = 0, activeMinutes = 0;
    for (const ds of bucket.dataset ?? []) {
      for (const pt of ds.point ?? []) {
        for (const val of pt.value ?? []) {
          if (ds.dataSourceId?.includes('step_count')) steps += val.intVal ?? 0;
          if (ds.dataSourceId?.includes('active_minutes')) activeMinutes += val.intVal ?? 0;
        }
      }
    }
    if (steps > 0 || activeMinutes > 0) results.push({ date, steps, activeMinutes });
  }
  return results;
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function PatientProgress() {
  const { profile } = useAuth();
  const [weightEntries, setWeightEntries] = useState<WeightEntry[]>([]);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [goals, setGoals] = useState<Goals | null>(null);
  const [loading, setLoading] = useState(true);

  // Activity log form
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [logSteps, setLogSteps] = useState('');
  const [logMinutes, setLogMinutes] = useState('');
  const [logNotes, setLogNotes] = useState('');
  const [logSaving, setLogSaving] = useState(false);
  const [logMsg, setLogMsg] = useState('');

  // Google Fit
  const [fitToken, setFitToken] = useState<string | null>(null);
  const [fitSyncing, setFitSyncing] = useState(false);
  const [fitMsg, setFitMsg] = useState('');

  useEffect(() => {
    // Parse Google Fit token from URL hash after OAuth redirect
    if (window.location.hash.includes('access_token')) {
      const params = new URLSearchParams(window.location.hash.slice(1));
      const token = params.get('access_token');
      if (token) {
        setFitToken(token);
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  useEffect(() => {
    if (!profile) return;
    loadAll();
  }, [profile]);

  async function loadAll() {
    if (!supabase || !profile) { setLoading(false); return; }
    setLoading(true);
    const [{ data: wData }, { data: aData }, { data: gData }] = await Promise.all([
      supabase.from('patient_weight_entries').select('id,weight,waist_inches,recorded_at').eq('profile_id', profile.id).order('recorded_at', { ascending: false }),
      supabase.from('patient_activity_log').select('*').eq('profile_id', profile.id).order('logged_date', { ascending: false }),
      supabase.from('patient_goals').select('goal_weight,starting_weight,height_inches,activity_goal').eq('profile_id', profile.id).maybeSingle(),
    ]);
    setWeightEntries((wData ?? []) as WeightEntry[]);
    setActivityLog((aData ?? []) as ActivityEntry[]);
    setGoals((gData as Goals | null) ?? null);
    setLoading(false);
  }

  async function handleLogActivity(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !profile) return;
    setLogSaving(true);
    setLogMsg('');
    const { error } = await supabase.from('patient_activity_log').upsert({
      profile_id: profile.id,
      logged_date: logDate,
      steps: logSteps ? parseInt(logSteps, 10) : null,
      active_minutes: logMinutes ? parseInt(logMinutes, 10) : null,
      notes: logNotes || null,
      source: 'manual',
    }, { onConflict: 'profile_id,logged_date' });
    if (!error) {
      setLogSteps('');
      setLogMinutes('');
      setLogNotes('');
      setLogMsg('Logged!');
      await loadAll();
      setTimeout(() => setLogMsg(''), 2500);
    }
    setLogSaving(false);
  }

  async function handleGoogleFitSync() {
    if (!fitToken || !supabase || !profile) return;
    setFitSyncing(true);
    setFitMsg('');
    try {
      const fitData = await fetchGoogleFitSteps(fitToken);
      if (fitData.length === 0) { setFitMsg('No activity data found in Google Fit.'); setFitSyncing(false); return; }
      const rows = fitData.map((d) => ({
        profile_id: profile.id,
        logged_date: d.date,
        steps: d.steps || null,
        active_minutes: d.activeMinutes || null,
        source: 'google_fit',
      }));
      const { error } = await supabase.from('patient_activity_log').upsert(rows, { onConflict: 'profile_id,logged_date' });
      if (!error) {
        setFitMsg(`Synced ${fitData.length} days from Google Fit.`);
        await loadAll();
      } else {
        setFitMsg('Sync failed. Try again.');
      }
    } catch {
      setFitMsg('Google Fit sync failed. Token may have expired.');
    }
    setFitSyncing(false);
  }

  function handleGoogleFitConnect() {
    if (!GOOGLE_FIT_CLIENT_ID) {
      alert('Google Fit is not configured. Add VITE_GOOGLE_FIT_CLIENT_ID to your .env file.');
      return;
    }
    const params = new URLSearchParams({
      client_id: GOOGLE_FIT_CLIENT_ID,
      redirect_uri: `${window.location.origin}/patient/progress`,
      response_type: 'token',
      scope: FIT_SCOPE,
      include_granted_scopes: 'true',
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  // ── Derived values ───────────────────────────────────────────────────────────
  const currentWeight = weightEntries[0]?.weight ?? null;

  const bmi = useMemo(() => {
    if (!currentWeight || !goals?.height_inches) return null;
    return calcBmi(currentWeight, goals.height_inches);
  }, [currentWeight, goals]);

  const stepGoal = parseStepGoal(goals?.activity_goal ?? null);

  const weightChartData = useMemo(() =>
    [...weightEntries].reverse().map((e) => ({ x: e.recorded_at.slice(0, 10), y: e.weight })),
    [weightEntries]
  );

  const waistChartData = useMemo(() =>
    [...weightEntries].reverse().filter((e) => e.waist_inches != null).map((e) => ({ x: e.recorded_at.slice(0, 10), y: e.waist_inches! })),
    [weightEntries]
  );

  const daysHitGoal = activityLog.filter((e) => (e.steps ?? 0) >= stepGoal).length;

  return (
    <DashLayout title="Progress Tracker" navItems={patientNav}>
      {loading ? (
        <div className="loading-screen"><div className="spinner" /><span>Loading progress...</span></div>
      ) : (
        <div style={{ display: 'grid', gap: 24 }}>

          {/* ── Stats row ───────────────────────────────────────────────────── */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Current weight</div>
              <div className="stat-value">{currentWeight != null ? `${currentWeight} lb` : '--'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">BMI</div>
              <div className="stat-value" style={{ color: bmi ? bmiCategory(bmi).color : undefined }}>
                {bmi != null ? bmi.toFixed(1) : '--'}
              </div>
              {bmi != null && <div style={{ fontSize: 12, color: bmiCategory(bmi).color, fontWeight: 600, marginTop: 2 }}>{bmiCategory(bmi).label}</div>}
            </div>
            <div className="stat-card">
              <div className="stat-label">Activity days logged</div>
              <div className="stat-value">{activityLog.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Step goal days hit</div>
              <div className="stat-value" style={{ color: daysHitGoal > 0 ? 'var(--success)' : undefined }}>{daysHitGoal}</div>
            </div>
          </div>

          {/* ── Goal progress bar ────────────────────────────────────────────── */}
          {goals?.starting_weight && goals.goal_weight && currentWeight != null && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">Weight goal progress</div>
              </div>
              <div className="card-body">
                <GoalProgressBar current={currentWeight} start={goals.starting_weight} goal={goals.goal_weight} />
              </div>
            </div>
          )}

          {/* ── Weight chart ─────────────────────────────────────────────────── */}
          {weightChartData.length >= 2 && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">Weight trend</div>
                {goals?.goal_weight && <div className="card-subtitle">Dashed green line = goal ({goals.goal_weight} lb)</div>}
              </div>
              <div className="card-body">
                <LineChart data={weightChartData} label="Weight trend chart" color="#25C7D9" goalLine={goals?.goal_weight ?? null} />
              </div>
            </div>
          )}

          {/* ── Waist chart ──────────────────────────────────────────────────── */}
          {waistChartData.length >= 2 && (
            <div className="card">
              <div className="card-header">
                <div className="card-title">Waist measurement trend</div>
              </div>
              <div className="card-body">
                <LineChart data={waistChartData} label="Waist trend chart" color="#a855f7" />
              </div>
            </div>
          )}

          {/* ── Steps chart + log ────────────────────────────────────────────── */}
          <div className="detail-grid">
            <div>
              {activityLog.some((e) => e.steps != null) && (
                <div className="card mb-6">
                  <div className="card-header">
                    <div className="card-title">Daily steps (last 14 days)</div>
                    <div className="card-subtitle">Green bars = step goal met ({stepGoal.toLocaleString()} steps)</div>
                  </div>
                  <div className="card-body">
                    <StepsBarChart data={activityLog} stepGoal={stepGoal} />
                  </div>
                </div>
              )}

              {/* Activity history table */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Activity log</div>
                  <div className="card-subtitle">Last 14 entries</div>
                </div>
                {activityLog.length === 0 ? (
                  <div className="card-body">
                    <div className="empty-state" style={{ padding: 24 }}>
                      <div className="empty-state-title">No activity logged yet</div>
                      <div className="empty-state-desc">Log steps and active minutes daily to track your habits.</div>
                    </div>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table className="table">
                      <thead><tr><th>Date</th><th>Steps</th><th>Active min</th><th>Source</th></tr></thead>
                      <tbody>
                        {activityLog.slice(0, 14).map((e) => {
                          const met = (e.steps ?? 0) >= stepGoal;
                          return (
                            <tr key={e.id}>
                              <td style={{ fontSize: 13 }}>{new Date(e.logged_date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                              <td style={{ fontWeight: 700, color: met ? 'var(--success)' : 'var(--navy)' }}>
                                {e.steps != null ? e.steps.toLocaleString() : '—'}
                                {met && <span style={{ marginLeft: 6, fontSize: 12, color: 'var(--success)' }}>✓</span>}
                              </td>
                              <td>{e.active_minutes != null ? `${e.active_minutes} min` : '—'}</td>
                              <td><span className="badge badge-default" style={{ fontSize: 11, textTransform: 'capitalize' }}>{e.source.replace('_', ' ')}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Log activity form */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Log activity</div>
                </div>
                <div className="card-body">
                  <form onSubmit={handleLogActivity}>
                    <div style={{ display: 'grid', gap: 14 }}>
                      <div className="form-group">
                        <label className="form-label form-required">Date</label>
                        <input className="form-input" type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} required />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Steps</label>
                        <input className="form-input" type="number" min="0" value={logSteps} onChange={(e) => setLogSteps(e.target.value)} placeholder="e.g. 8500" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Active minutes</label>
                        <input className="form-input" type="number" min="0" value={logMinutes} onChange={(e) => setLogMinutes(e.target.value)} placeholder="e.g. 45" />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Notes</label>
                        <input className="form-input" value={logNotes} onChange={(e) => setLogNotes(e.target.value)} placeholder="Walk, gym session…" />
                      </div>
                      {logMsg && <div className="alert alert-success" style={{ padding: '8px 12px', fontSize: 13 }}>{logMsg}</div>}
                      <button className="btn btn-primary" disabled={logSaving} style={{ justifyContent: 'center' }}>
                        {logSaving ? 'Saving…' : 'Log Activity'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>

              {/* Google Fit connect */}
              <div className="card">
                <div className="card-header">
                  <div className="card-title">Connect wearable</div>
                  <div className="card-subtitle">Sync steps from Google Fit (Android / Wear OS / Fitbit)</div>
                </div>
                <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {fitToken ? (
                    <>
                      <div className="alert alert-success" style={{ padding: '8px 12px', fontSize: 13 }}>Google Fit connected. Ready to sync.</div>
                      {fitMsg && <div style={{ fontSize: 13, color: fitMsg.includes('failed') ? 'var(--error)' : 'var(--success)' }}>{fitMsg}</div>}
                      <button className="btn btn-primary" onClick={handleGoogleFitSync} disabled={fitSyncing} style={{ justifyContent: 'center' }}>
                        {fitSyncing ? 'Syncing…' : 'Sync last 30 days →'}
                      </button>
                    </>
                  ) : (
                    <>
                      <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                        Connect Google Fit to auto-import daily steps and active minutes from your Android phone, Wear OS watch, Fitbit, or Garmin (if synced to Google Fit).
                      </p>
                      <button className="btn btn-outline" onClick={handleGoogleFitConnect} style={{ justifyContent: 'center', gap: 8 }}>
                        <span>🔗</span> Connect Google Fit
                      </button>
                    </>
                  )}
                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', marginBottom: 6 }}>Apple Watch / iPhone</div>
                    <p style={{ fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.6, margin: 0 }}>
                      Apple Health data cannot be accessed from web apps. Log steps manually above, or export a CSV from your Health app and contact support to import it.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}
    </DashLayout>
  );
}
