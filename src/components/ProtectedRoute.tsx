import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../types';
import { getRolePortalType, loginPathForRole, roleMatchesAllowedRoles, type LoginPortalType } from '../lib/authRoles';
import { buildPortalLoginPath, getWhiteLabelPortal } from '../config/whiteLabelPortals';
import { resolveStoreContextFromLocation } from '../lib/storeContext';

interface Props {
  roles: Role[];
  exact?: boolean;
}

export default function ProtectedRoute({ roles, exact = false }: Props) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span>Loading...</span>
      </div>
    );
  }

  if (!user) return <Navigate to={loginPathForProtectedRoute(roles, location)} replace />;
  const isAllowed = exact
    ? Boolean(profile && roles.includes(profile.role))
    : Boolean(profile && roleMatchesAllowedRoles(profile.role, roles));
  if (!isAllowed) return <Navigate to={loginPathForRole(profile?.role)} replace />;

  return <Outlet />;
}

function loginPathForProtectedRoute(roles: Role[], location: ReturnType<typeof useLocation>): string {
  const selectedPortal = loginPortalForAllowedRoles(roles);
  const context = typeof window !== 'undefined'
    ? resolveStoreContextFromLocation(window.location)
    : null;
  const portal = context ? getWhiteLabelPortal(context.portalId) : null;
  const currentPath = `${location.pathname}${location.search}${location.hash}`;
  const basePath = portal
    ? buildPortalLoginPath(portal, selectedPortal)
    : `/login?portal=${selectedPortal}`;

  const separator = basePath.includes('?') ? '&' : '?';
  return `${basePath}${separator}returnTo=${encodeURIComponent(currentPath)}`;
}

function loginPortalForAllowedRoles(roles: Role[]): LoginPortalType {
  if (roles.some((role) => getRolePortalType(role) === 'admin')) return 'admin';
  if (roles.some((role) => getRolePortalType(role) === 'rep')) return 'rep';
  return 'patient';
}
