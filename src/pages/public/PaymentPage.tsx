import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import { usePageMeta } from '../../hooks/usePageMeta';
import { supabase } from '../../lib/supabase';
import type { PatientSubmission, CryptoAsset } from '../../types';
import { SHIPPING_OPTIONS } from '../../types';
import CryptoPaymentInstructions from '../../components/CryptoPaymentInstructions';
import { PHONE_DISPLAY, PHONE_HREF, PAYPAL_ME } from '../../config';
import { useRealtime } from '../../hooks/useRealtime';

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
              description: `PepScriptRX - ${submission!.medication}`,
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
  }, [submission, id, paypalClientId]);

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

  if (submission.status === 'paid' || submission.status === 'fulfilled') {
    return (
      <PublicLayout>
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
      <PublicLayout>
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
      <PublicLayout>
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
  const paypalUrl = `${PAYPAL_ME}/${grandTotal.toFixed(2)}`;
  const isMarkPortalOrder = submission.referral_code === 'MARK65';

  return (
    <PublicLayout>
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

            {/* PayPal payment */}
            <div className="card" style={{ background: 'var(--ink)', border: 'none' }}>
              <div className="card-body" style={{ textAlign: 'center', padding: '40px 24px' }}>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,.7)', marginBottom: 6 }}>Total due today</div>
                <div style={{ fontSize: 44, fontWeight: 800, color: '#fff', marginBottom: 8 }}>${grandTotal.toFixed(2)}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.5)', marginBottom: 28 }}>
                  {submission.medication} + {shippingOption?.label ?? 'Standard Shipping'}
                  {discountAmount > 0 ? ` - ${submission.discount_code ?? 'referral'} discount` : ''}
                </div>

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
                  <>
                    <a
                      href={paypalUrl}
                      target="_blank"
                      rel="noreferrer"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 10,
                        background: '#FFC439',
                        color: '#003087',
                        fontWeight: 800,
                        fontSize: 18,
                        padding: '16px 40px',
                        borderRadius: 8,
                        textDecoration: 'none',
                        boxShadow: '0 4px 14px rgba(0,0,0,0.3)',
                        letterSpacing: '-.01em',
                      }}
                    >
                      Pay ${grandTotal.toFixed(2)} with PayPal
                    </a>
                    <p style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', marginTop: 18 }}>
                      Accepts PayPal, credit card, and debit card. Secure checkout.
                    </p>
                  </>
                )}
              </div>
            </div>

            {!paymentComplete && (<>
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
              <strong>Notice:</strong> Payment confirms your order and authorizes fulfillment. PepScriptRX is not a pharmacy or medical provider. Fulfillment is handled by verified third-party partners.
              {' '}Questions? <Link to="/" style={{ color: 'var(--teal)' }}>Visit our home page</Link> or call <a href={PHONE_HREF} style={{ color: 'var(--teal)' }}>{PHONE_DISPLAY}</a>.
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
