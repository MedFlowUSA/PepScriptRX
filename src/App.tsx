import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

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
import Login from './pages/public/Login';
import PatientSignup from './pages/public/PatientSignup';
import ReferralRedirect from './pages/public/ReferralRedirect';
import AuthCallback from './pages/public/AuthCallback';
import ResetPassword from './pages/public/ResetPassword';
import Library from './pages/public/Library';

// Patient pages
import PatientDashboard from './pages/patient/PatientDashboard';
import PatientProfile from './pages/patient/PatientProfile';
import PatientGoals from './pages/patient/PatientGoals';
import PatientWeightTracker from './pages/patient/PatientWeightTracker';
import PatientProgress from './pages/patient/PatientProgress';
import PatientSideEffects from './pages/patient/PatientSideEffects';

// Admin pages
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminAnalytics from './pages/admin/AdminAnalytics';
import AdminSubmissions from './pages/admin/AdminSubmissions';
import AdminSubmissionDetail from './pages/admin/AdminSubmissionDetail';
import AdminReps from './pages/admin/AdminReps';
import AdminPayouts from './pages/admin/AdminPayouts';
import AdminFulfillment from './pages/admin/AdminFulfillment';
import AdminProducts from './pages/admin/AdminProducts';
import AdminInventory from './pages/admin/AdminInventory';
import AdminRxPlus from './pages/admin/AdminRxPlus';

// Rep pages
import RepDashboard from './pages/rep/RepDashboard';

// Physician pages
import PhysicianCases from './pages/physician/PhysicianCases';
import PhysicianCaseDetail from './pages/physician/PhysicianCaseDetail';

// Fulfillment pages
import FulfillmentOrders from './pages/fulfillment/FulfillmentOrders';
import FulfillmentOrderDetail from './pages/fulfillment/FulfillmentOrderDetail';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public */}
          <Route path="/"             element={<Home />} />
          <Route path="/start"        element={<Start />} />
          <Route path="/submitted"    element={<Submitted />} />
          <Route path="/pay/:id"      element={<PaymentPage />} />
          <Route path="/reta-waitlist" element={<Navigate to="/start" replace />} />
          <Route path="/privacy"        element={<Privacy />} />
          <Route path="/terms"          element={<Terms />} />
          <Route path="/certificates"   element={<Certificates />} />
          <Route path="/peptide-calculator" element={<PeptideCalculator />} />
          <Route path="/library" element={<Library />} />
          <Route path="/rx-plus" element={<RxPlusLanding />} />
          <Route path="/rx-plus/:distributorSlug" element={<RxPlusDistributorPortal />} />
          <Route path="/login"        element={<Login />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/patient/signup" element={<PatientSignup />} />
          <Route path="/rick" element={<ReferralRedirect />} />
          <Route path="/EmpireHealth&Wellness" element={<ReferralRedirect />} />
          <Route path="/mark" element={<ReferralRedirect />} />
          <Route path="/dennis" element={<ReferralRedirect />} />
          <Route path="/gabriel" element={<ReferralRedirect />} />
          <Route path="/jerry" element={<ReferralRedirect />} />
          <Route path="/AACTIVATED" element={<RxPlusDistributorPortal />} />
          <Route path="/aactivated" element={<RxPlusDistributorPortal />} />
          <Route path="/guy" element={<RxPlusDistributorPortal />} />
          <Route path="/r/:code" element={<ReferralRedirect />} />

          {/* Patient */}
          <Route element={<ProtectedRoute roles={['patient']} />}>
            <Route path="/patient"          element={<PatientDashboard />} />
            <Route path="/patient/profile"  element={<PatientProfile />} />
            <Route path="/patient/goals"    element={<PatientGoals />} />
            <Route path="/patient/weight"   element={<PatientWeightTracker />} />
            <Route path="/patient/progress"      element={<PatientProgress />} />
            <Route path="/patient/side-effects"  element={<PatientSideEffects />} />
          </Route>

          {/* Admin + scoped PepScriptRX+ admin */}
          <Route element={<ProtectedRoute roles={['admin', 'rx_plus_admin']} />}>
            <Route path="/admin"                        element={<AdminDashboard />} />
            <Route path="/admin/submissions"            element={<AdminSubmissions />} />
            <Route path="/admin/analytics"             element={<AdminAnalytics />} />
            <Route path="/admin/submissions/:id"        element={<AdminSubmissionDetail />} />
            <Route path="/admin/reps"                   element={<AdminReps />} />
            <Route path="/admin/fulfillment"            element={<AdminFulfillment />} />
            <Route path="/admin/products"               element={<AdminProducts />} />
            <Route path="/admin/inventory"              element={<AdminInventory />} />
            <Route path="/admin/rx-plus"                element={<AdminRxPlus />} />
          </Route>

          {/* Company Admin Only */}
          <Route element={<ProtectedRoute roles={['admin']} />}>
            <Route path="/admin/payouts"                element={<AdminPayouts />} />
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
  );
}
