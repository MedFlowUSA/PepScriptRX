import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function AactivatedRepAccessGate() {
  const [access, setAccess] = useState<{state:string;ready:boolean} | null | undefined>();
  useEffect(() => {
    void supabase!.from('aactivated_onboarding_profiles')
      .select('state,account_status,agreement_status,w9_status,starter_kit_status,payout_status,last_activity_at')
      .order('last_activity_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        const rows = data ?? [];
        const row = rows.find((candidate) => !['application_more_info_required', 'application_declined', 'suspended'].includes(candidate.state)) ?? rows[0];
        setAccess(row ? {
          state: row.state,
          ready: row.account_status === 'complete'
            && row.agreement_status === 'complete'
            && ['submitted', 'under_review', 'accepted'].includes(row.w9_status)
            && row.starter_kit_status === 'complete'
            && ['submitted', 'verified', 'complete'].includes(row.payout_status),
        } : null);
      });
  }, []);
  if (access === undefined) return <div className="loading-screen"><div className="spinner" /><span>Checking representative access…</span></div>;
  if (access === null) return <Navigate to="/applicant" replace />;
  if (access.state !== 'active' && !access.ready) return <Navigate to="/rep/onboarding" replace />;
  return <Outlet />;
}
