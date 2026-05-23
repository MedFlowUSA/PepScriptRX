import { useEffect, useState } from 'react';
import DashLayout from '../../components/layout/DashLayout';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { patientNav } from './patientNav';
import { REFERRAL_DISPLAY_BASE_URL } from '../../config/referrals';

function getReferralCode(profileId: string): string {
  return profileId.replace(/-/g, '').slice(0, 8).toUpperCase();
}

export default function PatientReferral() {
  const { profile } = useAuth();
  const [referralCount, setReferralCount] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  const referralCode = profile?.id ? getReferralCode(profile.id) : '';
  const referralLink = referralCode ? `${REFERRAL_DISPLAY_BASE_URL}/start?ref=${referralCode}` : '';

  useEffect(() => {
    if (!supabase || !referralCode) return;
    supabase
      .rpc('count_my_referrals', { referral_code_input: referralCode })
      .then(({ data }) => setReferralCount(typeof data === 'number' ? data : null));
  }, [referralCode]);

  async function copyLink() {
    if (!referralLink) return;
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const STEPS = [
    {
      icon: '🔗',
      title: 'Share your link',
      desc: 'Copy and send your personal link to friends or family who are paying too much for their medication.',
    },
    {
      icon: '📋',
      title: 'They submit a free savings check',
      desc: 'Your friend clicks your link and fills out the intake form — no commitment, no cost.',
    },
    {
      icon: '💊',
      title: 'They save on their medication',
      desc: 'If eligible, they receive a lower-cost quote for the same medication. Same quality, better price.',
    },
  ];

  return (
    <DashLayout title="Refer a Friend" navItems={patientNav}>
      <div style={{ maxWidth: 620, display: 'grid', gap: 24 }}>

        {/* Hero */}
        <div className="card" style={{ borderColor: 'rgba(37,199,217,.35)', overflow: 'hidden' }}>
          <div style={{ background: 'var(--navy)', padding: '28px 28px 20px', color: '#fff' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🎁</div>
            <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px', letterSpacing: '-.01em' }}>
              Refer a friend. Help them save.
            </h1>
            <p style={{ color: 'rgba(255,255,255,.65)', fontSize: 14, lineHeight: 1.7, margin: 0 }}>
              Share your personal link. Anyone who submits a savings check through it could save hundreds on their medication — the same way you did.
            </p>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em' }}>
              Your referral link
            </div>
            <div style={{
              background: 'var(--card-soft)', border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)', padding: '12px 16px',
              fontFamily: 'monospace', fontSize: 14, color: 'var(--teal)',
              wordBreak: 'break-all',
            }}>
              {referralLink || '—'}
            </div>
            <button
              className="btn btn-primary"
              onClick={copyLink}
              disabled={!referralLink}
              style={{ justifyContent: 'center' }}
            >
              {copied ? '✓ Copied to Clipboard!' : 'Copy My Referral Link'}
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--teal)' }}>
              {referralCount === null ? '—' : referralCount}
            </div>
            <div className="stat-label">Friends Referred</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">Free</div>
            <div className="stat-label">Cost to Refer</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">1–2 days</div>
            <div className="stat-label">Review Time</div>
          </div>
        </div>

        {/* How it works */}
        <div className="card">
          <div className="card-header" style={{ paddingBottom: 16 }}>
            <div className="card-title">How it works</div>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {STEPS.map((step, i) => (
              <div key={step.title} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: '50%', background: 'var(--teal-pale)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0, fontSize: 20,
                }}>
                  {step.icon}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--teal)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      Step {i + 1}
                    </span>
                  </div>
                  <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 4, fontSize: 15 }}>{step.title}</div>
                  <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Share options */}
        <div className="card">
          <div className="card-header" style={{ paddingBottom: 16 }}>
            <div className="card-title">Share your link</div>
            <div className="card-subtitle">Send it anywhere your friends are</div>
          </div>
          <div className="card-body" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <a
              href={`sms:?body=${encodeURIComponent(`I've been saving on my medication with PepScriptRX. Check if you're eligible: ${referralLink}`)}`}
              className="btn btn-outline btn-sm"
            >
              📱 Text
            </a>
            <a
              href={`mailto:?subject=${encodeURIComponent('Save on your medication')}&body=${encodeURIComponent(`Hey! I found PepScriptRX and it's helped me save on my medication costs. Check if you qualify: ${referralLink}`)}`}
              className="btn btn-outline btn-sm"
            >
              ✉️ Email
            </a>
            <button className="btn btn-outline btn-sm" onClick={copyLink}>
              {copied ? '✓ Copied!' : '📋 Copy Link'}
            </button>
          </div>
        </div>

        <div className="disclaimer">
          Referral program participation is subject to PepScriptRX Terms of Service. PepScriptRX does not guarantee
          savings, eligibility, or approval for referred individuals. Program terms may change.
        </div>

      </div>
    </DashLayout>
  );
}
