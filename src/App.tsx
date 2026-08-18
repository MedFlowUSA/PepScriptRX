import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import FreeBacWaterBanner from './components/FreeBacWaterBanner';
import ProtectedRoute from './components/ProtectedRoute';
import AactivatedRepAccessGate from './components/AactivatedRepAccessGate';
import { buildPortalLoginPath, buildPortalSignupPath, getWhiteLabelPortal } from './config/whiteLabelPortals';
import {
  AACTIVATED_PATH,
  captureReferral,
  getPortalByCode,
  getReferralStartPath,
  persistReferral,
  updateManifestForReferral,
  type StoredReferral,
} from './config/referrals';
import { supabase } from './lib/supabase';
import { isRockPhormAdmin } from './lib/rockPhormScope';
import { isGlowAdmin } from './lib/glowScope';
import { isProductIntelligenceAdmin } from './lib/productIntelligenceAccess';
import { getPartnerTenant, isPlatformAdmin as isPlatformTenantAdmin, partnerCan } from './lib/partnerTenant';
import { isAactivatedPartnerAdmin } from './lib/aactivatedScope';

// Public pages
import Home from './pages/public/Home';
import Start from './pages/public/Start';
import Submitted from './pages/public/Submitted';
import PaymentPage from './pages/public/PaymentPage';
import Privacy from './pages/public/Privacy';
import Terms from './pages/public/Terms';
import Certificates from './pages/public/Certificates';
import PeptideCalculator from './pages/public/PeptideCalculator';
import RxPlusLanding from './pages/public/RxPlusLanding';
import RxPlusDistributorPortal from './pages/public/RxPlusDistributorPortal';
import GlowStorefront from './pages/public/GlowStorefront';
import RadianceStorefront from './pages/public/RadianceStorefront';
import KlowStorefront from './pages/public/KlowStorefront';
import ViltrumPeptideStorefront from './pages/public/ViltrumPeptideStorefront';
import PaulRevereStorefront from './pages/public/PaulRevereStorefront';
import VitalityStorefront from './pages/public/VitalityStorefront';
import SandmanStorefront from './pages/public/SandmanStorefront';
import BlacklineStorefront from './pages/public/BlacklineStorefront';
import PeakVitalStorefront from './pages/public/PeakVitalStorefront';
import ThePLoungeStorefront from './pages/public/ThePLoungeStorefront';
import Login from './pages/public/Login';
import PatientSignup from './pages/public/PatientSignup';
import ReferralRedirect from './pages/public/ReferralRedirect';
import AuthCallback from './pages/public/AuthCallback';
import ResetPassword from './pages/public/ResetPassword';
import Library from './pages/public/Library';
import RepIntake from './pages/public/RepIntake';
import AactivatedRepApplication from './pages/public/AactivatedRepApplication';
import ProductConfidence from './pages/public/ProductConfidence';
import AactivatedOnboarding from './pages/rep/AactivatedOnboarding';
import AactivatedStarterKits from './pages/rep/AactivatedStarterKits';
import AactivatedApplicantPortal from './pages/applicant/AactivatedApplicantPortal';

const ROCKPHORM_CANONICAL_STORE_PATH = '/rx-plus/rockphorm';

function CanonicalAactivatedRoute({ element }: { element: ReactElement }) {
  const location = useLocation();
  const canonicalPath = location.pathname.replace(/^\/AACTIVATED\b/i, AACTIVATED_PATH);

  if (location.pathname !== canonicalPath) {
    return <Navigate to={`${canonicalPath}${location.search}${location.hash}`} replace />;
  }

  return element;
}

function AactivatedHomeRedirect() {
  const location = useLocation();
  return <Navigate to={`${AACTIVATED_PATH}${location.search}${location.hash}`} replace />;
}

function BossiquitLegacyAliasRedirect() {
  const location = useLocation();
  const { productSlug } = useParams<{ productSlug?: string }>();
  const productPath = productSlug ? `/product/${encodeURIComponent(productSlug)}` : '';
  return <Navigate to={`/aactivatedrx-pure${productPath}${location.search}${location.hash}`} replace />;
}

type AactivatedRepStoreLookup = {
  rep_slug: string | null;
  discount_code?: string | null;
  public_display_name?: string | null;
  rep_name?: string | null;
  promo_config?: { discount_code?: string | null } | null;
};

function PortalAwareHome() {
  const location = useLocation();
  const [rootReferralRedirect, setRootReferralRedirect] = useState<string | null>(null);
  const [checkingRootReferral, setCheckingRootReferral] = useState(false);

  useEffect(() => {
    if (location.pathname !== '/') return;
    const params = new URLSearchParams(location.search);
    const rawCode = params.get('rep') || params.get('ref') || params.get('referral');
    const normalizedCode = normalizeRootReferralCode(rawCode);
    if (!normalizedCode) {
      setRootReferralRedirect(null);
      setCheckingRootReferral(false);
      return;
    }

    const staticPortal = getPortalByCode(normalizedCode);
    if (staticPortal) {
      const referral = captureReferral(staticPortal, 'root_referral');
      updateManifestForReferral(referral);
      setRootReferralRedirect(getReferralStartPath(referral));
      setCheckingRootReferral(false);
      return;
    }

    let cancelled = false;
    setCheckingRootReferral(true);
    void resolveAactivatedRepReferral(normalizedCode).then((referral) => {
      if (cancelled) return;
      const resolvedReferral = referral ?? captureReferral(normalizedCode, 'root_referral');
      updateManifestForReferral(resolvedReferral);
      setRootReferralRedirect(getReferralStartPath(resolvedReferral));
      setCheckingRootReferral(false);
    });
    return () => { cancelled = true; };
  }, [location.pathname, location.search]);

  if (rootReferralRedirect) {
    return <Navigate to={rootReferralRedirect} replace />;
  }

  if (checkingRootReferral) {
    return <ReferralApplyingSplash />;
  }

  return <Home />;
}

