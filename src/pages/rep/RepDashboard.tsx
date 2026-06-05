import { useCallback, useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import DashLayout from '../../components/layout/DashLayout';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { Rep, PatientSubmission, CommissionLedger } from '../../types';
import { STATUS_LABELS, STATUS_COLORS } from '../../types';
import type { SubmissionStatus } from '../../types';
import { buildReferralLink, REFERRAL_DISPLAY_BASE_URL } from '../../config/referrals';
import { getDistributorProducts } from '../../data/rxPlus';
import { buildPortalLoginPath, buildPortalSignupPath, getWhiteLabelPortal } from '../../config/whiteLabelPortals';

type RepPayout = {
  id: string;
  submission_id: string | null;
  amount: number;
  pct: number;
  status: 'pending' | 'sent' | 'failed';
  paypal_batch_id: string | null;
  created_at: string;
  submission?: { full_name: string; medication: string } | null;
};

const REP_NAV = [
  { label: 'My Dashboard', path: '/rep', icon: '📊' },
];

const MARKETING_ASSETS = [
  { title: 'Premium Products', file: 'pepscript-promo-2.png', src: '/marketing/pepscript-promo-2.png' },
  { title: 'Lifestyle Performance', file: 'pepscript-promo-3.png', src: '/marketing/pepscript-promo-3.png' },
  { title: '20% Refill Offer', file: 'pepscript-promo-4.png', src: '/marketing/pepscript-promo-4.png' },
  { title: 'Transformation Offer', file: 'pepscript-promo-5.png', src: '/marketing/pepscript-promo-5.png' },
];

export default function RepDashboard() {
  const { profile } = useAuth();
  const [rep, setRep] = useState<Rep | null>(null);
  const [submissions, setSubmissions] = useState<PatientSubmission[]>([]);
  const [commissions, setCommissions] = useState<CommissionLedger[]>([]);
  const [repPayouts, setRepPayouts] = useState<RepPayout[]>([]);
  const [loading, setLoading] = useState(true);
  const [showQR, setShowQR] = useState(false);

  const loadData = useCallback(async () => {
    const { data: repData } = await supabase!.from('reps').select('*').eq('profile_id', profile!.id).maybeSingle();
    if (!repData) { setLoading(false); return; }
    const r = repData as Rep;
    setRep(r);

    const [{ data: subs }, { data: coms }, { data: payoutsData }] = await Promise.all([
      supabase!.from('patient_submissions').select('id, full_name, medication, status, created_at, quoted_price').eq('rep_id', r.id).order('created_at', { ascending: false }),
      supabase!.from('commission_ledger').select('*').eq('rep_id', r.id).order('created_at', { ascending: false }),
      supabase!.from('payouts').select('*, submission:patient_submissions(full_name, medication)').eq('recipient_type', 'rep').order('created_at', { ascending: false }),
    ]);
    setSubmissions((subs as PatientSubmission[]) ?? []);
    setCommissions((coms as CommissionLedger[]) ?? []);
    setRepPayouts((payoutsData as RepPayout[]) ?? []);
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    if (!supabase || !profile) { setLoading(false); return; }
    loadData();
  }, [profile, loadData]);

  const referralLink = rep ? buildReferralLink(rep.rep_slug, REFERRAL_DISPLAY_BASE_URL) : '';

  const earned   = commissions.filter((c) => c.status !== 'reversed').reduce((s, c) => s + c.commission_amount, 0);
  const pending  = commissions.filter((c) => c.status === 'pending').reduce((s, c) => s + c.commission_amount, 0);
  const payable  = commissions.filter((c) => c.status === 'payable').reduce((s, c) => s + c.commission_amount, 0);
  const paid     = commissions.filter((c) => c.status === 'paid').reduce((s, c) => s + c.commission_amount, 0);
  const paidOrders = submissions.filter((s) => s.status === 'paid' || s.status === 'fulfilled').length;
  const clickEstimate = submissions.length;
  const repPortal = rep
    ? [rep.custom_store_slug, rep.referral_path, rep.rep_slug, rep.brand_name]
        .map((value) => value?.trim())
        .filter(Boolean)
        .map((value) => getWhiteLabelPortal(value))
        .find(Boolean) ?? null
    : null;
  const repProducts = repPortal ? getDistributorProducts(repPortal.distributorSlug) : [];
  const customerPortalPath = repPortal ? buildPortalLoginPath(repPortal, 'patient') : '';
  const backOfficeRole = repPortal?.backOfficePortal ?? 'rep';
  const backOfficePortalPath = repPortal ? buildPortalLoginPath(repPortal, backOfficeRole) : '';
  const backOfficeLabel = backOfficeRole === 'admin' ? 'Admin Portal' : 'Rep Portal';
  const signupPath = repPortal ? buildPortalSignupPath(repPortal) : '';
  const referralAssetText = rep
    ? [
        `${rep.rep_name || rep.rep_slug} Referral Asset`,
        `Referral link: ${referralLink}`,
        repPortal ? `Storefront: ${REFERRAL_DISPLAY_BASE_URL.replace(/\/$/, '')}${repPortal.path}` : '',
        repPortal ? `Customer portal: ${REFERRAL_DISPLAY_BASE_URL.replace(/\/$/, '')}${customerPortalPath}` : '',
        repPortal ? `${backOfficeLabel}: ${REFERRAL_DISPLAY_BASE_URL.replace(/\/$/, '')}${backOfficePortalPath}` : '',
        `Discount code: ${rep.discount_code || rep.rep_slug}`,
        `Customer offer: $${rep.discount_amount ?? 10} off first eligible order`,
        `Commission: ${(rep.commission_rate * 100).toFixed(0)}% of net profit`,
        `Tier: ${(rep.rep_tier || 'standard_rep').replace(/_/g, ' ')}`,
      ].filter(Boolean).join('\n')
    : '';

  function downloadReferralAsset() {
    if (!rep) return;
    const blob = new Blob([referralAssetText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${rep.rep_slug}-referral-assets.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <DashLayout title="My Dashboard" navItems={REP_NAV}>
      {loading ? (
        <div style={{ padding: 64, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : !rep ? (
        <div className="card">
          <div className="card-body">
            <div className="empty-state">
              <div className="empty-state-icon">🔗</div>
              <div className="empty-state-title">Rep account not set up</div>
              <div className="empty-state-desc">Contact admin to set up your rep profile and get your referral link.</div>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="stats-grid mb-8">
            <div className="stat-card">
              <div className="stat-value">{submissions.length}</div>
              <div className="stat-label">Total Leads</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{clickEstimate}</div>
              <div className="stat-label">Tracked Clicks</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{submissions.filter((s) => s.status === 'new_submission' || s.status === 'under_review' || s.status === 'physician_review').length}</div>
              <div className="stat-label">Pending Review</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{submissions.filter((s) => s.status === 'eligible' || s.status === 'payment_sent').length}</div>
              <div className="stat-label">Approved / Quoted</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{paidOrders}</div>
              <div className="stat-label">Paid Orders</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--success)' }}>${earned.toFixed(2)}</div>
              <div className="stat-label">Total Earned</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--warning)' }}>${pending.toFixed(2)}</div>
              <div className="stat-label">Pending</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--info)' }}>${payable.toFixed(2)}</div>
              <div className="stat-label">Ready to Pay</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">${paid.toFixed(2)}</div>
              <div className="stat-label">Paid Out</div>
            </div>
          </div>

          {/* Referral link */}
          <div className="card mb-6">
            <div className="card-header" style={{ paddingBottom: 16 }}>
              <div className="card-title">Your Referral Link</div>
              {(rep.rep_name || rep.handle || rep.rep_identifier) && (
                <div className="card-subtitle">
                  {[rep.rep_name, rep.handle, rep.rep_identifier].filter(Boolean).join(' - ')}
                  {rep.rep_tier && ` - ${rep.rep_tier.replace(/_/g, ' ')}`}
                </div>
              )}
              {rep.discount_code && (
                <div className="card-subtitle">
                  Code {rep.discount_code}: ${rep.discount_amount ?? 0} off first eligible order. Your commission rate is {(rep.commission_rate * 100).toFixed(0)}% of net profit.
                </div>
              )}
            </div>
            <div className="card-body">
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{
                  flex: 1, background: 'var(--card-soft)', border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)', padding: '10px 14px',
                  fontFamily: 'monospace', fontSize: 14, color: 'var(--teal)',
                  overflowX: 'auto', whiteSpace: 'nowrap',
                }}>
                  {referralLink}
                </div>
                <button className="btn btn-outline btn-sm" onClick={() => navigator.clipboard.writeText(referralLink)}>
                  Copy Link
                </button>
                <button className="btn btn-outline btn-sm" onClick={() => setShowQR(!showQR)}>
                  {showQR ? 'Hide QR' : 'Show QR'}
                </button>
                <button className="btn btn-outline btn-sm" onClick={downloadReferralAsset}>
                  Download Assets
                </button>
              </div>

              {showQR && (
                <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
                  <div className="qr-wrap">
                    <QRCodeSVG value={referralLink} size={180} />
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center' }}>
                      Scan to open your referral link
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Rep: <strong>{rep.rep_slug}</strong></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {(repPortal || rep.custom_store_slug || repProducts.length > 0) && (
            <div className="card mb-6">
              <div className="card-header" style={{ paddingBottom: 16 }}>
                <div className="card-title">{repPortal?.brandName || rep.brand_name || rep.rep_name || rep.rep_slug} Portal Tools</div>
                <div className="card-subtitle">Storefront, customer portal, back-office portal, and custom catalog visibility.</div>
              </div>
              <div className="card-body" style={{ display: 'grid', gap: 16 }}>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {(repPortal || rep.custom_store_slug) && (
                    <a className="btn btn-primary btn-sm" href={repPortal?.path ?? `/${rep.custom_store_slug}`} target="_blank" rel="noreferrer">
                      Open {repPortal?.path ?? `/${rep.custom_store_slug}`}
                    </a>
                  )}
                  {repPortal && (
                    <>
                      <a className="btn btn-outline btn-sm" href={customerPortalPath} target="_blank" rel="noreferrer">
                        Customer Portal
                      </a>
                      <a className="btn btn-outline btn-sm" href={signupPath} target="_blank" rel="noreferrer">
                        Customer Signup
                      </a>
                      <a className="btn btn-outline btn-sm" href={backOfficePortalPath} target="_blank" rel="noreferrer">
                        {backOfficeLabel}
                      </a>
                    </>
                  )}
                </div>
                {repProducts.length > 0 && (
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Category</th>
                          <th>Price</th>
                        </tr>
                      </thead>
                      <tbody>
                        {repProducts.map((product) => (
                          <tr key={product.id}>
                            <td>
                              <div style={{ fontWeight: 700 }}>{product.product_name}</div>
                              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{product.strength}</div>
                            </td>
                            <td style={{ fontSize: 13 }}>{product.category}</td>
                            <td style={{ fontWeight: 800 }}>${product.displayPrice?.toFixed(2) ?? '0.00'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Marketing assets */}
          <div className="card mb-6">
            <div className="card-header" style={{ paddingBottom: 16 }}>
              <div className="card-title">Marketing Assets</div>
              <div className="card-subtitle">
                Use these polished creatives with your referral link. Keep the caption focused on refill savings and eligibility review.
              </div>
            </div>
            <div className="card-body">
              <div className="rep-assets-grid">
                {MARKETING_ASSETS.map((asset) => (
                  <div className="rep-asset-card" key={asset.src}>
                    <div className="rep-asset-preview">
                      <img src={asset.src} alt={`${asset.title} campaign asset`} loading="lazy" />
                    </div>
                    <div className="rep-asset-meta">
                      <div>
                        <div style={{ fontWeight: 800, color: 'var(--navy)' }}>{asset.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>PepScriptRX campaign creative</div>
                      </div>
                      <a href={asset.src} download={asset.file} className="btn btn-outline btn-sm">
                        Download
                      </a>
                    </div>
                  </div>
                ))}
              </div>
              <div className="disclaimer" style={{ marginTop: 18 }}>
                Share assets with your referral link. Do not promise approval, medical outcomes, specific weight loss, or guaranteed savings. Orders remain subject to review.
              </div>
            </div>
          </div>

          {/* Commission ledger */}
          <div className="card mb-6">
            <div className="card-header" style={{ paddingBottom: 16 }}>
              <div className="card-title">Commission Ledger</div>
              <div className="card-subtitle">
                Earned: <strong style={{ color: 'var(--success)' }}>${earned.toFixed(2)}</strong>
                {' · '}Pending: <strong style={{ color: 'var(--warning)' }}>${pending.toFixed(2)}</strong>
                {' · '}Ready to pay: <strong style={{ color: 'var(--info)' }}>${payable.toFixed(2)}</strong>
                {' · '}Paid out: <strong>${paid.toFixed(2)}</strong>
              </div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Order</th>
                    <th>Gross Sale</th>
                    <th>Rate</th>
                    <th>Commission</th>
                    <th>Status</th>
                    <th>Payout Date</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>No commissions yet. Share your referral link to get started!</td></tr>
                  ) : commissions.map((c) => {
                    const relatedSub = submissions.find((s) => s.id === c.submission_id);
                    return (
                      <tr key={c.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{relatedSub?.medication ?? 'Order'}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{new Date(c.created_at).toLocaleDateString()}</div>
                        </td>
                        <td>${c.gross_sale?.toFixed(2) ?? '—'}</td>
                        <td>{((c.commission_rate ?? 0) * 100).toFixed(0)}%</td>
                        <td style={{ fontWeight: 700, color: 'var(--success)' }}>${c.commission_amount?.toFixed(2) ?? '—'}</td>
                        <td>
                          <span className={`badge ${c.status === 'paid' ? 'badge-success' : c.status === 'payable' ? 'badge-info' : c.status === 'reversed' ? 'badge-error' : 'badge-warning'}`}>
                            {c.status}
                          </span>
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                          {c.payout_date ? new Date(c.payout_date).toLocaleDateString() : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* PayPal payout history */}
          {repPayouts.length > 0 && (
            <div className="card mb-6">
              <div className="card-header" style={{ paddingBottom: 16 }}>
                <div className="card-title">PayPal Payout History</div>
                <div className="card-subtitle">
                  Manual PayPal payouts sent by admin after review. Total sent:&nbsp;
                  <strong style={{ color: 'var(--success)' }}>
                    ${repPayouts.filter((p) => p.status === 'sent').reduce((s, p) => s + p.amount, 0).toFixed(2)}
                  </strong>
                </div>
              </div>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Amount</th>
                      <th>Split</th>
                      <th>Status</th>
                      <th>PayPal Batch</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {repPayouts.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{p.submission?.medication ?? 'Order'}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{p.submission?.full_name ?? '—'}</div>
                        </td>
                        <td style={{ fontWeight: 700, color: 'var(--success)' }}>${p.amount?.toFixed(2)}</td>
                        <td style={{ fontSize: 13 }}>{p.pct}%</td>
                        <td>
                          <span className={`badge ${p.status === 'sent' ? 'badge-success' : p.status === 'failed' ? 'badge-error' : 'badge-warning'}`}>
                            {p.status}
                          </span>
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                          {p.paypal_batch_id ? p.paypal_batch_id.slice(0, 16) + '…' : '—'}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {new Date(p.created_at).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Submissions */}
          <div className="card">
            <div className="card-header" style={{ paddingBottom: 16 }}>
              <div className="card-title">My Leads</div>
              <div className="card-subtitle">You cannot view uploaded documents. Commission is earned when orders are fulfilled.</div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Medication</th>
                    <th>Status</th>
                    <th>Submitted</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>No leads yet.</td></tr>
                  ) : submissions.map((s) => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 600 }}>{s.full_name}</td>
                      <td>{s.medication}</td>
                      <td>
                        <span className={`badge ${STATUS_COLORS[s.status as SubmissionStatus] ?? 'badge-default'}`}>
                          {STATUS_LABELS[s.status as SubmissionStatus] ?? s.status}
                        </span>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{new Date(s.created_at).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </DashLayout>
  );
}
