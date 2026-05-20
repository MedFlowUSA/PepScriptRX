import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabase';

export default function Login() {
  const { signIn, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [waitingForProfile, setWaitingForProfile] = useState(false);

  // After sign-in, wait for AuthContext to load the profile then navigate
  useEffect(() => {
    if (!waitingForProfile || authLoading) return;
    if (profile) {
      const role = profile.role;
      if (role === 'admin')       navigate('/admin');
      else if (role === 'rep')    navigate('/rep');
      else if (role === 'physician') navigate('/physician');
      else if (role === 'fulfillment') navigate('/fulfillment');
      else navigate('/patient');
    }
  }, [waitingForProfile, authLoading, profile, navigate]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signIn(email, password);
      setWaitingForProfile(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Check your credentials.');
      setSubmitting(false);
    }
  }

  const busy = submitting || waitingForProfile;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link to="/" style={{ fontSize: 24, fontWeight: 800, color: 'var(--navy)', textDecoration: 'none' }}>
            PepScript<span style={{ color: 'var(--teal)' }}>RX</span>
          </Link>
          <p style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 15 }}>Patient refill portal sign in</p>
        </div>

        <div className="card">
          <div className="card-header" style={{ paddingBottom: 0 }}>
            <div className="card-title">Patient or staff login</div>
            <div className="card-subtitle">Patients can track refill reviews. Staff accounts route to their assigned portal after sign in.</div>
          </div>
          <div className="card-body">
            {!isSupabaseConfigured && (
              <div className="alert alert-info mb-4">
                Supabase is not configured. Add your .env variables to enable authentication.
              </div>
            )}

            {error && (
              <div className="alert alert-error mb-4">{error}</div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="form-group">
                  <label className="form-label form-required">Email address</label>
                  <input
                    type="email" className="form-input" required
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    disabled={busy}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label form-required">Password</label>
                  <input
                    type="password" className="form-input" required
                    value={password} onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    disabled={busy}
                  />
                </div>
                <button type="submit" className="btn btn-primary w-full" disabled={busy || !isSupabaseConfigured} style={{ justifyContent: 'center' }}>
                  {busy ? 'Signing in…' : 'Sign In'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Link to="/patient/signup" style={{ fontSize: 14, color: 'var(--teal)', fontWeight: 700 }}>Create patient account</Link>
          <span style={{ color: 'var(--border)', fontSize: 18 }}>|</span>
          <Link to="/" style={{ fontSize: 14, color: 'var(--text-muted)' }}>Back to PepScriptRX</Link>
        </div>
      </div>
    </div>
  );
}