function ReferralApplyingSplash() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--surface)' }}>
      <div style={{ textAlign: 'center' }}>
        <div className="spinner" style={{ margin: '0 auto 16px' }} />
        <div style={{ color: 'var(--text-muted)', fontWeight: 700 }}>Applying referral...</div>
      </div>
    </div>
  );
}

async function resolveAactivatedRepReferral(code: string): Promise<StoredReferral | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('aactivated_public_rep_stores')
    .select('rep_slug,discount_code,public_display_name,rep_name,promo_config')
    .eq('rep_slug', code)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as AactivatedRepStoreLookup;
  const repSlug = normalizeRootReferralCode(row.rep_slug) || code;
  const discountCode = normalizeRootReferralCode(row.discount_code || row.promo_config?.discount_code) || repSlug;
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

function normalizeRootReferralCode(value: string | null | undefined): string {
  return String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 32);
}

function ScopedPortalPage({ page }: { page: 'library' | 'mixing' | 'certificates' | 'privacy' | 'terms' | 'rep-intake' | 'product-confidence' }) {
  const { portalSlug, productSlug } = useParams<{ portalSlug?: string; productSlug?: string }>();
  const portal = getWhiteLabelPortal(portalSlug);

  if (!portal) return <Navigate to="/" replace />;

  switch (page) {
    case 'library':
      return <Library portalKey={portal.id} />;
    case 'mixing':
      return <PeptideCalculator portalKey={portal.id} key={productSlug ?? 'mixing'} />;
    case 'certificates':
      return <Certificates portalKey={portal.id} />;
    case 'privacy':
      return <Privacy portalKey={portal.id} />;
    case 'terms':
      return <Terms portalKey={portal.id} />;
    case 'rep-intake':
      return <RepIntake portalKey={portal.id} />;
    case 'product-confidence':
      return <ProductConfidence portalKey={portal.id} />;
    default:
      return <Navigate to={portal.path} replace />;
  }
}

function RockPhormStoreRedirect() {
  const { search, hash } = useLocation();
  return <Navigate to={`${ROCKPHORM_CANONICAL_STORE_PATH}${search}${hash}`} replace />;
}

function ScopedPortalLoginRedirect({ portalRole }: { portalRole?: 'patient' | 'rep' | 'admin' }) {
  const { portalSlug } = useParams<{ portalSlug?: string }>();
  const portal = getWhiteLabelPortal(portalSlug);
  if (!portal) return <Navigate to="/login" replace />;
  const role = portalRole ?? portal.backOfficePortal;
  return <Navigate to={buildPortalLoginPath(portal, role)} replace />;
}

function ScopedPortalSignupRedirect() {
  const { portalSlug } = useParams<{ portalSlug?: string }>();
  const portal = getWhiteLabelPortal(portalSlug);
  if (!portal) return <Navigate to="/patient/signup" replace />;
  return <Navigate to={buildPortalSignupPath(portal)} replace />;
}

// Patient pages
import PatientDashboard from './pages/patient/PatientDashboard';
import PatientProfile from './pages/patient/PatientProfile';
import PatientGoals from './pages/patient/PatientGoals';
import PatientWeightTracker from './pages/patient/PatientWeightTracker';
import PatientProgress from './pages/patient/PatientProgress';
import PatientSideEffects from './pages/patient/PatientSideEffects';
import PatientReferral from './pages/patient/PatientReferral';
import PatientPayments from './pages/patient/PatientPayments';
import PatientShipping from './pages/patient/PatientShipping';
import PatientDocuments from './pages/patient/PatientDocuments';
import PatientEducation from './pages/patient/PatientEducation';
import PatientNotifications from './pages/patient/PatientNotifications';
import HelpCenter from './pages/public/HelpCenter';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminCustomerActivity from './pages/admin/AdminCustomerActivity';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminExecutiveDiligence from './pages/admin/AdminExecutiveDiligence';
import AdminSubmissions from './pages/admin/AdminSubmissions';
import AdminSubmissionDetail from './pages/admin/AdminSubmissionDetail';
import AdminReps from './pages/admin/AdminReps';
import AdminPayouts from './pages/admin/AdminPayouts';
import AdminPaymentAudit from './pages/admin/AdminPaymentAudit';
import AdminScopeCodes from './pages/admin/AdminScopeCodes';
import AdminRepIntake from './pages/admin/AdminRepIntake';
import AdminAactivatedOnboarding from './pages/admin/AdminAactivatedOnboarding';
import AdminAactivatedDocuments from './pages/admin/AdminAactivatedDocuments';
import AdminAactivatedStarterKits from './pages/admin/AdminAactivatedStarterKits';
import AdminFulfillment from './pages/admin/AdminFulfillment';
import AdminProducts from './pages/admin/AdminProducts';
import AdminInventory from './pages/admin/AdminInventory';
import AdminProductIntelligence from './pages/admin/AdminProductIntelligence';
import AdminRxPlus from './pages/admin/AdminRxPlus';
import AdminAactivatedPromos from './pages/admin/AdminAactivatedPromos';
import AdminLeads from './pages/admin/AdminLeads';
import AdminZellePayments from './pages/admin/AdminZellePayments';
import AdminAactivatedPartnerTools from './pages/admin/AdminAactivatedPartnerTools';
import AdminRockPhorm from './pages/admin/AdminRockPhorm';
import AdminPartnerMarketing from './pages/admin/AdminPartnerMarketing';
import AdminVitality from './pages/admin/AdminVitality';
import AdminSandman from './pages/admin/AdminSandman';
import AdminBlackline from './pages/admin/AdminBlackline';
import AdminPartnerStore, { type PartnerStoreMode } from './pages/admin/AdminPartnerStore';

// Rep pages
import RepDashboard from './pages/rep/RepDashboard';

// Physician pages
import PhysicianCases from './pages/physician/PhysicianCases';
import PhysicianCaseDetail from './pages/physician/PhysicianCaseDetail';

// Fulfillment pages
import FulfillmentOrders from './pages/fulfillment/FulfillmentOrders';
import FulfillmentOrderDetail from './pages/fulfillment/FulfillmentOrderDetail';

