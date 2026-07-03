import type { ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigationType, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ErrorBoundary from './components/ErrorBoundary';
import ProtectedRoute from './components/ProtectedRoute';
import { buildPortalLoginPath, buildPortalSignupPath, getWhiteLabelPortal } from './config/whiteLabelPortals';
import { restoreActiveStoreContext } from './lib/storeContext';
import { isRockPhormAdmin } from './lib/rockPhormScope';
import { isGlowAdmin } from './lib/glowScope';
import { isProductIntelligenceAdmin } from './lib/productIntelligenceAccess';

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
import Login from './pages/public/Login';
import PatientSignup from './pages/public/PatientSignup';
import ReferralRedirect from './pages/public/ReferralRedirect';
import AuthCallback from './pages/public/AuthCallback';
import ResetPassword from './pages/public/ResetPassword';
import Library from './pages/public/Library';
import RepIntake from './pages/public/RepIntake';
import ProductConfidence from './pages/public/ProductConfidence';

const ACTIVE_PORTAL_PATH_KEY = 'pepscriptrx_active_portal_path';

function CanonicalAactivatedRoute({ element }: { element: ReactElement }) {
  const location = useLocation();
  const canonicalPath = location.pathname.replace(/^\/aactivated\b/i, '/AACTIVATED');

  if (location.pathname !== canonicalPath) {
    return <Navigate to={`${canonicalPath}${location.search}${location.hash}`} replace />;
  }

  return element;
}

function PortalAwareHome() {
  const navigationType = useNavigationType();
  const activePortalPath = restoreActiveStoreContext()?.homePath
    || (typeof window !== 'undefined'
      ? window.sessionStorage.getItem(ACTIVE_PORTAL_PATH_KEY)
      : null);

  if (navigationType === 'POP' && activePortalPath && activePortalPath !== '/') {
    return <Navigate to={activePortalPath} replace />;
  }

  return <Home />;
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

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminSubmissions from './pages/admin/AdminSubmissions';
import AdminSubmissionDetail from './pages/admin/AdminSubmissionDetail';
import AdminReps from './pages/admin/AdminReps';
import AdminPayouts from './pages/admin/AdminPayouts';
import AdminPaymentAudit from './pages/admin/AdminPaymentAudit';
import AdminScopeCodes from './pages/admin/AdminScopeCodes';
import AdminRepIntake from './pages/admin/AdminRepIntake';
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
  return profile?.role === 'rx_plus_admin' ? scoped : platform;
}

function RockPhormOrAdminPage({ rockphorm, fallback }: { rockphorm: ReactElement; fallback: ReactElement }) {
  const { profile } = useAuth();
  return isRockPhormAdmin(profile) || isGlowAdmin(profile) ? rockphorm : fallback;
}

function AdminHomePage() {
  const { profile } = useAuth();
  if (isRockPhormAdmin(profile) || isGlowAdmin(profile)) return <AdminRockPhorm mode="dashboard" />;
  if (profile?.role === 'rx_plus_admin') return <AdminAactivatedPartnerTools mode="dashboard" />;
  return <AdminDashboard />;
}

function ProductIntelligenceAdminPage() {
  const { profile } = useAuth();
  return isProductIntelligenceAdmin(profile) ? <AdminProductIntelligence /> : <Navigate to="/admin" replace />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
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
          <Route path="/aactivated/mixing" element={<CanonicalAactivatedRoute element={<PeptideCalculator portalKey="aactivated" />} />} />
          <Route path="/aactivated/mixing/:productSlug" element={<CanonicalAactivatedRoute element={<PeptideCalculator portalKey="aactivated" />} />} />
          <Route path="/AACTIVATED/mixing" element={<CanonicalAactivatedRoute element={<PeptideCalculator portalKey="aactivated" />} />} />
          <Route path="/AACTIVATED/mixing/:productSlug" element={<CanonicalAactivatedRoute element={<PeptideCalculator portalKey="aactivated" />} />} />
          <Route path="/library" element={<Library />} />
          <Route path="/aactivated/library" element={<CanonicalAactivatedRoute element={<Library portalKey="aactivated" />} />} />
          <Route path="/aactivated/product-library" element={<CanonicalAactivatedRoute element={<Library portalKey="aactivated" />} />} />
          <Route path="/AACTIVATED/library" element={<CanonicalAactivatedRoute element={<Library portalKey="aactivated" />} />} />
          <Route path="/AACTIVATED/product-library" element={<CanonicalAactivatedRoute element={<Library portalKey="aactivated" />} />} />
          <Route path="/aactivated/products" element={<Navigate to="/AACTIVATED#aactivated-top-sellers" replace />} />
          <Route path="/aactivated/top-sellers" element={<Navigate to="/AACTIVATED#aactivated-top-sellers" replace />} />
          <Route path="/AACTIVATED/products" element={<Navigate to="/AACTIVATED#aactivated-top-sellers" replace />} />
          <Route path="/AACTIVATED/top-sellers" element={<Navigate to="/AACTIVATED#aactivated-top-sellers" replace />} />
          <Route path="/rep-intake" element={<RepIntake />} />
          <Route path="/start-rep" element={<RepIntake />} />
          <Route path="/aactivated/rep-intake" element={<CanonicalAactivatedRoute element={<RepIntake portalKey="aactivated" />} />} />
          <Route path="/aactivated/start-rep" element={<CanonicalAactivatedRoute element={<RepIntake portalKey="aactivated" />} />} />
          <Route path="/aactivated/approval" element={<CanonicalAactivatedRoute element={<RepIntake portalKey="aactivated" />} />} />
          <Route path="/aactivated/apply" element={<CanonicalAactivatedRoute element={<RepIntake portalKey="aactivated" />} />} />
          <Route path="/AACTIVATED/rep-intake" element={<CanonicalAactivatedRoute element={<RepIntake portalKey="aactivated" />} />} />
          <Route path="/AACTIVATED/start-rep" element={<CanonicalAactivatedRoute element={<RepIntake portalKey="aactivated" />} />} />
          <Route path="/AACTIVATED/approval" element={<CanonicalAactivatedRoute element={<RepIntake portalKey="aactivated" />} />} />
          <Route path="/AACTIVATED/apply" element={<CanonicalAactivatedRoute element={<RepIntake portalKey="aactivated" />} />} />
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
          <Route path="/rx-plus/EHWSUB" element={<Navigate to="/EHWSUB" replace />} />
          <Route path="/rx-plus/ehwsub" element={<Navigate to="/EHWSUB" replace />} />
          <Route path="/rx-plus/:distributorSlug" element={<RxPlusDistributorPortal />} />
          <Route path="/login"        element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/patient/signup" element={<PatientSignup />} />
          <Route path="/rick" element={<Navigate to="/rockphorm" replace />} />
          <Route path="/rickdiaz" element={<Navigate to="/rockphorm" replace />} />
          <Route path="/rick50" element={<Navigate to="/rockphorm" replace />} />
          <Route path="/rock-phorm" element={<Navigate to="/rockphorm" replace />} />
          <Route path="/RockPhorm" element={<Navigate to="/rockphorm" replace />} />
          <Route path="/Rockphorm" element={<Navigate to="/rockphorm" replace />} />
          <Route path="/EmpireHealth&Wellness" element={<RxPlusDistributorPortal />} />
          <Route path="/empirehealth" element={<Navigate to="/EmpireHealth&Wellness" replace />} />
          <Route path="/EHWSUB" element={<RxPlusDistributorPortal />} />
          <Route path="/ehwsub" element={<Navigate to="/EHWSUB" replace />} />
          <Route path="/warxlabz" element={<RxPlusDistributorPortal />} />
          <Route path="/mark" element={<ReferralRedirect />} />
          <Route path="/dennis" element={<ReferralRedirect />} />
          <Route path="/gabriel" element={<ReferralRedirect />} />
          <Route path="/jerry" element={<ReferralRedirect />} />
          <Route path="/optimax-peptide-therapy" element={<RxPlusDistributorPortal />} />
          <Route path="/AACTIVATED" element={<CanonicalAactivatedRoute element={<RxPlusDistributorPortal />} />} />
          <Route path="/aactivated" element={<CanonicalAactivatedRoute element={<RxPlusDistributorPortal />} />} />
          <Route path="/AACTIVATED/*" element={<CanonicalAactivatedRoute element={<Navigate to="/AACTIVATED" replace />} />} />
          <Route path="/aactivated/*" element={<CanonicalAactivatedRoute element={<Navigate to="/AACTIVATED" replace />} />} />
          <Route path="/guy" element={<RxPlusDistributorPortal />} />
          <Route path="/peakform" element={<RxPlusDistributorPortal />} />
          <Route path="/alphapride" element={<RxPlusDistributorPortal />} />
          <Route path="/ronin" element={<RxPlusDistributorPortal />} />
          <Route path="/agprimelab" element={<RxPlusDistributorPortal />} />
          <Route path="/vyigenix" element={<RxPlusDistributorPortal />} />
          <Route path="/rockphorm" element={<RxPlusDistributorPortal />} />
          <Route path="/rockphorm/*" element={<RxPlusDistributorPortal />} />
          <Route path="/aurora" element={<RxPlusDistributorPortal />} />
          <Route path="/auroralabs" element={<RxPlusDistributorPortal />} />
          <Route path="/MegDel" element={<RxPlusDistributorPortal />} />
          <Route path="/megdel" element={<RxPlusDistributorPortal />} />
          <Route path="/aurora-labs/Duffy" element={<RxPlusDistributorPortal />} />
          <Route path="/aurora labs/Duffy" element={<RxPlusDistributorPortal />} />
          <Route path="/zenora" element={<RxPlusDistributorPortal />} />
          <Route path="/PhysioPeptides" element={<RxPlusDistributorPortal />} />
          <Route path="/physiopeptides" element={<RxPlusDistributorPortal />} />
          <Route path="/ginto" element={<RxPlusDistributorPortal />} />
          <Route path="/ginto-wellness-labs" element={<RxPlusDistributorPortal />} />
          <Route path="/glow" element={<GlowStorefront />} />
          <Route path="/glow-sheer-radiance" element={<Navigate to="/glow" replace />} />
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
          </Route>

          {/* Admin + scoped PepScriptRX+ admin */}
          <Route element={<ProtectedRoute roles={['admin', 'rx_plus_admin']} />}>
            <Route path="/admin"                        element={<AdminHomePage />} />
            <Route path="/admin/submissions"            element={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="orders" />} fallback={<AdminSubmissions />} />} />
            <Route path="/admin/analytics"             element={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="dashboard" />} fallback={<AdminAnalytics />} />} />
            <Route path="/admin/submissions/:id"        element={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="orders" />} fallback={<AdminSubmissionDetail />} />} />
            <Route path="/admin/reps"                   element={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="reps" />} fallback={<AdminReps />} />} />
            <Route path="/admin/fulfillment"            element={<PlatformOrScopedAdminPage platform={<AdminFulfillment />} scoped={<Navigate to="/admin" replace />} />} />
            <Route path="/admin/products"               element={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="products" />} fallback={<PlatformOrScopedAdminPage platform={<AdminProducts />} scoped={<AdminAactivatedPartnerTools mode="product-lists" />} />} />} />
            <Route path="/admin/inventory"              element={<PlatformOrScopedAdminPage platform={<AdminInventory />} scoped={<Navigate to="/admin" replace />} />} />
            <Route path="/admin/product-intelligence"    element={<Navigate to="/admin/operations/product-intelligence" replace />} />
            <Route path="/admin/operations/product-intelligence" element={<ProductIntelligenceAdminPage />} />
            <Route path="/admin/rx-plus"                element={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="products" />} fallback={<AdminRxPlus />} />} />
            <Route path="/admin/aactivated-promos"      element={<PlatformOrScopedAdminPage platform={<AdminAactivatedPromos />} scoped={<AdminAactivatedPromos />} />} />
            <Route path="/admin/rep-intake"             element={<Navigate to="/admin/rep-requests" replace />} />
            <Route path="/admin/rep-approval-center"    element={<Navigate to="/admin/rep-requests" replace />} />
            <Route path="/admin/rep-requests"           element={<AdminRepIntake />} />
            <Route path="/admin/leads"                  element={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="customers" />} fallback={<AdminLeads />} />} />
            <Route path="/admin/pricing"                element={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="pricing" />} fallback={<AdminAactivatedPartnerTools mode="pricing" />} />} />
            <Route path="/admin/commission-center"      element={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="commission" />} fallback={<AdminAactivatedPartnerTools mode="commission" />} />} />
            <Route path="/admin/rep-store-manager"      element={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="reps" />} fallback={<AdminAactivatedPartnerTools mode="rep-store-manager" />} />} />
            <Route path="/admin/product-lists"          element={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="products" />} fallback={<AdminAactivatedPartnerTools mode="product-lists" />} />} />
            <Route path="/admin/feature-requests"       element={<AdminAactivatedPartnerTools mode="feature-requests" />} />
            <Route path="/admin/rep-performance"        element={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="reps" />} fallback={<AdminAactivatedPartnerTools mode="leaderboard" />} />} />
            <Route path="/admin/customer-activity"      element={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="customers" />} fallback={<AdminAactivatedPartnerTools mode="customer" />} />} />
            <Route path="/admin/product-performance"    element={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="products" />} fallback={<AdminAactivatedPartnerTools mode="product" />} />} />
            <Route path="/admin/store-settings"         element={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="store-settings" />} fallback={<AdminAactivatedPartnerTools mode="store-settings" />} />} />
            <Route path="/admin/payouts"                element={<RockPhormOrAdminPage rockphorm={<AdminRockPhorm mode="commission" />} fallback={<PlatformOrScopedAdminPage platform={<AdminPayouts />} scoped={<AdminAactivatedPartnerTools mode="payouts" />} />} />} />
            <Route path="/admin/payment-audit"          element={<PlatformOrScopedAdminPage platform={<AdminPaymentAudit />} scoped={<AdminAactivatedPartnerTools mode="payment-audit" />} />} />
            <Route path="/admin/scope-codes"            element={<PlatformOrScopedAdminPage platform={<AdminScopeCodes />} scoped={<AdminAactivatedPartnerTools mode="scope-codes" />} />} />
            <Route path="/admin/zelle-payments"         element={<PlatformOrScopedAdminPage platform={<AdminZellePayments />} scoped={<AdminAactivatedPartnerTools mode="zelle" />} />} />
          </Route>

          {/* Rep */}
          <Route element={<ProtectedRoute roles={['rep']} />}>
            <Route path="/rep"           element={<RepDashboard />} />
            <Route path="/rep/dashboard" element={<RepDashboard />} />
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
