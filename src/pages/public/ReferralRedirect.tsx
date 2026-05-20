import { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  captureReferral,
  getPortalByPath,
  getReferralStartPath,
  updateManifestForReferral,
} from '../../config/referrals';

export default function ReferralRedirect() {
  const { code } = useParams<{ code: string }>();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const portal = getPortalByPath(pathname);
    const rawCode = (code ?? '').trim();

    if (!portal && !rawCode) {
      navigate('/start', { replace: true });
      return;
    }

    const referral = captureReferral(portal ?? rawCode, portal ? 'permanent_portal_route' : 'short_code_route');
    updateManifestForReferral(referral);

    navigate(getReferralStartPath(referral), {
      replace: true,
    });
  }, [code, navigate, pathname]);

  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--surface)' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 16px' }} />
        <div style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Applying referral...</div>
      </div>
    </div>
  );
}
