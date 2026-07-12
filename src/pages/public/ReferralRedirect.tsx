import { useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  AACTIVATED_PATH,
  captureReferral,
  getPortalByCode,
  getPortalByPath,
  getReferralStartPath,
  persistReferral,
  updateManifestForReferral,
  type StoredReferral,
} from '../../config/referrals';
import { supabase } from '../../lib/supabase';

type AactivatedRepStoreLookup = {
  rep_slug: string | null;
  discount_code?: string | null;
  public_display_name?: string | null;
  rep_name?: string | null;
  promo_config?: { discount_code?: string | null } | null;
};

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

    if (portal || getPortalByCode(rawCode)) {
      const referral = captureReferral(portal ?? rawCode, portal ? 'permanent_portal_route' : 'short_code_route');
      updateManifestForReferral(referral);
      navigate(getReferralStartPath(referral), { replace: true });
      return;
    }

    let cancelled = false;
    void resolveAactivatedRepReferral(rawCode).then((resolvedReferral) => {
      if (cancelled) return;
      const referral = resolvedReferral ?? captureReferral(rawCode, 'short_code_route');
      updateManifestForReferral(referral);
      navigate(getReferralStartPath(referral), { replace: true });
    });
    return () => { cancelled = true; };
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

async function resolveAactivatedRepReferral(rawCode: string): Promise<StoredReferral | null> {
  const repCode = normalizeReferralCode(rawCode);
  if (!repCode || !supabase) return null;
  const { data, error } = await supabase
    .from('aactivated_public_rep_stores')
    .select('rep_slug,discount_code,public_display_name,rep_name,promo_config')
    .eq('rep_slug', repCode)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as AactivatedRepStoreLookup;
  const repSlug = normalizeReferralCode(row.rep_slug) || repCode;
  const discountCode = normalizeReferralCode(row.discount_code || row.promo_config?.discount_code) || repSlug;
  const referral: StoredReferral = {
    repSlug,
    discountCode,
    discountAmount: 10,
    capturedAt: new Date().toISOString(),
    repName: row.public_display_name || row.rep_name || repSlug,
    portalPath: AACTIVATED_PATH,
    source: 'aactivated_public_rep_store',
  };
  persistReferral(referral);
  return referral;
}

function normalizeReferralCode(value: string | null | undefined): string {
  return String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
}
