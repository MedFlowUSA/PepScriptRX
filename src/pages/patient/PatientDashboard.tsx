import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashLayout from '../../components/layout/DashLayout';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { MessageThread } from '../../components/MessageThread';
import { useRealtime } from '../../hooks/useRealtime';
import type { PatientSubmission } from '../../types/index';
import { STATUS_LABELS } from '../../types/index';
import { patientNav } from './patientNav';
import { getPatientJourney, JOURNEY_STEPS } from './patientJourney';

type Goal = {
  goal_weight: number | null;
  starting_weight: number | null;
};

type WeightEntry = {
  weight: number;
  recorded_at: string;
};

function trackingUrl(carrier: string | null, number: string): string {
  switch (carrier) {
    case 'UPS':   return `https://www.ups.com/track?tracknum=${number}`;
    case 'FedEx': return `https://www.fedex.com/fedextrack/?trknbr=${number}`;
    case 'USPS':  return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${number}`;
    case 'DHL':   return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${number}`;
    default:      return `https://www.google.com/search?q=${encodeURIComponent(`${carrier ?? ''} tracking ${number}`)}`;
  }
}

function orderTotal(order: PatientSubmission): number {
  const productTotal = order.quoted_price ?? 0;
  const discountAmount = Math.min(order.discount_amount ?? 0, productTotal);
  return Math.max(0, productTotal - discountAmount) + (order.shipping_cost ?? 0);
}

function formatPaymentProvider(provider: PatientSubmission['payment_provider']): string {
  if (provider === 'venmo') return 'Venmo';
  if (provider === 'zelle') return 'Zelle';
  return 'Manual';
}

