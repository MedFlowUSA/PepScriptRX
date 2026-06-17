import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashLayout from '../../components/layout/DashLayout';
import { sendCustomerOrderEmail, supabase, type CustomerOrderEmailRecord, type OrderEmailType } from '../../lib/supabase';
import type { PatientSubmission, SubmissionDocument, Rep, Profile, SubmissionStatus, CryptoAsset, CryptoPaymentStatus, CustomerManualReviewStatus } from '../../types';
import { STATUS_LABELS, STATUS_COLORS, ALL_STATUSES, SHIPPING_OPTIONS, CRYPTO_PAYMENT_STATUS_LABELS, ALL_CRYPTO_STATUSES, ALL_CUSTOMER_MANUAL_REVIEW_STATUSES, CUSTOMER_MANUAL_REVIEW_STATUS_LABELS } from '../../types';
import { MessageThread } from '../../components/MessageThread';
import { useAuth } from '../../context/AuthContext';
import { PHYSIOPEPTIDES_COMMISSION_RATE, PHYSIOPEPTIDES_STORE_NAME, isPhysioPeptidesOrder } from '../../lib/rockPhormScope';
import { anatoliaStorefront } from '../../config/anatolia';

import { ADMIN_NAV } from './adminNav';
import { CRYPTO_WALLETS } from '../../config';

type OrderItemSnapshot = {
  id?: string;
  sku?: string | null;
  name?: string;
  display_name_at_purchase?: string;
  quantity?: number;
  qty?: number;
  price?: number;
  inventory_status_label_at_purchase?: string;
  inventory_status_at_purchase?: string;
  was_special_order?: boolean;
  estimated_fulfillment_days_at_purchase?: number;
};

