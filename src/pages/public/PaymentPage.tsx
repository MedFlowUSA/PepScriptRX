import { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import { usePageMeta } from '../../hooks/usePageMeta';
import { supabase } from '../../lib/supabase';
import type { CryptoAsset, ShippingSpeed } from '../../types';
import { SHIPPING_OPTIONS } from '../../types';
import CryptoPaymentInstructions from '../../components/CryptoPaymentInstructions';
import { PHONE_DISPLAY, PHONE_HREF } from '../../config';
import { buildPortalLoginPath, buildPortalSignupPath, getWhiteLabelPortal } from '../../config/whiteLabelPortals';
import { centsFromDollars, dollarsFromCents, venmoConfig, zelleConfig } from '../../config/zelle';
import {
  completeZelleProofUpload,
  createVenmoIntent,
  createZelleIntent,
  getVenmoStatus,
  getZelleStatus,
  markZelleSent,
  requestZelleProofUpload,
  ZelleFunctionError,
  type ZelleIntent,
} from '../../lib/zelle';
import { createStripeCheckoutSession, StripeCheckoutError } from '../../lib/stripeCheckout';

const CRYPTO_ASSETS: { value: CryptoAsset; label: string }[] = [
  { value: 'BTC',  label: 'Bitcoin (BTC)' },
  { value: 'ETH',  label: 'Ethereum (ETH)' },
  { value: 'USDT', label: 'Tether (USDT)' },
  { value: 'XRP',  label: 'XRP' },
];

function trShippingLabel(label: string | undefined): string {
  if (!label) return 'Standart Teslimat';
  return label
    .replace('Standard Shipping', 'Standart Teslimat')
    .replace('Standard', 'Standart')
    .replace('Expedited', 'Hızlandırılmış')
    .replace('Overnight', 'Gece Teslimatı');
}

function trShippingDays(days: string | undefined): string {
  if (!days) return '5-7 iş günü';
  return days.replace('business days', 'iş günü').replace('days', 'gün');
}

type PublicPaymentSubmission = {
  payment_token: string;
  order_reference: string | null;
  medication: string;
  quoted_price: number | null;
  shipping_speed: ShippingSpeed | null;
  shipping_cost: number | null;
  status: string;
  referral_code: string | null;
  discount_code: string | null;
  discount_amount: number | null;
  crypto_asset: CryptoAsset | null;
  crypto_expected_amount_asset: number | null;
  crypto_tx_submitted: boolean | null;
  checkout_scope_code: string | null;
  source_portal: string | null;
  payment_provider: 'paypal' | 'stripe' | 'crypto' | 'zelle' | 'venmo' | 'manual' | 'other' | null;
  payment_status: string | null;
  subtotal_cents: number | null;
  discount_cents: number | null;
  amount_due_cents: number | null;
  payment_expires_at: string | null;
  payment_reference: string | null;
  created_at: string | null;
};

function normalizePublicGintoTirzepatide60Submission(submission: PublicPaymentSubmission): PublicPaymentSubmission {
  const isGinto = [
    submission.checkout_scope_code,
    submission.source_portal,
    submission.referral_code,
  ].some((value) => String(value ?? '').toLowerCase().includes('ginto'));
  const medication = String(submission.medication ?? '').toLowerCase();
  const productTotal = Number(submission.quoted_price ?? 0);
  if (!isGinto || !medication.includes('tirzepatide') || !medication.includes('60') || productTotal < 900) {
    return submission;
  }

  const quantityMatch = medication.match(/\bx\s*(\d{1,2})\b/i);
  const quantity = quantityMatch ? Math.max(1, Number(quantityMatch[1])) : Math.max(1, Math.round(productTotal / 950));
  const correctedProductTotal = Math.round(249 * quantity * 100) / 100;
  const discount = Math.min(Number(submission.discount_amount ?? 0), correctedProductTotal);
  const shipping = Number(submission.shipping_cost ?? 0);
  const amountDueCents = Math.round((Math.max(0, correctedProductTotal - discount) + shipping) * 100);

  return {
    ...submission,
    quoted_price: correctedProductTotal,
    subtotal_cents: Math.round(correctedProductTotal * 100),
    amount_due_cents: amountDueCents,
  };
}

export default function PaymentPage() {
  const { id } = useParams<{ id: string }>();
  const paymentToken = id ?? '';
  const [submission, setSubmission] = useState<PublicPaymentSubmission | null>(null);
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
  const [stripeLoading, setStripeLoading] = useState(false);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [zelleIntent, setZelleIntent] = useState<ZelleIntent | null>(null);
  const [zelleLoading, setZelleLoading] = useState(false);
  const [zelleError, setZelleError] = useState<string | null>(null);
  const [zelleSenderName, setZelleSenderName] = useState('');
  const [zelleSenderEmail, setZelleSenderEmail] = useState('');
  const [zelleSenderPhone, setZelleSenderPhone] = useState('');
  const [zelleConfirmedRecipient, setZelleConfirmedRecipient] = useState(false);
  const [zelleProofUploading, setZelleProofUploading] = useState(false);
  const [zelleFunctionDebug, setZelleFunctionDebug] = useState<Record<string, unknown> | null>(null);
  const [venmoIntent, setVenmoIntent] = useState<ZelleIntent | null>(null);
  const [venmoLoading, setVenmoLoading] = useState(false);
  const [venmoError, setVenmoError] = useState<string | null>(null);
  const [venmoSenderName, setVenmoSenderName] = useState('');
  const [venmoSenderEmail, setVenmoSenderEmail] = useState('');
  const [venmoSenderPhone, setVenmoSenderPhone] = useState('');
  const [venmoConfirmedRecipient, setVenmoConfirmedRecipient] = useState(false);
  const [venmoProofUploading, setVenmoProofUploading] = useState(false);
  const [selectedOtherPayment, setSelectedOtherPayment] = useState<'paypal' | 'venmo' | 'crypto' | ''>('');
  const isAnatoliaPayment = (submission?.source_portal ?? '').toLowerCase().includes('anatolia');

  usePageMeta(
    isAnatoliaPayment ? 'Ödemenizi Tamamlayın' : 'Complete Your Payment',
    isAnatoliaPayment
      ? 'Anatolia Wellness Labs sipariş ödemenizi güvenli şekilde tamamlayın.'
      : 'Complete your PepScriptRX refill payment securely. Pay via PayPal, credit card, debit card, or cryptocurrency.',
  );

  const loadPayment = useCallback(() => {
    if (!supabase || !paymentToken) { setLoading(false); setNotFound(true); return; }
    supabase
      .rpc('get_public_payment_submission', { p_payment_token: paymentToken })
      .single()
      .then(({ data }) => {
        if (data) {
          const sub = normalizePublicGintoTirzepatide60Submission(data as PublicPaymentSubmission);
          setSubmission(sub);
          if (sub.crypto_asset) setTxAsset(sub.crypto_asset);
          if (sub.crypto_tx_submitted) setTxSubmitted(true);
        } else {
          setNotFound(true);
        }
        setLoading(false);
      });
  }, [paymentToken]);

  useEffect(() => { loadPayment(); }, [loadPayment]);

  useEffect(() => {
    if (!submission || selectedOtherPayment) return;
    if (submission.payment_provider === 'paypal') setSelectedOtherPayment('paypal');
    if (submission.payment_provider === 'venmo') setSelectedOtherPayment('venmo');
    if (submission.payment_provider === 'crypto') setSelectedOtherPayment('crypto');
  }, [submission, selectedOtherPayment]);

  const paypalClientId = import.meta.env.VITE_PAYPAL_CLIENT_ID as string | undefined;

  useEffect(() => {
    if (!submission || submission.status !== 'payment_sent' || !paypalClientId) return;
    if (selectedOtherPayment !== 'paypal' && submission.payment_provider !== 'paypal') return;
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
        onApprove: async (data: { orderID?: string }) => {
          try {
            if (!data.orderID) throw new Error('Missing PayPal order id');
            const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/capture-paypal-order`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ order_id: data.orderID, payment_token: paymentToken }),
            });
            const body = await res.json().catch(() => ({}));
            if (!res.ok || !body.ok) throw new Error(body.error ?? 'Payment confirmation failed');
            setPaymentComplete(true);
            loadPayment();
          } catch {
            setPaypalError(isAnatoliaPayment ? `PayPal ödemeyi onayladı, ancak sistemimiz henüz doğrulayamadı. Lütfen tekrar deneyin veya bizi arayın: ${PHONE_DISPLAY}` : `PayPal approved the checkout, but our system could not confirm it yet. Please retry or call us: ${PHONE_DISPLAY}`);
          }
        },
        onError: () => {
          setPaypalError(isAnatoliaPayment ? `Ödeme tamamlanamadı. Lütfen tekrar deneyin veya arayın: ${PHONE_DISPLAY}` : `Payment could not be completed. Please try again or call: ${PHONE_DISPLAY}`);
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
  }, [submission, paymentToken, paypalClientId, loadPayment, isAnatoliaPayment, selectedOtherPayment]);

  useEffect(() => {
    if (!paymentToken || !submission || submission.payment_provider !== 'zelle') return;
    getZelleStatus(paymentToken)
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
  }, [paymentToken, submission]);

  useEffect(() => {
    if (!paymentToken || !submission || submission.payment_provider !== 'venmo') return;
    getVenmoStatus(paymentToken)
      .then((result) => {
        if (result.intent) setVenmoIntent(result.intent);
      })
      .catch((error) => {
        setVenmoError(error instanceof Error ? error.message : 'Could not load Venmo payment status');
      });
  }, [paymentToken, submission]);

  async function submitTxHash() {
    if (!paymentToken || !txHash.trim()) return;
    setTxSubmitting(true);
    setTxError(null);
    const { error } = await supabase!.rpc('submit_crypto_tx_hash_by_token', {
      p_payment_token: paymentToken,
      p_tx_hash: txHash.trim(),
      p_asset: txAsset,
    });
    if (error) {
      setTxError(isAnatoliaPayment ? 'Gönderilemedi. Lütfen doğrudan bizi arayın.' : 'Could not submit. Please call us directly.');
    } else {
      setTxSubmitted(true);
    }
    setTxSubmitting(false);
  }

  async function startZellePayment() {
    if (!paymentToken) return;
    setZelleLoading(true);
    setZelleError(null);
    try {
      const result = await createZelleIntent(paymentToken);
      setZelleFunctionDebug({ action: 'create-intent', status: 200, response: result });
      setZelleIntent(result.intent);
      await loadPayment();
    } catch (error) {
      setZelleFunctionDebug({
        action: 'create-intent',
        status: error instanceof ZelleFunctionError ? error.status : 'unknown',
        response: error instanceof ZelleFunctionError ? error.body : String(error),
      });
      setZelleError(isAnatoliaPayment ? 'Zelle ödemesi başlatılamadı' : error instanceof Error ? error.message : 'Could not start Zelle checkout');
    }
    setZelleLoading(false);
  }

  async function startVenmoPayment() {
    if (!paymentToken) return;
    setVenmoLoading(true);
    setVenmoError(null);
    try {
      const result = await createVenmoIntent(paymentToken);
      setVenmoIntent(result.intent);
      await loadPayment();
    } catch (error) {
      setVenmoError(error instanceof Error ? error.message : 'Could not start Venmo checkout');
    }
    setVenmoLoading(false);
  }

  async function startStripePayment() {
    if (!paymentToken) return;
    setStripeLoading(true);
    setStripeError(null);
    try {
      const result = await createStripeCheckoutSession(paymentToken);
      window.location.href = result.url;
    } catch (error) {
      const message = error instanceof StripeCheckoutError
        ? error.message
        : error instanceof Error
          ? error.message
          : 'Could not start Stripe checkout';
      setStripeError(isAnatoliaPayment ? 'Stripe odemesi baslatilamadi. Lutfen tekrar deneyin veya bizi arayin.' : message);
    }
    setStripeLoading(false);
  }

  async function submitZelleSent() {
    if (!zelleIntent) return;
    setZelleLoading(true);
    setZelleError(null);
    try {
      const result = await markZelleSent({
        intentId: zelleIntent.id,
        paymentToken,
        senderName: zelleSenderName,
        senderEmail: zelleSenderEmail,
        senderPhone: zelleSenderPhone,
        claimedAmountCents: zelleIntent.amount_due_cents,
      });
      setZelleIntent(result.intent);
    } catch (error) {
      setZelleError(isAnatoliaPayment ? 'Zelle ödeme durumu güncellenemedi' : error instanceof Error ? error.message : 'Could not update Zelle payment');
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
        paymentToken,
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
        paymentToken,
        filePath: upload.filePath,
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        fileSize: file.size,
      });
    } catch (error) {
      setZelleError(isAnatoliaPayment ? 'Ödeme kanıtı yüklenemedi' : error instanceof Error ? error.message : 'Could not upload payment proof');
    }
    setZelleProofUploading(false);
  }

  async function submitVenmoSent() {
    if (!venmoIntent) return;
    setVenmoLoading(true);
    setVenmoError(null);
    try {
      const result = await markZelleSent({
        intentId: venmoIntent.id,
        paymentToken,
        senderName: venmoSenderName,
        senderEmail: venmoSenderEmail,
        senderPhone: venmoSenderPhone,
        claimedAmountCents: venmoIntent.amount_due_cents,
      });
      setVenmoIntent(result.intent);
    } catch (error) {
      setVenmoError(error instanceof Error ? error.message : 'Could not update Venmo payment');
    }
    setVenmoLoading(false);
  }

  async function uploadVenmoProof(file: File | null) {
    if (!venmoIntent || !file) return;
    setVenmoProofUploading(true);
    setVenmoError(null);
    try {
      const upload = await requestZelleProofUpload({
        intentId: venmoIntent.id,
        paymentToken,
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
        intentId: venmoIntent.id,
        paymentToken,
        filePath: upload.filePath,
        fileName: file.name,
        contentType: file.type || 'application/octet-stream',
        fileSize: file.size,
      });
    } catch (error) {
      setVenmoError(error instanceof Error ? error.message : 'Could not upload Venmo proof');
    }
    setVenmoProofUploading(false);
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

  const checkoutScopeCode = (submission.checkout_scope_code ?? '').trim().toUpperCase();
  const referralCode = (submission.referral_code ?? '').trim().toUpperCase();
  const sourcePortal = (submission.source_portal ?? '').trim();
  const sourcePortalKey = sourcePortal.toLowerCase();
  const isMainCheckoutScope = !checkoutScopeCode || checkoutScopeCode === 'MAIN';
  const isMainSourcePortal = !sourcePortalKey || sourcePortalKey === 'main' || sourcePortalKey === 'pepscriptrx' || sourcePortalKey === 'root';
  const isAactivatedOrder = ['AACTIVATED', 'VITALITYINS', 'GUY60'].includes(checkoutScopeCode)
    || referralCode === 'GUY60'
    || sourcePortalKey.includes('vitality')
    || sourcePortalKey.includes('aactivated');
  const isAnatoliaOrder = sourcePortalKey.includes('anatolia');
  const nonMainSourcePortal = isMainSourcePortal ? '' : sourcePortal;
  const explicitPortalHint = isAnatoliaOrder
    ? 'anatolia'
    : isAactivatedOrder
      ? 'aactivated'
      : !isMainCheckoutScope
        ? (submission.checkout_scope_code || submission.referral_code || nonMainSourcePortal)
        : (submission.referral_code || nonMainSourcePortal);
  const paymentPortal = getWhiteLabelPortal(explicitPortalHint);
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
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy)', marginBottom: 12 }}>{isAnatoliaOrder ? 'Ödeme zaten alındı' : 'Payment already received'}</h1>
          <p style={{ color: 'var(--text-muted)' }}>{isAnatoliaOrder ? `${submission.medication} siparişiniz işleme alındı. Takip bilgileriyle sizinle iletişime geçeceğiz.` : `Your order for ${submission.medication} is in process. We will contact you with tracking information.`}</p>
        </div>
      </PublicLayout>
    );
  }

  if (!submission.quoted_price) {
    return (
      <PublicLayout {...paymentLayoutProps}>
        <div style={{ padding: '80px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy)', marginBottom: 12 }}>{isAnatoliaOrder ? 'Teklifiniz hazırlanıyor' : 'Your quote is being prepared'}</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>{isAnatoliaOrder ? 'Ekibimiz fiyatlandırmanızı sonlandırıyor. Ödemeniz hazır olduğunda telefon veya e-posta ile bilgilendirileceksiniz.' : 'Our team is finalizing your pricing. You will receive a call or email when your payment is ready.'}</p>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>{isAnatoliaOrder ? 'Sorularınız mı var?' : 'Questions? Call our AI line:'} <a href={PHONE_HREF} style={{ color: 'var(--teal)' }}>{PHONE_DISPLAY}</a></p>
        </div>
      </PublicLayout>
    );
  }

  if (submission.status !== 'payment_sent') {
    return (
      <PublicLayout {...paymentLayoutProps}>
        <div style={{ padding: '80px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--navy)', marginBottom: 12 }}>{isAnatoliaOrder ? 'Ödeme henüz mevcut değil' : 'Checkout is not available yet'}</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
            {isAnatoliaOrder ? 'Bu talep için ödeme hazır fiyat henüz yok. Şimdi ödeme yapmanız gerektiğini düşünüyorsanız lütfen bizimle iletişime geçin.' : 'This request does not have a checkout-ready price yet. Please contact us if you expected to pay now.'}
          </p>
          <p style={{ fontSize: 14, color: 'var(--text-muted)' }}>
            {isAnatoliaOrder ? 'Sorularınız mı var?' : 'Questions? Call our AI line:'} <a href={PHONE_HREF} style={{ color: 'var(--teal)' }}>{PHONE_DISPLAY}</a>
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
  const hasNonMainScope = Boolean(checkoutScopeCode && checkoutScopeCode !== 'MAIN');
  const isRootSource = isMainSourcePortal;
  const hasPartnerStorefrontAttribution = Boolean(submission.referral_code || hasNonMainScope);
  const isRootOrder = !hasPartnerStorefrontAttribution
    && isRootSource
    && (!checkoutScopeCode || checkoutScopeCode === 'MAIN');
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
    payment_token: submission.payment_token,
    source_portal: submission.source_portal ?? null,
    scope: submission.checkout_scope_code ?? null,
    rep_referral_code: submission.referral_code ?? null,
    cart_subtotal_cents: grandTotalCents,
    isRootOrder,
    isUnderZelleCap,
    NEXT_PUBLIC_ZELLE_ENABLED: String(zelleConfig.enabled),
    recipient_display_name: zelleConfig.displayName || null,
    recipient_value_present: zelleRecipientPresent,
    zelleEligible,
    hidden_reason: zelleEligible ? null : zelleHiddenReasons.join('; '),
  };
  const showZelleDebug = typeof window !== 'undefined'
    && import.meta.env.DEV
    && new URLSearchParams(window.location.search).get('zelle_debug') === '1';
  if (typeof window !== 'undefined' && import.meta.env.DEV) {
    window.console.info('[PepScriptRX Zelle eligibility]', zelleDebug);
  }
  const activeZelleIntent = zelleIntent && ['pending', 'sent', 'needs_info'].includes(zelleIntent.status);
  const activeVenmoIntent = venmoIntent && ['pending', 'sent', 'needs_info'].includes(venmoIntent.status);
  const activeManualIntent = activeZelleIntent || activeVenmoIntent;
  const zelleSavingsCents = Math.floor((grandTotalCents * zelleConfig.discountBps) / 10000);
  const zelleAmountCents = zelleIntent?.amount_due_cents ?? Math.max(0, grandTotalCents - zelleSavingsCents);
  const venmoReference = submission.order_reference || `PSRX-${submission.payment_token.slice(0, 8).toUpperCase()}`;
  const venmoNote = venmoConfig.noteInstruction.replace('[order_number]', venmoReference);
  const paymentReturnPath = `/pay/${paymentToken}`;
  const portalSignupPath = appendQueryParams(
    paymentPortal ? buildPortalSignupPath(paymentPortal) : '/patient/signup',
    { returnTo: paymentPortal ? paymentReturnPath : undefined, payment: paymentToken },
  );
  const portalLoginPath = appendQueryParams(
    paymentPortal ? buildPortalLoginPath(paymentPortal, 'patient') : '/login?portal=patient',
    { returnTo: paymentPortal ? paymentReturnPath : undefined },
  );

  const customerPortalCard = (
    <div className="card" style={{ borderColor: 'rgba(37,199,217,.38)', background: 'linear-gradient(135deg, #f8feff 0%, #ffffff 100%)' }}>
      <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 620 }}>
          <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--teal)', marginBottom: 6 }}>
            {isAnatoliaOrder ? 'Musteri portali' : 'Customer portal'}
          </div>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--navy)', marginBottom: 6 }}>
            {isAnatoliaOrder ? 'Odeme sonrasi portal hesabinizi olusturun' : 'After payment, create your portal account for updates'}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
            {isAnatoliaOrder ? 'Siparis durumu, teslimat bildirimleri ve takip bilgileri panelinizde gorunur.' : 'Order status, shipping notifications, tracking, and Mixing Center access will appear in your private dashboard.'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link className="btn btn-primary" to={portalSignupPath}>
            {isAnatoliaOrder ? 'Portal Hesabi Olustur' : 'Create Portal Account'}
          </Link>
          <Link className="btn btn-outline" to={portalLoginPath}>
            {isAnatoliaOrder ? 'Musteri Girisi' : 'Customer Login'}
          </Link>
        </div>
      </div>
    </div>
  );
  return (
    <PublicLayout {...paymentLayoutProps}>
      {/* Header */}
      <div style={{ background: 'var(--ink)', padding: '48px 24px 36px' }}>
        <div className="container-sm">
          <h1 style={{ fontSize: 'clamp(24px, 4vw, 34px)', fontWeight: 800, color: '#fff', letterSpacing: '-.02em', marginBottom: 8 }}>
            {isAnatoliaOrder ? 'Siparişinizi Tamamlayın' : 'Complete Your Order'}
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,.7)' }}>
            {isAnatoliaOrder ? 'Siparişinizi aşağıda gözden geçirin ve güvenli ödemeyi tamamlayın.' : 'Review your order below and complete secure checkout.'}
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
                <div className="card-title">{isAnatoliaOrder ? 'Sipariş Özeti' : 'Order Summary'}</div>
              </div>
              <div className="card-body">
                <div className="detail-row">
                  <span className="detail-label">{isAnatoliaOrder ? 'Ürün' : 'Medication'}</span>
                  <span className="detail-value" style={{ fontWeight: 700 }}>{submission.medication}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">{isAnatoliaOrder ? 'Ürün fiyatı' : 'Product price'}</span>
                  <span className="detail-value" style={{ fontWeight: 700 }}>${productTotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="detail-row">
                    <span className="detail-label">{isAnatoliaOrder ? 'İndirim' : 'Discount'}</span>
                    <span className="detail-value" style={{ fontWeight: 800, color: 'var(--success)' }}>
                      -${discountAmount.toFixed(2)} {submission.discount_code ? `(${submission.discount_code})` : ''}
                    </span>
                  </div>
                )}
                <div className="detail-row">
                  <span className="detail-label">{isAnatoliaOrder ? 'Teslimat' : 'Shipping'}</span>
                  <span className="detail-value">
                    {isAnatoliaOrder ? trShippingLabel(shippingOption?.label) : shippingOption?.label ?? 'Standard'}
                    <span style={{ marginLeft: 8, color: shippingCost === 0 ? 'var(--success)' : 'var(--navy)', fontWeight: 600 }}>
                      {shippingCost === 0 ? (isAnatoliaOrder ? '- Dahil' : '— Included') : `+$${shippingCost.toFixed(2)}`}
                    </span>
                  </span>
                </div>
                {shippingOption && (
                  <div className="detail-row">
                    <span className="detail-label">{isAnatoliaOrder ? 'Tahmini teslimat' : 'Estimated delivery'}</span>
                    <span className="detail-value" style={{ color: 'var(--teal)', fontWeight: 600 }}>{isAnatoliaOrder ? trShippingDays(shippingOption.days) : shippingOption.days}</span>
                  </div>
                )}
                <div className="detail-row" style={{ borderTop: '2px solid var(--border)', paddingTop: 16, marginTop: 8 }}>
                  <span className="detail-label" style={{ fontWeight: 700, fontSize: 16 }}>{isAnatoliaOrder ? 'Bugün ödenecek toplam' : 'Total due today'}</span>
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

            <div className="card" hidden aria-hidden="true" style={{ display: 'none', borderColor: 'rgba(37,199,217,.38)', background: 'linear-gradient(135deg, #f8feff 0%, #ffffff 100%)' }}>
              <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ maxWidth: 620 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--teal)', marginBottom: 6 }}>
                    {isAnatoliaOrder ? 'Müşteri portalı' : 'Customer portal'}
                  </div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--navy)', marginBottom: 6 }}>
                    {isAnatoliaOrder ? 'Ödeme ve teslimat güncellemeleri için portal hesabınızı oluşturun' : 'Create your portal account for payment and shipping updates'}
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
                    {isAnatoliaOrder ? 'Zelle doğrulama durumu, sipariş güncellemeleri, teslimat bildirimleri, takip ve Karışım Merkezi erişimi özel panelinizde görünür.' : 'Zelle verification status, order updates, shipping notifications, tracking, and Mixing Center access will appear in your private dashboard.'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Link className="btn btn-primary" to={portalSignupPath}>
                    {isAnatoliaOrder ? 'Portal Hesabı Oluştur' : 'Create Portal Account'}
                  </Link>
                  <Link className="btn btn-outline" to={portalLoginPath}>
                    {isAnatoliaOrder ? 'Müşteri Girişi' : 'Customer Login'}
                  </Link>
                </div>
              </div>
            </div>

            {zelleEligible && !activeVenmoIntent && (
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
                        {isAnatoliaOrder ? 'En iyi ödeme seçeneği - %10 tasarruf' : 'Best payment option - save 10%'}
                      </div>
                      <div className="card-title" style={{ fontSize: 'clamp(22px, 4vw, 30px)', color: '#061425' }}>{isAnatoliaOrder ? 'En iyi seçenek: Zelle ile öde' : 'Best option: Pay by Zelle'}</div>
                      <div style={{ fontSize: 14, color: '#28445d', lineHeight: 1.6, maxWidth: 650, fontWeight: 600 }}>
                        {isAnatoliaOrder ? 'Zelle siparişleri manuel doğrulanır. Yönetici ödemeyi onaylayana kadar siparişiniz beklemede kalır. Sipariş, Zelle ödemesi doğrulandıktan sonra işleme alınır.' : 'Zelle orders are manually verified. Your order stays pending until an admin confirms the received payment. Order will be processed after Zelle payment is verified.'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, color: '#38526a', fontWeight: 800 }}>{isAnatoliaOrder ? 'Zelle tutarı' : 'Zelle amount'}</div>
                      <div style={{ fontSize: 34, fontWeight: 950, color: '#061425', lineHeight: 1.05 }}>
                        ${dollarsFromCents(zelleAmountCents).toFixed(2)}
                      </div>
                      <div style={{ fontSize: 13, color: '#08798a', fontWeight: 900, marginTop: 4 }}>
                        {isAnatoliaOrder ? 'Tasarrufunuz' : 'You save'} ${dollarsFromCents(zelleSavingsCents).toFixed(2)}
                      </div>
                    </div>
                  </div>

                  {zelleError && <div className="alert alert-error mb-4">{zelleError}</div>}

                  {!zelleIntent ? (
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
                        gap: 18,
                        alignItems: 'center',
                        minWidth: 0,
                      }}
                    >
                      <button type="button" className="btn btn-primary" onClick={startZellePayment} disabled={zelleLoading} style={{ minHeight: 54, width: '100%', minWidth: 0, fontSize: 17, fontWeight: 950, lineHeight: 1.25, justifyContent: 'center', textAlign: 'center', whiteSpace: 'normal' }}>
                        {zelleLoading ? (isAnatoliaOrder ? 'Zelle hazırlanıyor...' : 'Preparing Zelle...') : isAnatoliaOrder ? `Zelle ödemesini başlat - $${dollarsFromCents(zelleSavingsCents).toFixed(2)} tasarruf` : `Start Zelle payment - save $${dollarsFromCents(zelleSavingsCents).toFixed(2)}`}
                      </button>
                      <div style={{ width: '100%', maxWidth: 360, minWidth: 0, justifySelf: 'center', background: '#ffffff', border: '1px solid rgba(7,21,36,.14)', borderRadius: 8, padding: 12, textAlign: 'center', boxShadow: '0 12px 30px rgba(7,21,36,.08)' }}>
                        <img src={zelleConfig.qrImageSrc} alt={`Zelle QR for ${zelleConfig.displayName}`} style={{ width: '100%', maxWidth: 190, height: 'auto', display: 'block', margin: '0 auto' }} />
                        <div style={{ fontSize: 12, color: '#28445d', fontWeight: 800, marginTop: 8 }}>{isAnatoliaOrder ? 'Bankacılık uygulamanızda tarayın' : 'Scan in your banking app'}</div>
                        <div style={{ fontSize: 12, color: '#28445d', fontWeight: 800, marginTop: 6 }}>
                          {isAnatoliaOrder ? 'Alıcı' : 'Recipient'}: {zelleConfig.displayName}<br />
                          {isAnatoliaOrder ? 'Telefon' : 'Phone'}: {zelleConfig.recipientValue}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gap: 18 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 16, alignItems: 'start' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                          {[
                            [isAnatoliaOrder ? 'Gönderilecek kişi' : 'Send to', zelleIntent.recipient_display_name],
                            [zelleIntent.recipient_kind === 'email' ? 'Zelle email' : isAnatoliaOrder ? 'Telefon' : 'Phone', zelleIntent.recipient_value],
                            [isAnatoliaOrder ? 'Tam tutar' : 'Exact amount', `$${dollarsFromCents(zelleIntent.amount_due_cents).toFixed(2)}`],
                            [isAnatoliaOrder ? 'Not' : 'Payment note', venmoNote],
                          ].map(([label, value]) => (
                            <div key={label} style={{ background: '#ffffff', border: '1px solid rgba(7,21,36,.16)', borderRadius: 8, padding: 14, boxShadow: '0 8px 24px rgba(7,21,36,.06)' }}>
                              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#36566f', fontWeight: 900 }}>{label}</div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginTop: 5 }}>
                                <strong style={{ color: '#061425', wordBreak: 'break-word', fontSize: 16, lineHeight: 1.35 }}>{value}</strong>
                                <button type="button" className="btn btn-outline btn-sm" onClick={() => navigator.clipboard?.writeText(value)} style={{ borderColor: '#15314a', color: '#061425', fontWeight: 800 }}>
                                  {isAnatoliaOrder ? 'Kopyala' : 'Copy'}
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div style={{ background: '#ffffff', border: '1px solid rgba(7,21,36,.14)', borderRadius: 8, padding: 14, textAlign: 'center', boxShadow: '0 14px 34px rgba(7,21,36,.1)' }}>
                          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: '#36566f', fontWeight: 900, marginBottom: 8 }}>{isAnatoliaOrder ? 'Ödemek için tara' : 'Scan to pay'}</div>
                          <img src={zelleConfig.qrImageSrc} alt={`Zelle QR for ${zelleIntent.recipient_display_name}`} style={{ width: '100%', maxWidth: 210, height: 'auto', display: 'block', margin: '0 auto' }} />
                          <div style={{ fontSize: 12, color: '#28445d', fontWeight: 800, marginTop: 8 }}>
                            {isAnatoliaOrder ? `Banka seçmeniz istenirse Chase’i seçin. Göndermeden önce bankanızın ${zelleIntent.recipient_display_name} adını gösterdiğini doğrulayın.` : `If prompted to choose a bank, select Chase. Confirm your bank shows ${zelleIntent.recipient_display_name} before sending.`}
                          </div>
                        </div>
                      </div>

                      <div style={{ background: '#fff7ed', border: '1px solid rgba(245,158,11,.42)', borderRadius: 8, padding: '12px 14px', color: '#7c2d12', fontSize: 13, fontWeight: 800, lineHeight: 1.5 }}>
                        {zelleConfig.disclosure}
                      </div>

                      <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: '#28445d', lineHeight: 1.5, fontWeight: 600 }}>
                        <input type="checkbox" checked={zelleConfirmedRecipient} onChange={(event) => setZelleConfirmedRecipient(event.target.checked)} style={{ marginTop: 3 }} />
                        {isAnatoliaOrder ? `Göndermeden önce bankanızda görünen alıcı adının ${zelleIntent.recipient_display_name} ile eşleştiğini doğrulayın. QR kodunu tararken uygulama banka seçmenizi isterse Chase’i seçin. Tam tutarı göndereceğim ve not alanına yalnızca ${venmoNote} yazacağım.` : `Before sending, confirm the recipient name shown by your bank matches ${zelleIntent.recipient_display_name}. If scanning the QR code and your app asks you to choose a bank, select Chase. I will send the exact amount and include only ${venmoNote} in the payment note.`}
                      </label>

                      {zelleIntent.status === 'sent' ? (
                        <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 8, padding: 16 }}>
                          <strong style={{ color: 'var(--success)' }}>{isAnatoliaOrder ? 'Ödeme gönderildi olarak işaretlendi.' : 'Payment marked sent.'}</strong>
                          <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                            {isAnatoliaOrder ? 'Sipariş, Zelle ödemesi doğrulandıktan sonra işleme alınır. Yönetici incelemesi beklemededir. Kanıt ekibin daha hızlı doğrulamasına yardımcı olur, ancak ödemeyi otomatik onaylamaz.' : 'Order will be processed after Zelle payment is verified. Admin review is pending. Proof helps the team verify faster, but it never auto-confirms payment.'}
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                          <input className="form-input" placeholder={isAnatoliaOrder ? 'Gönderen adı' : 'Sender name'} value={zelleSenderName} onChange={(event) => setZelleSenderName(event.target.value)} />
                          <input className="form-input" placeholder={isAnatoliaOrder ? 'Gönderen e-postası' : 'Sender email'} value={zelleSenderEmail} onChange={(event) => setZelleSenderEmail(event.target.value)} />
                          <input className="form-input" placeholder={isAnatoliaOrder ? 'Gönderen telefonu' : 'Sender phone'} value={zelleSenderPhone} onChange={(event) => setZelleSenderPhone(event.target.value)} />
                          <button
                            type="button"
                            className="btn btn-primary"
                            onClick={submitZelleSent}
                            disabled={zelleLoading || !zelleConfirmedRecipient || !zelleSenderName.trim()}
                          >
                            {zelleLoading ? (isAnatoliaOrder ? 'Kaydediliyor...' : 'Saving...') : (isAnatoliaOrder ? 'Gönderdim' : "I've sent it")}
                          </button>
                        </div>
                      )}

                      {zelleIntent.status === 'sent' && (
                        <div>
                          <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>
                            {isAnatoliaOrder ? 'İsteğe bağlı kanıt yükleme' : 'Optional proof upload'}
                          </label>
                          <input
                            type="file"
                            className="form-input"
                            accept="image/*,.pdf"
                            disabled={zelleProofUploading}
                            onChange={(event) => uploadZelleProof(event.target.files?.[0] ?? null)}
                          />
                          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                            {zelleProofUploading ? (isAnatoliaOrder ? 'Kanıt yükleniyor...' : 'Uploading proof...') : (isAnatoliaOrder ? 'Fiş ekran görüntüsü veya PDF yükleyin. Yönetici yine manuel onaylar.' : 'Upload a receipt screenshot or PDF. Admin still confirms manually.')}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!paymentComplete && !activeManualIntent && (
              <div className="card" style={{ border: '2px solid rgba(37,199,217,.42)', background: '#ffffff' }}>
                <div className="card-body" style={{ display: 'grid', gap: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ maxWidth: 620 }}>
                      <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--teal)', marginBottom: 6 }}>
                        {isAnatoliaOrder ? 'Secenek 2' : 'Option 2'}
                      </div>
                      <div className="card-title" style={{ fontSize: 'clamp(22px, 4vw, 28px)', color: 'var(--navy)' }}>
                        {isAnatoliaOrder ? 'Stripe ile guvenli ode' : 'Pay securely with Stripe'}
                      </div>
                      <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 6 }}>
                        {isAnatoliaOrder ? 'Stripe uzerinden kredi karti, banka karti veya uygun cuzdanlarla odeme yapin.' : 'Use Stripe for credit card, debit card, and eligible wallet payments.'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 800 }}>{isAnatoliaOrder ? 'Kart tutari' : 'Card amount'}</div>
                      <div style={{ fontSize: 34, fontWeight: 950, color: 'var(--navy)', lineHeight: 1.05 }}>${grandTotal.toFixed(2)}</div>
                    </div>
                  </div>

                  {submission.checkout_scope_code && (
                    <div style={{ background: 'rgba(37,199,217,.10)', border: '1px solid rgba(37,199,217,.28)', borderRadius: 8, padding: '10px 12px', color: '#075985', fontSize: 13, fontWeight: 800 }}>
                      {isAnatoliaOrder ? 'Iliskili hesap' : 'Associated account'}: {submission.checkout_scope_code}
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn btn-primary btn-lg"
                    onClick={startStripePayment}
                    disabled={stripeLoading}
                    style={{ width: '100%', justifyContent: 'center', minHeight: 54, fontWeight: 950 }}
                  >
                    {stripeLoading ? 'Opening secure Stripe checkout...' : 'Pay with Stripe / card'}
                  </button>
                  {stripeError && (
                    <div style={{ background: 'rgba(255,60,60,.10)', border: '1px solid rgba(255,60,60,.35)', borderRadius: 8, padding: '12px 16px', color: '#b91c1c', fontSize: 13, textAlign: 'left', fontWeight: 700 }}>
                      {stripeError}
                    </div>
                  )}
                </div>
              </div>
            )}

            {!paymentComplete && !activeManualIntent && selectedOtherPayment === 'venmo' && venmoConfig.enabled && (
              <div className="card" style={{ borderColor: 'rgba(0,122,255,.28)', background: '#ffffff' }}>
                <div className="card-body" style={{ display: 'grid', gap: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
                    <div style={{ maxWidth: 620 }}>
                      <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase', color: '#007aff', marginBottom: 6 }}>
                        Venmo
                      </div>
                      <div className="card-title" style={{ fontSize: 'clamp(22px, 4vw, 28px)', color: 'var(--navy)' }}>Pay with Venmo</div>
                      <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 6 }}>
                        Pay securely through Venmo to <strong>{venmoConfig.displayName} {venmoConfig.handle}</strong>. Please include your <strong>Order Number only</strong> in the Venmo note so we can match your payment quickly. Do not include product names or medical information.
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 800 }}>Venmo amount</div>
                      <div style={{ fontSize: 34, fontWeight: 950, color: 'var(--navy)', lineHeight: 1.05 }}>${grandTotal.toFixed(2)}</div>
                    </div>
                  </div>

                  {venmoError && <div className="alert alert-error">{venmoError}</div>}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: 18, alignItems: 'start' }}>
                    <div style={{ display: 'grid', gap: 12 }}>
                      <div style={{ background: 'var(--card-soft)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', fontWeight: 900 }}>Business name</div>
                        <strong style={{ display: 'block', marginTop: 5, color: 'var(--navy)', fontSize: 17 }}>{venmoConfig.displayName}</strong>
                      </div>
                      <div style={{ background: 'var(--card-soft)', border: '1px solid var(--border)', borderRadius: 8, padding: 14 }}>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', fontWeight: 900 }}>Venmo handle</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginTop: 5, flexWrap: 'wrap' }}>
                          <strong style={{ color: '#0060bf', wordBreak: 'break-word', fontSize: 20 }}>{venmoConfig.handle}</strong>
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => navigator.clipboard?.writeText(venmoConfig.handle)}>
                            Copy
                          </button>
                        </div>
                      </div>
                      <div style={{ background: '#f8fbff', border: '1px solid rgba(0,122,255,.2)', borderRadius: 8, padding: 14 }}>
                        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--text-muted)', fontWeight: 900 }}>Payment note</div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginTop: 5, flexWrap: 'wrap' }}>
                          <strong style={{ color: 'var(--navy)', wordBreak: 'break-word', fontSize: 16 }}>{venmoNote}</strong>
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => navigator.clipboard?.writeText(venmoNote)}>
                            Copy
                          </button>
                        </div>
                      </div>

                      {!venmoIntent ? (
                        <button type="button" className="btn btn-primary" onClick={startVenmoPayment} disabled={venmoLoading} style={{ minHeight: 52, fontWeight: 900 }}>
                          {venmoLoading ? 'Preparing Venmo...' : 'Select Venmo'}
                        </button>
                      ) : (
                        <div style={{ display: 'grid', gap: 12 }}>
                          <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, fontWeight: 600 }}>
                            <input type="checkbox" checked={venmoConfirmedRecipient} onChange={(event) => setVenmoConfirmedRecipient(event.target.checked)} style={{ marginTop: 3 }} />
                            I will send payment only to {venmoConfig.displayName} {venmoConfig.handle}, use the exact amount, and include only {venmoNote} in the Venmo note.
                          </label>

                          {venmoIntent.status === 'sent' ? (
                            <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 8, padding: 16 }}>
                              <strong style={{ color: 'var(--success)' }}>Payment marked sent.</strong>
                              <div style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 4 }}>
                                Your order will remain pending until payment is confirmed by our team.
                              </div>
                            </div>
                          ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                              <input className="form-input" placeholder="Sender name" value={venmoSenderName} onChange={(event) => setVenmoSenderName(event.target.value)} />
                              <input className="form-input" placeholder="Sender email" value={venmoSenderEmail} onChange={(event) => setVenmoSenderEmail(event.target.value)} />
                              <input className="form-input" placeholder="Sender phone" value={venmoSenderPhone} onChange={(event) => setVenmoSenderPhone(event.target.value)} />
                              <button
                                type="button"
                                className="btn btn-primary"
                                onClick={submitVenmoSent}
                                disabled={venmoLoading || !venmoConfirmedRecipient || !venmoSenderName.trim()}
                              >
                                {venmoLoading ? 'Saving...' : "I've sent it"}
                              </button>
                            </div>
                          )}

                          {venmoIntent.status === 'sent' && (
                            <div>
                              <label style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>
                                Optional proof upload
                              </label>
                              <input
                                type="file"
                                className="form-input"
                                accept="image/*,.pdf"
                                disabled={venmoProofUploading}
                                onChange={(event) => uploadVenmoProof(event.target.files?.[0] ?? null)}
                              />
                              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                                {venmoProofUploading ? 'Uploading proof...' : 'Upload a Venmo receipt screenshot or PDF. Admin still confirms manually.'}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    <div style={{ background: '#f8fbff', border: '1px solid rgba(0,122,255,.2)', borderRadius: 8, padding: 14, textAlign: 'center' }}>
                      <img src={venmoConfig.qrImageSrc} alt={venmoConfig.altText} style={{ width: '100%', maxWidth: 300, height: 'auto', display: 'block', margin: '0 auto' }} />
                    </div>
                  </div>

                  <div style={{ background: '#fff7ed', border: '1px solid rgba(245,158,11,.42)', borderRadius: 8, padding: '12px 14px', color: '#7c2d12', fontSize: 13, fontWeight: 800, lineHeight: 1.5 }}>
                    Your order will remain pending until payment is confirmed by our team. For Venmo, Zelle, PayPal, and Crypto payment notes, include only {venmoNote}; do not include product names, medication names, health-related information, or anything medically identifying.
                  </div>
                </div>
              </div>
            )}

            {!paymentComplete && !activeManualIntent && (
              <div className="card" style={{ borderColor: 'rgba(15,23,42,.12)', background: '#ffffff' }}>
                <div className="card-body" style={{ display: 'grid', gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 6 }}>
                      {isAnatoliaOrder ? 'Diger odeme secenekleri' : 'Other payment options'}
                    </div>
                    <div className="card-title" style={{ fontSize: 20, color: 'var(--navy)' }}>
                      {isAnatoliaOrder ? 'Baska bir odeme yontemi secin' : 'Choose another payment method'}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6, marginTop: 4 }}>
                      {isAnatoliaOrder ? 'Zelle secenek 1, Stripe secenek 2. PayPal, Venmo veya Crypto icin bu menuyu kullanin.' : 'Zelle is option 1 and Stripe is option 2. Use this menu for PayPal, Venmo, or Crypto.'}
                    </div>
                  </div>
                  <select
                    className="form-select"
                    value={selectedOtherPayment}
                    onChange={(event) => setSelectedOtherPayment(event.target.value as 'paypal' | 'venmo' | 'crypto' | '')}
                    style={{ maxWidth: 420 }}
                  >
                    <option value="">{isAnatoliaOrder ? 'Odeme yontemi secin' : 'Select a payment method'}</option>
                    <option value="paypal">PayPal</option>
                    <option value="venmo">Venmo</option>
                    <option value="crypto">Crypto</option>
                  </select>
                  {selectedOtherPayment === 'venmo' && !venmoConfig.enabled && (
                    <div className="alert alert-info" style={{ margin: 0 }}>
                      Venmo is not currently enabled for this checkout session.
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* PayPal payment */}
            {!activeManualIntent && selectedOtherPayment === 'paypal' && (
            <div className="card" style={{ background: 'var(--ink)' }}>
              <div className="card-body" style={{ textAlign: 'center', padding: activeZelleIntent ? '30px 24px' : '40px 24px' }}>
                <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: '.06em', textTransform: 'uppercase', color: activeZelleIntent ? '#69efff' : 'rgba(255,255,255,.65)', marginBottom: 6 }}>
                  {activeZelleIntent ? (isAnatoliaOrder ? 'Yedek ödeme seçeneği' : 'Backup payment option') : (isAnatoliaOrder ? 'Güvenli ödeme' : 'Secure checkout')}
                </div>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,.76)', marginBottom: 6 }}>
                  {activeZelleIntent ? (isAnatoliaOrder ? 'PayPal, banka kartı veya kredi kartını mı tercih edersiniz?' : 'Prefer PayPal, debit, or credit card?') : (isAnatoliaOrder ? 'Bugün ödenecek toplam' : 'Total due today')}
                </div>
                <div style={{ fontSize: activeZelleIntent ? 34 : 44, fontWeight: 900, color: '#fff', marginBottom: 8 }}>${grandTotal.toFixed(2)}</div>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,.62)', marginBottom: 28 }}>
                  {submission.medication} + {isAnatoliaOrder ? trShippingLabel(shippingOption?.label) : shippingOption?.label ?? 'Standard Shipping'}
                  {discountAmount > 0 ? (isAnatoliaOrder ? ` - ${submission.discount_code ?? 'referans'} indirimi` : ` - ${submission.discount_code ?? 'referral'} discount`) : ''}
                  {activeZelleIntent ? (isAnatoliaOrder ? ' - Zelle tasarrufu PayPal/kart için geçerli değildir.' : ' - Zelle savings do not apply to PayPal/card.') : ''}
                </div>
                {submission.checkout_scope_code && (
                  <div style={{ background: 'rgba(37,199,217,.14)', border: '1px solid rgba(37,199,217,.35)', borderRadius: 8, padding: '10px 12px', maxWidth: 400, margin: '0 auto 18px', color: '#bff8ff', fontSize: 13, fontWeight: 800 }}>
                    {isAnatoliaOrder ? 'İlişkili hesap' : 'Associated account'}: {submission.checkout_scope_code}
                  </div>
                )}

                {paymentComplete ? (
                  <div style={{ background: 'rgba(0,200,100,.15)', border: '1px solid #00c864', borderRadius: 10, padding: '24px' }}>
                    <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
                    <div style={{ fontWeight: 700, color: '#00c864', fontSize: 18 }}>{isAnatoliaOrder ? 'Ödeme alındı - teşekkürler!' : 'Payment received - thank you!'}</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,.7)', marginTop: 8 }}>
                      {isAnatoliaOrder ? 'Siparişiniz onaylandı. Takip bilgileriyle yakında sizinle iletişime geçeceğiz.' : "Your order is confirmed. We'll contact you with tracking info soon."}
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
                      <p style={{ fontSize: 13, color: 'rgba(255,255,255,.4)' }}>{isAnatoliaOrder ? 'Ödeme seçenekleri yükleniyor...' : 'Loading payment options...'}</p>
                    )}
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,.5)', marginTop: 8 }}>
                      {isAnatoliaOrder ? 'PayPal · Kredi kartı · Banka kartı - hesap gerekmez' : 'PayPal · Credit card · Debit card - no account required'}
                    </p>
                  </>
                ) : (
                  <div style={{ background: 'rgba(255,196,57,.14)', border: '1px solid rgba(255,196,57,.42)', borderRadius: 10, padding: '18px 20px', maxWidth: 460, margin: '0 auto', textAlign: 'left' }}>
                    <div style={{ color: '#ffd66b', fontWeight: 800, marginBottom: 6 }}>{isAnatoliaOrder ? 'Güvenli ödeme geçici olarak kullanılamıyor' : 'Secure checkout is temporarily unavailable'}</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,.72)', lineHeight: 1.6 }}>
                      {isAnatoliaOrder ? `Resmi PayPal ödeme istemcisi bu tarayıcı oturumu için yapılandırılmamış. Lütfen ${PHONE_DISPLAY} numarasını arayın; bu sayfa dışındaki doğrudan PayPal bağlantılarına ödeme göndermeyin.` : `The official PayPal checkout client is not configured for this browser session. Please call ${PHONE_DISPLAY}; do not send payment to any direct PayPal link outside this page.`}
                    </div>
                  </div>
                )}
              </div>
            </div>
            )}

            {!paymentComplete && !activeManualIntent && selectedOtherPayment === 'crypto' && (<>
            {/* Divider */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{isAnatoliaOrder ? 'VEYA KRİPTO İLE ÖDE' : 'OR PAY WITH CRYPTO'}</span>
              <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
            </div>

            {/* Crypto payment */}
            <CryptoPaymentInstructions
              totalUsd={grandTotal}
              expectedAssetAmount={submission.crypto_expected_amount_asset}
              selectedAsset={submission.crypto_asset}
              locale={isAnatoliaOrder ? 'tr' : 'en'}
            />

            {/* Crypto TX hash submission */}
            <div className="card">
              <div className="card-header" style={{ paddingBottom: 12 }}>
                <div className="card-title">{isAnatoliaOrder ? 'Kripto gönderdiniz mi?' : 'Already sent crypto?'}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{isAnatoliaOrder ? 'Ekibimizin ödemenizi daha hızlı doğrulaması için işlem kimliğinizi (TX hash) gönderin.' : 'Submit your transaction ID (TX hash) so our team can verify your payment faster.'}</div>
              </div>
              <div className="card-body">
                {txSubmitted ? (
                  <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success)', borderRadius: 'var(--radius-sm)', padding: '16px 18px' }}>
                    <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: 4 }}>{isAnatoliaOrder ? 'İşlem kimliği alındı' : 'Transaction ID received'}</div>
                    <div style={{ fontSize: 13, color: 'var(--success)' }}>{isAnatoliaOrder ? 'Ekibimiz ödemenizi doğrulayıp sipariş durumunuzu güncelleyecek. Ek işlem gerekmez.' : 'Our team will verify your payment and update your order status. No further action needed.'}</div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <div style={{ flex: '0 0 auto' }}>
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>{isAnatoliaOrder ? 'Varlık' : 'Asset'}</label>
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
                        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '.05em' }}>{isAnatoliaOrder ? 'İşlem Kimliği / TX Hash' : 'Transaction ID / TX Hash'}</label>
                        <input
                          type="text"
                          className="form-input"
                          style={{ width: '100%', fontFamily: 'monospace', fontSize: 13 }}
                          placeholder={isAnatoliaOrder ? 'TX hash’inizi buraya yapıştırın...' : 'Paste your TX hash here...'}
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
                      {txSubmitting ? (isAnatoliaOrder ? 'Gönderiliyor...' : 'Submitting...') : (isAnatoliaOrder ? 'İşlem Kimliğini Gönder' : 'Submit Transaction ID')}
                    </button>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {isAnatoliaOrder ? 'TX hash’iniz ile bizi arayabilir veya mesaj gönderebilirsiniz' : 'You can also call or text us with your TX hash'}: <a href={PHONE_HREF} style={{ color: 'var(--teal)' }}>{PHONE_DISPLAY}</a>
                    </div>
                  </div>
                )}
              </div>
            </div>
            </>)}

            {!paymentComplete && !activeManualIntent && customerPortalCard}

            {/* What happens next */}
            <div className="card">
              <div className="card-header" style={{ paddingBottom: 16 }}>
                <div className="card-title">{isAnatoliaOrder ? 'Ödemeden sonra ne olur?' : 'What happens after payment?'}</div>
              </div>
              <div className="card-body">
                {[
                  { n: 1, text: isAnatoliaOrder ? 'Ödemeniz alınır ve siparişiniz onaylanır.' : 'Your payment is received and your order is confirmed.' },
                  { n: 2, text: isAnatoliaOrder ? 'Teslimat iş ortağımız siparişinizi işler ve gönderir.' : 'Our fulfillment partner processes and ships your order.' },
                  { n: 3, text: isAnatoliaOrder ? `Takip bilgilerini e-posta ile ${trShippingDays(shippingOption?.days)} içinde alırsınız.` : `You receive tracking info by email within ${shippingOption?.days ?? '5-7 business days'}.` },
                  { n: 4, text: isAnatoliaOrder ? `Sorularınız için istediğiniz zaman arayın veya mesaj gönderin: ${PHONE_DISPLAY}.` : `Questions? Call or text our AI line any time: ${PHONE_DISPLAY}.` },
                ].map((step) => (
                  <div key={step.n} style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--teal-pale)', color: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0, fontSize: 13 }}>{step.n}</div>
                    <div style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6, paddingTop: 4 }}>{step.text}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="disclaimer">
              {isAnatoliaOrder ? (
                <>
                  <strong>Uyarı:</strong> Ödeme siparişinizi onaylar ve teslimat sürecini yetkilendirir. {paymentPortal?.brandName ?? 'Anatolia Wellness Labs'} bir eczane veya sağlık hizmeti sağlayıcısı değildir. Teslimat doğrulanmış üçüncü taraf iş ortakları tarafından yürütülür.
                  {' '}Sorularınız mı var? <Link to={paymentHomePath} style={{ color: 'var(--teal)' }}>{paymentPortal?.brandName ?? 'ana sayfa'} mağazasına dönün</Link> veya <a href={PHONE_HREF} style={{ color: 'var(--teal)' }}>{PHONE_DISPLAY}</a> numarasını arayın.
                </>
              ) : (
                <>
                  <strong>Notice:</strong> Payment confirms your order and authorizes fulfillment. {paymentPortal?.brandName ?? 'PepScriptRX'} is not a pharmacy or medical provider. Fulfillment is handled by verified third-party partners.
                  {' '}Questions? <Link to={paymentHomePath} style={{ color: 'var(--teal)' }}>Return to {paymentPortal?.brandName ?? 'our home page'}</Link> or call <a href={PHONE_HREF} style={{ color: 'var(--teal)' }}>{PHONE_DISPLAY}</a>.
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}

function appendQueryParams(path: string, params: Record<string, string | null | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  const serialized = query.toString();
  if (!serialized) return path;
  return `${path}${path.includes('?') ? '&' : '?'}${serialized}`;
}
