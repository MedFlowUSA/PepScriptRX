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
  getRolePortalType,
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
  const brandPortal = getWhiteLabelPortal(
    searchParams.get('brand') ||
    searchParams.get('store') ||
    searchParams.get('scope') ||
    searchParams.get('rep'),
  );
  const brandName = brandPortal?.brandName ?? 'PepScriptRX';
  const brandHomePath = brandPortal?.path ?? '/';
  usePageMeta(
    brandPortal ? `${brandName} Portal Login` : 'Sign In',
    brandPortal ? `Sign in to your ${brandName} customer or rep portal.` : 'Sign in to your PepScriptRX customer, rep, or admin portal.',
  );

  const portal = searchParams.get('portal');
  const selectedPortal: LoginPortalType = portal === 'rep'
    ? 'rep'
    : portal === 'admin' && (!brandPortal || brandPortal.backOfficePortal === 'admin' || brandPortal.id === 'aactivated')
      ? 'admin'
      : 'patient';
  const dashboardBrandId = brandPortal?.id;
  const brandQuery = dashboardBrandId ? `?brand=${encodeURIComponent(dashboardBrandId)}` : '';
  const returnTo = safeReturnTo(searchParams.get('returnTo'));

  // Route already-authenticated sessions, but do not override an active login attempt.
  useEffect(() => {
    if (authLoading || submitting || waitingForProfile || !user || !profile) return;
    if (!roleMatchesLoginPortal(profile.role, selectedPortal, brandPortal?.id)) {
      const actualLabel = rolePortalLabel(profile.role);
      void signOut();
      setError(roleMismatchMessage(actualLabel));
      return;
    }
    navigate(selectedPortal === 'patient' && returnTo ? returnTo : `${dashboardPathForRole(profile.role)}${brandQuery}`, { replace: true });
  }, [authLoading, brandPortal?.id, brandQuery, navigate, profile, returnTo, selectedPortal, signOut, submitting, user, waitingForProfile]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      setWaitingForProfile(true);
      const { profile: signedInProfile } = await signIn(email, password);
      const actualRole = signedInProfile?.role;

      if (!actualRole || !roleMatchesLoginPortal(actualRole, selectedPortal, brandPortal?.id)) {
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
  const patientLoginPath = appendReturnTo(brandPortal ? buildPortalLoginPath(brandPortal, 'patient') : '/login?portal=patient', returnTo);
  const repLoginPath = brandPortal ? buildPortalLoginPath(brandPortal, 'rep') : '/login?portal=rep';
  const adminLoginPath = brandPortal ? buildPortalLoginPath(brandPortal, 'admin') : '/login?portal=admin';
  const signupPath = appendReturnTo(brandPortal ? buildPortalSignupPath(brandPortal) : '/patient/signup', returnTo);
  const showAdminPortal = !brandPortal || brandPortal.backOfficePortal === 'admin';

  return (
    <>
      <div className="auth-shell">
        <div className="auth-wrap">
          <div className="auth-brand">
            <Link to={brandHomePath} className="auth-logo">
              {brandPortal ? (
                <img src={brandPortal.logoSrc} alt={brandName} />
              ) : (
                <>PepScript<span>RX</span></>
              )}
            </Link>
            <p>{brandPortal ? `${brandName} ${portalMeta.eyebrow}` : portalMeta.eyebrow}</p>
          </div>

          <div className="auth-card">
            <div className="auth-card-header">
              <div className={`auth-portal-grid ${showAdminPortal ? '' : 'auth-portal-grid-two'}`}>
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
              <div className="auth-title-row">
                <div>
                  <div className="auth-title">{portalMeta.title}</div>
                  <div className="auth-subtitle">{portalMeta.subtitle}</div>
                </div>
                <span className="auth-status">Secure</span>
              </div>
            </div>

            <div className="auth-card-body">
              {!isSupabaseConfigured && (
                <div className="alert alert-info mb-4">
                  Supabase is not configured. Add your .env variables to enable authentication.
                </div>
              )}

              {error && (
                <div className="alert alert-error mb-4">{error}</div>
              )}

              <div className="auth-note mb-4">
                Use the login type assigned to your account. Logging in under the wrong portal will not continue.
              </div>
              <p className="auth-helper">
                {portalMeta.helper}
              </p>

              {forgotMode ? (
                resetSent ? (
                  <div className="auth-success-state">
                    <div className="auth-success-mark">OK</div>
                    <div className="auth-success-title">Reset email sent</div>
                    <p>
                      Check <strong>{email}</strong> for a password reset link. It may take a minute to arrive.
                    </p>
                    <button className="btn btn-ghost btn-sm" onClick={() => { setForgotMode(false); setResetSent(false); }}>Back to sign in</button>
                  </div>
                ) : (
                  <form onSubmit={handleForgotPassword}>
                    <div className="auth-form-stack auth-form-stack-compact">
                      <p className="auth-reset-copy">Enter your account email and we'll send a password reset link.</p>
                      <div className="form-group">
                        <label className="form-label form-required">Email address</label>
                        <input type="email" className="form-input" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" disabled={resetSending} />
                      </div>
                      <button type="submit" className="btn btn-primary w-full auth-submit" disabled={resetSending || !isSupabaseConfigured}>
                        {resetSending ? 'Sending...' : 'Send Reset Link'}
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm w-full auth-secondary-action" onClick={() => setForgotMode(false)}>Back to sign in</button>
                    </div>
                  </form>
                )
              ) : (
                <form onSubmit={handleSubmit}>
                  <div className="auth-form-stack">
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
                      <div className="auth-field-row">
                        <label className="form-label form-required">Password</label>
                        <button type="button" onClick={() => setForgotMode(true)} className="auth-text-button">
                          Forgot password?
                        </button>
                      </div>
                      <input
                        type="password" className="form-input" required
                        value={password} onChange={(e) => setPassword(e.target.value)}
                        placeholder="Password"
                        disabled={busy}
                      />
                    </div>
                    <button type="submit" className="btn btn-primary w-full auth-submit" disabled={busy || !isSupabaseConfigured}>
                      {busy ? 'Signing in...' : 'Sign In'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>

          <div className="auth-footer-links">
            <Link to={signupPath}>Create customer account</Link>
            <span />
            <Link to={brandPortal ? `${brandHomePath.replace(/\/+$/, '')}/rep-intake` : '/rep-intake'}>Apply as rep</Link>
            <span />
            <Link to={brandHomePath} className="auth-muted-link">Back to {brandName}</Link>
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

function appendReturnTo(path: string, returnTo: string): string {
  if (!returnTo || path.includes('returnTo=')) return path;
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}returnTo=${encodeURIComponent(returnTo)}`;
}

function roleMatchesLoginPortal(role: string | null | undefined, portal: LoginPortalType, brandId?: string | null): boolean {
  if (roleMatchesPortal(role, portal)) return true;
  return brandId === 'aactivated' && portal === 'rep' && getRolePortalType(role) === 'admin';
}
