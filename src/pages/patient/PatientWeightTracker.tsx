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

export default function PatientWeightTracker() {
  const { profile } = useAuth();
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [weight, setWeight] = useState('');
  const [waist, setWaist] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadEntries();
  }, [profile]);

  async function loadEntries() {
    if (!supabase || !profile) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('patient_weight_entries')
      .select('*')
      .eq('profile_id', profile.id)
      .order('recorded_at', { ascending: false });

    setEntries((data ?? []) as WeightEntry[]);
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
      await loadEntries();
    }
    setSaving(false);
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
            <div className="stat-value">{stats.change !== null ? `${stats.change.toFixed(1)} lb` : '--'}</div>
          </div>
        </div>

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
                    <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
                      <div>
                        <strong style={{ color: 'var(--navy)' }}>{entry.weight} lb</strong>
                        {entry.waist_inches && <span style={{ color: 'var(--text-muted)' }}> · {entry.waist_inches} in waist</span>}
                        {entry.notes && <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>{entry.notes}</div>}
                      </div>
                      <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{new Date(entry.recorded_at).toLocaleDateString()}</span>
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
