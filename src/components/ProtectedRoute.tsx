import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../types';
import { loginPathForRole, roleMatchesAllowedRoles } from '../lib/authRoles';

interface Props {
  roles: Role[];
  exact?: boolean;
}

export default function ProtectedRoute({ roles, exact = false }: Props) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="spinner" />
        <span>Loading…</span>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  const isAllowed = exact
    ? Boolean(profile && roles.includes(profile.role))
    : Boolean(profile && roleMatchesAllowedRoles(profile.role, roles));
  if (!isAllowed) return <Navigate to={loginPathForRole(profile?.role)} replace />;

  return <Outlet />;
}
