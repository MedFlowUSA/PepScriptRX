import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../hooks/useTheme';

interface NavItem {
  label: string;
  path: string;
  icon: string;
}

interface Props {
  title: string;
  navItems: NavItem[];
  actions?: ReactNode;
  children: ReactNode;
}

export default function DashLayout({ title, navItems, actions, children }: Props) {
  const { profile, signOut } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isDark, toggle: toggleTheme } = useTheme();
  const scopedRxPlusPaths = new Set([
    '/admin',
    '/admin/submissions',
    '/admin/analytics',
    '/admin/products',
    '/admin/inventory',
    '/admin/rx-plus',
    '/admin/aactivated-promos',
    '/admin/leads',
    '/admin/zelle-payments',
    '/admin/rep-requests',
    '/admin/reps',
    '/admin/rep-store-manager',
    '/admin/product-lists',
    '/admin/pricing',
    '/admin/payouts',
    '/admin/scope-codes',
    '/admin/payment-audit',
    '/admin/fulfillment',
    '/admin/commission-center',
    '/admin/rep-performance',
    '/admin/customer-activity',
    '/admin/product-performance',
    '/admin/store-settings',
    '/admin/feature-requests',
  ]);
  const visibleNavItems = profile?.role === 'rx_plus_admin'
    ? navItems.filter((item) => scopedRxPlusPaths.has(item.path))
    : navItems;

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  function closeSidebar() { setSidebarOpen(false); }

  return (
    <div className="dash-shell">
      {/* Mobile overlay */}
      <div
        className={`dash-sidebar-overlay${sidebarOpen ? ' open' : ''}`}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      <aside className={`dash-sidebar${sidebarOpen ? ' mobile-open' : ''}`}>
        <div className="dash-sidebar-brand">
          <div className="dash-sidebar-brand-name">
            PepScript<span className="text-teal">RX</span>
          </div>
          <div className="dash-sidebar-brand-sub">
            {profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) + ' Portal' : 'Portal'}
          </div>
        </div>

        <nav className="dash-sidebar-nav">
          {visibleNavItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={closeSidebar}
              className={`dash-sidebar-link${pathname === item.path || pathname.startsWith(item.path + '/') ? ' active' : ''}`}
            >
              <span style={{ fontSize: 15, lineHeight: 1 }}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="dash-sidebar-footer">
          <div className="dash-sidebar-user">
            <strong>{profile?.full_name || 'User'}</strong>
            {profile?.email}
          </div>
          <button
            className="btn btn-ghost btn-sm w-full"
            onClick={toggleTheme}
            style={{ color: 'rgba(255,255,255,.6)', justifyContent: 'center' }}
          >
            {isDark ? '☀ Light Mode' : '◑ Dark Mode'}
          </button>
          <Link
            className="btn btn-ghost btn-sm w-full"
            to="/reset-password"
            style={{ color: 'rgba(255,255,255,.6)', justifyContent: 'center' }}
          >
            Change Password
          </Link>
          <button
            className="btn btn-ghost btn-sm w-full"
            onClick={handleSignOut}
            style={{ color: 'rgba(255,255,255,.6)', justifyContent: 'center' }}
          >
            Sign Out
          </button>
        </div>
      </aside>

      <div className="dash-main">
        <div className="dash-topbar">
          <div className="flex items-center gap-3">
            <button
              className="dash-hamburger"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open navigation"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <rect y="3" width="20" height="2" rx="1" fill="currentColor"/>
                <rect y="9" width="20" height="2" rx="1" fill="currentColor"/>
                <rect y="15" width="20" height="2" rx="1" fill="currentColor"/>
              </svg>
            </button>
            <span className="dash-topbar-title">{title}</span>
          </div>
          <div className="flex gap-2 items-center">
            {actions}
          </div>
        </div>
        <div className="dash-content">
          {children}
        </div>
      </div>
    </div>
  );
}
