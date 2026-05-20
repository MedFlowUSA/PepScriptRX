import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashLayout from '../../components/layout/DashLayout';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import type { PatientSubmission } from '../../types';
import { STATUS_LABELS } from '../../types';
import { patientNav } from './patientNav';

type Goal = {
  goal_weight: number | null;
  starting_weight: number | null;
};

type WeightEntry = {
  weight: number;
  recorded_at: string;
};

export default function PatientDashboard() {
  const { profile } = useAuth();
  const [submissions, setSubmissions] = useState<PatientSubmission[]>([]);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [latestWeight, setLatestWeight] = useState<WeightEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!supabase || !profile) {
        setLoading(false);
        return;
      }

      const [{ data: submissionsData }, { data: goalData }, { data: weightData }] = await Promise.all([
        supabase
          .from('patient_submissions')
          .select('*')
          .or(`patient_profile_id.eq.${profile.id},email.eq.${profile.email}`)
          .order('created_at', { ascending: false }),
        supabase
          .from('patient_goals')
          .select('goal_weight, starting_weight')
          .eq('profile_id', profile.id)
          .maybeSingle(),
        supabase
          .from('patient_weight_entries')
          .select('weight, recorded_at')
          .eq('profile_id', profile.id)
          .order('recorded_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      setSubmissions((submissionsData ?? []) as PatientSubmission[]);
      setGoal((goalData as Goal | null) ?? null);
      setLatestWeight((weightData as WeightEntry | null) ?? null);
      setLoading(false);
    }

    load();
  }, [profile]);

  const progress =
    goal?.starting_weight && goal.goal_weight && latestWeight
      ? Math.max(0, goal.starting_weight - latestWeight.weight)
      : null;

  const DONE_STATUSES = ['fulfilled', 'cancelled_refunded', 'not_eligible'];
  const activeOrders = submissions.filter((s) => !DONE_STATUSES.includes(s.status));
  const completedOrders = submissions.filter((s) => DONE_STATUSES.includes(s.status));

  return (
    <DashLayout title="Patient Dashboard" navItems={patientNav}>
      {loading ? (
        <div className="loading-screen"><div className="spinner" /><span>Loading patient dashboard...</span></div>
      ) : (
        <div style={{ display: 'grid', gap: 24 }}>

          {/* Stats row */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-label">Active orders</div>
              <div className="stat-value">{activeOrders.length}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Current weight</div>
              <div className="stat-value">{latestWeight ? `${latestWeight.weight} lb` : '--'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Goal weight</div>
              <div className="stat-value">{goal?.goal_weight ? `${goal.goal_weight} lb` : '--'}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Progress lost</div>
              <div className="stat-value" style={{ color: progress !== null ? 'var(--success)' : undefined }}>
                {progress !== null ? `${progress.toFixed(1)} lb` : '--'}
              </div>
            </div>
          </div>

          {/* Active orders */}
          {activeOrders.length === 0 ? (
            <div className="card">
              <div className="card-body">
                <div className="empty-state" style={{ padding: 24 }}>
                  <div className="empty-state-icon">💊</div>
                  <div className="empty-state-title">No active orders</div>
                  <div className="empty-state-desc">Use the same email as your intake so your orders appear here.</div>
                  <Link to="/start" className="btn btn-primary mt-4">Start Savings Check</Link>
                </div>
              </div>
            </div>
          ) : activeOrders.map((order) => {
            const canPay = order.status === 'payment_sent';
            const estimatedSavings = order.estimated_savings ?? null;
            return (
              <div key={order.id} className="card">
                <div className="card-header" style={{ paddingBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div className="card-title">{order.medication}</div>
                      <div className="card-subtitle">{order.current_dose}{order.current_pharmacy ? ` · Previously at ${order.current_pharmacy}` : ''}</div>
                    </div>
                    <span className="badge badge-teal">{STATUS_LABELS[order.status]}</span>
                  </div>
                </div>
                <div className="card-body" style={{ display: 'grid', gap: 14 }}>

                  {/* Savings highlight */}
                  {estimatedSavings !== null && estimatedSavings > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--success-bg)', border: '1px solid rgba(34,197,94,.25)', borderRadius: 'var(--radius-sm)', padding: '12px 16px' }}>
                      <span style={{ fontSize: 22 }}>💰</span>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: 15 }}>Estimated savings: ${estimatedSavings.toFixed(2)}/mo</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>vs. your current price of {order.current_price ? `$${order.current_price.toFixed(2)}` : 'on file'}</div>
                      </div>
                    </div>
                  )}

                  {/* Quoted price */}
                  {order.quoted_price !== null && (
                    <div className="detail-row">
                      <span className="detail-label">Quoted price</span>
                      <span className="detail-value" style={{ fontWeight: 800, color: 'var(--teal)', fontSize: 18 }}>${order.quoted_price.toFixed(2)}</span>
                    </div>
                  )}

                  {/* Pay button */}
                  {canPay && (
                    <a
                      className="btn btn-primary"
                      href={`/pay/${order.id}`}
                      style={{ justifyContent: 'center', fontSize: 16, padding: '14px 24px' }}
                    >
                      💳 Complete Payment →
                    </a>
                  )}

                  {/* Status guidance */}
                  {!canPay && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
                      {order.status === 'new_submission' && 'Your submission is in queue for review. Expect a response within 1–2 business days.'}
                      {order.status === 'under_review' && 'Our team is reviewing your submission. We will contact you shortly with next steps.'}
                      {order.status === 'physician_review' && 'Your order is undergoing physician review. This typically takes 1–2 additional days.'}
                      {order.status === 'fulfillment_review' && 'Your order is being reviewed by our fulfillment partner. Almost there.'}
                      {order.status === 'eligible' && 'You are eligible! A payment link is being prepared and will be sent to you shortly.'}
                      {order.status === 'missing_info' && 'We need more information. Please check your email or phone for a message from our team.'}
                      {order.status === 'paid' && '✅ Payment received. Your order is being processed for fulfillment.'}
                    </div>
                  )}

                  <Link className="btn btn-outline btn-sm" to="/patient/weight" style={{ justifyContent: 'center' }}>
                    Update Weight Tracker
                  </Link>
                </div>
              </div>
            );
          })}

          {/* Past orders */}
          {completedOrders.length > 0 && (
            <div className="card">
              <div className="card-header" style={{ paddingBottom: 16 }}>
                <div className="card-title">Order history</div>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Medication</th>
                      <th>Status</th>
                      <th>Submitted</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedOrders.map((o) => (
                      <tr key={o.id}>
                        <td style={{ fontWeight: 600 }}>{o.medication}</td>
                        <td><span className={`badge ${o.status === 'fulfilled' ? 'badge-success' : o.status === 'not_eligible' ? 'badge-error' : 'badge-default'}`}>{STATUS_LABELS[o.status]}</span></td>
                        <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}
    </DashLayout>
  );
}
