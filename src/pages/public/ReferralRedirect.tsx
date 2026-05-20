import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  DEFAULT_REFERRAL_DISCOUNT_AMOUNT,
  REFERRAL_STORAGE_KEY,
  type StoredReferral,
} from '../../config/referrals';

export default function ReferralRedirect() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();

  useEffect(() => {
    const rawCode = (code ?? '').trim();
    const normalizedCode = rawCode.toUpperCase();

    if (!normalizedCode) {
      navigate('/start', { replace: true });
      return;
    }

    const referral: StoredReferral = {
      repSlug: normalizedCode,
      discountCode: normalizedCode,
      discountAmount: DEFAULT_REFERRAL_DISCOUNT_AMOUNT,
      capturedAt: new Date().toISOString(),
    };

    window.localStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(referral));
    window.sessionStorage.setItem(REFERRAL_STORAGE_KEY, JSON.stringify(referral));

    navigate(`/start?rep=${encodeURIComponent(normalizedCode)}&discount=${encodeURIComponent(normalizedCode)}`, {
      replace: true,
    });
  }, [code, navigate]);

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--surface)' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 16px' }} />
        <div style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Applying referral...</div>
      </div>
    </div>
  );
}
