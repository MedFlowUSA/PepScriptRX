import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../../context/AuthContext';

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

  async function handleSignOut() {
    await signOut();
    navigate('/login');
  }

  return (
    <div className="dash-shell">
      <aside className="dash-sidebar">
        <div className="dash-sidebar-brand">
          <div className="dash-sidebar-brand-name">
            PepScript<span style={{ color: 'var(--teal)' }}>RX</span>
          </div>
          <div className="dash-sidebar-brand-sub">
            {profile?.role ? profile.role.charAt(0).toUpperCase() + profile.role.slice(1) + ' Portal' : 'Portal'}
          </div>
        </div>

        <nav className="dash-sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`dash-sidebar-link${pathname === item.path || pathname.startsWith(item.path + '/') ? ' active' : ''}`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="dash-sidebar-footer">
          <div className="dash-sidebar-user">
            <strong>{profile?.full_name || 'User'}</strong>
            {profile?.email}
          </div>
          <button className="btn btn-ghost btn-sm w-full" onClick={handleSignOut}
            style={{ color: 'rgba(255,255,255,.6)', justifyContent: 'center' }}>
            Sign Out
          </button>
        </div>
      </aside>

      <div className="dash-main">
        <div className="dash-topbar">
          <span className="dash-topbar-title">{title}</span>
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
