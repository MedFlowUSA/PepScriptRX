import { useState } from 'react';
import type { FormEvent } from 'react';
import DashLayout from '../../components/layout/DashLayout';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { patientNav } from './patientNav';

export default function PatientProfile() {
  const { profile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!supabase || !profile) return;
    setSaving(true);
    setMessage('');
    setError('');
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ full_name: fullName, phone })
      .eq('id', profile.id);

    if (updateError) setError(updateError.message);
    else setMessage('Profile updated.');
    setSaving(false);
  }

  return (
    <DashLayout title="Patient Profile" navItems={patientNav}>
      <div className="card" style={{ maxWidth: 680 }}>
        <div className="card-header">
          <div className="card-title">Profile</div>
          <div className="card-subtitle">Keep your account and contact details current.</div>
        </div>
        <div className="card-body">
          {message && <div className="alert alert-success mb-4">{message}</div>}
          {error && <div className="alert alert-error mb-4">{error}</div>}
          <form onSubmit={save}>
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
                {saving ? 'Saving...' : 'Save Profile'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </DashLayout>
  );
}
