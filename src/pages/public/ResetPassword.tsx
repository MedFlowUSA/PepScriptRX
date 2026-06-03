import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { usePageMeta } from '../../hooks/usePageMeta';
import { buildPortalLoginPath, getWhiteLabelPortal } from '../../config/whiteLabelPortals';

type RecoveryStatus = 'checking' | 'ready' | 'missing' | 'error';
type PortalRole = 'patient' | 'rep' | 'admin';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const brandPortal = getWhiteLabelPortal(searchParams.get('brand'));
  const portalRole = normalizePortalRole(searchParams.get('portal'));
  const brandName = brandPortal?.brandName ?? 'PepScriptRX';
  const brandHomePath = brandPortal?.path ?? '/';
  const loginPath = brandPortal
    ? buildPortalLoginPath(brandPortal, portalRole)
    : `/login?portal=${portalRole}`;

  usePageMeta('Reset Password', `Set a new password for your ${brandName} account.`);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [recoveryStatus, setRecoveryStatus] = useState<RecoveryStatus>('checking');
  const [recoveryMessage, setRecoveryMessage] = useState('Checking your password reset link...');

  useEffect(() => {
    let alive = true;

    async function prepareRecoverySession() {
      if (!supabase) {
        setRecoveryStatus('error');
        setRecoveryMessage('Authentication is not configured for this environment.');
        return;
      }

      const params = readRecoveryParams();
      const errorDescription = params.get('error_description') || params.get('error');
      if (errorDescription) {
        setRecoveryStatus('error');
        setRecoveryMessage(errorDescription);
        return;
      }

      try {
        const code = params.get('code');
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) throw exchangeError;
          cleanRecoveryUrl();
        } else if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) throw sessionError;
          cleanRecoveryUrl();
        }

        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        if (!alive) return;
        if (data.session?.user) {
          setRecoveryStatus('ready');
          setRecoveryMessage('Choose a new password for your account.');
        } else {
          setRecoveryStatus('missing');
          setRecoveryMessage('Open a password reset email link, or sign in first to change your password.');
        }
      } catch (caught) {
        if (!alive) return;
        setRecoveryStatus('error');
        setRecoveryMessage(caught instanceof Error ? caught.message : 'Your reset link could not be verified. Please request a new password reset link.');
      }
    }

    prepareRecoverySession();

    return () => {
      alive = false;
    };
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
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
    setTimeout(() => navigate(loginPath, { replace: true }), 2500);
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <Link to={brandHomePath} style={{ fontSize: 24, fontWeight: 800, color: 'var(--navy)', textDecoration: 'none', display: 'inline-flex', justifyContent: 'center' }}>
            {brandPortal ? (
              <img src={brandPortal.logoSrc} alt={brandName} style={{ maxWidth: 190, maxHeight: 62, objectFit: 'contain' }} />
            ) : (
              <>PepScript<span style={{ color: 'var(--teal)' }}>RX</span></>
            )}
          </Link>
          <p style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 15 }}>{brandName} account recovery</p>
        </div>

        <div className="card">
          <div className="card-header">
            <div className="card-title">Set new password</div>
            <div className="card-subtitle">{recoveryMessage}</div>
          </div>
          <div className="card-body">
            {recoveryStatus === 'checking' ? (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <div className="spinner" style={{ margin: '0 auto 16px' }} />
                <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>Preparing password reset...</div>
              </div>
            ) : recoveryStatus === 'missing' || recoveryStatus === 'error' ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className={`alert ${recoveryStatus === 'error' ? 'alert-error' : 'alert-info'}`}>
                  {recoveryMessage}
                </div>
                <Link to={loginPath} className="btn btn-primary w-full" style={{ justifyContent: 'center' }}>
                  Go to sign in
                </Link>
              </div>
            ) : done ? (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 22, fontWeight: 900 }}>OK</div>
                <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>Password updated</div>
                <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Redirecting you to sign in...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                  {error && <div className="alert alert-error">{error}</div>}
                  <div className="form-group">
                    <label className="form-label form-required">New password</label>
                    <input
                      type="password"
                      className="form-input"
                      required
                      minLength={8}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Min. 8 characters"
                      disabled={submitting}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label form-required">Confirm password</label>
                    <input
                      type="password"
                      className="form-input"
                      required
                      minLength={8}
                      value={confirm}
                      onChange={(event) => setConfirm(event.target.value)}
                      placeholder="Repeat your password"
                      disabled={submitting}
                    />
                  </div>
                  <button type="submit" className="btn btn-primary w-full" disabled={submitting} style={{ justifyContent: 'center' }}>
                    {submitting ? 'Saving...' : 'Update Password'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <Link to={loginPath} style={{ fontSize: 14, color: 'var(--text-muted)' }}>Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}

function normalizePortalRole(value: string | null): PortalRole {
  return value === 'rep' || value === 'admin' ? value : 'patient';
}

function readRecoveryParams(): URLSearchParams {
  const params = new URLSearchParams(window.location.search);
  const hash = window.location.hash.replace(/^#/, '');
  if (hash) {
    const hashParams = new URLSearchParams(hash);
    hashParams.forEach((value, key) => {
      if (!params.has(key)) params.set(key, value);
    });
  }
  return params;
}

function cleanRecoveryUrl() {
  const params = new URLSearchParams(window.location.search);
  ['code', 'access_token', 'refresh_token', 'token_hash', 'type'].forEach((key) => params.delete(key));
  const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ''}`;
  window.history.replaceState({}, document.title, next);
}
