import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashLayout from '../../components/layout/DashLayout';
import { supabase } from '../../lib/supabase';

type Application = { full_name: string; email: string; approval_status: string | null; approval_notes: string | null; created_at: string };

export default function AactivatedApplicantPortal() {
  const [application, setApplication] = useState<Application | null | undefined>();
  useEffect(() => { void supabase!.from('rep_store_intake_submissions').select('full_name,email,approval_status,approval_notes,created_at').eq('source_portal_id','aactivated').maybeSingle().then(({ data }) => setApplication(data)); }, []);
  if (application === undefined) return <DashLayout title="Application Status" navItems={[]}><p>Loading your application…</p></DashLayout>;
  const status = application?.approval_status ?? 'pending';
  return <DashLayout title="AACTIVATEDRX Application" navItems={[]}><div style={{ maxWidth: 760, margin: '0 auto' }}>
    <div className="card" style={{ padding: 28 }}><p className="eyebrow">AACTIVATEDRX representative application</p><h1>{statusTitle(status)}</h1>
      {!application ? <div className="alert alert-error">We could not find an application linked to this account. Please contact support.</div> : <>
        <p>Hello {application.full_name}. Your application was received on {new Date(application.created_at).toLocaleDateString()}.</p>
        <div className={`alert ${status === 'rejected' ? 'alert-error' : status === 'more_info_requested' ? 'alert-info' : 'alert-success'}`}>{statusCopy(status)}</div>
        {application.approval_notes && status === 'more_info_requested' && <div><strong>Information requested</strong><p>{application.approval_notes}</p></div>}
        <p>While review is pending, referral links, commissions, customers, orders, payout settings, tax forms, and representative resources remain unavailable.</p>
        {status === 'approved' && <Link className="btn btn-primary" to="/rep/onboarding">Continue representative setup</Link>}
      </>}
    </div><p style={{ marginTop: 20 }}>Questions? <a href="mailto:support@aactivated.com">Contact AACTIVATEDRX support</a>.</p>
  </div></DashLayout>;
}

function statusTitle(status: string) { if (status === 'approved') return 'Application approved'; if (status === 'rejected') return 'Application decision'; if (status === 'more_info_requested') return 'More information needed'; return 'Application under review'; }
function statusCopy(status: string) { if (status === 'approved') return 'Your application has been approved. Complete the required onboarding steps to activate your representative tools.'; if (status === 'rejected') return 'Your application was not approved. Representative access has not been activated.'; if (status === 'more_info_requested') return 'An administrator needs additional information before completing the review.'; return 'Our team is reviewing your application. We will notify you when its status changes.'; }
