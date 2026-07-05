import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { getPasswordResetUrl, supabase } from '../../lib/supabase';
import type { Profile, Role } from '../../types';
import { usePageMeta } from '../../hooks/usePageMeta';

type CallbackStatus = 'confirming' | 'success' | 'error';

function destinationForRole(role?: Role | null): string {
  if (role === 'admin') return '/admin';
  if (role === 'rx_plus_admin') return '/admin';
  if (role === 'rep') return '/rep';
  if (role === 'physician') return '/physician';
  if (role === 'fulfillment') return '/fulfillment';
  return '/patient';
}

export default function AuthCallback() {
  usePageMeta('Confirming Account', 'Verifying your PepScriptRX account - please wait.');
  const navigate = useNavigate();
  const [status, setStatus] = useState<CallbackStatus>('confirming');
  const [message, setMessage] = useState('Confirming your PepScriptRX account...');

  useEffect(() => {
    let alive = true;

    async function confirmSession() {
      if (!supabase) {
        setStatus('error');
        setMessage('Authentication is not configured for this environment.');
        return;
      }

      const params = readAuthParams();
      const errorDescription = params.get('error_description') || params.get('error');
      const code = params.get('code');

      if (errorDescription) {
        setStatus('error');
        setMessage(errorDescription);
        return;
      }

      try {
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          if (accessToken && refreshToken) {
            const { error } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            if (error) throw error;
          }
        }

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw sessionError;

        const user = sessionData.session?.user;
        if (!user) throw new Error('We could not confirm your session. Please open the confirmation link again or sign in.');

        const type = params.get('type');
        if (type === 'recovery') {
          if (!alive) return;
          setStatus('success');
          setMessage('Identity confirmed. Redirecting you to reset your password...');
          window.history.replaceState({}, document.title, '/auth/callback');
          setTimeout(() => navigate(getPasswordResetPath(params), { replace: true }), 900);
          return;
        }

        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .or(`id.eq.${user.id},auth_user_id.eq.${user.id}`)
          .maybeSingle();

        const destination = destinationForRole((profile as Profile | null)?.role);

        if (!alive) return;
        setStatus('success');
        setMessage('Your account is confirmed. Redirecting you now...');

        window.history.replaceState({}, document.title, '/auth/callback');
        setTimeout(() => navigate(destination, { replace: true }), 900);
      } catch (caught) {
        if (!alive) return;
        setStatus('error');
        setMessage(caught instanceof Error ? caught.message : 'Email confirmation failed. Please try signing in or request a new confirmation email.');
      }
    }

    confirmSession();

    return () => {
      alive = false;
    };
  }, [navigate]);

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(180deg, #07111F 0%, #0D1726 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 500 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Link to="/" style={{ fontSize: 26, fontWeight: 800, color: '#F8FAFC', textDecoration: 'none' }}>
            PepScript<span style={{ color: 'var(--teal)' }}>RX</span>
          </Link>
          <p style={{ marginTop: 8, color: '#CBD5E1', fontSize: 15 }}>Secure account confirmation</p>
        </div>

        <div className="card" style={{ textAlign: 'center', padding: 34 }}>
          {status === 'confirming' && <div className="spinner" style={{ margin: '0 auto 20px' }} />}
          {status === 'success' && (
            <div style={{ width: 48, height: 48, borderRadius: 999, background: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 24, fontWeight: 900 }}>
              OK
            </div>
          )}
          {status === 'error' && (
            <div style={{ width: 48, height: 48, borderRadius: 999, background: '#FEE2E2', color: '#B91C1C', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', fontSize: 24, fontWeight: 900 }}>
              !
            </div>
          )}

          <h1 style={{ fontSize: 26, color: 'var(--navy)', marginBottom: 10 }}>
            {status === 'error' ? 'Confirmation needs attention' : 'Confirming your account'}
          </h1>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, margin: '0 auto', maxWidth: 380 }}>{message}</p>

          {status === 'error' && (
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 26 }}>
              <Link to="/login" className="btn btn-primary">Go to Login</Link>
              <Link to="/patient/signup" className="btn btn-outline">Create Account</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function readAuthParams(): URLSearchParams {
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

function getPasswordResetPath(params: URLSearchParams): string {
  const url = new URL(getPasswordResetUrl({
    brand: params.get('brand'),
    portal: params.get('portal'),
  }));
  const resetParams = new URLSearchParams(url.search);
  ['code', 'access_token', 'refresh_token', 'token_hash', 'type'].forEach((key) => {
    const value = params.get(key);
    if (value && !resetParams.has(key)) resetParams.set(key, value);
  });
  return `/reset-password${resetParams.toString() ? `?${resetParams.toString()}` : ''}`;
}
