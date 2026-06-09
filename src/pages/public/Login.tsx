import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getPasswordResetUrl, supabase, isSupabaseConfigured } from '../../lib/supabase';
import { usePageMeta } from '../../hooks/usePageMeta';
import { buildPortalLoginPath, buildPortalSignupPath, getWhiteLabelPortal } from '../../config/whiteLabelPortals';
import PortalAgeLeadGate from '../../components/PortalAgeLeadGate';
import {
  dashboardPathForRole,
  portalLabel,
  roleMatchesPortal,
  rolePortalLabel,
  type LoginPortalType,
} from '../../lib/authRoles';

function roleMismatchMessage(actualLabel: string): string {
  const article = actualLabel === 'Admin' ? 'an' : 'a';
  return `This account is registered as ${article} ${actualLabel}. Please use the ${actualLabel} login tab.`;
}

export default function Login() {
  const { signIn, signOut, user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [waitingForProfile, setWaitingForProfile] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const brandPortal = getWhiteLabelPortal(searchParams.get('brand'));
  const brandName = brandPortal?.brandName ?? 'PepScriptRX';
  const brandHomePath = brandPortal?.path ?? '/';
  usePageMeta(
    brandPortal ? `${brandName} Portal Login` : 'Sign In',
    brandPortal ? `Sign in to your ${brandName} customer or rep portal.` : 'Sign in to your PepScriptRX customer, rep, or admin portal.',
  );

  const portal = searchParams.get('portal');
  const selectedPortal: LoginPortalType = portal === 'rep'
    ? 'rep'
    : portal === 'admin' && (!brandPortal || brandPortal.backOfficePortal === 'admin')
      ? 'admin'
      : 'patient';
  const brandQuery = brandPortal ? `?brand=${encodeURIComponent(brandPortal.id)}` : '';
  const returnTo = safeReturnTo(searchParams.get('returnTo'));

  // Route already-authenticated sessions, but do not override an active login attempt.
  useEffect(() => {
    if (authLoading || submitting || waitingForProfile || !user || !profile) return;
    if (!roleMatchesPortal(profile.role, selectedPortal)) {
      const actualLabel = rolePortalLabel(profile.role);
      void signOut();
      setError(roleMismatchMessage(actualLabel));
      return;
    }
    navigate(selectedPortal === 'patient' && returnTo ? returnTo : `${dashboardPathForRole(profile.role)}${brandQuery}`, { replace: true });
  }, [authLoading, brandQuery, navigate, profile, returnTo, selectedPortal, signOut, submitting, user, waitingForProfile]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      setWaitingForProfile(true);
      const { profile: signedInProfile } = await signIn(email, password);
      const actualRole = signedInProfile?.role;

      if (!actualRole || !roleMatchesPortal(actualRole, selectedPortal)) {
        await signOut();
        const actualLabel = rolePortalLabel(actualRole);
        const selectedLabel = portalLabel(selectedPortal);
        setError(actualRole
          ? roleMismatchMessage(actualLabel)
          : `We could not verify this account role. Please contact support before using the ${selectedLabel} login tab.`
        );
        setWaitingForProfile(false);
        setSubmitting(false);
        return;
      }

      navigate(selectedPortal === 'patient' && returnTo ? returnTo : `${dashboardPathForRole(actualRole)}${brandQuery}`, { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Sign in failed. Check your credentials.');
      setWaitingForProfile(false);
      setSubmitting(false);
    }
  }

  async function handleForgotPassword(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !email) return;
    setResetSending(true);
    setError('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getPasswordResetUrl({
        brand: brandPortal?.id ?? searchParams.get('brand'),
        portal: searchParams.get('portal'),
      }),
    });
    if (resetError) {
      setError(resetError.message);
      setResetSending(false);
      return;
    }
    setResetSent(true);
    setResetSending(false);
  }

  const busy = submitting || waitingForProfile;
  const portalMeta = selectedPortal === 'rep'
    ? {
        eyebrow: 'Rep Portal',
        title: 'Rep login',
        subtitle: 'Access referral links, QR codes, lead status, and storefront tools.',
        helper: 'For representatives managing referrals and commissions.',
      }
    : selectedPortal === 'admin'
      ? {
          eyebrow: 'Admin Portal',
          title: 'Admin login',
          subtitle: 'Review submissions, assign cases, manage pricing, fulfillment, and payouts.',
          helper: 'For admins managing stores, reps, orders, and payouts.',
        }
      : {
          eyebrow: 'Customer Portal',
          title: 'Customer login',
          subtitle: 'Track refill reviews, profile details, goals, and weight progress.',
          helper: 'For customers tracking orders, refills, and profile info.',
        };
  const patientLoginPath = brandPortal ? buildPortalLoginPath(brandPortal, 'patient') : '/login?portal=patient';
  const repLoginPath = brandPortal ? buildPortalLoginPath(brandPortal, 'rep') : '/login?portal=rep';
  const adminLoginPath = brandPortal ? buildPortalLoginPath(brandPortal, 'admin') : '/login?portal=admin';
  const signupPath = brandPortal ? buildPortalSignupPath(brandPortal) : '/patient/signup';
  const showAdminPortal = !brandPortal || brandPortal.backOfficePortal === 'admin';

  return (
    <>
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
          <p style={{ marginTop: 8, color: 'var(--text-muted)', fontSize: 15 }}>{brandPortal ? `${brandName} ${portalMeta.eyebrow}` : portalMeta.eyebrow}</p>
        </div>

        <div className="card">
          <div className="card-header" style={{ paddingBottom: 0 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              <Link to={patientLoginPath} className={`portal-chip portal-chip-role ${selectedPortal === 'patient' ? 'portal-chip-active' : ''}`}>
                <strong>Customer</strong>
                <small>Orders, refills, and profile info.</small>
              </Link>
              <Link to={repLoginPath} className={`portal-chip portal-chip-role ${selectedPortal === 'rep' ? 'portal-chip-active' : ''}`}>
                <strong>Rep</strong>
                <small>Referrals and commissions.</small>
              </Link>
              {showAdminPortal && (
                <Link to={adminLoginPath} className={`portal-chip portal-chip-role ${selectedPortal === 'admin' ? 'portal-chip-active' : ''}`}>
                  <strong>Admin</strong>
                  <small>Stores, reps, orders, and payouts.</small>
                </Link>
              )}
            </div>
            <div className="card-title">{portalMeta.title}</div>
            <div className="card-subtitle">{portalMeta.subtitle}</div>
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

            <div className="alert alert-warning mb-4">
              Use the login type assigned to your account. Logging in under the wrong portal will not continue.
            </div>
            <p style={{ margin: '0 0 18px', color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5 }}>
              {portalMeta.helper}
            </p>

            {forgotMode ? (
              resetSent ? (
                <div style={{ textAlign: 'center', padding: '8px 0' }}>
                  <div style={{ width: 44, height: 44, borderRadius: '50%', background: '#DCFCE7', color: '#15803D', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 22, fontWeight: 900 }}>✓</div>
                  <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>Reset email sent</div>
                  <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 20 }}>
                    Check <strong>{email}</strong> for a password reset link. It may take a minute to arrive.
                  </p>
                  <button className="btn btn-ghost btn-sm" onClick={() => { setForgotMode(false); setResetSent(false); }}>Back to sign in</button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: 0 }}>Enter your account email and we'll send a password reset link.</p>
                    <div className="form-group">
                      <label className="form-label form-required">Email address</label>
                      <input type="email" className="form-input" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" disabled={resetSending} />
                    </div>
                    <button type="submit" className="btn btn-primary w-full" disabled={resetSending || !isSupabaseConfigured} style={{ justifyContent: 'center' }}>
                      {resetSending ? 'Sending…' : 'Send Reset Link'}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm w-full" onClick={() => setForgotMode(false)} style={{ justifyContent: 'center' }}>Back to sign in</button>
                  </div>
                </form>
              )
            ) : (
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label className="form-label form-required" style={{ margin: 0 }}>Password</label>
                      <button type="button" onClick={() => setForgotMode(true)} style={{ background: 'none', border: 'none', color: 'var(--teal)', fontSize: 13, cursor: 'pointer', padding: 0, fontWeight: 600 }}>
                        Forgot password?
                      </button>
                    </div>
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
            )}
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Link to={signupPath} style={{ fontSize: 14, color: 'var(--teal)', fontWeight: 700 }}>Create customer account</Link>
          <span style={{ color: 'var(--border)', fontSize: 18 }}>|</span>
          <Link to={brandPortal ? `${brandHomePath.replace(/\/+$/, '')}/rep-intake` : '/rep-intake'} style={{ fontSize: 14, color: 'var(--teal)', fontWeight: 700 }}>Apply as rep</Link>
          <span style={{ color: 'var(--border)', fontSize: 18 }}>|</span>
          <Link to={brandHomePath} style={{ fontSize: 14, color: 'var(--text-muted)' }}>Back to {brandName}</Link>
        </div>
        </div>
      </div>
      <PortalAgeLeadGate portal={brandPortal} />
    </>
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
