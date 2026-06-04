import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import { usePageMeta } from '../../hooks/usePageMeta';
import { applyCheckoutScopeToSubmission, supabase } from '../../lib/supabase';
import type { PatientSubmission, CryptoAsset } from '../../types';
import { SHIPPING_OPTIONS } from '../../types';
import CryptoPaymentInstructions from '../../components/CryptoPaymentInstructions';
import { PHONE_DISPLAY, PHONE_HREF } from '../../config';
import { useRealtime } from '../../hooks/useRealtime';
import { resolveCheckoutScope, storeCheckoutScope } from '../../lib/checkoutScope';
import { getWhiteLabelPortal } from '../../config/whiteLabelPortals';
import { centsFromDollars, dollarsFromCents, zelleConfig } from '../../config/zelle';
import {
  completeZelleProofUpload,
  createZelleIntent,
  getZelleStatus,
  markZelleSent,
  requestZelleProofUpload,
  ZelleFunctionError,
  type ZelleIntent,
} from '../../lib/zelle';

const CRYPTO_ASSETS: { value: CryptoAsset; label: string }[] = [
  { value: 'BTC',  label: 'Bitcoin (BTC)' },
  { value: 'ETH',  label: 'Ethereum (ETH)' },
  { value: 'USDT', label: 'Tether (USDT)' },
  { value: 'XRP',  label: 'XRP' },
];