function PlatformOrScopedAdminPage({ platform, scoped }: { platform: ReactElement; scoped: ReactElement }) {
  const { profile } = useAuth();
  if (isRockPhormAdmin(profile) || isGlowAdmin(profile)) return <Navigate to="/admin" replace />;
  if (isPlatformTenantAdmin(profile)) return platform;
  return isAactivatedScopedAdmin(profile) ? scoped : <Navigate to="/admin" replace />;
}

function AactivatedScopedAdminPage({ scoped, fallback }: { scoped: ReactElement; fallback: ReactElement }) {
  const { profile } = useAuth();
  return isAactivatedScopedAdmin(profile) ? scoped : fallback;
}

function RockPhormOrAdminPage({ rockphorm, fallback }: { rockphorm: ReactElement; fallback: ReactElement }) {
  const { profile } = useAuth();
  return isRockPhormAdmin(profile) || isGlowAdmin(profile) ? rockphorm : fallback;
}

function AdminHomePage() {
  const { profile } = useAuth();
  const tenant = getPartnerTenant(profile);
  if (tenant?.brandId === 'aactivated') return <AdminAactivatedPartnerTools mode="dashboard" />;
  if (tenant?.brandId === 'vitality') return <AdminVitality mode="dashboard" />;
  if (tenant?.brandId === 'sandman') return <AdminSandman mode="dashboard" />;
  if (tenant?.brandId === 'blackline') return <AdminBlackline mode="dashboard" />;
  if (isRockPhormAdmin(profile) || isGlowAdmin(profile)) return <AdminRockPhorm mode="dashboard" />;
  if (tenant) return <AdminPartnerStore mode="dashboard" />;
  if (profile?.role === 'rx_plus_admin') return <AdminAactivatedPartnerTools mode="dashboard" />;
  return <AdminDashboard />;
}

function isAactivatedScopedAdmin(profile: ReturnType<typeof useAuth>['profile']): boolean {
  return profile?.role === 'rx_plus_admin'
    || getPartnerTenant(profile)?.brandId === 'aactivated'
    || isAactivatedPartnerAdmin(profile);
}

function ProductIntelligenceAdminPage() {
  const { profile } = useAuth();
  return isProductIntelligenceAdmin(profile) ? <AdminProductIntelligence /> : <Navigate to="/admin" replace />;
}

function RepRequestsAdminPage() {
  const { profile } = useAuth();
  if (isRockPhormAdmin(profile) || isGlowAdmin(profile)) return <AdminRockPhorm mode="reps" />;
  return <AdminRepIntake />;
}

function AactivatedOnlyAdminToolPage({ element }: { element: ReactElement }) {
  const { profile } = useAuth();
  const tenant = getPartnerTenant(profile);
  return (isRockPhormAdmin(profile) || isGlowAdmin(profile) || (tenant && tenant.brandId !== 'aactivated')) ? <Navigate to="/admin" replace /> : element;
}

function PartnerMarketingAdminPage() {
  const { profile } = useAuth();
  return isPlatformTenantAdmin(profile) || partnerCan(profile, 'marketing') ? <AdminPartnerMarketing /> : <Navigate to="/admin" replace />;
}

function VitalityOrAdminPage({ mode, fallback }: { mode: 'orders' | 'customers' | 'analytics' | 'products' | 'store-settings'; fallback: ReactElement }) {
  const { profile } = useAuth();
  return getPartnerTenant(profile)?.brandId === 'vitality' ? <AdminVitality mode={mode} /> : fallback;
}

function SandmanOrAdminPage({ mode, fallback }: { mode: 'orders' | 'customers' | 'analytics' | 'reports' | 'products' | 'pricing' | 'discounts' | 'reps' | 'inventory' | 'store-settings'; fallback: ReactElement }) {
  const { profile } = useAuth();
  const tenant = getPartnerTenant(profile);
  if (tenant?.brandId === 'sandman') return <AdminSandman mode={mode} />;
  if (tenant?.brandId === 'blackline') return <AdminBlackline mode={mode} />;
  if (tenant && !['aactivated', 'vitality'].includes(tenant.brandId) && !isRockPhormAdmin(profile) && !isGlowAdmin(profile)) {
    return <AdminPartnerStore mode={mode as PartnerStoreMode} />;
  }
  return fallback;
}

function FinancialAdminPage({ element }: { element: ReactElement }) {
  const { profile } = useAuth();
  const tenant = getPartnerTenant(profile);
  if (tenant && !partnerCan(profile, 'payouts')) return <Navigate to="/admin" replace />;
  return element;
}

function VitalityBlockedAdminPage({ element }: { element: ReactElement }) {
  const { profile } = useAuth();
  return getPartnerTenant(profile)?.brandId === 'vitality' ? <Navigate to="/admin" replace /> : element;
}

