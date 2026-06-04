import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import DashLayout from '../../components/layout/DashLayout';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { patientNav } from './patientNav';

type HealthData = {
  goal_weight: number | null;
  starting_weight: number | null;
  height_inches: number | null;
  current_weight: number | null;
};

type PatientGoalRow = Pick<HealthData, 'goal_weight' | 'starting_weight' | 'height_inches'>;

type PatientWeightRow = {
  weight: number | null;
};

function calcBmi(weightLb: number, heightIn: number) {
  return (703 * weightLb) / (heightIn * heightIn);
}
function bmiCategory(bmi: number) {
  if (bmi < 18.5) return { label: 'Underweight', color: '#3b82f6' };
  if (bmi < 25)   return { label: 'Normal weight', color: '#22c55e' };
  if (bmi < 30)   return { label: 'Overweight', color: '#f59e0b' };
  return               { label: 'Obese', color: '#ef4444' };
}
function inchesToFeetStr(inches: number) {
  const ft = Math.floor(inches / 12);
  const inn = Math.round(inches % 12);
  return `${ft}'${inn}"`;
}

export default function PatientProfile() {
  const { profile, refreshProfile } = useAuth();

  // Account fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Password fields
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwMessage, setPwMessage] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwSaving, setPwSaving] = useState(false);

  // SMS preferences
  const [smsOptedOut, setSmsOptedOut] = useState(false);
  const [smsMsg, setSmsMsg] = useState('');
  const [smsSaving, setSmsSaving] = useState(false);

  // Health vitals
  const [health, setHealth] = useState<HealthData | null>(null);
  const [heightInput, setHeightInput] = useState('');
  const [heightSaving, setHeightSaving] = useState(false);
  const [heightMsg, setHeightMsg] = useState('');

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '');
      setPhone(profile.phone ?? '');
      setSmsOptedOut(profile.sms_opted_out ?? false);
      loadHealth();
    }
  }, [profile]);

  async function loadHealth() {
    if (!supabase || !profile) return;
    const [{ data: goalData }, { data: weightData }] = await Promise.all([
      supabase.from('patient_goals').select('goal_weight, starting_weight, height_inches').eq('profile_id', profile.id).maybeSingle(),
      supabase.from('patient_weight_entries').select('weight').eq('profile_id', profile.id).order('recorded_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    const goal = goalData as PatientGoalRow | null;
    const weight = weightData as PatientWeightRow | null;
    const h: HealthData = {
      goal_weight: goal?.goal_weight ?? null,
      starting_weight: goal?.starting_weight ?? null,
      height_inches: goal?.height_inches ?? null,
      current_weight: weight?.weight ?? null,
    };
    setHealth(h);
    setHeightInput(h.height_inches?.toString() ?? '');
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !profile) return;
    setSaving(true);
    setMessage('');
    setError('');
    const { error: updateError } = await supabase.from('profiles').update({ full_name: fullName, phone }).eq('id', profile.id);
    if (updateError) {
      setError(updateError.message);
    } else {
      setMessage('Profile updated.');
      await refreshProfile();
    }
    setSaving(false);
  }

  async function saveHeight(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !profile) return;
    setHeightSaving(true);
    setHeightMsg('');
    const heightInches = heightInput ? parseFloat(heightInput) : null;
    const { error } = await supabase.from('patient_goals').upsert(
      { profile_id: profile.id, height_inches: heightInches, updated_at: new Date().toISOString() },
      { onConflict: 'profile_id' }
    );
    if (!error) {
      setHeightMsg('Saved.');
      await loadHealth();
      setTimeout(() => setHeightMsg(''), 2000);
    }
    setHeightSaving(false);
  }

  async function saveSmsPreference(optOut: boolean) {
    if (!supabase || !profile) return;
    setSmsSaving(true);
    setSmsMsg('');
    const { error } = await supabase.from('profiles').update({ sms_opted_out: optOut }).eq('id', profile.id);
    if (!error) {
      setSmsOptedOut(optOut);
      setSmsMsg(optOut ? 'You have opted out of weekly reminders.' : 'Weekly reminders re-enabled.');
      await refreshProfile();
      setTimeout(() => setSmsMsg(''), 3000);
    }
    setSmsSaving(false);
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) { setPwError('Passwords do not match.'); return; }
    if (newPassword.length < 8) { setPwError('Password must be at least 8 characters.'); return; }
    if (!supabase) return;
    setPwSaving(true);
    setPwError('');
    setPwMessage('');
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      setPwError(updateError.message);
    } else {
      setPwMessage('Password updated successfully.');
      setNewPassword('');
      setConfirmPassword('');
    }
    setPwSaving(false);
  }

  const bmi = health?.current_weight && health.height_inches
    ? calcBmi(health.current_weight, health.height_inches)
    : null;
  const bmiCat = bmi != null ? bmiCategory(bmi) : null;

  const lostLbs = health?.starting_weight && health.current_weight
    ? health.starting_weight - health.current_weight
    : null;
  const toGoLbs = health?.goal_weight && health.current_weight
    ? health.current_weight - health.goal_weight
    : null;
  const pctToGoal = health?.starting_weight && health.goal_weight && health.current_weight
    ? Math.min(100, Math.max(0, ((health.starting_weight - health.current_weight) / (health.starting_weight - health.goal_weight)) * 100))
    : null;

  return (
    <DashLayout title="My Profile" navItems={patientNav}>
      <div style={{ display: 'grid', gap: 24, maxWidth: 760 }}>

        {/* ── Health Vitals ────────────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Health Overview</div>
            <div className="card-subtitle">Your current health snapshot based on logged data.</div>
          </div>
          <div className="card-body" style={{ display: 'grid', gap: 20 }}>

            {/* Stats row */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">Current weight</div>
                <div className="stat-value">{health?.current_weight != null ? `${health.current_weight} lb` : '--'}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">BMI</div>
                <div className="stat-value" style={{ color: bmiCat?.color }}>
                  {bmi != null ? bmi.toFixed(1) : '--'}
                </div>
                {bmiCat && <div style={{ fontSize: 12, color: bmiCat.color, fontWeight: 600, marginTop: 2 }}>{bmiCat.label}</div>}
              </div>
              <div className="stat-card">
                <div className="stat-label">Goal weight</div>
                <div className="stat-value">{health?.goal_weight != null ? `${health.goal_weight} lb` : '--'}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">Lost so far</div>
                <div className="stat-value" style={{ color: lostLbs && lostLbs > 0 ? 'var(--success)' : undefined }}>
                  {lostLbs != null && lostLbs > 0 ? `${lostLbs.toFixed(1)} lb` : '--'}
                </div>
              </div>
            </div>

            {/* Progress bar */}
            {pctToGoal != null && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--text-muted)', marginBottom: 6 }}>
                  <span>Start: {health!.starting_weight} lb</span>
                  <span style={{ fontWeight: 700, color: 'var(--navy)' }}>{pctToGoal.toFixed(1)}% to goal</span>
                  <span>Goal: {health!.goal_weight} lb</span>
                </div>
                <div style={{ height: 10, background: 'var(--surface-2)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pctToGoal}%`, background: 'linear-gradient(90deg,#25C7D9,#22c55e)', borderRadius: 8, transition: 'width .5s ease' }} />
                </div>
                {toGoLbs != null && toGoLbs > 0 && (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 5 }}>{toGoLbs.toFixed(1)} lb to goal</div>
                )}
              </div>
            )}

            {/* Height editor */}
            <form onSubmit={saveHeight}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12 }}>
                <div className="form-group" style={{ flex: 1, margin: 0 }}>
                  <label className="form-label">Height (inches)</label>
                  <input
                    className="form-input"
                    type="number"
                    step="0.5"
                    min="36"
                    max="96"
                    value={heightInput}
                    onChange={(e) => setHeightInput(e.target.value)}
                    placeholder="e.g. 68"
                  />
                  {heightInput && !isNaN(parseFloat(heightInput)) && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                      = {inchesToFeetStr(parseFloat(heightInput))}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <button className="btn btn-outline btn-sm" disabled={heightSaving} style={{ marginBottom: 0 }}>
                    {heightSaving ? 'Saving…' : 'Save height'}
                  </button>
                  {heightMsg && <div style={{ fontSize: 12, color: 'var(--success)', textAlign: 'center' }}>{heightMsg}</div>}
                </div>
              </div>
            </form>

            {/* Quick links */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link to="/patient/weight" className="btn btn-outline btn-sm">Update Weight →</Link>
              <Link to="/patient/goals" className="btn btn-outline btn-sm">Edit Goals →</Link>
              <Link to="/patient/progress" className="btn btn-outline btn-sm">View Progress →</Link>
              <Link to="/patient/side-effects" className="btn btn-outline btn-sm">Side Effects →</Link>
            </div>

            {!health?.current_weight && (
              <div style={{ fontSize: 13, color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
                Log your first weight entry in the <Link to="/patient/weight" style={{ color: 'var(--teal)' }}>Weight Tracker</Link> to see your BMI and progress here.
              </div>
            )}
          </div>
        </div>

        {/* ── Account Info ─────────────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Account</div>
            <div className="card-subtitle">Keep your contact details current.</div>
          </div>
          <div className="card-body">
            {message && <div className="alert alert-success mb-4">{message}</div>}
            {error && <div className="alert alert-error mb-4">{error}</div>}
            <form onSubmit={saveProfile}>
              <div style={{ display: 'grid', gap: 18 }}>
                <div className="form-group">
                  <label className="form-label">Full name</label>
                  <input className="form-input" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input className="form-input" value={profile?.email ?? ''} disabled />
                </div>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input className="form-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <button className="btn btn-primary" disabled={saving} style={{ justifyContent: 'center' }}>
                  {saving ? 'Saving…' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ── Change Password ───────────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Change Password</div>
            <div className="card-subtitle">Must be at least 8 characters.</div>
          </div>
          <div className="card-body">
            {pwMessage && <div className="alert alert-success mb-4">{pwMessage}</div>}
            {pwError && <div className="alert alert-error mb-4">{pwError}</div>}
            <form onSubmit={changePassword}>
              <div style={{ display: 'grid', gap: 18 }}>
                <div className="form-group">
                  <label className="form-label form-required">New password</label>
                  <input type="password" className="form-input" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min. 8 characters" disabled={pwSaving} />
                </div>
                <div className="form-group">
                  <label className="form-label form-required">Confirm new password</label>
                  <input type="password" className="form-input" required minLength={8} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat your password" disabled={pwSaving} />
                </div>
                <button className="btn btn-outline" disabled={pwSaving} style={{ justifyContent: 'center' }}>
                  {pwSaving ? 'Updating…' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* ── SMS Preferences ──────────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">SMS Notifications</div>
            <div className="card-subtitle">Weekly injection reminders sent by text message.</div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '14px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--card-soft)' }}>
              <div>
                <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 15 }}>Weekly medication reminders</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                  {smsOptedOut ? 'You are currently opted out.' : 'Sent every Monday at 10:00 AM.'}
                </div>
              </div>
              <button
                className={`btn btn-sm ${smsOptedOut ? 'btn-primary' : 'btn-outline'}`}
                onClick={() => saveSmsPreference(!smsOptedOut)}
                disabled={smsSaving}
              >
                {smsSaving ? 'Saving…' : smsOptedOut ? 'Re-enable' : 'Opt out'}
              </button>
            </div>
            {smsMsg && <div className="alert alert-success">{smsMsg}</div>}
          </div>
        </div>

      </div>
    </DashLayout>
  );
}
