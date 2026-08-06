import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AactivatedRepAccessGate() {
  const [state, setState] = useState<string | null | undefined>();
  useEffect(() => {
    void supabase!.from('aactivated_onboarding_profiles').select('state').maybeSingle()
      .then(({ data }) => setState(data?.state ?? null));
  }, []);
  if (state === undefined) return <div className="loading-screen"><div className="spinner" /><span>Checking representative access…</span></div>;
  if (state && state !== 'active') return <Navigate to="/rep/onboarding" replace />;
  return <Outlet />;
}
