import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AactivatedRepAccessGate() {
  const [access, setAccess] = useState<{state:string;ready:boolean} | null | undefined>();
  useEffect(() => {
    void supabase!.from('aactivated_onboarding_profiles').select('state,account_status,agreement_status,w9_status,starter_kit_status,payout_status').maybeSingle()
      .then(({ data }) => setAccess(data ? {state:data.state,ready:data.account_status==='complete'&&data.agreement_status==='complete'&&['submitted','under_review','accepted'].includes(data.w9_status)&&data.starter_kit_status==='complete'&&['submitted','verified','complete'].includes(data.payout_status)} : null));
  }, []);
  if (access === undefined) return <div className="loading-screen"><div className="spinner" /><span>Checking representative access…</span></div>;
  if (access && access.state !== 'active' && !access.ready) return <Navigate to="/rep/onboarding" replace />;
  return <Outlet />;
}
