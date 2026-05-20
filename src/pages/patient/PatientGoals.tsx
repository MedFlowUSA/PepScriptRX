import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import DashLayout from '../../components/layout/DashLayout';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { patientNav } from './patientNav';

export default function PatientGoals() {
  const { profile } = useAuth();
  const [startingWeight, setStartingWeight] = useState('');
  const [goalWeight, setGoalWeight] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [activityGoal, setActivityGoal] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    async function load() {
      if (!supabase || !profile) {
        setLoading(false);
        return;
      }

      const { data } = await supabase
        .from('patient_goals')
        .select('*')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (data) {
        setStartingWeight(data.starting_weight?.toString() ?? '');
        setGoalWeight(data.goal_weight?.toString() ?? '');
        setTargetDate(data.target_date ?? '');
        setActivityGoal(data.activity_goal ?? '');
        setNotes(data.notes ?? '');
      }
      setLoading(false);
    }

    load();
  }, [profile]);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !profile) return;
    setSaving(true);
    setMessage('');

    const payload = {
      profile_id: profile.id,
      starting_weight: numberOrNull(startingWeight),
      goal_weight: numberOrNull(goalWeight),
      target_date: targetDate || null,
      activity_goal: activityGoal || null,
      notes: notes || null,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('patient_goals')
      .upsert(payload, { onConflict: 'profile_id' });

    setMessage(error ? error.message : 'Goals saved.');
    setSaving(false);
  }

  return (
    <DashLayout title="Goals Setup" navItems={patientNav}>
      <div className="card" style={{ maxWidth: 760 }}>
        <div className="card-header">
          <div className="card-title">Weight loss goals</div>
          <div className="card-subtitle">Set a target so your progress tracker has something useful to measure.</div>
        </div>
        <div className="card-body">
          {loading ? (
            <div className="loading-screen"><div className="spinner" /><span>Loading goals...</span></div>
          ) : (
            <form onSubmit={save}>
              {message && <div className="alert alert-info mb-4">{message}</div>}
              <div className="form-grid form-grid-2" style={{ gap: 18 }}>
                <div className="form-group">
                  <label className="form-label">Starting weight</label>
                  <input className="form-input" type="number" step="0.1" value={startingWeight} onChange={(e) => setStartingWeight(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Goal weight</label>
                  <input className="form-input" type="number" step="0.1" value={goalWeight} onChange={(e) => setGoalWeight(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Target date</label>
                  <input className="form-input" type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Activity goal</label>
                  <input className="form-input" value={activityGoal} onChange={(e) => setActivityGoal(e.target.value)} placeholder="Example: 8,000 steps daily" />
                </div>
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label className="form-label">Notes</label>
                  <textarea className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What are you working toward?" />
                </div>
              </div>
              <button className="btn btn-primary mt-4" disabled={saving}>
                {saving ? 'Saving...' : 'Save Goals'}
              </button>
            </form>
          )}
        </div>
      </div>
    </DashLayout>
  );
}

function numberOrNull(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value !== '' ? parsed : null;
}
