import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import DashLayout from '../../components/layout/DashLayout';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { patientNav } from './patientNav';

type SideEffect = {
  id: string;
  logged_date: string;
  symptom: string;
  severity: number;
  notes: string | null;
  created_at: string;
};

const COMMON_SYMPTOMS = [
  'Nausea', 'Vomiting', 'Fatigue', 'Headache', 'Dizziness',
  'Injection site reaction', 'Constipation', 'Diarrhea',
  'Appetite changes', 'Hair loss', 'Muscle pain', 'Other',
];

const SEVERITY_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Mild',     color: '#22c55e' },
  2: { label: 'Moderate', color: '#84cc16' },
  3: { label: 'Notable',  color: '#f59e0b' },
  4: { label: 'Severe',   color: '#ef4444' },
  5: { label: 'Critical', color: '#7f1d1d' },
};

function SeverityPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {[1, 2, 3, 4, 5].map((n) => {
        const { label, color } = SEVERITY_LABELS[n];
        const active = value === n;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            title={label}
            style={{
              flex: 1,
              padding: '8px 4px',
              border: `2px solid ${active ? color : 'var(--border)'}`,
              borderRadius: 8,
              background: active ? `${color}18` : 'transparent',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 3,
              transition: 'all .15s',
            }}
          >
            <span style={{ fontSize: 18 }}>{'●'.repeat(n)}</span>
            <span style={{ fontSize: 10, fontWeight: 700, color: active ? color : 'var(--text-muted)' }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function PatientSideEffects() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<SideEffect[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [symptom, setSymptom] = useState('');
  const [customSymptom, setCustomSymptom] = useState('');
  const [severity, setSeverity] = useState(2);
  const [notes, setNotes] = useState('');
  const [msg, setMsg] = useState('');

  useEffect(() => { load(); }, [profile]);

  async function load() {
    if (!supabase || !profile) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from('patient_side_effects')
      .select('*')
      .eq('profile_id', profile.id)
      .order('logged_date', { ascending: false });
    setEntries((data as SideEffect[]) ?? []);
    setLoading(false);
  }

  async function handleLog(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !profile) return;
    const finalSymptom = symptom === 'Other' ? customSymptom.trim() : symptom;
    if (!finalSymptom) { setMsg('Please enter a symptom.'); return; }
    setSaving(true);
    setMsg('');
    const { error } = await supabase.from('patient_side_effects').insert({
      profile_id: profile.id,
      logged_date: logDate,
      symptom: finalSymptom,
      severity,
      notes: notes || null,
    });
    if (!error) {
      setSymptom('');
      setCustomSymptom('');
      setSeverity(2);
      setNotes('');
      setMsg('Logged.');
      await load();
      setTimeout(() => setMsg(''), 2500);
    }
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!supabase) return;
    setDeleting(id);
    await supabase.from('patient_side_effects').delete().eq('id', id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setDeleting(null);
  }

  // Summary counts for past 30 days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 30);
  const recent = entries.filter((e) => new Date(e.logged_date) >= cutoff);
  const symptomCounts: Record<string, number> = {};
  recent.forEach((e) => { symptomCounts[e.symptom] = (symptomCounts[e.symptom] ?? 0) + 1; });
  const topSymptoms = Object.entries(symptomCounts).sort((a, b) => b[1] - a[1]).slice(0, 4);
  const avgSeverity = recent.length > 0 ? recent.reduce((s, e) => s + e.severity, 0) / recent.length : null;

  return (
    <DashLayout title="Side Effects" navItems={patientNav}>
      <div style={{ display: 'grid', gap: 24 }}>

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Logged (30 days)</div>
            <div className="stat-value">{recent.length}</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Avg severity</div>
            <div className="stat-value" style={{ color: avgSeverity != null ? SEVERITY_LABELS[Math.round(avgSeverity)]?.color : undefined }}>
              {avgSeverity != null ? avgSeverity.toFixed(1) : '--'}
            </div>
          </div>
          <div className="stat-card" style={{ gridColumn: 'span 2' }}>
            <div className="stat-label">Most common (30 days)</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
              {topSymptoms.length === 0
                ? <span className="stat-value">--</span>
                : topSymptoms.map(([sym, count]) => (
                  <span key={sym} className="badge badge-default" style={{ fontSize: 12 }}>{sym} ×{count}</span>
                ))
              }
            </div>
          </div>
        </div>

        <div className="detail-grid">
          {/* Log */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Log a side effect</div>
              <div className="card-subtitle">Your log is private and may be shared with your physician for better care.</div>
            </div>
            <div className="card-body">
              <form onSubmit={handleLog}>
                <div style={{ display: 'grid', gap: 16 }}>
                  <div className="form-group">
                    <label className="form-label form-required">Date</label>
                    <input className="form-input" type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} required />
                  </div>

                  <div className="form-group">
                    <label className="form-label form-required">Symptom</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: symptom === 'Other' ? 10 : 0 }}>
                      {COMMON_SYMPTOMS.map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSymptom(s)}
                          style={{
                            padding: '5px 12px',
                            border: `1.5px solid ${symptom === s ? 'var(--teal)' : 'var(--border)'}`,
                            borderRadius: 99,
                            background: symptom === s ? 'rgba(37,199,217,.12)' : 'transparent',
                            fontSize: 13,
                            cursor: 'pointer',
                            color: symptom === s ? 'var(--teal)' : 'var(--navy)',
                            fontWeight: symptom === s ? 700 : 400,
                            transition: 'all .15s',
                          }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                    {symptom === 'Other' && (
                      <input
                        className="form-input mt-2"
                        value={customSymptom}
                        onChange={(e) => setCustomSymptom(e.target.value)}
                        placeholder="Describe your symptom…"
                      />
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label form-required">Severity</label>
                    <SeverityPicker value={severity} onChange={setSeverity} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Notes</label>
                    <textarea className="form-input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="When it started, what helped, any other context…" />
                  </div>

                  {msg && <div className="alert alert-success" style={{ padding: '8px 12px', fontSize: 13 }}>{msg}</div>}

                  <button className="btn btn-primary" disabled={saving || !symptom} style={{ justifyContent: 'center' }}>
                    {saving ? 'Logging…' : 'Log Side Effect'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* History */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">History</div>
              <div className="card-subtitle">All logged side effects, newest first</div>
            </div>
            <div className="card-body">
              {loading ? (
                <div className="loading-screen"><div className="spinner" /></div>
              ) : entries.length === 0 ? (
                <div className="empty-state" style={{ padding: 24 }}>
                  <div className="empty-state-title">No side effects logged</div>
                  <div className="empty-state-desc">Log anything you notice — nausea, fatigue, injection reactions.</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {entries.map((entry) => {
                    const sev = SEVERITY_LABELS[entry.severity] ?? SEVERITY_LABELS[1];
                    return (
                      <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <strong style={{ color: 'var(--navy)', fontSize: 14 }}>{entry.symptom}</strong>
                            <span style={{ fontSize: 11, fontWeight: 700, color: sev.color, background: `${sev.color}18`, border: `1px solid ${sev.color}44`, borderRadius: 99, padding: '2px 8px' }}>
                              {sev.label}
                            </span>
                          </div>
                          {entry.notes && <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>{entry.notes}</div>}
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>
                            {new Date(entry.logged_date + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          disabled={deleting === entry.id}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, padding: '2px 6px', borderRadius: 6, flexShrink: 0 }}
                          aria-label="Delete entry"
                        >
                          {deleting === entry.id ? '…' : '×'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-body" style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--navy)' }}>Important:</strong> This log is for your personal tracking. If you experience severe or worsening symptoms, contact your prescribing physician directly. Do not adjust your medication without medical guidance.
          </div>
        </div>

      </div>
    </DashLayout>
  );
}
