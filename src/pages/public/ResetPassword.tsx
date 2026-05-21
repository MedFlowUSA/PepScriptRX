import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { usePageMeta } from '../../hooks/usePageMeta';

export default function ResetPassword() {
  usePageMeta('Reset Password', 'Set a new password for your PepScriptRX account.');
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (!supabase) return;
    setSubmitting(true);
    setError('');
    const { error: updateError } = await supabase.auth.updateUser({ password });
    if (updateError) {
      setError(updateError.message);
      setSubmitting(false);
      return;
    }
    setDone(true);
    setTimeout(() => navigate('/login', { replace: true }), 2500);
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link to="/" style={{ fontSize: 24, fontWeight: 800, color: 'var(--navy)', textDecoration: 'none' }}>
            PepScript<span style={{ color: 'var(--teal)' }}>RX</span>
          </Link>
          <p style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 15 }}>Account recovery</p>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Set new password</div>
            <div className="card-subtitle">Choose a strong password for your account.</div>
          </div>
          <div className="card-body">
            {done ? (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 22, fontWeight: 900 }}>✓</div>
                <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>Password updated</div>
                <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Redirecting you to sign in…</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {error && <div className="alert alert-error">{error}</div>}
                  <div className="form-group">
                    <label className="form-label form-required">New password</label>
                    <input
                      type="password" className="form-input" required minLength={8}
                      value={password} onChange={(e) => setPassword(e.target.value)}
                      placeholder="Min. 8 characters" disabled={submitting}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label form-required">Confirm password</label>
                    <input
                      type="password" className="form-input" required minLength={8}
                      value={confirm} onChange={(e) => setConfirm(e.target.value)}
                      placeholder="Repeat your password" disabled={submitting}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary w-full" disabled={submitting} style={{ justifyContent: 'center' }}>
                    {submitting ? 'Saving…' : 'Update Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Link to="/login" style={{ fontSize: 14, color: 'var(--text-muted)' }}>Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