export default function App() {
  const isStaging = import.meta.env.VITE_APP_ENV === 'staging';
  return (
    <ErrorBoundary>
      <BrowserRouter>
        {isStaging && (
          <div
            role="status"
            aria-label="Staging environment"
            style={{ position: 'fixed', right: 12, bottom: 12, zIndex: 10000, padding: '7px 11px', borderRadius: 6, background: '#7c2d12', color: '#fff', fontSize: 12, fontWeight: 900, letterSpacing: '.08em', boxShadow: '0 4px 16px rgba(0,0,0,.25)' }}
          >
            STAGING
          </div>
        )}
        <RoutePrivacyMetadata />
        <FreeBacWaterBanner />
        <AuthProvider>
          <Routes>
          {/* Public */}
          <Route path="/"             element={<PortalAwareHome />} />
          <Route path="/start"        element={<Start />} />
          <Route path="/checkout"     element={<Start />} />
          <Route path="/submitted"    element={<Submitted />} />
          <Route path="/pay/:id"      element={<PaymentPage />} />
          <Route path="/reta-waitlist" element={<Navigate to="/start" replace />} />
          <Route path="/privacy"        element={<Privacy />} />
          <Route path="/terms"          element={<Terms />} />
          <Route path="/certificates"   element={<Certificates />} />
          <Route path="/aactivated/privacy" element={<CanonicalAactivatedRoute element={<Privacy portalKey="aactivated" />} />} />
          <Route path="/aactivated/terms" element={<CanonicalAactivatedRoute element={<Terms portalKey="aactivated" />} />} />
          <Route path="/aactivated/certificates" element={<CanonicalAactivatedRoute element={<Certificates portalKey="aactivated" />} />} />
          <Route path="/AACTIVATED/privacy" element={<CanonicalAactivatedRoute element={<Privacy portalKey="aactivated" />} />} />
          <Route path="/AACTIVATED/terms" element={<CanonicalAactivatedRoute element={<Terms portalKey="aactivated" />} />} />
          <Route path="/AACTIVATED/certificates" element={<CanonicalAactivatedRoute element={<Certificates portalKey="aactivated" />} />} />
          <Route path="/alphapride/privacy" element={<Privacy portalKey="alphapride" />} />
          <Route path="/alphapride/terms" element={<Terms portalKey="alphapride" />} />
          <Route path="/alphapride/certificates" element={<Certificates portalKey="alphapride" />} />
          <Route path="/ronin/privacy" element={<Privacy portalKey="ronin" />} />
          <Route path="/ronin/terms" element={<Terms portalKey="ronin" />} />
          <Route path="/ronin/certificates" element={<Certificates portalKey="ronin" />} />
          <Route path="/agprimelab/privacy" element={<Privacy portalKey="agprime" />} />
          <Route path="/agprimelab/terms" element={<Terms portalKey="agprime" />} />
          <Route path="/agprimelab/certificates" element={<Certificates portalKey="agprime" />} />
          <Route path="/vyigenix/privacy" element={<Privacy portalKey="vyigenix" />} />
          <Route path="/vyigenix/terms" element={<Terms portalKey="vyigenix" />} />
          <Route path="/vyigenix/certificates" element={<Certificates portalKey="vyigenix" />} />
          <Route path="/rockphorm/privacy" element={<Privacy portalKey="rockphorm" />} />
          <Route path="/rockphorm/terms" element={<Terms portalKey="rockphorm" />} />
          <Route path="/rockphorm/certificates" element={<Certificates portalKey="rockphorm" />} />
          <Route path="/zenora/privacy" element={<Privacy portalKey="zenora" />} />
          <Route path="/zenora/terms" element={<Terms portalKey="zenora" />} />
          <Route path="/zenora/certificates" element={<Certificates portalKey="zenora" />} />
          <Route path="/peptide-calculator" element={<PeptideCalculator />} />
          <Route path="/mixing" element={<PeptideCalculator />} />
          <Route path="/mixing/:productSlug" element={<PeptideCalculator />} />
          <Route path="/help" element={<HelpCenter />} />
          <Route path="/aactivated/mixing" element={<CanonicalAactivatedRoute element={<PeptideCalculator portalKey="aactivated" />} />} />
          <Route path="/aactivated/mixing/:productSlug" element={<CanonicalAactivatedRoute element={<PeptideCalculator portalKey="aactivated" />} />} />
          <Route path="/AACTIVATED/mixing" element={<CanonicalAactivatedRoute element={<PeptideCalculator portalKey="aactivated" />} />} />
          <Route path="/AACTIVATED/mixing/:productSlug" element={<CanonicalAactivatedRoute element={<PeptideCalculator portalKey="aactivated" />} />} />
          <Route path="/library" element={<Library />} />
          <Route path="/aactivated/library" element={<CanonicalAactivatedRoute element={<Library portalKey="aactivated" />} />} />
          <Route path="/aactivated/product-library" element={<CanonicalAactivatedRoute element={<Library portalKey="aactivated" />} />} />
          <Route path="/AACTIVATED/library" element={<CanonicalAactivatedRoute element={<Library portalKey="aactivated" />} />} />
          <Route path="/AACTIVATED/product-library" element={<CanonicalAactivatedRoute element={<Library portalKey="aactivated" />} />} />
          <Route path="/aactivated/products" element={<Navigate to="/aactivated#aactivated-top-sellers" replace />} />
          <Route path="/aactivated/top-sellers" element={<Navigate to="/aactivated#aactivated-top-sellers" replace />} />
          <Route path="/AACTIVATED/products" element={<Navigate to="/aactivated#aactivated-top-sellers" replace />} />
          <Route path="/AACTIVATED/top-sellers" element={<Navigate to="/aactivated#aactivated-top-sellers" replace />} />
          <Route path="/rep-intake" element={<RepIntake />} />
          <Route path="/start-rep" element={<RepIntake />} />
          <Route path="/aactivated/rep-intake" element={<CanonicalAactivatedRoute element={<AactivatedRepApplication />} />} />
          <Route path="/aactivated/start-rep" element={<CanonicalAactivatedRoute element={<AactivatedRepApplication />} />} />
          <Route path="/aactivated/approval" element={<CanonicalAactivatedRoute element={<AactivatedRepApplication />} />} />
          <Route path="/aactivated/apply" element={<CanonicalAactivatedRoute element={<AactivatedRepApplication />} />} />
          <Route path="/AACTIVATED/rep-intake" element={<CanonicalAactivatedRoute element={<AactivatedRepApplication />} />} />
          <Route path="/AACTIVATED/start-rep" element={<CanonicalAactivatedRoute element={<AactivatedRepApplication />} />} />
          <Route path="/AACTIVATED/approval" element={<CanonicalAactivatedRoute element={<AactivatedRepApplication />} />} />
          <Route path="/AACTIVATED/apply" element={<CanonicalAactivatedRoute element={<AactivatedRepApplication />} />} />
          <Route path="/beastmode/rep" element={<ScopedPortalLoginRedirect portalRole="rep" />} />
          <Route path="/beastmode/rep-login" element={<ScopedPortalLoginRedirect portalRole="rep" />} />
          <Route path="/beastmode/rep-intake" element={<Navigate to="/beastmode" replace />} />
          <Route path="/beastmode/start-rep" element={<Navigate to="/beastmode" replace />} />
          <Route path="/beastmode/approval" element={<Navigate to="/beastmode" replace />} />
          <Route path="/beastmode/apply" element={<Navigate to="/beastmode" replace />} />
          <Route path="/product-confidence" element={<ProductConfidence />} />
          <Route path="/aactivated/product-confidence" element={<CanonicalAactivatedRoute element={<ProductConfidence portalKey="aactivated" />} />} />
          <Route path="/aactivated/quality" element={<CanonicalAactivatedRoute element={<ProductConfidence portalKey="aactivated" />} />} />
          <Route path="/aactivated/verification" element={<CanonicalAactivatedRoute element={<ProductConfidence portalKey="aactivated" />} />} />
          <Route path="/AACTIVATED/product-confidence" element={<CanonicalAactivatedRoute element={<ProductConfidence portalKey="aactivated" />} />} />
          <Route path="/AACTIVATED/quality" element={<CanonicalAactivatedRoute element={<ProductConfidence portalKey="aactivated" />} />} />
          <Route path="/AACTIVATED/verification" element={<CanonicalAactivatedRoute element={<ProductConfidence portalKey="aactivated" />} />} />
          <Route path="/:portalSlug/privacy" element={<ScopedPortalPage page="privacy" />} />
          <Route path="/:portalSlug/terms" element={<ScopedPortalPage page="terms" />} />
          <Route path="/:portalSlug/certificates" element={<ScopedPortalPage page="certificates" />} />
          <Route path="/:portalSlug/library" element={<ScopedPortalPage page="library" />} />
          <Route path="/:portalSlug/product-library" element={<ScopedPortalPage page="library" />} />
          <Route path="/:portalSlug/mixing" element={<ScopedPortalPage page="mixing" />} />
          <Route path="/:portalSlug/mixing/:productSlug" element={<ScopedPortalPage page="mixing" />} />
          <Route path="/:portalSlug/rep-intake" element={<ScopedPortalPage page="rep-intake" />} />
          <Route path="/:portalSlug/start-rep" element={<ScopedPortalPage page="rep-intake" />} />
          <Route path="/:portalSlug/approval" element={<ScopedPortalPage page="rep-intake" />} />
          <Route path="/:portalSlug/apply" element={<ScopedPortalPage page="rep-intake" />} />
          <Route path="/:portalSlug/product-confidence" element={<ScopedPortalPage page="product-confidence" />} />
          <Route path="/:portalSlug/quality" element={<ScopedPortalPage page="product-confidence" />} />
          <Route path="/:portalSlug/verification" element={<ScopedPortalPage page="product-confidence" />} />
          <Route path="/:portalSlug/login" element={<ScopedPortalLoginRedirect />} />
          <Route path="/:portalSlug/customer" element={<ScopedPortalLoginRedirect portalRole="patient" />} />
          <Route path="/:portalSlug/customer-login" element={<ScopedPortalLoginRedirect portalRole="patient" />} />
          <Route path="/:portalSlug/admin" element={<ScopedPortalLoginRedirect portalRole="admin" />} />
          <Route path="/:portalSlug/admin-login" element={<ScopedPortalLoginRedirect portalRole="admin" />} />
          <Route path="/:portalSlug/rep" element={<ScopedPortalLoginRedirect portalRole="rep" />} />
          <Route path="/:portalSlug/rep-login" element={<ScopedPortalLoginRedirect portalRole="rep" />} />
          <Route path="/:portalSlug/signup" element={<ScopedPortalSignupRedirect />} />
          <Route path="/:portalSlug/register" element={<ScopedPortalSignupRedirect />} />
          <Route path="/rx-plus" element={<RxPlusLanding />} />
          <Route path="/rx-plus/EHWSUB" element={<Navigate to="/radiance" replace />} />
          <Route path="/rx-plus/ehwsub" element={<Navigate to="/radiance" replace />} />
          <Route path="/rx-plus/:distributorSlug" element={<RxPlusDistributorPortal />} />
          <Route path="/login"        element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/patient/signup" element={<PatientSignup />} />
          <Route path="/rick" element={<RockPhormStoreRedirect />} />
          <Route path="/rickdiaz" element={<RockPhormStoreRedirect />} />
          <Route path="/rick50" element={<RockPhormStoreRedirect />} />
          <Route path="/rock-phorm" element={<RockPhormStoreRedirect />} />
          <Route path="/RockPhorm" element={<RockPhormStoreRedirect />} />
          <Route path="/Rockphorm" element={<RockPhormStoreRedirect />} />
          <Route path="/EmpireHealth&Wellness" element={<RxPlusDistributorPortal />} />
          <Route path="/empirehealth" element={<Navigate to="/EmpireHealth&Wellness" replace />} />
          <Route path="/radiance" element={<RadianceStorefront />} />
          <Route path="/EHWSUB" element={<Navigate to="/radiance" replace />} />
          <Route path="/ehwsub" element={<Navigate to="/radiance" replace />} />
          <Route path="/warxlabz" element={<RxPlusDistributorPortal />} />
          <Route path="/mark" element={<ReferralRedirect />} />
          <Route path="/dennis" element={<Navigate to="/viltrumpeptide" replace />} />
          <Route path="/gabriel" element={<ReferralRedirect />} />
          <Route path="/jerry" element={<ReferralRedirect />} />
          <Route path="/optimax-peptide-therapy" element={<RxPlusDistributorPortal />} />
          <Route path="/AACTIVATED" element={<CanonicalAactivatedRoute element={<RxPlusDistributorPortal />} />} />
          <Route path="/aactivated" element={<CanonicalAactivatedRoute element={<RxPlusDistributorPortal />} />} />
          <Route path="/AACTIVATED/product/:productSlug" element={<CanonicalAactivatedRoute element={<RxPlusDistributorPortal />} />} />
          <Route path="/aactivated/product/:productSlug" element={<CanonicalAactivatedRoute element={<RxPlusDistributorPortal />} />} />
          <Route path="/AACTIVATEDRX-PURE" element={<RxPlusDistributorPortal />} />
          <Route path="/aactivatedrx-pure" element={<RxPlusDistributorPortal />} />
          <Route path="/AACTIVATEDRX-PURE/product/:productSlug" element={<RxPlusDistributorPortal />} />
          <Route path="/aactivatedrx-pure/product/:productSlug" element={<RxPlusDistributorPortal />} />
          <Route path="/AACTIVATEDRX-PURE/*" element={<RxPlusDistributorPortal />} />
          <Route path="/aactivatedrx-pure/*" element={<RxPlusDistributorPortal />} />
          <Route path="/RXAACTIVATED" element={<BossiquitLegacyAliasRedirect />} />
          <Route path="/rxaactivated" element={<BossiquitLegacyAliasRedirect />} />
          <Route path="/RXAACTIVATED/product/:productSlug" element={<BossiquitLegacyAliasRedirect />} />
          <Route path="/rxaactivated/product/:productSlug" element={<BossiquitLegacyAliasRedirect />} />
          <Route path="/RXAACTIVATED/*" element={<BossiquitLegacyAliasRedirect />} />
          <Route path="/rxaactivated/*" element={<BossiquitLegacyAliasRedirect />} />
          <Route path="/AACTIVATEDRX" element={<AactivatedHomeRedirect />} />
          <Route path="/aactivatedrx" element={<AactivatedHomeRedirect />} />
          <Route path="/AACTIVATED/*" element={<CanonicalAactivatedRoute element={<AactivatedHomeRedirect />} />} />
          <Route path="/aactivated/*" element={<CanonicalAactivatedRoute element={<AactivatedHomeRedirect />} />} />
          <Route path="/guy" element={<RxPlusDistributorPortal />} />
          <Route path="/peakform" element={<RxPlusDistributorPortal />} />
          <Route path="/alphapride" element={<RxPlusDistributorPortal />} />
          <Route path="/ronin" element={<RxPlusDistributorPortal />} />
          <Route path="/agprimelab" element={<RxPlusDistributorPortal />} />
          <Route path="/vyigenix" element={<RxPlusDistributorPortal />} />
          <Route path="/rockphorm" element={<RockPhormStoreRedirect />} />
          <Route path="/rockphorm/*" element={<RockPhormStoreRedirect />} />
          <Route path="/aurora" element={<RxPlusDistributorPortal />} />
          <Route path="/auroralabs" element={<RxPlusDistributorPortal />} />
          <Route path="/auroraJL" element={<RxPlusDistributorPortal />} />
          <Route path="/aurorajl" element={<RxPlusDistributorPortal />} />
          <Route path="/auroraMD" element={<RxPlusDistributorPortal />} />
          <Route path="/auroramd" element={<RxPlusDistributorPortal />} />
          <Route path="/auroraDD" element={<RxPlusDistributorPortal />} />
          <Route path="/auroradd" element={<RxPlusDistributorPortal />} />
          <Route path="/auroraET" element={<RxPlusDistributorPortal />} />
          <Route path="/auroraet" element={<RxPlusDistributorPortal />} />
          <Route path="/auroraTO" element={<RxPlusDistributorPortal />} />
          <Route path="/aurorato" element={<RxPlusDistributorPortal />} />
          <Route path="/auroraGE" element={<RxPlusDistributorPortal />} />
          <Route path="/aurorage" element={<RxPlusDistributorPortal />} />
          <Route path="/aurora/McCall" element={<RxPlusDistributorPortal />} />
          <Route path="/aurora/mccall" element={<RxPlusDistributorPortal />} />
          <Route path="/auroraRM" element={<RxPlusDistributorPortal />} />
          <Route path="/aurorarm" element={<RxPlusDistributorPortal />} />
          <Route path="/auroraEW" element={<RxPlusDistributorPortal />} />
          <Route path="/auroraew" element={<RxPlusDistributorPortal />} />
          <Route path="/MegDel" element={<RxPlusDistributorPortal />} />
          <Route path="/megdel" element={<RxPlusDistributorPortal />} />
          <Route path="/aurora-labs/Duffy" element={<RxPlusDistributorPortal />} />
          <Route path="/aurora labs/Duffy" element={<RxPlusDistributorPortal />} />
          <Route path="/zenora" element={<RxPlusDistributorPortal />} />
          <Route path="/PhysioPeptides" element={<RxPlusDistributorPortal />} />
          <Route path="/physiopeptides" element={<RxPlusDistributorPortal />} />
          <Route path="/ginto" element={<RxPlusDistributorPortal />} />
          <Route path="/ginto-wellness-labs" element={<RxPlusDistributorPortal />} />
          <Route path="/beastmode" element={<RxPlusDistributorPortal />} />
          <Route path="/beastmode-performance-labs" element={<RxPlusDistributorPortal />} />
          <Route path="/viltrumpeptide" element={<ViltrumPeptideStorefront />} />
          <Route path="/viltrum-peptide" element={<Navigate to="/viltrumpeptide" replace />} />
          <Route path="/glow" element={<GlowStorefront />} />
          <Route path="/glow-sheer-radiance" element={<Navigate to="/glow" replace />} />
          <Route path="/klow" element={<KlowStorefront />} />
          <Route path="/klow-recovery-radiance" element={<Navigate to="/klow" replace />} />
          <Route path="/paulrevere" element={<PaulRevereStorefront />} />
          <Route path="/paulreverepeptides" element={<Navigate to="/paulrevere" replace />} />
          <Route path="/vitality" element={<VitalityStorefront />} />
          <Route path="/vitalityinstitutelabs" element={<Navigate to="/vitality" replace />} />
          <Route path="/sandman" element={<SandmanStorefront />} />
          <Route path="/sandmanwellnesslabs" element={<Navigate to="/sandman" replace />} />
          <Route path="/sandman-wellness-labs" element={<Navigate to="/sandman" replace />} />
          <Route path="/blackline" element={<BlacklineStorefront />} />
          <Route path="/blacklinepeptides" element={<Navigate to="/blackline" replace />} />
          <Route path="/blackline-peptides" element={<Navigate to="/blackline" replace />} />
          <Route path="/PeakVital" element={<PeakVitalStorefront />} />
          <Route path="/peakvital" element={<PeakVitalStorefront />} />
          <Route path="/peak-vital" element={<Navigate to="/PeakVital" replace />} />
          <Route path="/peak-vital-peptides" element={<Navigate to="/PeakVital" replace />} />
          <Route path="/the-p-lounge" element={<ThePLoungeStorefront />} />
          <Route path="/theplounge" element={<Navigate to="/the-p-lounge" replace />} />
          <Route path="/p-lounge" element={<Navigate to="/the-p-lounge" replace />} />
          <Route path="/plounge" element={<Navigate to="/the-p-lounge" replace />} />
          <Route path="/anatolia" element={<RxPlusDistributorPortal />} />
          <Route path="/turkiye" element={<RxPlusDistributorPortal />} />
          <Route path="/anatoliawellness" element={<RxPlusDistributorPortal />} />
          <Route path="/anatolia-wellness-labs" element={<RxPlusDistributorPortal />} />
          <Route path="/r/:code" element={<ReferralRedirect />} />

          {/* Patient */}
          <Route element={<ProtectedRoute roles={['patient']} />}>
            <Route path="/patient"          element={<PatientDashboard />} />
            <Route path="/patient/profile"  element={<PatientProfile />} />
            <Route path="/patient/goals"    element={<PatientGoals />} />
            <Route path="/patient/weight"   element={<PatientWeightTracker />} />
            <Route path="/patient/progress"      element={<PatientProgress />} />
            <Route path="/patient/side-effects"  element={<PatientSideEffects />} />
            <Route path="/patient/referral"       element={<PatientReferral />} />
            <Route path="/patient/payments"       element={<PatientPayments />} />
            <Route path="/patient/shipping"       element={<PatientShipping />} />
            <Route path="/patient/documents"      element={<PatientDocuments />} />
            <Route path="/patient/education"      element={<PatientEducation />} />
            <Route path="/patient/notifications" element={<PatientNotifications />} />
          </Route>

          {/* Admin + scoped PepScriptRX+ admin */}
          <Route element={<ProtectedRoute roles={['admin', 'rx_plus_admin']} />}>
            <Route path="/admin"                        element={<AdminHomePage />} />
            <Route path="/admin/submissions"            element={<SandmanOrAdminPage mode="orders" fallback={<VitalityOrAdminPage mode="orders" fallback={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="orders" />} fallback={<AactivatedScopedAdminPage scoped={<AdminAactivatedPartnerTools mode="dashboard" />} fallback={<AdminSubmissions />} />} />} />} />} />
            <Route path="/admin/analytics"             element={<SandmanOrAdminPage mode="analytics" fallback={<VitalityOrAdminPage mode="analytics" fallback={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="dashboard" />} fallback={<AactivatedScopedAdminPage scoped={<AdminAactivatedPartnerTools mode="dashboard" />} fallback={<AdminAnalytics />} />} />} />} />} />
            <Route path="/admin/executive-diligence"   element={<AdminExecutiveDiligence />} />
            <Route path="/admin/submissions/:id"        element={<VitalityBlockedAdminPage element={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="orders" />} fallback={<AactivatedScopedAdminPage scoped={<Navigate to="/admin" replace />} fallback={<AdminSubmissionDetail />} />} />} />} />
            <Route path="/admin/reps"                   element={<SandmanOrAdminPage mode="reps" fallback={<VitalityBlockedAdminPage element={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="reps" />} fallback={<AactivatedScopedAdminPage scoped={<AdminAactivatedPartnerTools mode="rep-store-manager" />} fallback={<AdminReps />} />} />} />} />} />
            <Route path="/admin/fulfillment"            element={<PlatformOrScopedAdminPage platform={<AdminFulfillment />} scoped={<Navigate to="/admin" replace />} />} />
            <Route path="/admin/products"               element={<SandmanOrAdminPage mode="products" fallback={<VitalityOrAdminPage mode="products" fallback={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="products" />} fallback={<PlatformOrScopedAdminPage platform={<AdminProducts />} scoped={<AdminAactivatedPartnerTools mode="pricing" />} />} />} />} />} />
            <Route path="/admin/inventory"              element={<SandmanOrAdminPage mode="inventory" fallback={<PlatformOrScopedAdminPage platform={<AdminInventory />} scoped={<Navigate to="/admin" replace />} />} />} />
            <Route path="/admin/product-intelligence"    element={<Navigate to="/admin/operations/product-intelligence" replace />} />
            <Route path="/admin/operations/product-intelligence" element={<ProductIntelligenceAdminPage />} />
            <Route path="/admin/rx-plus"                element={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="products" />} fallback={<AactivatedScopedAdminPage scoped={<AdminAactivatedPartnerTools mode="dashboard" />} fallback={<AdminRxPlus />} />} />} />
            <Route path="/admin/aactivated-promos"      element={<SandmanOrAdminPage mode="discounts" fallback={<VitalityBlockedAdminPage element={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="discounts" />} fallback={<PlatformOrScopedAdminPage platform={<AdminAactivatedPromos />} scoped={<AdminAactivatedPromos />} />} />} />} />} />
            <Route path="/admin/rep-intake"             element={<Navigate to="/admin/rep-requests" replace />} />
            <Route path="/admin/rep-approval-center"    element={<Navigate to="/admin/rep-requests" replace />} />
            <Route path="/admin/rep-requests"           element={<VitalityBlockedAdminPage element={<RepRequestsAdminPage />} />} />
            <Route path="/admin/rep-onboarding"         element={<AactivatedOnlyAdminToolPage element={<AdminAactivatedOnboarding />} />} />
            <Route path="/admin/rep-documents"          element={<AactivatedOnlyAdminToolPage element={<AdminAactivatedDocuments />} />} />
            <Route path="/admin/starter-kits"          element={<AactivatedOnlyAdminToolPage element={<AdminAactivatedStarterKits />} />} />
            <Route path="/admin/leads"                  element={<SandmanOrAdminPage mode="customers" fallback={<VitalityOrAdminPage mode="customers" fallback={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="customers" />} fallback={<AactivatedScopedAdminPage scoped={<AdminAactivatedPartnerTools mode="customer" />} fallback={<AdminLeads />} />} />} />} />} />
            <Route path="/admin/pricing"                element={<SandmanOrAdminPage mode="pricing" fallback={<VitalityBlockedAdminPage element={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="pricing" />} fallback={<AdminAactivatedPartnerTools mode="pricing" />} />} />} />} />
            <Route path="/admin/commission-center"      element={<SandmanOrAdminPage mode="reports" fallback={<FinancialAdminPage element={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="commission" />} fallback={<AdminAactivatedPartnerTools mode="commission" />} />} />} />} />
            <Route path="/admin/rep-store-manager"      element={<SandmanOrAdminPage mode="reps" fallback={<VitalityBlockedAdminPage element={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="reps" />} fallback={<AdminAactivatedPartnerTools mode="rep-store-manager" />} />} />} />} />
            <Route path="/admin/product-lists"          element={<SandmanOrAdminPage mode="products" fallback={<VitalityBlockedAdminPage element={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="products" />} fallback={<AdminAactivatedPartnerTools mode="product-lists" />} />} />} />} />
            <Route path="/admin/feature-requests"       element={<AactivatedOnlyAdminToolPage element={<AdminAactivatedPartnerTools mode="feature-requests" />} />} />
            <Route path="/admin/rep-performance"        element={<SandmanOrAdminPage mode="reports" fallback={<VitalityBlockedAdminPage element={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="reps" />} fallback={<AdminAactivatedPartnerTools mode="leaderboard" />} />} />} />} />
            <Route path="/admin/customer-activity"      element={<SandmanOrAdminPage mode="customers" fallback={<VitalityBlockedAdminPage element={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="customers" />} fallback={<PlatformOrScopedAdminPage platform={<AdminCustomerActivity />} scoped={<AdminAactivatedPartnerTools mode="customer" />} />} />} />} />} />
            <Route path="/admin/product-performance"    element={<SandmanOrAdminPage mode="analytics" fallback={<VitalityBlockedAdminPage element={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="products" />} fallback={<AdminAactivatedPartnerTools mode="product" />} />} />} />} />
            <Route path="/admin/store-settings"         element={<SandmanOrAdminPage mode="store-settings" fallback={<VitalityOrAdminPage mode="store-settings" fallback={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="store-settings" />} fallback={<AdminAactivatedPartnerTools mode="store-settings" />} />} />} />} />
            <Route path="/admin/marketing-assets"       element={<PartnerMarketingAdminPage />} />
            <Route path="/admin/payouts"                element={<FinancialAdminPage element={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="commission" />} fallback={<PlatformOrScopedAdminPage platform={<AdminPayouts />} scoped={<AdminAactivatedPartnerTools mode="payouts" />} />} />} />} />
            <Route path="/admin/payment-audit"          element={<PlatformOrScopedAdminPage platform={<AdminPaymentAudit />} scoped={<AdminAactivatedPartnerTools mode="payment-audit" />} />} />
            <Route path="/admin/scope-codes"            element={<PlatformOrScopedAdminPage platform={<AdminScopeCodes />} scoped={<AdminAactivatedPartnerTools mode="scope-codes" />} />} />
            <Route path="/admin/zelle-payments"         element={<PlatformOrScopedAdminPage platform={<AdminZellePayments />} scoped={<AdminAactivatedPartnerTools mode="zelle" />} />} />
          </Route>

          {/* AACTIVATED applicant */}
          <Route element={<ProtectedRoute roles={['rep_applicant']} exact />}>
            <Route path="/applicant" element={<AactivatedApplicantPortal />} />
          </Route>

          {/* Approved applicants complete onboarding before full rep activation. */}
          <Route element={<ProtectedRoute roles={['rep', 'rep_applicant']} />}>
            <Route path="/rep/onboarding" element={<AactivatedOnboarding />} />
          </Route>

          {/* Rep */}
          <Route element={<ProtectedRoute roles={['rep']} />}>
            <Route element={<AactivatedRepAccessGate />}>
              <Route path="/rep"           element={<RepDashboard />} />
              <Route path="/rep/dashboard" element={<RepDashboard />} />
              <Route path="/rep/starter-kits" element={<AactivatedStarterKits />} />
            </Route>
          </Route>

          {/* Physician */}
          <Route element={<ProtectedRoute roles={['physician']} />}>
            <Route path="/physician"          element={<PhysicianCases />} />
            <Route path="/physician/cases"    element={<PhysicianCases />} />
            <Route path="/physician/cases/:id" element={<PhysicianCaseDetail />} />
          </Route>

          {/* Fulfillment */}
          <Route element={<ProtectedRoute roles={['fulfillment']} />}>
            <Route path="/fulfillment"             element={<FulfillmentOrders />} />
            <Route path="/fulfillment/orders"      element={<FulfillmentOrders />} />
            <Route path="/fulfillment/orders/:id"  element={<FulfillmentOrderDetail />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

function RoutePrivacyMetadata() {
  const { pathname } = useLocation();
  useEffect(() => {
    const privatePrefixes = ['/start', '/checkout', '/submitted', '/pay/', '/login', '/auth/', '/reset-password', '/patient', '/rep', '/admin', '/physician', '/fulfillment'];
    const noIndex = privatePrefixes.some((prefix) => pathname.toLowerCase().startsWith(prefix));
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    robots.content = noIndex ? 'noindex,nofollow,noarchive' : 'index,follow,max-image-preview:large';
  }, [pathname]);
  return null;
}
