import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabase';

export default function Login() {
  const { signIn, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
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
  const portal = searchParams.get('portal');
  const portalMeta = portal === 'rep'
    ? {
        eyebrow: 'Rep Portal',
        title: 'Rep login',
        subtitle: 'Access referral links, QR codes, lead status, and commission tracking.',
      }
    : portal === 'admin'
      ? {
          eyebrow: 'Admin Portal',
          title: 'Admin login',
          subtitle: 'Review submissions, assign cases, manage pricing, fulfillment, and payouts.',
        }
      : {
          eyebrow: 'Patient Portal',
          title: 'Patient login',
          subtitle: 'Track refill reviews, profile details, goals, and weight progress.',
        };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link to="/" style={{ fontSize: 24, fontWeight: 800, color: 'var(--navy)', textDecoration: 'none' }}>
            PepScript<span style={{ color: 'var(--teal)' }}>RX</span>
          </Link>
          <p style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 15 }}>{portalMeta.eyebrow}</p>
        </div>

        <div className="card">
          <div className="card-header" style={{ paddingBottom: 0 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <Link to="/login?portal=patient" className={`portal-chip ${portal !== 'rep' && portal !== 'admin' ? 'portal-chip-active' : ''}`}>Patient</Link>
              <Link to="/login?portal=rep" className={`portal-chip ${portal === 'rep' ? 'portal-chip-active' : ''}`}>Rep</Link>
              <Link to="/login?portal=admin" className={`portal-chip ${portal === 'admin' ? 'portal-chip-active' : ''}`}>Admin</Link>
            </div>
            <div className="card-title">{portalMeta.title}</div>
            <div className="card-subtitle">{portalMeta.subtitle} Your account role will route you to the correct dashboard after sign in.</div>
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
