import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import type { Role } from '../types';

interface Props {
  roles: Role[];
}

export default function ProtectedRoute({ roles }: Props) {
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
  if (profile && !roles.includes(profile.role)) return <Navigate to="/" replace />;

  return <Outlet />;
}