export default function AdminSubmissionDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [submission, setSubmission] = useState<PatientSubmission | null>(null);
  const [documents, setDocuments] = useState<SubmissionDocument[]>([]);
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});
  const [reps, setReps] = useState<Rep[]>([]);
  const [physicians, setPhysicians] = useState<Profile[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');
  const [loading, setLoading] = useState(true);
  const [smsSending, setSmsSending] = useState(false);
  const [smsMsg, setSmsMsg] = useState('');
  const [reminderSending, setReminderSending] = useState(false);
  const [reminderMsg, setReminderMsg] = useState('');
  const [emailSending, setEmailSending] = useState<OrderEmailType | ''>('');
  const [emailMsg, setEmailMsg] = useState('');

  // Editable fields
  const [status, setStatus] = useState<SubmissionStatus>('new_submission');
  const [repId, setRepId] = useState('');
  const [physicianId, setPhysicianId] = useState('');
  const [quotedPrice, setQuotedPrice] = useState('');
  const [costOfGoods, setCostOfGoods] = useState('');
  const [estimatedSavings, setEstimatedSavings] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [manualReviewStatus, setManualReviewStatus] = useState<CustomerManualReviewStatus | ''>('');
  const [manualReviewNotes, setManualReviewNotes] = useState('');
  const [recommendedAction, setRecommendedAction] = useState('');
  const [paypalCopied, setPaypalCopied] = useState(false);

  // Crypto payment fields
  const [cryptoAsset, setCryptoAsset] = useState<CryptoAsset | ''>('');
  const [cryptoAddress, setCryptoAddress] = useState('');
  const [cryptoDestinationTag, setCryptoDestinationTag] = useState('');
  const [cryptoExpectedUsd, setCryptoExpectedUsd] = useState('');
  const [cryptoExpectedAsset, setCryptoExpectedAsset] = useState('');
  const [cryptoTxHash, setCryptoTxHash] = useState('');
  const [cryptoPaymentStatus, setCryptoPaymentStatus] = useState<CryptoPaymentStatus | ''>('');
  const [cryptoNotes, setCryptoNotes] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingCarrier, setTrackingCarrier] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');

  const CRYPTO_DEFAULTS: Record<CryptoAsset, { address: string; tag?: string | null }> = CRYPTO_WALLETS;
  const isAnatoliaOrder = submission?.store_slug === anatoliaStorefront.slug
    || submission?.source_portal === anatoliaStorefront.brandName
    || submission?.locale === anatoliaStorefront.locale;

  const loadSubmission = useCallback(async () => {
    const { data } = await supabase!.from('patient_submissions').select('*').eq('id', id).single();
    if (data) {
      const s = data as PatientSubmission;
      setSubmission(s);
      setStatus(s.status);
      setRepId(s.rep_id ?? '');
      setPhysicianId(s.physician_id ?? '');
      setQuotedPrice(s.quoted_price?.toString() ?? '');
      setCostOfGoods(s.cost_of_goods?.toString() ?? '');
      setEstimatedSavings(s.estimated_savings?.toString() ?? '');
      setAdminNotes(s.admin_notes ?? '');
      setManualReviewStatus(s.manual_review_status ?? '');
      setManualReviewNotes(s.manual_review_notes ?? '');
      setRecommendedAction(s.recommended_action ?? '');
      setCryptoAsset((s.crypto_asset as CryptoAsset) ?? '');
      setCryptoAddress(s.crypto_address ?? '');
      setCryptoDestinationTag(s.crypto_destination_tag ?? '');
      setCryptoExpectedUsd(s.crypto_expected_amount_usd?.toString() ?? '');
      setCryptoExpectedAsset(s.crypto_expected_amount_asset?.toString() ?? '');
      setCryptoTxHash(s.crypto_tx_hash ?? '');
      setCryptoPaymentStatus((s.crypto_payment_status as CryptoPaymentStatus) ?? '');
      setCryptoNotes(s.crypto_notes ?? '');
      setPaidAt(s.paid_at ? s.paid_at.slice(0, 16) : '');
      setTrackingNumber(s.tracking_number ?? '');
      setTrackingCarrier(s.tracking_carrier ?? '');
      setTrackingUrl(s.tracking_url ?? '');
    }
  }, [id]);

  const loadDocs = useCallback(async () => {
    const { data } = await supabase!.from('submission_documents').select('*').eq('submission_id', id);
    const docs = (data as SubmissionDocument[]) ?? [];
    setDocuments(docs);

    // Generate signed URLs for each doc
    const urls: Record<string, string> = {};
    await Promise.all(
      docs.map(async (doc) => {
        const { data: signedData } = await supabase!.storage
          .from('submission-documents')
          .createSignedUrl(doc.file_path, 3600);
        if (signedData?.signedUrl) urls[doc.id] = signedData.signedUrl;
      }),
    );
    setDocUrls(urls);
  }, [id]);

  const loadReps = useCallback(async () => {
    const { data } = await supabase!.from('reps').select('*, profile:profiles(full_name)').eq('active', true);
    setReps((data as Rep[]) ?? []);
  }, []);

  const loadPhysicians = useCallback(async () => {
    const { data } = await supabase!.from('profiles').select('*').eq('role', 'physician');
    setPhysicians((data as Profile[]) ?? []);
  }, []);

  useEffect(() => {
    if (!supabase || !id) { setLoading(false); return; }
    Promise.all([loadSubmission(), loadDocs(), loadReps(), loadPhysicians()]).finally(() => setLoading(false));
  }, [id, loadSubmission, loadDocs, loadReps, loadPhysicians]);

  async function handleSave() {
    if (!supabase || !id || !submission) return;
    setSaving(true);
    setSaveMsg('');
    setEmailMsg('');

    const nextPaidAt = status === 'paid' || status === 'fulfilled'
      ? (paidAt ? new Date(paidAt).toISOString() : (submission.paid_at ?? new Date().toISOString()))
      : (paidAt ? new Date(paidAt).toISOString() : null);
    const updates: Partial<PatientSubmission> & Record<string, unknown> = {
      status,
      rep_id:            repId || null,
      physician_id:      physicianId || null,
      quoted_price:      quotedPrice ? parseFloat(quotedPrice) : null,
      cost_of_goods:     costOfGoods ? parseFloat(costOfGoods) : 0,
      estimated_savings: estimatedSavings ? parseFloat(estimatedSavings) : null,
      admin_notes:                adminNotes || null,
      manual_review_status:       manualReviewStatus || null,
      manual_review_notes:        manualReviewNotes || null,
      recommended_action:         recommendedAction || null,
      reviewed_by:                manualReviewStatus || manualReviewNotes || recommendedAction ? (profile?.id ?? submission.reviewed_by ?? null) : null,
      reviewed_at:                manualReviewStatus || manualReviewNotes || recommendedAction ? new Date().toISOString() : null,
      manual_review_source:       manualReviewStatus || manualReviewNotes || recommendedAction ? 'admin-order-detail' : null,
      crypto_asset:               cryptoAsset || null,
      crypto_address:             cryptoAddress || null,
      crypto_destination_tag:     cryptoDestinationTag || null,
      crypto_expected_amount_usd:   cryptoExpectedUsd ? parseFloat(cryptoExpectedUsd) : null,
      crypto_expected_amount_asset: cryptoExpectedAsset ? parseFloat(cryptoExpectedAsset) : null,
      crypto_tx_hash:             cryptoTxHash || null,
      crypto_payment_status:      cryptoPaymentStatus || null,
      crypto_notes:               cryptoNotes || null,
      paid_at:                    nextPaidAt,
      tracking_number:            trackingNumber || null,
      tracking_carrier:           trackingCarrier || null,
      tracking_url:               trackingUrl || null,
      updated_at:                 new Date().toISOString(),
    };

    if (status === 'paid' || status === 'fulfilled') {
      updates.payment_status = 'paid';
      updates.payment_provider = submission.payment_provider ?? 'manual';
    }

    const { data: savedRows, error } = await supabase!
      .from('patient_submissions')
      .update(updates)
      .eq('id', id)
      .select('id')
      .limit(1);

    if (error) {
      setSaveMsg(`Save failed: ${error.message}`);
      setSaving(false);
      setTimeout(() => setSaveMsg(''), 8000);
      return;
    }

    if (!savedRows || savedRows.length === 0) {
      setSaveMsg('Save failed: no matching order was updated. Check admin permissions for this store.');
      setSaving(false);
      setTimeout(() => setSaveMsg(''), 8000);
      return;
    }

    {
      setSaveMsg(status === 'paid' || status === 'fulfilled' ? 'Saved successfully. Payment marked paid.' : 'Saved successfully.');
      if (nextPaidAt) setPaidAt(nextPaidAt.slice(0, 16));
      await supabase!.from('audit_logs').insert({ submission_id: id, action: 'admin_update', notes: `Status changed to ${status}` });

      // Auto-create commission ledger entry if rep is assigned and status is paid
      if (repId && (status === 'paid' || status === 'fulfilled') && quotedPrice) {
        const rep = reps.find((r) => r.id === repId);
        const isPhysioOrder = isPhysioPeptidesOrder({
          ...submission,
          checkout_scope_code: submission.checkout_scope_code,
          store_slug: submission.store_slug,
          store_name: submission.store_name,
          source_portal: submission.source_portal,
          source_store: submission.source_store,
          source_admin: submission.source_admin,
          source_rep: submission.source_rep,
          admin_code: submission.admin_code,
          referral_code: submission.referral_code,
          discount_code: submission.discount_code,
          rep,
        });
        const rate = Math.min(rep?.commission_rate ?? 0.20, isPhysioOrder ? PHYSIOPEPTIDES_COMMISSION_RATE : 1);
        const parentRep = rep?.parent_rep_id ? reps.find((r) => r.id === rep.parent_rep_id) : null;
        const overrideRate = isPhysioOrder && parentRep
          ? Math.max(0, PHYSIOPEPTIDES_COMMISSION_RATE - rate)
          : rep?.override_percent ?? 0;
        const platformRate = isPhysioOrder ? 0.01 : rep?.platform_percent ?? Math.max(0, 1 - rate - overrideRate);
        const gross = parseFloat(quotedPrice);
        const cogs = costOfGoods ? parseFloat(costOfGoods) : 0;
        const netProfit = Math.max(0, gross - (submission?.discount_amount ?? 0) - cogs);
        const ledgerStatus = status === 'fulfilled' ? 'payable' : 'pending';
        const ledgerRows = [{
          submission_id: id,
          rep_id: repId,
          gross_sale: gross,
          margin: netProfit,
          commission_rate: rate,
          commission_amount: netProfit * rate,
          commission_role: 'rep_commission_owner',
          owner_label: rep?.rep_name ?? rep?.rep_slug ?? 'Rep',
          status: ledgerStatus,
        }];
        if (parentRep && overrideRate > 0) {
          ledgerRows.push({
            submission_id: id,
            rep_id: parentRep.id,
            gross_sale: gross,
            margin: netProfit,
            commission_rate: overrideRate,
            commission_amount: netProfit * overrideRate,
            commission_role: 'override_owner',
            owner_label: isPhysioOrder ? PHYSIOPEPTIDES_STORE_NAME : parentRep.rep_name ?? parentRep.rep_slug ?? 'Parent rep',
            status: ledgerStatus,
          });
        }
        if (platformRate > 0) {
          ledgerRows.push({
            submission_id: id,
            rep_id: repId,
            gross_sale: gross,
            margin: netProfit,
            commission_rate: platformRate,
            commission_amount: netProfit * platformRate,
            commission_role: 'platform_margin_owner',
            owner_label: 'PepScriptRX',
            status: ledgerStatus,
          });
        }
        await supabase!.from('commission_ledger').upsert(ledgerRows, { onConflict: 'submission_id,rep_id,commission_role' });
      }

      // Auto-send payment email when status is set to payment_sent
      if (status === 'payment_sent') {
        try {
          const { data: { session } } = await supabase!.auth.getSession();
          await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-payment-sent`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session?.access_token ?? ''}`,
            },
            body: JSON.stringify({
              id,
              email:           submission.email,
              full_name:       submission.full_name,
              medication:      submission.medication,
              quoted_price:    quotedPrice ? parseFloat(quotedPrice) : null,
              discount_amount: submission.discount_amount ?? 0,
              discount_code:   submission.discount_code ?? null,
              shipping_cost:   submission.shipping_cost ?? 0,
              shipping_speed:  submission.shipping_speed ?? null,
            }),
          });
        } catch {
          // Payment email failed silently — admin can resend manually
        }
      }

      if (status === 'payment_sent' && quotedPrice) {
        await sendOrderEmail('order_confirmation', false);
      }

      const trackingChanged = Boolean(trackingNumber) && (
        trackingNumber !== (submission.tracking_number ?? '')
        || trackingCarrier !== (submission.tracking_carrier ?? '')
        || trackingUrl !== (submission.tracking_url ?? '')
      );
      const statusBecameShipped = status === 'shipped' && submission.status !== 'shipped';
      if (trackingNumber && (trackingChanged || statusBecameShipped)) {
        await sendOrderEmail('shipping_confirmation', false);
      }

    }

    setSaving(false);
    await loadSubmission();
    setTimeout(() => setSaveMsg(''), 3000);
  }

  async function sendOrderEmail(type: OrderEmailType, force: boolean) {
    if (!submission) return;
    setEmailSending(type);
    try {
      const result = await sendCustomerOrderEmail(type, buildOrderEmailRecord(), force);
      const skipped = typeof result.skipped === 'string';
      setEmailMsg(skipped
        ? `${emailLabel(type)} already sent.`
        : `${emailLabel(type)} sent.`);
      await loadSubmission();
    } catch (err) {
      setEmailMsg(`${emailLabel(type)} failed: ${String(err)}`);
    } finally {
      setEmailSending('');
      setTimeout(() => setEmailMsg(''), 6000);
    }
  }

  function buildOrderEmailRecord(): CustomerOrderEmailRecord {
    const productTotal = quotedPrice ? parseFloat(quotedPrice) : (submission?.quoted_price ?? 0);
    const shippingCost = submission?.shipping_cost ?? 0;
    const discountAmount = submission?.discount_amount ?? 0;
    const orderItems = Array.isArray(submission?.order_items) && submission.order_items.length > 0
      ? submission.order_items
      : [{ name: submission?.medication ?? 'PepScriptRX order', price: productTotal, quantity: 1 }];

    return {
      id: id ?? submission?.id ?? '',
      email: submission?.email,
      full_name: submission?.full_name,
      order_number: submission?.order_number || (id ? `PSRX-${id.slice(0, 8).toUpperCase()}` : null),
      order_items: orderItems,
      order_total: Math.max(0, productTotal + shippingCost - discountAmount),
      quoted_price: productTotal,
      shipping_cost: shippingCost,
      discount_amount: discountAmount,
      medication: submission?.medication,
      referral_code: submission?.referral_code,
      discount_code: submission?.discount_code,
      checkout_scope_code: submission?.checkout_scope_code,
      source_portal: submission?.source_portal,
      store_slug: submission?.store_slug,
      store_name: submission?.store_name,
      locale: submission?.locale,
      tracking_carrier: trackingCarrier || submission?.tracking_carrier,
      tracking_number: trackingNumber || submission?.tracking_number,
      tracking_url: trackingUrl || submission?.tracking_url,
    };
  }

  function emailLabel(type: OrderEmailType) {
    return type === 'order_confirmation' ? 'Order confirmation email' : 'Shipping email';
  }

  async function handleSendSms() {
    if (!submission?.phone || !supabase) return;
    setSmsSending(true);
    setSmsMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          phone: submission.phone,
          name: submission.full_name,
          status,
          quoted_price: quotedPrice ? parseFloat(quotedPrice) : undefined,
        }),
      });
      const json = await res.json();
      setSmsMsg(res.ok ? `SMS sent (${json.sid ?? 'ok'})` : `SMS failed: ${json.error ?? 'unknown error'}`);
    } catch (err) {
      setSmsMsg(`SMS error: ${String(err)}`);
    }
    setSmsSending(false);
    setTimeout(() => setSmsMsg(''), 5000);
  }

  async function handleSendReminder() {
    if (!submission?.phone || !supabase) return;
    setReminderSending(true);
    setReminderMsg('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-sms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: JSON.stringify({
          phone: submission.phone,
          name: submission.full_name,
          status: 'injection_reminder',
          medication: submission.medication,
        }),
      });
      const json = await res.json();
      setReminderMsg(res.ok ? `Reminder sent (${json.sid ?? 'ok'})` : `Failed: ${json.error ?? 'unknown error'}`);
    } catch (err) {
      setReminderMsg(`Error: ${String(err)}`);
    }
    setReminderSending(false);
    setTimeout(() => setReminderMsg(''), 5000);
  }

  if (loading) {
    return (
      <DashLayout title="Submission Detail" navItems={ADMIN_NAV}>
        <div style={{ padding: 64, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      </DashLayout>
    );
  }

  if (!submission) {
    return (
      <DashLayout title="Submission Not Found" navItems={ADMIN_NAV}>
        <div className="empty-state"><div className="empty-state-title">Submission not found.</div></div>
      </DashLayout>
    );
  }

  const orderItems = Array.isArray(submission.order_items)
    ? (submission.order_items as OrderItemSnapshot[])
    : [];

  return (
    <DashLayout
      title={`Review: ${submission.full_name}`}
      navItems={ADMIN_NAV}
      actions={
        <div className="flex items-center gap-3">
          {saveMsg && <span className="text-success text-sm">{saveMsg}</span>}
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <Link to="/admin/submissions" style={{ fontSize: 14, color: 'var(--text-muted)' }}>← All Orders</Link>
      </div>

      <div className="detail-grid">
        {/* Left column */}
        <div>
          {/* Patient Info */}
          <div className="card mb-6">
            <div className="card-header" style={{ paddingBottom: 16 }}>
              <div className="card-title">Patient Information</div>
            </div>
            <div className="card-body">
              <div className="detail-section-title">Contact</div>
              <div className="detail-row"><span className="detail-label">Full name</span><span className="detail-value">{submission.full_name}</span></div>
              <div className="detail-row"><span className="detail-label">Email</span><span className="detail-value"><a href={`mailto:${submission.email}`} style={{ color: 'var(--teal)' }}>{submission.email}</a></span></div>
              <div className="detail-row"><span className="detail-label">Phone</span><span className="detail-value"><a href={`tel:${submission.phone}`} style={{ color: 'var(--teal)' }}>{submission.phone}</a></span></div>
              <div className="detail-row"><span className="detail-label">Date of birth</span><span className="detail-value">{submission.date_of_birth}</span></div>
              <div className="detail-row"><span className="detail-label">State</span><span className="detail-value">{submission.state}</span></div>

              <div className="detail-section-title" style={{ marginTop: 20 }}>Medication</div>
              <div className="detail-row"><span className="detail-label">Medication</span><span className="detail-value" style={{ fontWeight: 700 }}>{submission.medication}</span></div>
              {orderItems.length > 0 && (
                <div style={{ display: 'grid', gap: 8, margin: '10px 0 4px' }}>
                  {orderItems.map((item, index) => (
                    <div key={`${item.id ?? item.sku ?? index}`} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '10px 12px', background: 'var(--card-soft)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: 800, color: 'var(--navy)', fontSize: 13 }}>
                            {item.display_name_at_purchase || item.name || item.id || item.sku || 'Order item'}
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                            Qty {item.quantity ?? item.qty ?? 1}{item.sku ? ` - ${item.sku}` : ''}
                          </div>
                        </div>
                        {typeof item.price === 'number' && (
                          <div style={{ fontWeight: 800, color: 'var(--navy)', fontSize: 13 }}>${item.price.toFixed(2)}</div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                        <span className={`badge ${item.was_special_order ? 'badge-info' : 'badge-success'}`}>
                          {item.inventory_status_label_at_purchase || item.inventory_status_at_purchase || 'Inventory snapshot'}
                        </span>
                        {item.was_special_order && (
                          <span style={{ fontSize: 12, color: '#0e7490', fontWeight: 800 }}>
                            Out of stock - fulfillment timing confirmed after review
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <div className="detail-row"><span className="detail-label">Current dose</span><span className="detail-value">{submission.current_dose || '—'}</span></div>
              <div className="detail-row"><span className="detail-label">Monthly price paid</span><span className="detail-value" style={{ fontWeight: 700 }}>{submission.current_price ? `$${submission.current_price.toFixed(2)}` : '—'}</span></div>
              <div className="detail-row"><span className="detail-label">Pharmacy / Source</span><span className="detail-value">{submission.current_pharmacy || '—'}</span></div>

              <div className="detail-section-title" style={{ marginTop: 20 }}>Shipping Address</div>
              <div className="detail-row"><span className="detail-label">Street</span><span className="detail-value">{submission.shipping_address || '—'}</span></div>
              <div className="detail-row"><span className="detail-label">City / State / ZIP</span><span className="detail-value">{[submission.shipping_city, submission.shipping_state, submission.shipping_zip].filter(Boolean).join(', ') || '—'}</span></div>
              <div className="detail-row">
                <span className="detail-label">Shipping speed</span>
                <span className="detail-value">
                  {submission.shipping_speed
                    ? SHIPPING_OPTIONS.find(o => o.value === submission.shipping_speed)?.label ?? submission.shipping_speed
                    : '—'}
                  {submission.shipping_cost != null && submission.shipping_cost > 0 && (
                    <span style={{ marginLeft: 8, color: 'var(--teal)', fontWeight: 600 }}>+${submission.shipping_cost}</span>
                  )}
                </span>
              </div>

              <div className="detail-section-title" style={{ marginTop: 20 }}>Submission</div>
              <div className="detail-row"><span className="detail-label">Submitted</span><span className="detail-value">{new Date(submission.created_at).toLocaleString()}</span></div>
              <div className="detail-row"><span className="detail-label">Last updated</span><span className="detail-value">{new Date(submission.updated_at).toLocaleString()}</span></div>
              <div className="detail-section-title" style={{ marginTop: 20 }}>Referral</div>
              <div className="detail-row"><span className="detail-label">Referral source</span><span className="detail-value">{submission.referral_code || 'None'}</span></div>
              <div className="detail-row"><span className="detail-label">Discount code</span><span className="detail-value">{submission.discount_code || 'None'}</span></div>
              <div className="detail-row"><span className="detail-label">Discount amount</span><span className="detail-value">{submission.discount_amount ? `$${submission.discount_amount.toFixed(2)}` : '$0.00'}</span></div>
            </div>
          </div>

          {/* Customer Link Review */}
          <div className="card mb-6">
            <div className="card-header" style={{ paddingBottom: 16 }}>
              <div>
                <div className="card-title">Customer Link Review</div>
                <div className="card-subtitle">Classify unlinked checkout records without attaching or deleting anything.</div>
              </div>
              {manualReviewStatus && (
                <span className="badge badge-warning">
                  {CUSTOMER_MANUAL_REVIEW_STATUS_LABELS[manualReviewStatus]}
                </span>
              )}
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ background: 'var(--card-soft)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', fontSize: 13, color: 'var(--text-muted)' }}>
                Use this for historical unlinked submissions only. It preserves order, payment, rep, store, promo, and commission history.
              </div>

              <div className="detail-row">
                <span className="detail-label">Customer profile link</span>
                <span className="detail-value">{submission.patient_profile_id ? 'Linked' : 'Unlinked'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Payment status</span>
                <span className="detail-value">{submission.payment_status || 'unknown'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Attribution</span>
                <span className="detail-value">
                  {[submission.store_slug, submission.source_store, submission.source_rep, submission.checkout_scope_code, submission.discount_code].filter(Boolean).join(' / ') || 'None'}
                </span>
              </div>
              {isAnatoliaOrder && (
                <div style={{ background: '#fbf8ef', border: '1px solid rgba(212,175,55,.35)', borderRadius: 'var(--radius-sm)', padding: '12px 14px', fontSize: 13, color: '#0B1F33' }}>
                  <strong>Anatolia Wellness Labs:</strong> master-owned Turkish storefront. Commission owner is Main PepScriptRX, partner payout eligible is false, and order revenue remains on the platform path.
                </div>
              )}
              {submission.reviewed_at && (
                <div className="detail-row">
                  <span className="detail-label">Last reviewed</span>
                  <span className="detail-value">{new Date(submission.reviewed_at).toLocaleString()}</span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Manual review status</label>
                <select
                  className="form-select"
                  value={manualReviewStatus}
                  onChange={(e) => setManualReviewStatus(e.target.value as CustomerManualReviewStatus | '')}
                >
                  <option value="">Not reviewed</option>
                  {ALL_CUSTOMER_MANUAL_REVIEW_STATUSES.map((value) => (
                    <option key={value} value={value}>{CUSTOMER_MANUAL_REVIEW_STATUS_LABELS[value]}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Recommended action</label>
                <input
                  className="form-input"
                  value={recommendedAction}
                  onChange={(e) => setRecommendedAction(e.target.value)}
                  placeholder="e.g. Leave unlinked unless customer identity is confirmed manually"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Manual review notes</label>
                <textarea
                  className="form-textarea w-full"
                  rows={4}
                  value={manualReviewNotes}
                  onChange={(e) => setManualReviewNotes(e.target.value)}
                  placeholder="Document why this should stay unlinked, be treated as QA/internal, or require customer confirmation."
                />
              </div>
            </div>
          </div>

          {/* Documents */}
          <div className="card mb-6">
            <div className="card-header" style={{ paddingBottom: 16 }}>
              <div className="card-title">Uploaded Documents</div>
            </div>
            <div className="card-body">
              {documents.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No documents uploaded.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {documents.map((doc) => (
                    <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--card-soft)' }}>
                      <span style={{ fontSize: 20 }}>
                        {doc.document_type === 'prescription' ? '📄' : doc.document_type === 'receipt' ? '🧾' : '💊'}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--navy)', textTransform: 'capitalize' }}>
                          {doc.document_type.replace('_', ' ')}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                          {new Date(doc.uploaded_at).toLocaleDateString()}
                        </div>
                      </div>
                      {docUrls[doc.id] ? (
                        <a href={docUrls[doc.id]} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
                          View File ↗
                        </a>
                      ) : (
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Admin Notes */}
          <div className="card">
            <div className="card-header" style={{ paddingBottom: 16 }}>
              <div className="card-title">Admin Notes</div>
            </div>
            <div className="card-body">
              <textarea
                className="form-textarea w-full"
                placeholder="Internal notes — not visible to patient…"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                style={{ minHeight: 120 }}
              />
            </div>
          </div>
        </div>

        {/* Right column */}
        <div>
          {/* Status & Assignment */}
          <div className="card mb-6">
            <div className="card-header" style={{ paddingBottom: 16 }}>
              <div className="card-title">Status &amp; Assignment</div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Current status</label>
                <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value as SubmissionStatus)}>
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                  ))}
                </select>
                <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span className={`badge ${STATUS_COLORS[status]}`}>{STATUS_LABELS[status]}</span>
                  {submission.phone && (
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={handleSendSms}
                      disabled={smsSending}
                      title={`Send SMS update to ${submission.phone}`}
                    >
                      {smsSending ? 'Sending…' : '📱 SMS patient'}
                    </button>
                  )}
                  {submission.phone && (submission.status === 'paid' || submission.status === 'fulfilled') && (
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={handleSendReminder}
                      disabled={reminderSending}
                      title="Send injection reminder SMS"
                    >
                      {reminderSending ? 'Sending…' : '💉 Send Reminder'}
                    </button>
                  )}
                </div>
                {smsMsg && (
                  <div style={{ marginTop: 8, fontSize: 13, color: smsMsg.startsWith('SMS sent') ? 'var(--success)' : 'var(--error)' }}>
                    {smsMsg}
                  </div>
                )}
                {reminderMsg && (
                  <div style={{ marginTop: 8, fontSize: 13, color: reminderMsg.startsWith('Reminder sent') ? 'var(--success)' : 'var(--error)' }}>
                    {reminderMsg}
                  </div>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Assign Rep</label>
                <select className="form-select" value={repId} onChange={(e) => setRepId(e.target.value)}>
                  <option value="">No rep assigned</option>
                  {reps.map((r) => (
                    <option key={r.id} value={r.id}>{r.rep_slug}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Assign Physician</label>
                <select className="form-select" value={physicianId} onChange={(e) => setPhysicianId(e.target.value)}>
                  <option value="">No physician assigned</option>
                  {physicians.map((p) => (
                    <option key={p.id} value={p.id}>{p.full_name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="card mb-6">
            <div className="card-header" style={{ paddingBottom: 16 }}>
              <div className="card-title">Pricing</div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="detail-row">
                <span className="detail-label">Patient pays now</span>
                <span className="detail-value" style={{ fontWeight: 700 }}>
                  {submission.current_price ? `$${submission.current_price.toFixed(2)}` : '—'}
                </span>
              </div>

              <div className="form-group">
                <label className="form-label">Quoted price ($)</label>
                <input
                  type="number" className="form-input" step="0.01" min="0"
                  placeholder="0.00" value={quotedPrice}
                  onChange={(e) => setQuotedPrice(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Wholesale / COGS ($)</label>
                <input
                  type="number" className="form-input" step="0.01" min="0"
                  placeholder="0.00" value={costOfGoods}
                  onChange={(e) => setCostOfGoods(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Estimated savings ($)</label>
                <input
                  type="number" className="form-input" step="0.01" min="0"
                  placeholder="0.00" value={estimatedSavings}
                  onChange={(e) => setEstimatedSavings(e.target.value)}
                />
              </div>

              {quotedPrice && submission.current_price && (
                <div style={{ background: 'var(--success-bg)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', fontSize: 14 }}>
                  <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: 4 }}>
                    Patient saves ${(submission.current_price - parseFloat(quotedPrice || '0')).toFixed(2)}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {((submission.current_price - parseFloat(quotedPrice || '0')) / submission.current_price * 100).toFixed(1)}% reduction
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Patient Payment Link */}
          <div className="card mb-6">
            <div className="card-header" style={{ paddingBottom: 16 }}>
              <div className="card-title">Patient Payment Link</div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {quotedPrice ? (
                <>
                  <div style={{ background: 'var(--teal-pale)', padding: '14px 16px', borderRadius: 'var(--radius-sm)' }}>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>Patient will pay via PayPal</div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--teal)' }}>
                      ${(parseFloat(quotedPrice || '0') + (submission.shipping_cost ?? 0)).toFixed(2)}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                      ${parseFloat(quotedPrice).toFixed(2)} product + ${(submission.shipping_cost ?? 0).toFixed(2)} shipping
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>Payment page URL</div>
                    <div style={{ fontSize: 13, padding: '10px 12px', background: 'var(--card-soft)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontFamily: 'monospace', wordBreak: 'break-all', color: 'var(--navy)' }}>
                      {typeof window !== 'undefined' ? window.location.origin : ''}/pay/{id}
                    </div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={async () => {
                      const base = typeof window !== 'undefined' ? window.location.origin : '';
                      await navigator.clipboard.writeText(`${base}/pay/${id}`);
                      setPaypalCopied(true);
                      setTimeout(() => setPaypalCopied(false), 2000);
                    }}
                  >
                    {paypalCopied ? '✓ Copied!' : 'Copy & Send to Patient'}
                  </button>
                  <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
                    Send this link to the patient via email or text. PayPal checkout pre-fills the exact amount automatically.
                  </p>
                </>
              ) : (
                <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                  Set a quoted price above and save — the payment link will activate automatically.
                </div>
              )}
            </div>
          </div>

          {/* Customer Email Notifications */}
          <div className="card mb-6">
            <div className="card-header" style={{ paddingBottom: 16 }}>
              <div>
                <div className="card-title">Customer Email Notifications</div>
                <div className="card-subtitle">Automatic emails are sent once. Use resend after edits.</div>
              </div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="detail-row">
                <span className="detail-label">Order confirmation</span>
                <span className="detail-value">
                  {submission.confirmation_email_sent_at
                    ? new Date(submission.confirmation_email_sent_at).toLocaleString()
                    : 'Not sent'}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Shipping email</span>
                <span className="detail-value">
                  {submission.shipping_email_sent_at
                    ? new Date(submission.shipping_email_sent_at).toLocaleString()
                    : 'Not sent'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => sendOrderEmail('order_confirmation', true)}
                  disabled={emailSending !== ''}
                >
                  {emailSending === 'order_confirmation' ? 'Sending...' : 'Resend confirmation'}
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => sendOrderEmail('shipping_confirmation', true)}
                  disabled={emailSending !== '' || !trackingNumber}
                  title={!trackingNumber ? 'Add a tracking number before sending shipping email' : undefined}
                >
                  {emailSending === 'shipping_confirmation' ? 'Sending...' : 'Resend shipping'}
                </button>
              </div>
              {emailMsg && (
                <div style={{ fontSize: 13, color: emailMsg.includes('failed') ? 'var(--error)' : 'var(--success)' }}>
                  {emailMsg}
                </div>
              )}
            </div>
          </div>

          {/* Crypto Payment */}
          <div className="card mb-6">
            <div className="card-header" style={{ paddingBottom: 16 }}>
              <div className="card-title">Crypto Payment</div>
              {cryptoPaymentStatus && (
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
                  background: cryptoPaymentStatus === 'confirmed' ? 'var(--success-bg)' : cryptoPaymentStatus === 'awaiting_confirmation' ? '#fef3c7' : '#fee2e2',
                  color: cryptoPaymentStatus === 'confirmed' ? 'var(--success)' : cryptoPaymentStatus === 'awaiting_confirmation' ? '#92400e' : '#b91c1c',
                }}>
                  {CRYPTO_PAYMENT_STATUS_LABELS[cryptoPaymentStatus]}
                </span>
              )}
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              <div className="form-group">
                <label className="form-label">Crypto asset</label>
                <select
                  className="form-select"
                  value={cryptoAsset}
                  onChange={(e) => {
                    const asset = e.target.value as CryptoAsset | '';
                    setCryptoAsset(asset);
                    if (asset && CRYPTO_DEFAULTS[asset]) {
                      setCryptoAddress(CRYPTO_DEFAULTS[asset].address);
                      setCryptoDestinationTag(CRYPTO_DEFAULTS[asset].tag ?? '');
                    }
                  }}
                >
                  <option value="">— None —</option>
                  <option value="BTC">Bitcoin (BTC)</option>
                  <option value="ETH">Ethereum (ETH) — ERC-20</option>
                  <option value="USDT">Tether (USDT) — ERC-20</option>
                  <option value="XRP">XRP — XRP Ledger</option>
                </select>
              </div>

              {cryptoAsset && (
                <>
                  <div className="form-group">
                    <label className="form-label">Wallet address</label>
                    <input type="text" className="form-input" value={cryptoAddress} onChange={(e) => setCryptoAddress(e.target.value)} style={{ fontFamily: 'monospace', fontSize: 13 }} />
                  </div>

                  {cryptoAsset === 'XRP' && (
                    <div className="form-group">
                      <label className="form-label" style={{ color: '#ef4444' }}>Destination tag (XRP required)</label>
                      <input type="text" className="form-input" value={cryptoDestinationTag} onChange={(e) => setCryptoDestinationTag(e.target.value)} style={{ borderColor: '#ef4444', fontWeight: 700, fontSize: 16 }} />
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div className="form-group">
                      <label className="form-label">Expected (USD)</label>
                      <input type="number" className="form-input" step="0.01" min="0" placeholder="0.00" value={cryptoExpectedUsd} onChange={(e) => setCryptoExpectedUsd(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Expected ({cryptoAsset})</label>
                      <input type="number" className="form-input" step="any" min="0" placeholder="0.000000" value={cryptoExpectedAsset} onChange={(e) => setCryptoExpectedAsset(e.target.value)} />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Payment status</label>
                    <select className="form-select" value={cryptoPaymentStatus} onChange={(e) => setCryptoPaymentStatus(e.target.value as CryptoPaymentStatus | '')}>
                      <option value="">— Not set —</option>
                      {ALL_CRYPTO_STATUSES.map(s => (
                        <option key={s} value={s}>{CRYPTO_PAYMENT_STATUS_LABELS[s]}</option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Transaction hash (TX ID)</label>
                    <input type="text" className="form-input" placeholder="Patient provides after sending…" value={cryptoTxHash} onChange={(e) => setCryptoTxHash(e.target.value)} style={{ fontFamily: 'monospace', fontSize: 12 }} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Paid at</label>
                    <input type="datetime-local" className="form-input" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Crypto notes</label>
                    <textarea className="form-textarea w-full" rows={2} placeholder="e.g. Underpaid by 0.002 ETH, awaiting top-up…" value={cryptoNotes} onChange={(e) => setCryptoNotes(e.target.value)} />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Commission Preview */}
          {repId && quotedPrice && (
            <div className="card mb-6">
              <div className="card-header" style={{ paddingBottom: 16 }}>
                <div className="card-title">Commission Preview</div>
              </div>
              <div className="card-body">
                {(() => {
                  const rep = reps.find((r) => r.id === repId);
                  const gross = parseFloat(quotedPrice || '0');
                  const discount = submission.discount_amount ?? 0;
                  const cogs = costOfGoods ? parseFloat(costOfGoods) : 0;
                  const netProfit = Math.max(0, gross - discount - cogs);
                  const rate = rep?.commission_rate ?? 0.20;
                  const commission = netProfit * rate;
                  return (
                    <>
                      <div className="detail-row"><span className="detail-label">Rep</span><span className="detail-value">{rep?.rep_slug}</span></div>
                      <div className="detail-row"><span className="detail-label">Commission rate</span><span className="detail-value">{(rate * 100).toFixed(0)}%</span></div>
                      <div className="detail-row"><span className="detail-label">Gross sale</span><span className="detail-value">${gross.toFixed(2)}</span></div>
                      <div className="detail-row"><span className="detail-label">Customer discount</span><span className="detail-value">-${discount.toFixed(2)}</span></div>
                      <div className="detail-row"><span className="detail-label">Wholesale / COGS</span><span className="detail-value">-${cogs.toFixed(2)}</span></div>
                      <div className="detail-row"><span className="detail-label">Net profit</span><span className="detail-value">${netProfit.toFixed(2)}</span></div>
                      <div className="detail-row" style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 8 }}>
                        <span className="detail-label" style={{ fontWeight: 700 }}>Commission owed</span>
                        <span className="detail-value" style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 16 }}>${commission.toFixed(2)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {/* Tracking */}
          <div className="card mb-6">
            <div className="card-header" style={{ paddingBottom: 16 }}>
              <div className="card-title">Shipping &amp; Tracking</div>
              <div className="card-subtitle">Shown to patient once set</div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Carrier</label>
                <select className="form-select" value={trackingCarrier} onChange={(e) => setTrackingCarrier(e.target.value)}>
                  <option value="">Select carrier…</option>
                  <option value="UPS">UPS</option>
                  <option value="FedEx">FedEx</option>
                  <option value="USPS">USPS</option>
                  <option value="DHL">DHL</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tracking number</label>
                <input className="form-input" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} placeholder="e.g. 1Z999AA10123456784" style={{ fontFamily: 'monospace' }} />
              </div>
              <div className="form-group">
                <label className="form-label">Tracking URL</label>
                <input
                  className="form-input"
                  value={trackingUrl}
                  onChange={(e) => setTrackingUrl(e.target.value)}
                  placeholder="Optional carrier tracking link"
                />
              </div>
              {trackingNumber && trackingCarrier && (
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Patient sees: <strong>{trackingCarrier} {trackingNumber}</strong>{trackingUrl ? ' with your saved tracking link.' : ' with an auto-generated carrier link when available.'}
                </div>
              )}
            </div>
          </div>

          <button className="btn btn-primary w-full" onClick={handleSave} disabled={saving} style={{ justifyContent: 'center' }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
          {saveMsg && <div className="alert alert-success mt-4">{saveMsg}</div>}
        </div>
      </div>

      {/* Messages */}
      {profile && id && (
        <div className="card mt-6">
          <div className="card-header" style={{ paddingBottom: 16 }}>
            <div className="card-title">Messages</div>
            <div className="card-subtitle">Direct thread with {submission.full_name} — messages are private between patient and care team</div>
          </div>
          <MessageThread submissionId={id} profile={profile} />
        </div>
      )}
    </DashLayout>
  );
}

