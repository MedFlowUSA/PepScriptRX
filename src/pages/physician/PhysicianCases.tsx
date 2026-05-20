import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashLayout from '../../components/layout/DashLayout';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { PatientSubmission } from '../../types';
import { STATUS_LABELS, STATUS_COLORS } from '../../types';
import type { SubmissionStatus } from '../../types';

const PHYSICIAN_NAV = [
  { label: 'My Cases', path: '/physician', icon: '🩺' },
];

export default function PhysicianCases() {
  const { profile } = useAuth();
  const [cases, setCases] = useState<PatientSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !profile) { setLoading(false); return; }
    supabase
      .from('patient_submissions')
      .select('*')
      .eq('physician_id', profile.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setCases((data as PatientSubmission[]) ?? []);
        setLoading(false);
      });
  }, [profile]);

  const pending = cases.filter((c) => c.status === 'physician_review').length;

  return (
    <DashLayout title="My Cases" navItems={PHYSICIAN_NAV}>
      {pending > 0 && (
        <div className="alert alert-info mb-6">
          You have <strong>{pending}</strong> case{pending !== 1 ? 's' : ''} awaiting physician review.
        </div>
      )}

      <div className="card">
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Medication / Dose</th>
                  <th>State</th>
                  <th>Status</th>
                  <th>Submitted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {cases.length === 0 ? (
                  <tr><td colSpan={6}>
                    <div className="empty-state" style={{ padding: '40px 0' }}>
                      <div className="empty-state-title">No cases assigned</div>
                      <div className="empty-state-desc">Cases appear here when assigned by the admin team.</div>
                    </div>
                  </td></tr>
                ) : cases.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{c.full_name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{c.email}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{c.medication}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{c.current_dose}</div>
                    </td>
                    <td>{c.state}</td>
                    <td>
                      <span className={`badge ${STATUS_COLORS[c.status as SubmissionStatus] ?? 'badge-default'}`}>
                        {STATUS_LABELS[c.status as SubmissionStatus] ?? c.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleDateString()}</td>
                    <td>
                      <Link to={`/physician/cases/${c.id}`} className="table-link">Review →</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashLayout>
  );
}
