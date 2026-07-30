import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isSupabaseConfigured } from '../../lib/supabase';
import { usePageMeta } from '../../hooks/usePageMeta';
import { buildPortalLoginPath, getWhiteLabelPortal } from '../../config/whiteLabelPortals';
import { dashboardPathForRole, roleMatchesPortal } from '../../lib/authRoles';

export default function PatientSignup() {
  const { signIn, signUpPatient } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const brandPortal = getWhiteLabelPortal(params.get('brand'));
  const brandName = brandPortal?.brandName ?? 'PepScriptRX';
  const brandHomePath = brandPortal?.path ?? '/';
  const returnTo = safeReturnTo(params.get('returnTo'));
  const paymentToken = cleanToken(params.get('payment'));
  const loginPath = appendReturnTo(brandPortal ? buildPortalLoginPath(brandPortal, 'patient') : '/login', returnTo);
  usePageMeta(
    brandPortal ? `Create Customer Account | ${brandName}` : 'Create Patient Account',
    brandPortal ? `Create your ${brandName} customer portal account.` : 'Sign up for your PepScriptRX patient portal to track refill reviews and weight progress.',
  );
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState(params.get('email') ?? '');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (paymentToken) {
        const account = await createOrderBackedCustomerAccount({
          paymentToken,
          fullName,
          phone,
          email,
          password,
        });
        if (typeof account.login_url === 'string' && account.login_url) {
          window.location.assign(account.login_url);
          return;
        }
        const result = await signIn(email, password);
        if (result.profile && roleMatchesPortal(result.profile.role, 'patient')) {
          navigate(returnTo || `${dashboardPathForRole(result.profile.role)}${brandPortal ? `?brand=${encodeURIComponent(brandPortal.id)}` : ''}`, { replace: true });
          return;
        }
        setMessage('Account created. Sign in to view your customer dashboard.');
        setTimeout(() => navigate(loginPath), 800);
        return;
      }

      const result = await signUpPatient({ fullName, phone, email, password });
      if (result.sessionActive && result.profile && roleMatchesPortal(result.profile.role, 'patient')) {
        navigate(returnTo || `${dashboardPathForRole(result.profile.role)}${brandPortal ? `?brand=${encodeURIComponent(brandPortal.id)}` : ''}`, { replace: true });
        return;
      }
      setMessage('Account created. Check your email if confirmation is required, then sign in to view your customer dashboard.');
      setTimeout(() => navigate(loginPath), 1200);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create account.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <Link to={brandHomePath} style={{ fontSize: 24, fontWeight: 800, color: 'var(--navy)', display: 'inline-flex', justifyContent: 'center' }}>
            {brandPortal ? (
              <img src={brandPortal.logoSrc} alt={brandName} style={{ maxWidth: 190, maxHeight: 62, objectFit: 'contain' }} />
            ) : (
              <>PepScript<span style={{ color: 'var(--teal)' }}>RX</span></>
            )}
          </Link>
          <p style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 15 }}>Create your {brandPortal ? brandName : 'customer'} account</p>
        </div>

        <div className="card">
          <div className="card-body">
            {!isSupabaseConfigured && (
              <div className="alert alert-info mb-4">Supabase is not configured. Add your environment variables to enable account creation.</div>
            )}
            {error && <div className="alert alert-error mb-4">{error}</div>}
            {message && <div className="alert alert-success mb-4">{message}</div>}
            {paymentToken && (
              <div className="alert alert-info mb-4">
                Use the same email from your order. Your portal access will be activated immediately after this form.
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div className="form-group">
                  <label className="form-label form-required">Full name</label>
                  <input className="form-input" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label form-required">Phone</label>
                  <input className="form-input" required type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label form-required">Email</label>
                  <input className="form-input" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label form-required">Password</label>
                  <input className="form-input" required minLength={8} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <button className="btn btn-primary w-full" disabled={loading || !isSupabaseConfigured} style={{ justifyContent: 'center' }}>
                  {loading ? 'Creating account...' : 'Create Customer Account'}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 22 }}>
          <Link to={loginPath} style={{ color: 'var(--text-muted)', fontSize: 14 }}>Already have an account? Sign in</Link>
        </div>
      </div>
    </div>
  );
}

function safeReturnTo(value: string | null): string {
  if (!value) return '';
  try {
    const decoded = decodeURIComponent(value);
    if (!decoded.startsWith('/') || decoded.startsWith('//')) return '';
    if (/^\/(admin|rep|physician|fulfillment)(\/|$)/i.test(decoded)) return '';
    return decoded;
  } catch {
    return '';
  }
}

function appendReturnTo(path: string, returnTo: string): string {
  if (!returnTo || path.includes('returnTo=')) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}returnTo=${encodeURIComponent(returnTo)}`;
}

function cleanToken(value: string | null): string {
  const token = String(value ?? '').trim();
  return /^[a-zA-Z0-9_-]{12,160}$/.test(token) ? token : '';
}

async function createOrderBackedCustomerAccount(args: {
  paymentToken: string;
  fullName: string;
  phone: string;
  email: string;
  password: string;
}) {
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-customer-portal-account`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(anonKey ? { apikey: anonKey, Authorization: `Bearer ${anonKey}` } : {}),
    },
    body: JSON.stringify({
      payment_token: args.paymentToken,
      full_name: args.fullName,
      phone: args.phone,
      email: args.email,
      password: args.password,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.ok) {
    throw new Error(typeof body.error === 'string' ? body.error : 'Could not create customer portal account.');
  }
  return body as { login_url?: string | null };
}