export default function PaymentPage() {
  usePageMeta(
    'Complete Your Payment',
    'Complete your PepScriptRX refill payment securely. Pay via PayPal, credit card, debit card, or cryptocurrency.',
  );
  const { id } = useParams<{ id: string }>();
  const [submission, setSubmission] = useState<PatientSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Crypto TX hash submission state
  const [txHash, setTxHash] = useState('');
  const [txAsset, setTxAsset] = useState<CryptoAsset>('BTC');
  const [txSubmitting, setTxSubmitting] = useState(false);
  const [txSubmitted, setTxSubmitted] = useState(false);
  const [txError, setTxError] = useState<string | null>(null);
  const [paypalReady, setPaypalReady] = useState(false);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [paypalError, setPaypalError] = useState<string | null>(null);
  const [scopeNote, setScopeNote] = useState('');
  const [scopeApplied, setScopeApplied] = useState(false);
  const [zelleIntent, setZelleIntent] = useState<ZelleIntent | null>(null);
  const [zelleLoading, setZelleLoading] = useState(false);
  const [zelleError, setZelleError] = useState<string | null>(null);
  const [zelleSenderName, setZelleSenderName] = useState('');
  const [zelleSenderEmail, setZelleSenderEmail] = useState('');
  const [zelleSenderPhone, setZelleSenderPhone] = useState('');
  const [zelleConfirmedRecipient, setZelleConfirmedRecipient] = useState(false);
  const [zelleProofUploading, setZelleProofUploading] = useState(false);
  const [zelleFunctionDebug, setZelleFunctionDebug] = useState<Record<string, unknown> | null>(null);

  const loadPayment = useCallback(() => {
    if (!supabase || !id) { setLoading(false); setNotFound(true); return; }
    supabase
      .rpc('get_public_payment_submission', { p_submission_id: id })
      .single()
      .then(({ data }) => {
        if (data) {
          const sub = data as PatientSubmission;
          setSubmission(sub);
          if (sub.crypto_asset) setTxAsset(sub.crypto_asset);
          if (sub.crypto_tx_hash) setTxSubmitted(true);
        } else {
          setNotFound(true);
        }
        setLoading(false);
      });
  }, [id]);

  useEffect(() => { loadPayment(); }, [loadPayment]);

  useEffect(() => {
    if (!id || scopeApplied) return;
    const scope = resolveCheckoutScope(new URLSearchParams(window.location.search), { restoreStored: false });
    if (!scope?.code) return;
    setScopeApplied(true);
    applyCheckoutScopeToSubmission(id, scope.code, scope.source)
      .then((result) => {
        if (result.valid && result.scope_code) {
          setScopeNote(`Associated account: ${result.display_name ?? result.scope_code}`);
          storeCheckoutScope({ code: result.scope_code, source: scope.source });
          loadPayment();
        } else {
          setScopeNote('We could not verify that account code. Checkout can continue without it.');
        }
      })
      .catch(() => {
        setScopeNote('We could not verify that account code. Checkout can continue without it.');
      });
  }, [id, loadPayment, scopeApplied]);

  useRealtime(
    `payment-page-${id}`,
    'patient_submissions',
    id ? `id=eq.${id}` : undefined,
    loadPayment,
    Boolean(id),
  );

  const paypalClientId = import.meta.env.VITE_PAYPAL_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (!submission || submission.status !== 'payment_sent' || !paypalClientId) return;
    const productTot = Number(submission.quoted_price ?? 0);
    const discAmt    = Math.min(Number(submission.discount_amount ?? 0), productTot);
    const shipCost   = Number(submission.shipping_cost ?? 0);
    const total      = Math.max(0, productTot - discAmt) + shipCost;
    if (total <= 0) return;
    const paypalDescriptionBrand = ['AACTIVATED', 'VITALITYINS', 'GUY60'].includes((submission.checkout_scope_code ?? '').toUpperCase())
      || submission.referral_code === 'GUY60'
      || (submission.source_portal ?? '').toLowerCase().includes('vitality')
      ? 'AACTIVATED-RX'
      : 'PepScriptRX';

    function initButtons() {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pp = (window as any).paypal;
      if (!pp) return;
      setPaypalReady(true);
      const container = document.getElementById('paypal-button-container');
      if (!container || container.children.length > 0) return;

      pp.Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'pay', height: 50 },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        createOrder: (_d: unknown, actions: any) =>
          actions.order.create({
            purchase_units: [{
              amount: { value: total.toFixed(2), currency_code: 'USD' },
              description: `${paypalDescriptionBrand} - ${submission!.medication}`,
            }],
          }),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        onApprove: async (data: { orderID?: string }) => {
          try {
            if (!data.orderID) throw new Error('Missing PayPal order id');
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/capture-paypal-order`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ order_id: data.orderID, submission_id: id }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok || !body.ok) throw new Error(body.error ?? 'Payment confirmation failed');
            setPaymentComplete(true);
            loadPayment();
          } catch {
            setPaypalError(`PayPal approved the checkout, but our system could not confirm it yet. Please retry or call us: ${PHONE_DISPLAY}`);
          }
        },
        onError: () => {
          setPaypalError(`Payment could not be completed. Please try again or call: ${PHONE_DISPLAY}`);
        },
      }).render('#paypal-button-container');
    }

    if (document.getElementById('paypal-sdk')) { initButtons(); return; }

    const script = document.createElement('script');
    script.id = 'paypal-sdk';
    script.src = `https://www.paypal.com/sdk/js?client-id=${paypalClientId}&currency=USD&intent=capture&enable-funding=card`;
    script.async = true;
    script.onload = initButtons;
    document.head.appendChild(script);
  }, [submission, id, paypalClientId, loadPayment]);

  useEffect(() => {
    if (!id || !submission || submission.payment_provider !== 'zelle') return;
    getZelleStatus(id)
      .then((result) => {
        setZelleFunctionDebug({ action: 'status', status: 200, response: result });
        if (result.intent) setZelleIntent(result.intent);
      })
      .catch((error) => {
        setZelleFunctionDebug({
          action: 'status',
          status: error instanceof ZelleFunctionError ? error.status : 'unknown',
          response: error instanceof ZelleFunctionError ? error.body : String(error),
        });
      });
  }, [id, submission]);

  async function submitTxHash() {
    if (!id || !txHash.trim()) return;
    setTxSubmitting(true);
    setTxError(null);
    const { error } = await supabase!.rpc('submit_crypto_tx_hash', {
      p_submission_id: id,
      p_tx_hash: txHash.trim(),
      p_asset: txAsset,
    });
    if (error) {
      setTxError('Could not submit. Please call us directly.');
    } else {
      setTxSubmitted(true);
    }
    setTxSubmitting(false);
  }

  async function startZellePayment() {
    if (!id) return;
    setZelleLoading(true);
    setZelleError(null);
    try {
      const result = await createZelleIntent(id);
      setZelleFunctionDebug({ action: 'create-intent', status: 200, response: result });
      setZelleIntent(result.intent);
      await loadPayment();
    } catch (error) {
      setZelleFunctionDebug({
        action: 'create-intent',
        status: error instanceof ZelleFunctionError ? error.status : 'unknown',
        response: error instanceof ZelleFunctionError ? error.body : String(error),
      });
      setZelleError(error instanceof Error ? error.message : 'Could not start Zelle checkout');
    }
    setZelleLoading(false);
  }

  async function submitZelleSent() {
    if (!zelleIntent) return;
    setZelleLoading(true);
    setZelleError(null);
    try {
      const result = await markZelleSent({
        intentId: zelleIntent.id,
        senderName: zelleSenderName,
        senderEmail: zelleSenderEmail,
        senderPhone: zelleSenderPhone,
        claimedAmountCents: zelleIntent.amount_due_cents,
      });
      setZelleIntent(result.intent);
    } catch (error) {
      setZelleError(error instanceof Error ? error.message : 'Could not update Zelle payment');
    }
    setZelleLoading(false);
  }

  async function uploadZelleProof(file: File | null) {
    if (!zelleIntent || !file) return;
    setZelleProofUploading(true);
    setZelleError(null);
    try {
      const upload = await requestZelleProofUpload({
        intentId: zelleIntent.id,
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
      });
      const res = await fetch(upload.uploadUrl, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      if (!res.ok) throw new Error('Proof upload failed');
      await completeZelleProofUpload({
        intentId: zelleIntent.id,
        filePath: upload.filePath,
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        fileSize: file.size,
      });
    } catch (error) {
      setZelleError(error instanceof Error ? error.message : 'Could not upload payment proof');
    }
    setZelleProofUploading(false);
  }

  if (loading) {
    return (
      <PublicLayout>
        <div style={{ padding: 80, textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto' }} />
        </div>
      </PublicLayout>
    );
  }

  if (notFound || !submission) {
    return (
      <PublicLayout>
        <div style={{ padding: '80px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy)', marginBottom: 12 }}>Payment link not found</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>This payment link may have expired or the ID is incorrect. Please contact us.</p>
          <a href={PHONE_HREF} className="btn btn-primary">Call {PHONE_DISPLAY}</a>
        </div>
      </PublicLayout>
    );
  }

  const isAactivatedOrder = ['AACTIVATED', 'VITALITYINS', 'GUY60'].includes((submission.checkout_scope_code ?? '').toUpperCase())
    || submission.referral_code === 'GUY60'
    || (submission.source_portal ?? '').toLowerCase().includes('vitality');
  const paymentPortal = isAactivatedOrder ? getWhiteLabelPortal('aactivated') : null;
  const paymentHomePath = paymentPortal?.path ?? '/';
  const paymentLayoutProps = {
    isolatedPortal: Boolean(paymentPortal),
    portalKey: paymentPortal?.id,
    portalHomePath: paymentPortal?.path,
    portalName: paymentPortal?.brandName,
    portalLogoSrc: paymentPortal?.logoSrc,
  };

  if (submission.status === 'paid' || submission.status === 'fulfilled') {
    return (
      <PublicLayout {...paymentLayoutProps}>
        <div style={{ padding: '80px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy)', marginBottom: 12 }}>Payment already received</h1>
          <p style={{ color: 'var(--text-muted)' }}>Your order for {submission.medication} is in process. We will contact you with tracking information.</p>
        </div>
      </PublicLayout>
    );
  }

  if (!submission.quoted_price) {
    return (
      <PublicLayout {...paymentLayoutProps}>
        <div style={{ padding: '80px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy)', marginBottom: 12 }}>Your quote is being prepared</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>Our team is finalizing your pricing. You will receive a call or email when your payment is ready.</p>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>Questions? Call our AI line: <a href={PHONE_HREF} style={{ color: 'var(--teal)' }}>{PHONE_DISPLAY}</a></p>
        </div>
      </PublicLayout>
    );
  }

  if (submission.status !== 'payment_sent') {
    return (
      <PublicLayout {...paymentLayoutProps}>
        <div style={{ padding: '80px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy)', marginBottom: 12 }}>Checkout is not available yet</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
            This request does not have a checkout-ready price yet. Please contact us if you expected to pay now.
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            Questions? Call our AI line: <a href={PHONE_HREF} style={{ color: 'var(--teal)' }}>{PHONE_DISPLAY}</a>
          </p>
        </div>
      </PublicLayout>
    );
  }

  const shippingOption = SHIPPING_OPTIONS.find(o => o.value === submission.shipping_speed);
  const shippingCost = submission.shipping_cost ?? 0;
  const productTotal = submission.quoted_price ?? 0;
  const discountAmount = Math.min(submission.discount_amount ?? 0, productTotal);
  const discountedProductTotal = Math.max(0, productTotal - discountAmount);
  const grandTotal = discountedProductTotal + shippingCost;
  const isMarkPortalOrder = submission.referral_code === 'MARK65';
  const grandTotalCents = centsFromDollars(grandTotal);
  const checkoutScopeCode = (submission.checkout_scope_code ?? '').trim().toUpperCase();
  const sourcePortal = (submission.source_portal ?? '').trim().toLowerCase();
  const sourceRoute = (submission.source_route ?? '').trim().toLowerCase();
  const hasNonMainScope = Boolean(checkoutScopeCode && checkoutScopeCode !== 'MAIN');
  const isRootSource = !sourcePortal || sourcePortal === 'main' || sourcePortal === 'pepscriptrx' || sourcePortal === 'root';
  const hasStaleEhwSubRootAttribution = isRootSource
    && !submission.store_slug
    && (!sourceRoute || sourceRoute === '/' || sourceRoute === '/start')
    && checkoutScopeCode === 'EHWSUB'
    && (submission.referral_code === 'EHWSUB' || !submission.referral_code);
  const hasPartnerStorefrontAttribution = Boolean(submission.store_slug || submission.referral_code || hasNonMainScope)
    && !hasStaleEhwSubRootAttribution;
  const isRootOrder = !hasPartnerStorefrontAttribution
    && isRootSource
    && (!checkoutScopeCode || checkoutScopeCode === 'MAIN' || hasStaleEhwSubRootAttribution);
  const isUnderZelleCap = grandTotalCents > 0 && grandTotalCents <= zelleConfig.lowRiskMaxCents;
  const zelleRecipientPresent = Boolean(zelleConfig.recipientValue);
  const zelleHiddenReasons = [
    zelleConfig.enabled ? null : 'NEXT_PUBLIC_ZELLE_ENABLED is false',
    grandTotalCents > 0 ? null : 'total is zero or missing',
    grandTotalCents <= zelleConfig.lowRiskMaxCents ? null : `total ${grandTotalCents} exceeds cap ${zelleConfig.lowRiskMaxCents}`,
    zelleRecipientPresent ? null : 'frontend recipient value missing; backend will still validate on intent create',
  ].filter(Boolean) as string[];
  const zelleEligible = zelleConfig.enabled
    && isUnderZelleCap;
  const zelleDebug = {
    order_id: submission.id,
    source_portal: submission.source_portal ?? null,
    source_route: submission.source_route ?? null,
    store_slug: submission.store_slug ?? null,
    scope: submission.checkout_scope_code ?? null,
    rep_referral_code: submission.referral_code ?? null,
    cart_subtotal_cents: grandTotalCents,
    isRootOrder,
    isUnderZelleCap,
    NEXT_PUBLIC_ZELLE_ENABLED: String(zelleConfig.enabled),
    recipient_display_name: zelleConfig.displayName || null,
    recipient_value_present: zelleRecipientPresent,
    zelleEligible,
    stale_ehwsub_root_attribution: hasStaleEhwSubRootAttribution,
    hidden_reason: zelleEligible ? null : zelleHiddenReasons.join('; '),
  };
  const showZelleDebug = typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('zelle_debug') === '1';
  if (typeof window !== 'undefined' && (showZelleDebug || import.meta.env.DEV)) {
    window.console.info('[PepScriptRX Zelle eligibility]', zelleDebug);
  }
  const zelleOverLimit = zelleConfig.enabled && grandTotalCents > zelleConfig.lowRiskMaxCents;
  const activeZelleIntent = zelleIntent && ['pending', 'sent', 'needs_info'].includes(zelleIntent.status);
  const zelleSavingsCents = Math.floor((grandTotalCents * zelleConfig.discountBps) / 10000);
  const zelleAmountCents = zelleIntent?.amount_due_cents ?? Math.max(0, grandTotalCents - zelleSavingsCents);
  const portalSignupPath = `/patient/signup${submission.email ? `?email=${encodeURIComponent(submission.email)}` : ''}`;

  return (
    <PublicLayout {...paymentLayoutProps}>
      {/* Header */}
      <div style={{ background: 'var(--ink)', padding: '48px 24px 36px' }}>
        <div className="container-sm">
          <h1 style={{ fontSize: 'clamp(24px, 4vw, 34px)', fontWeight: 800, color: '#fff', letterSpacing: '-.02em', marginBottom: 8 }}>
            Complete Your Order
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,.7)' }}>
            Hi {submission.full_name} — review your order below and complete secure checkout.
          </p>
          {isMarkPortalOrder && (
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,.62)', marginTop: 10 }}>
              Empire Health & Wellness portal order with MARK65 attribution.
            </p>
          )}
        </div>
      </div>

      <div style={{ padding: '48px 24px 64px' }}>
        <div className="container-sm">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Order summary */}
            <div className="card">
              <div className="card-header" style={{ paddingBottom: 16 }}>
                <div className="card-title">Order Summary</div>
              </div>
              <div className="card-body">
                <div className="detail-row">
                  <span className="detail-label">Medication</span>
                  <span className="detail-value" style={{ fontWeight: 700 }}>{submission.medication}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Product price</span>
                  <span className="detail-value" style={{ fontWeight: 700 }}>${productTotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="detail-row">
                    <span className="detail-label">Discount</span>
                    <span className="detail-value" style={{ fontWeight: 800, color: 'var(--success)' }}>
                      -${discountAmount.toFixed(2)} {submission.discount_code ? `(${submission.discount_code})` : ''}
                    </span>
                  </div>
                )}
                <div className="detail-row">
                  <span className="detail-label">Shipping</span>
                  <span className="detail-value">
                    {shippingOption?.label ?? 'Standard'}
                    <span style={{ marginLeft: 8, color: shippingCost === 0 ? 'var(--success)' : 'var(--navy)', fontWeight: 600 }}>
                      {shippingCost === 0 ? '— Included' : `+$${shippingCost.toFixed(2)}`}
                    </span>
                  </span>
                </div>
                {shippingOption && (
                  <div className="detail-row">
                    <span className="detail-label">Estimated delivery</span>
                    <span className="detail-value" style={{ color: 'var(--teal)', fontWeight: 600 }}>{shippingOption.days}</span>
                  </div>
                )}
                <div className="detail-row" style={{ borderTop: '2px solid var(--border)', paddingTop: 16, marginTop: 8 }}>
                  <span className="detail-label" style={{ fontWeight: 700, fontSize: 16 }}>Total due today</span>
                  <span className="detail-value" style={{ fontWeight: 800, fontSize: 24, color: 'var(--navy)' }}>${grandTotal.toFixed(2)}</span>
                </div>
              </div>
            </div>

            {showZelleDebug && (
              <div className="card" style={{ border: '1px solid #f59e0b', background: '#fffbeb' }}>
                <div className="card-body">
                  <div className="card-title" style={{ color: '#92400e' }}>Zelle Debug</div>
                  <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 12, color: '#78350f', marginTop: 12 }}>
                    {JSON.stringify({
                      eligibility: zelleDebug,
                      functionCall: zelleFunctionDebug,
                    }, null, 2)}
                  </pre>
                </div>
              </div>
            )}

            {/* Shipping address */}
            {submission.shipping_address && (
              <div className="card">
                <div className="card-header" style={{ paddingBottom: 16 }}>
                  <div className="card-title">Shipping Address</div>
                </div>
                <div className="card-body">
                  <div style={{ fontSize: 15, color: 'var(--navy)', lineHeight: 1.7 }}>
                    <strong>{submission.full_name}</strong><br />
                    {submission.shipping_address}<br />
                    {submission.shipping_city}, {submission.shipping_state} {submission.shipping_zip}
                  </div>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 12 }}>
                    If your address is incorrect, call us before paying: <a href={PHONE_HREF} style={{ color: 'var(--teal)' }}>{PHONE_DISPLAY}</a>
                  </p>
                </div>
              </div>
            )}

            <div className="card" style={{ borderColor: 'rgba(37,199,217,.38)', background: 'linear-gradient(135deg, #f8feff 0%, #ffffff 100%)' }}>
              <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ maxWidth: 620 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--teal)', marginBottom: 6 }}>
                    Customer portal
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--navy)', marginBottom: 6 }}>
                    Create your portal account for payment and shipping updates
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
                    Zelle verification status, order updates, shipping notifications, tracking, and Mixing Center access will appear in your private dashboard.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Link className="btn btn-primary" to={portalSignupPath}>
                    Create Portal Account
                  </Link>
                  <Link className="btn btn-outline" to="/login?portal=patient">
                    Customer Login
                  </Link>
                </div>
              </div>
            </div>

            {zelleEligible && (
              <div
                className="card"
                style={{
                  border: '3px solid rgba(37,199,217,.95)',
                  background: 'linear-gradient(135deg, #f1fdff 0%, #ffffff 42%, #dcf9ff 100%)',
                  boxShadow: '0 30px 90px rgba(37,199,217,.32), 0 0 0 8px rgba(37,199,217,.08)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    inset: '0 0 auto 0',
                    height: 8,
                    background: 'linear-gradient(90deg, #00d8ff, #071524, #00d8ff)',
                  }}
                />
                <div className="card-body" style={{ padding: '34px 24px 30px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: 18 }}>
                    <div>
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 8,
                          background: 'linear-gradient(135deg, #071524, #12314c)',
                          color: '#69efff',
                          border: '1px solid rgba(37,199,217,.55)',
                          borderRadius: 999,
                          padding: '7px 12px',
                          fontSize: 12,
                          fontWeight: 900,
                          letterSpacing: '.06em',
                          textTransform: 'uppercase',
                          marginBottom: 10,
                        }}
                      >
                        Best payment option - save 10%
                      </div>
                      <div className="card-title" style={{ fontSize: 'clamp(22px, 4vw, 30px)', color: '#061425' }}>Best option: Pay by Zelle</div>
                      <div style={{ fontSize: 14, color: '#28445d', lineHeight: 1.6, maxWidth: 650, fontWeight: 600 }}>
                        Zelle orders are manually verified. Your order stays pending until an admin confirms the received payment.
                        {' '}Order will be processed after Zelle payment is verified.
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, color: '#38526a', fontWeight: 800 }}>Zelle amount</div>
                      <div style={{ fontSize: 34, fontWeight: 950, color: '#061425', lineHeight: 1.05 }}>
                        ${dollarsFromCents(zelleAmountCents).toFixed(2)}
                      </div>
                      <div style={{ fontSize: 13, color: '#08798a', fontWeight: 900, marginTop: 4 }}>
                        You save ${dollarsFromCents(zelleSavingsCents).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {zelleError && <div className="alert alert-error mb-4">{zelleError}</div>}

                  {!zelleIntent ? (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(min(220px, 100%), 1fr))',
                        gap: 18,
                        alignItems: 'center',
                      }}
                    >
                      <button type="button" className="btn btn-primary" onClick={startZellePayment} disabled={zelleLoading} style={{ minHeight: 54, fontSize: 17, fontWeight: 950 }}>
                        {zelleLoading ? 'Preparing Zelle...' : `Start Zelle payment - save ${dollarsFromCents(zelleSavingsCents).toFixed(2)}`}
                      </button>
                      <div style={{ background: '#ffffff', border: '1px solid rgba(7,21,36,.14)', borderRadius: 8, padding: 12, textAlign: 'center', boxShadow: '0 12px 30px rgba(7,21,36,.08)' }}>
                        <img src={zelleConfig.qrImageSrc} alt={`Zelle QR for ${zelleConfig.displayName}`} style={{ width: '100%', maxWidth: 190, height: 'auto', display: 'block', margin: '0 auto' }} />
                        <div style={{ fontSize: 12, color: '#28445d', fontWeight: 800, marginTop: 8 }}>Scan in your banking app</div>
                        <div style={{ fontSize: 12, color: '#28445d', fontWeight: 800, marginTop: 6 }}>
                          Recipient: {zelleConfig.displayName}<br />
                          Phone: {zelleConfig.recipientValue}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 18 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 16, alignItems: 'start' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                          {[
                            ['Send to', zelleIntent.recipient_display_name],
                            [zelleIntent.recipient_kind === 'email' ? 'Zelle email' : 'Phone', zelleIntent.recipient_value],
                            ['Exact amount', `$${dollarsFromCents(zelleIntent.amount_due_cents).toFixed(2)}`],
                            ['Reference', zelleIntent.payment_reference],
                          ].map(([label, value]) => (
                            <div key={label} style={{ background: '#ffffff', border: '1px solid rgba(7,21,36,.16)', borderRadius: 8, padding: 14, boxShadow: '0 8px 24px rgba(7,21,36,.06)' }}>
                              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#36566f', fontWeight: 900 }}>{label}</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginTop: 5 }}>
                                <strong style={{ color: '#061425', wordBreak: 'break-word', fontSize: 16, lineHeight: 1.35 }}>{value}</strong>
                                <button type="button" className="btn btn-outline btn-sm" onClick={() => navigator.clipboard?.writeText(value)} style={{ borderColor: '#15314a', color: '#061425', fontWeight: 800 }}>
                                  Copy
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ background: '#ffffff', border: '1px solid rgba(7,21,36,.14)', borderRadius: 8, padding: 14, textAlign: 'center', boxShadow: '0 14px 34px rgba(7,21,36,.1)' }}>
                          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#36566f', fontWeight: 900, marginBottom: 8 }}>Scan to pay</div>
                          <img src={zelleConfig.qrImageSrc} alt={`Zelle QR for ${zelleIntent.recipient_display_name}`} style={{ width: '100%', maxWidth: 210, height: 'auto', display: 'block', margin: '0 auto' }} />
                          <div style={{ fontSize: 12, color: '#28445d', fontWeight: 800, marginTop: 8 }}>
                            If prompted to choose a bank, select Chase. Confirm your bank shows {zelleIntent.recipient_display_name} before sending.
                          </div>
                        </div>
                      </div>

                      <div style={{ background: '#fff7ed', border: '1px solid rgba(245,158,11,.42)', borderRadius: 8, padding: '12px 14px', color: '#7c2d12', fontSize: 13, fontWeight: 800, lineHeight: 1.5 }}>
                        {zelleConfig.disclosure}
                      </div>

                      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: '#28445d', lineHeight: 1.5, fontWeight: 600 }}>
                        <input type="checkbox" checked={zelleConfirmedRecipient} onChange={(event) => setZelleConfirmedRecipient(event.target.checked)} style={{ marginTop: 3 }} />
                        Before sending, confirm the recipient name shown by your bank matches {zelleIntent.recipient_display_name}. If scanning the QR code and your app asks you to choose a bank, select Chase. I will send the exact amount and include the reference when available.
                      </label>

                      {zelleIntent.status === 'sent' ? (
                        <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 8, padding: 16 }}>
                          <strong style={{ color: 'var(--success)' }}>Payment marked sent.</strong>
                          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                            Order will be processed after Zelle payment is verified. Admin review is pending. Proof helps the team verify faster, but it never auto-confirms payment.
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                          <input className="form-input" placeholder="Sender name" value={zelleSenderName} onChange={(event) => setZelleSenderName(event.target.value)} />
                          <input className="form-input" placeholder="Sender email" value={zelleSenderEmail} onChange={(event) => setZelleSenderEmail(event.target.value)} />
                          <input className="form-input" placeholder="Sender phone" value={zelleSenderPhone} onChange={(event) => setZelleSenderPhone(event.target.value)} />
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={submitZelleSent}
                            disabled={zelleLoading || !zelleConfirmedRecipient || !zelleSenderName.trim()}
                          >
                            {zelleLoading ? 'Saving...' : "I've sent it"}
                          </button>
                        </div>
                      )}

                      <div>
                        <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>
                          Optional proof upload
                        </label>
                        <input
                          type="file"
                          className="form-input"
                          accept="image/*,.pdf"
                          disabled={zelleProofUploading}
                          onChange={(event) => uploadZelleProof(event.target.files?.[0] ?? null)}
                        />
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                          {zelleProofUploading ? 'Uploading proof...' : 'Upload a receipt screenshot or PDF after sending. Admin still confirms manually.'}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {zelleOverLimit && (
              <div className="card">
                <div className="card-body" style={{ fontSize: 14, color: 'var(--text-muted)' }}>
                  Zelle is currently limited to orders up to ${dollarsFromCents(zelleConfig.lowRiskMaxCents).toFixed(2)}. Please use card/PayPal below.
                </div>
              </div>
            )}

            {/* PayPal payment */}
            <div className="card" style={{ background: 'var(--ink)', border: activeZelleIntent ? '1px solid rgba(255,255,255,.12)' : 'none' }}>
              <div className="card-body" style={{ textAlign: 'center', padding: activeZelleIntent ? '30px 24px' : '40px 24px' }}>
                <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase', color: activeZelleIntent ? '#69efff' : 'rgba(255,255,255,.65)', marginBottom: 6 }}>
                  {activeZelleIntent ? 'Backup payment option' : 'Secure checkout'}
                </div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,.76)', marginBottom: 6 }}>
                  {activeZelleIntent ? 'Prefer PayPal, debit, or credit card?' : 'Total due today'}
                </div>
                <div style={{ fontSize: activeZelleIntent ? 34 : 44, fontWeight: 900, color: '#fff', marginBottom: 8 }}>${grandTotal.toFixed(2)}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.62)', marginBottom: 28 }}>
                  {submission.medication} + {shippingOption?.label ?? 'Standard Shipping'}
                  {discountAmount > 0 ? ` - ${submission.discount_code ?? 'referral'} discount` : ''}
                  {activeZelleIntent ? ' - Zelle savings do not apply to PayPal/card.' : ''}
                </div>
                {(scopeNote || (submission.checkout_scope_code && !hasStaleEhwSubRootAttribution)) && (
                  <div style={{ background: 'rgba(37,199,217,.14)', border: '1px solid rgba(37,199,217,.35)', borderRadius: 8, padding: '10px 12px', maxWidth: 400, margin: '0 auto 18px', color: '#bff8ff', fontSize: 13, fontWeight: 800 }}>
                    {scopeNote || `Associated account: ${submission.checkout_scope_code}`}
                  </div>
                )}

                {paymentComplete ? (
                  <div style={{ background: 'rgba(0,200,100,.15)', border: '1px solid #00c864', borderRadius: 10, padding: '24px' }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                    <div style={{ fontWeight: 700, color: '#00c864', fontSize: 18 }}>Payment received — thank you!</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', marginTop: 8 }}>
                      Your order is confirmed. We'll contact you with tracking info soon.
                    </div>
                  </div>
                ) : paypalClientId ? (
                  <>
                    {paypalError && (
                      <div style={{ background: 'rgba(255,60,60,.15)', border: '1px solid rgba(255,60,60,.5)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#ff9090', fontSize: 13, textAlign: 'left' }}>
                        {paypalError}
                      </div>
                    )}
                    <div id="paypal-button-container" style={{ maxWidth: 400, margin: '0 auto 12px' }} />
                    {!paypalReady && (
                      <p style={{ fontSize: 13, color: 'rgba(255,255,255,.4)' }}>Loading payment options…</p>
                    )}
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginTop: 8 }}>
                      PayPal · Credit card · Debit card — no account required
                    </p>
                  </>
                ) : (
                  <div style={{ background: 'rgba(255,196,57,.14)', border: '1px solid rgba(255,196,57,.42)', borderRadius: 10, padding: '18px 20px', maxWidth: 460, margin: '0 auto', textAlign: 'left' }}>
                    <div style={{ color: '#ffd66b', fontWeight: 800, marginBottom: 6 }}>Secure checkout is temporarily unavailable</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,.72)', lineHeight: 1.6 }}>
                      The official PayPal checkout client is not configured for this browser session. Please call {PHONE_DISPLAY}; do not send payment to any direct PayPal link outside this page.
                    </div>
                  </div>
                )}
              </div>
            </div>

            {!paymentComplete && !activeZelleIntent && (<>
            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>OR PAY WITH CRYPTO</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            {/* Crypto payment */}
            <CryptoPaymentInstructions
              totalUsd={grandTotal}
              expectedAssetAmount={submission.crypto_expected_amount_asset}
              selectedAsset={submission.crypto_asset}
            />

            {/* Crypto TX hash submission */}
            <div className="card">
              <div className="card-header" style={{ paddingBottom: 12 }}>
                <div className="card-title">Already sent crypto?</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Submit your transaction ID (TX hash) so our team can verify your payment faster.</div>
              </div>
              <div className="card-body">
                {txSubmitted ? (
                  <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--radius-sm)', padding: '16px 18px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: 4 }}>Transaction ID received</div>
                    <div style={{ fontSize: 13, color: 'var(--success)' }}>Our team will verify your payment and update your order status. No further action needed.</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ flex: '0 0 auto' }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Asset</label>
                        <select
                          className="form-select"
                          style={{ fontSize: 14, padding: '10px 12px' }}
                          value={txAsset}
                          onChange={(e) => setTxAsset(e.target.value as CryptoAsset)}
                        >
                          {CRYPTO_ASSETS.map((a) => (
                            <option key={a.value} value={a.value}>{a.label}</option>
                          ))}
                        </select>
                      </div>
                      <div style={{ flex: 1, minWidth: 200 }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>Transaction ID / TX Hash</label>
                        <input
                          type="text"
                          className="form-input"
                          style={{ width: '100%', fontFamily: 'monospace', fontSize: 13 }}
                          placeholder="Paste your TX hash here…"
                          value={txHash}
                          onChange={(e) => setTxHash(e.target.value)}
                        />
                      </div>
                    </div>
                    {txError && (
                      <div style={{ color: 'var(--error)', fontSize: 13 }}>{txError}</div>
                    )}
                    <button
                      className="btn btn-primary btn-sm"
                      style={{ alignSelf: 'flex-start' }}
                      onClick={submitTxHash}
                      disabled={txSubmitting || !txHash.trim()}
                    >
                      {txSubmitting ? 'Submitting…' : 'Submit Transaction ID'}
                    </button>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      You can also call or text us with your TX hash: <a href={PHONE_HREF} style={{ color: 'var(--teal)' }}>{PHONE_DISPLAY}</a>
                    </div>
                  </div>
                )}
              </div>
            </div>
            </>)}

            {/* What happens next */}
            <div className="card">
              <div className="card-header" style={{ paddingBottom: 16 }}>
                <div className="card-title">What happens after payment?</div>
              </div>
              <div className="card-body">
                {[
                  { n: 1, text: 'Your payment is received and your order is confirmed.' },
                  { n: 2, text: 'Our fulfillment partner processes and ships your order.' },
                  { n: 3, text: `You receive tracking info by email within ${shippingOption?.days ?? '5–7 business days'}.` },
                  { n: 4, text: `Questions? Call or text our AI line any time: ${PHONE_DISPLAY}.` },
                ].map((step) => (
                  <div key={step.n} style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--teal-pale)', color: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0, fontSize: 13 }}>{step.n}</div>
                    <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, paddingTop: 4 }}>{step.text}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="disclaimer">
              <strong>Notice:</strong> Payment confirms your order and authorizes fulfillment. {paymentPortal?.brandName ?? 'PepScriptRX'} is not a pharmacy or medical provider. Fulfillment is handled by verified third-party partners.
              {' '}Questions? <Link to={paymentHomePath} style={{ color: 'var(--teal)' }}>Return to {paymentPortal?.brandName ?? 'our home page'}</Link> or call <a href={PHONE_HREF} style={{ color: 'var(--teal)' }}>{PHONE_DISPLAY}</a>.
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