export default function PatientDashboard() {
  const { profile } = useAuth();
  const [submissions, setSubmissions] = useState<PatientSubmission[]>([]);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [latestWeight, setLatestWeight] = useState<WeightEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [openMessages, setOpenMessages] = useState<Set<string>>(new Set());
  const [refilling, setRefilling] = useState<string | null>(null);
  const [refillMsg, setRefillMsg] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!supabase || !profile) { setLoading(false); return; }
    setLoading(true);

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
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (loading || !window.location.hash.startsWith('#order-')) return;
    window.requestAnimationFrame(() => document.querySelector(window.location.hash)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }, [loading, submissions]);

  // Live status updates — patient sees admin changes instantly
  useRealtime(
    `patient-dashboard-${profile?.id}`,
    'patient_submissions',
    profile ? `patient_profile_id=eq.${profile.id}` : undefined,
    load,
    Boolean(profile?.id),
  );

  useRealtime(
    `patient-dashboard-email-${profile?.email}`,
    'patient_submissions',
    profile?.email ? `email=eq.${profile.email}` : undefined,
    load,
    Boolean(profile?.email),
  );

  async function handleRefill(order: PatientSubmission) {
    if (!supabase || !profile) return;
    setRefilling(order.id);
    const { error } = await supabase.from('patient_submissions').insert({
      full_name: order.full_name,
      email: order.email,
      phone: order.phone,
      medication: order.medication,
      current_dose: order.current_dose,
      current_price: order.quoted_price ?? order.current_price,
      current_pharmacy: order.current_pharmacy,
      state: order.state,
      date_of_birth: order.date_of_birth,
      shipping_address: order.shipping_address,
      shipping_city: order.shipping_city,
      shipping_state: order.shipping_state,
      shipping_zip: order.shipping_zip,
      shipping_speed: order.shipping_speed ?? 'standard',
      shipping_cost: order.shipping_cost ?? 0,
      referral_code: order.referral_code,
      patient_profile_id: profile.id,
      status: 'new_submission',
    });
    setRefilling(null);
    setRefillMsg((prev) => ({
      ...prev,
      [order.id]: error ? 'Something went wrong. Please try again.' : 'Refill request submitted! We\'ll be in touch within 1-2 business days.',
    }));
    if (!error) await load();
  }

  function toggleMessages(id: string) {
    setOpenMessages((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const progress =
    goal?.starting_weight && goal.goal_weight && latestWeight
      ? Math.max(0, goal.starting_weight - latestWeight.weight)
      : null;

  const DONE_STATUSES = ['fulfilled', 'cancelled_refunded', 'not_eligible'];
  const activeOrders = submissions.filter((s) => !DONE_STATUSES.includes(s.status));
  const completedOrders = submissions.filter((s) => DONE_STATUSES.includes(s.status));
  const payableOrders = activeOrders.filter((s) => s.status === 'payment_sent' && (s.quoted_price ?? 0) > 0);
  const manualPendingOrders = submissions.filter((order) => ['zelle', 'venmo'].includes(order.payment_provider ?? '') && order.payment_status === 'payment_pending');
  const manualVerifiedOrders = submissions.filter((order) => ['zelle', 'venmo'].includes(order.payment_provider ?? '') && order.payment_status === 'paid');
  const shippingUpdateOrders = submissions.filter((order) => order.tracking_number || order.status === 'shipped' || order.shipping_email_sent_at);
  const basketTotal = payableOrders.reduce((sum, order) => sum + orderTotal(order), 0);
  const priorityOrder = activeOrders.find((order) => getPatientJourney(order).needsCustomerAction) ?? activeOrders[0] ?? null;
  const priorityJourney = priorityOrder ? getPatientJourney(priorityOrder) : null;

  return (
    <DashLayout title="Patient Dashboard" navItems={patientNav}>
      {loading ? (
        <div className="loading-screen"><div className="spinner" /><span>Loading patient dashboard...</span></div>
      ) : (
        <div style={{ display: 'grid', gap: 24 }}>

          {priorityOrder && priorityJourney && (
            <section className={`patient-next-step patient-next-step-${priorityJourney.terminalTone}`} aria-labelledby="patient-next-step-title">
              <div>
                <div className="patient-next-step-kicker">Your next step</div>
                <h2 id="patient-next-step-title">{priorityJourney.headline}</h2>
                <p>{priorityOrder.medication} — {priorityJourney.explanation}</p>
                <small>{priorityJourney.expectation}</small>
              </div>
              {priorityJourney.actionPath && priorityJourney.actionLabel && (
                <Link className="btn btn-primary" to={priorityJourney.actionPath}>{priorityJourney.actionLabel}</Link>
              )}
            </section>
          )}

          {(manualPendingOrders.length > 0 || manualVerifiedOrders.length > 0 || shippingUpdateOrders.length > 0) && (
            <div className="card" style={{ borderColor: 'rgba(37,199,217,.4)' }}>
              <div className="card-header" style={{ paddingBottom: 12 }}>
                <div className="card-title">Order notifications</div>
                <div className="card-subtitle">Manual payment and shipping updates appear here when your order changes.</div>
              </div>
              <div className="card-body" style={{ display: 'grid', gap: 10 }}>
                {manualPendingOrders.map((order) => (
                  <div key={`manual-pending-${order.id}`} style={{ border: '1px solid rgba(37,199,217,.35)', background: 'var(--teal-pale)', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
                    <div style={{ fontWeight: 800, color: 'var(--navy)' }}>{formatPaymentProvider(order.payment_provider)} payment waiting for verification</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                      {order.medication} is still pending manual payment review. Your order will process after payment is verified.
                    </div>
                    <Link className="btn btn-outline btn-sm" to={`/pay/${order.id}`} style={{ marginTop: 10 }}>
                      View payment details
                    </Link>
                  </div>
                ))}

                {manualVerifiedOrders.map((order) => (
                  <div key={`manual-paid-${order.id}`} style={{ border: '1px solid rgba(34,197,94,.28)', background: 'var(--success-bg)', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
                    <div style={{ fontWeight: 800, color: 'var(--success)' }}>{formatPaymentProvider(order.payment_provider)} payment verified</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                      {order.medication} payment has been verified. Fulfillment updates and tracking will show here.
                    </div>
                  </div>
                ))}

                {shippingUpdateOrders.map((order) => (
                  <div key={`shipping-${order.id}`} style={{ border: '1px solid var(--border)', background: 'var(--card-soft)', borderRadius: 'var(--radius-sm)', padding: '12px 14px' }}>
                    <div style={{ fontWeight: 800, color: 'var(--navy)' }}>Shipping update</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                      {order.tracking_number
                        ? `${order.medication} has tracking available: ${order.tracking_carrier ?? 'Carrier'} ${order.tracking_number}.`
                        : `${order.medication} shipping notification is active. Tracking will appear when available.`}
                    </div>
                    {order.tracking_number && (
                      <a className="btn btn-outline btn-sm" href={trackingUrl(order.tracking_carrier, order.tracking_number)} target="_blank" rel="noreferrer" style={{ marginTop: 10 }}>
                        Track package
                      </a>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {payableOrders.length > 0 && (
            <div className="card" style={{ borderColor: 'rgba(37,199,217,.42)', boxShadow: '0 20px 50px rgba(37,199,217,.12)' }}>
              <div className="card-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--teal)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
                      Payment basket
                    </div>
                    <h2 style={{ color: 'var(--navy)', fontSize: 24, margin: '0 0 8px' }}>
                      {payableOrders.length === 1 ? '1 order is ready to pay' : `${payableOrders.length} orders are ready to pay`}
                    </h2>
                    <p style={{ color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 }}>
                      Your basket updates in real time when the care team opens checkout.
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>Total ready</div>
                    <div style={{ color: 'var(--navy)', fontSize: 30, fontWeight: 900 }}>${basketTotal.toFixed(2)}</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 10, marginTop: 18 }}>
                  {payableOrders.map((order) => (
                    <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '12px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--card-soft)' }}>
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--navy)' }}>{order.medication}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                          {order.current_dose || 'Approved order'} - ${orderTotal(order).toFixed(2)}
                        </div>
                      </div>
                      <Link className="btn btn-primary btn-sm" to={`/pay/${order.id}`}>
                        Pay Now
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

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

          <div className="card" style={{ borderColor: 'rgba(37,199,217,.28)' }}>
            <div className="card-header" style={{ paddingBottom: 12 }}>
              <div>
                <div className="card-title">Your order journey</div>
                <div className="card-subtitle">Current status, what happens next, and whether you need to act.</div>
              </div>
              <Link className="btn btn-outline btn-sm" to="/patient/shipping">Shipping Center</Link>
            </div>
            <div className="card-body" style={{ display: 'grid', gap: 14 }}>
              {activeOrders.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>No active order timeline yet.</div>
              ) : activeOrders.slice(0, 4).map((order) => {
                const journey = getPatientJourney(order);
                return (
                  <article id={`order-${order.id}`} key={`timeline-${order.id}`} className={`patient-journey-card patient-journey-${journey.terminalTone}`}>
                    <div className="patient-journey-heading">
                      <div>
                        <div className="patient-journey-product">{order.medication}</div>
                        <h3>{journey.headline}</h3>
                      </div>
                      <span className={`badge ${journey.needsCustomerAction ? 'badge-warning' : 'badge-teal'}`}>
                        {journey.needsCustomerAction ? 'Action needed' : STATUS_LABELS[order.status]}
                      </span>
                    </div>
                    <ol className="patient-journey-track" aria-label={`Order progress: ${JOURNEY_STEPS[journey.currentStep]}`}>
                      {JOURNEY_STEPS.map((step, index) => (
                        <li key={step} className={index < journey.currentStep ? 'complete' : index === journey.currentStep ? 'current' : ''}>
                          <span aria-hidden="true">{index < journey.currentStep ? '✓' : index + 1}</span>
                          <small>{step}</small>
                        </li>
                      ))}
                    </ol>
                    <div className="patient-journey-details">
                      <div><strong>Current update</strong><p>{journey.explanation}</p></div>
                      <div><strong>What happens next</strong><p>{journey.expectation}</p></div>
                    </div>
                    <div className="patient-journey-actions">
                      {journey.actionPath && journey.actionLabel && <Link className="btn btn-primary btn-sm" to={journey.actionPath}>{journey.actionLabel}</Link>}
                      <button className="btn btn-outline btn-sm" type="button" onClick={() => toggleMessages(order.id)}>
                        {openMessages.has(order.id) ? 'Hide messages' : 'Message care team'}
                      </button>
                      {order.tracking_number && <a className="btn btn-outline btn-sm" href={trackingUrl(order.tracking_carrier, order.tracking_number)} target="_blank" rel="noreferrer">Track package</a>}
                    </div>
                    {openMessages.has(order.id) && profile && (
                      <div id={`messages-${order.id}`} className="patient-journey-messages"><MessageThread submissionId={order.id} profile={profile} /></div>
                    )}
                  </article>
                );
              })}
            </div>
          </div>

          <div className="card" style={{ borderColor: 'rgba(37,199,217,.28)' }}>
            <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 12, color: 'var(--teal)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', marginBottom: 6 }}>
                  Mixing Calculator
                </div>
                <div style={{ fontWeight: 800, color: 'var(--navy)', fontSize: 18 }}>Need to check written label math?</div>
                <div style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
                  Use the arithmetic-only Mixing Calculator with values from your provider or pharmacy instructions.
                </div>
              </div>
              <Link className="btn btn-primary" to="/mixing">
                Open Mixing Calculator
              </Link>
            </div>
          </div>

          {/* Onboarding checklist — shown until patient completes all steps */}
          <div className="stats-grid">
            {[
              { title: 'Payment Center', text: 'Zelle, Venmo, PayPal/card, Crypto, proof, and payment history.', path: '/patient/payments' },
              { title: 'Shipping Center', text: 'Tracking, shipping address, and package status.', path: '/patient/shipping' },
              { title: 'Documents Vault', text: 'Receipts, uploads, quality links, and order files.', path: '/patient/documents' },
              { title: 'Education Center', text: 'Mixing help, certificates, and product guides.', path: '/patient/education' },
            ].map((item) => (
              <Link key={item.path} to={item.path} className="card" style={{ textDecoration: 'none' }}>
                <div className="card-body">
                  <div style={{ fontWeight: 900, color: 'var(--navy)', marginBottom: 6 }}>{item.title}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, lineHeight: 1.5 }}>{item.text}</div>
                </div>
              </Link>
            ))}
          </div>

          {(!goal || !latestWeight) && (
            <div className="card" style={{ borderColor: 'rgba(37,199,217,.35)' }}>
              <div className="card-header" style={{ paddingBottom: 12 }}>
                <div className="card-title">Get started</div>
                <div className="card-subtitle">Complete these steps to set up your health tracking</div>
              </div>
              <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[
                  { done: Boolean(goal),          icon: '🎯', label: 'Set your goal weight',     path: '/patient/goals' },
                  { done: Boolean(latestWeight),  icon: '📉', label: 'Log your starting weight', path: '/patient/weight' },
                  { done: submissions.length > 0, icon: '💊', label: 'Submit your first order',  path: '/start' },
                ].map(({ done, icon, label, path }) => (
                  <Link
                    key={label}
                    to={done ? '#' : path}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', borderRadius: 'var(--radius-sm)',
                      border: `1px solid ${done ? 'rgba(34,197,94,.3)' : 'var(--border)'}`,
                      background: done ? 'var(--success-bg)' : 'var(--card-soft)',
                      textDecoration: 'none', pointerEvents: done ? 'none' : undefined,
                    }}
                  >
                    <span style={{ fontSize: 18 }}>{done ? '✅' : icon}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: done ? 'var(--success)' : 'var(--navy)' }}>{label}</span>
                    {!done && <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--teal)', fontWeight: 700 }}>→</span>}
                  </Link>
                ))}
              </div>
            </div>
          )}

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
            const messagesOpen = openMessages.has(order.id);
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

                  {estimatedSavings !== null && estimatedSavings > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--success-bg)', border: '1px solid rgba(34,197,94,.25)', borderRadius: 'var(--radius-sm)', padding: '12px 16px' }}>
                      <span style={{ fontSize: 22 }}>💰</span>
                      <div>
                        <div style={{ fontWeight: 700, color: 'var(--success)', fontSize: 15 }}>Estimated savings: ${estimatedSavings.toFixed(2)}/mo</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>vs. your current price of {order.current_price ? `$${order.current_price.toFixed(2)}` : 'on file'}</div>
                      </div>
                    </div>
                  )}

                  {order.quoted_price !== null && (
                    <div className="detail-row">
                      <span className="detail-label">Quoted price</span>
                      <span className="detail-value" style={{ fontWeight: 800, color: 'var(--teal)', fontSize: 18 }}>${order.quoted_price.toFixed(2)}</span>
                    </div>
                  )}

                  {canPay && (
                    <a className="btn btn-primary" href={`/pay/${order.id}`} style={{ justifyContent: 'center', fontSize: 16, padding: '14px 24px' }}>
                      💳 Complete Payment →
                    </a>
                  )}

                  {/* Tracking */}
                  {order.tracking_number && (
                    <a
                      href={trackingUrl(order.tracking_carrier, order.tracking_number)}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-outline"
                      style={{ justifyContent: 'center', gap: 8 }}
                    >
                      📦 Track Package — {order.tracking_carrier ?? ''} {order.tracking_number}
                    </a>
                  )}

                  {!canPay && (
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', background: 'var(--surface-2)', borderRadius: 'var(--radius-sm)', padding: '10px 14px' }}>
                      {order.status === 'new_submission' && 'Your submission is in queue for review. Expect a response within 1–2 business days.'}
                      {order.status === 'under_review' && 'Our team is reviewing your submission. We will contact you shortly with next steps.'}
                      {order.status === 'physician_review' && 'Your order is undergoing physician review. This typically takes 1–2 additional days.'}
                      {order.status === 'fulfillment_review' && 'Your order is being reviewed by our fulfillment partner. Almost there.'}
                      {order.status === 'eligible' && 'You are eligible! A payment link is being prepared and will be sent to you shortly.'}
                      {order.status === 'missing_info' && 'We need more information. Please check your email or use the message thread below.'}
                      {order.status === 'paid' && '✅ Payment received. Your order is being processed for fulfillment.'}
                    </div>
                  )}

                  {/* Messaging */}
                  <div>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => toggleMessages(order.id)}
                      style={{ justifyContent: 'center', width: '100%' }}
                    >
                      {messagesOpen ? '▲ Hide messages' : '💬 Messages with care team'}
                    </button>
                    {messagesOpen && profile && (
                      <div style={{ marginTop: 12, border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', overflow: 'hidden' }}>
                        <MessageThread submissionId={order.id} profile={profile} />
                      </div>
                    )}
                  </div>

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
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedOrders.map((o) => (
                      <tr key={o.id}>
                        <td style={{ fontWeight: 600 }}>{o.medication}</td>
                        <td><span className={`badge ${o.status === 'fulfilled' ? 'badge-success' : o.status === 'not_eligible' ? 'badge-error' : 'badge-default'}`}>{STATUS_LABELS[o.status]}</span></td>
                        <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{new Date(o.created_at).toLocaleDateString()}</td>
                        <td>
                          {o.status === 'fulfilled' && (
                            <div>
                              <button
                                className="btn btn-primary btn-sm"
                                onClick={() => handleRefill(o)}
                                disabled={refilling === o.id}
                                style={{ fontSize: 12 }}
                              >
                                {refilling === o.id ? 'Requesting…' : '🔄 Request Refill'}
                              </button>
                              {refillMsg[o.id] && (
                                <div style={{ fontSize: 12, marginTop: 6, color: refillMsg[o.id].includes('wrong') ? 'var(--error)' : 'var(--success)' }}>
                                  {refillMsg[o.id]}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
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
