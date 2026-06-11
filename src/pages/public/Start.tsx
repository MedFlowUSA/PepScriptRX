import { useState, useRef, useEffect } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import ProductPurityGuaranteeBadge from '../../components/ProductPurityGuaranteeBadge';
import AACTIVATEDRXVerificationBadge from '../../components/AACTIVATEDRXVerificationBadge';
import AiAssistedBadge from '../../components/ai/AiAssistedBadge';
import PepRxBotBadge from '../../components/ai/PepRxBotBadge';
import { useAuth } from '../../context/AuthContext';
import { usePageMeta } from '../../hooks/usePageMeta';
import { createPepScriptSubmission, getCustomerAccountStatus, isSupabaseConfigured, sendCustomerOrderEmail, supabase, validateCheckoutScope } from '../../lib/supabase';
import { US_STATES, SHIPPING_OPTIONS } from '../../types';
import { DEFAULT_PRODUCTS, INTAKE_PRODUCTS, PRODUCT_IMAGES } from '../../data/products';
import type { Product } from '../../data/products';
import { getDistributorProductById } from '../../data/rxPlus';
import {
  applyReferralFromUrl,
  DEFAULT_REFERRAL_DISCOUNT_AMOUNT,
  restoreReferral,
  type StoredReferral,
} from '../../config/referrals';
import { getWhiteLabelPortal } from '../../config/whiteLabelPortals';
import {
  isValidCheckoutScopeFormat,
  normalizeCheckoutScopeCode,
  resolveCheckoutScope,
  storeCheckoutScope,
  type CheckoutScopeState,
} from '../../lib/checkoutScope';
import {
  PORTAL_LEAD_DISCOUNT_CODE,
  PORTAL_LEAD_DISCOUNT_PERCENT,
  getActivePortalLeadDiscount,
} from '../../lib/portalLeadCapture';
import { scopedMixingCenterPath } from '../../lib/mixingCenter';
import { getProductMetadata, productOrderLabel } from '../../lib/productMetadata';
import { roleMatchesPortal, rolePortalLabel } from '../../lib/authRoles';
import {
  SPECIAL_ORDER_CHECKOUT_NOTICE,
  SPECIAL_ORDER_ITEM_NOTICE,
  computeInventoryStatus,
  type InventoryDisplayStatus,
  type InventoryStatusSnapshot,
} from '../../lib/inventoryStatus';

const BROOKS_DISCOUNT_CODE = 'BROOKS25';
const BROOKS_DISCOUNT_PERCENT = 0.25;
const MAIN_DISCOUNT_CODE = 'PEP10';
const MAIN_DISCOUNT_PERCENT = 0.10;
const EHW_SUB_DISCOUNT_CODE = 'PEP10';

type PublicInventoryStatusRow = {
  product_id: string;
  quantity_on_hand: number | null;
  low_stock_threshold: number | null;
  stock_status: InventoryDisplayStatus | string | null;
  allow_special_order: boolean | null;
  estimated_fulfillment_days: number | null;
  active: boolean | null;
  sellable: boolean | null;
  customer_visible: boolean | null;
  display_stock_status?: InventoryDisplayStatus | string | null;
  display_stock_label?: string | null;
  checkout_allowed?: boolean | null;
  was_special_order?: boolean | null;
  status_message?: string | null;
};

function mapInventoryStatusRow(row: PublicInventoryStatusRow | undefined): InventoryStatusSnapshot {
  const computed = computeInventoryStatus(row);
  if (!row?.display_stock_status) return computed;
  return {
    ...computed,
    inventory_status: String(row.display_stock_status) as InventoryDisplayStatus,
    inventory_status_label: row.display_stock_label ?? computed.inventory_status_label,
    checkout_allowed: row.checkout_allowed ?? computed.checkout_allowed,
    was_special_order: row.was_special_order ?? computed.was_special_order,
    supporting_copy: row.status_message ?? computed.supporting_copy,
  };
}

function normalizeInventoryStatusLabel(label: string | null | undefined): string | undefined {
  if (!label) return undefined;
  return label.toLowerCase().replace(/\s+/g, '_') === 'special_order' ? 'Out of Stock - Checkout Available' : label;
}

function inventoryBadgeClass(status: InventoryDisplayStatus): string {
  if (status === 'in_stock') return 'badge-success';
  if (status === 'low_stock') return 'badge-warning';
  if (status === 'special_order') return 'badge-info';
  if (status === 'hidden') return 'badge-default';
  return 'badge-error';
}

export default function Start() {
  usePageMeta(
    'Check My Savings',
    'Select your medication and submit your intake form. Our team reviews eligibility and contacts you with a refill savings quote within 1–2 business days.',
  );
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const { user, profile, loading: authLoading, signIn, signOut } = useAuth();

  const searchParams = new URLSearchParams(window.location.search);
  const pathname = window.location.pathname;
  const normalizedPathname = pathname.toLowerCase();
  const isMainPlatformPath = normalizedPathname === '/' || normalizedPathname === '/start';
  const explicitRepSlug = searchParams.get('rep') || '';
  const explicitDiscountCode = searchParams.get('discount') || '';
  const hasExplicitReferral = Boolean(
    explicitRepSlug
      || explicitDiscountCode
      || searchParams.get('ref')
      || searchParams.get('referral'),
  );
  const hasExplicitScope = Boolean(
    searchParams.get('scope')
      || searchParams.get('admin')
      || searchParams.get('store'),
  );
  const storedReferral = isMainPlatformPath ? null : getStoredReferral(hasExplicitReferral, pathname);
  const repSlug = isMainPlatformPath ? '' : explicitRepSlug || storedReferral?.repSlug || '';
  const initialDiscountCode = isMainPlatformPath ? '' : normalizeDiscountCodeForAutofill(explicitDiscountCode || storedReferral?.discountCode || '');
  const initialDiscountAmount = isMainPlatformPath ? 0 : storedReferral?.discountAmount ?? (initialDiscountCode ? DEFAULT_REFERRAL_DISCOUNT_AMOUNT : 0);
  const initialCheckoutScope = isMainPlatformPath ? null : resolveCheckoutScope(searchParams, { restoreStored: hasExplicitScope || hasExplicitReferral });

  const sourceParam = searchParams.get('source') || '';
  const portalCart = readPortalCart(sourceParam);
  const isPortalCartFlow = Boolean(portalCart && portalCart.items.length > 0);

  const initialPortalProduct = isPortalCartFlow ? makeCartSummaryProduct(portalCart!) : getInitialPortalProduct(searchParams);
  const [step, setStep] = useState<1 | 2>(initialPortalProduct ? 2 : 1);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(initialPortalProduct);
  const [selectedAddons, setSelectedAddons] = useState<Product[]>([]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const initialVisiblePromoCode = isPortalCartFlow ? '' : initialDiscountCode;
  const [promoInput, setPromoInput] = useState(initialVisiblePromoCode);
  const [appliedDiscountCode, setAppliedDiscountCode] = useState(initialVisiblePromoCode);
  const [manualPortalDiscount, setManualPortalDiscount] = useState<{ code: string; amount: number; label: string } | null>(null);
  const [promoMessage, setPromoMessage] = useState('');
  const [scopeInput, setScopeInput] = useState(initialCheckoutScope?.code ?? '');
  const [checkoutScope, setCheckoutScope] = useState<CheckoutScopeState | null>(initialCheckoutScope);
  const [scopeDisplayName, setScopeDisplayName] = useState('');
  const [scopeMessage, setScopeMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [emailAccountStatus, setEmailAccountStatus] = useState<{ checkedEmail: string; accountExists: boolean; customerExists: boolean } | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginMessage, setLoginMessage] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [mainInventoryRows, setMainInventoryRows] = useState<PublicInventoryStatusRow[]>([]);
  const allowCheckoutScope = !isMainPlatformPath && (hasExplicitScope || hasExplicitReferral || isPortalCartFlow);
  const activeCheckoutScope = allowCheckoutScope ? checkoutScope : null;
  const isLoggedInCustomer = Boolean(user && profile && roleMatchesPortal(profile.role, 'patient'));
  const loggedInStaffLabel = user && profile && !isLoggedInCustomer ? rolePortalLabel(profile.role) : '';
  const profileFullName = isLoggedInCustomer ? String(profile?.full_name ?? '') : '';
  const profileEmail = isLoggedInCustomer ? String(profile?.email ?? '') : '';
  const profilePhone = isLoggedInCustomer ? String(profile?.phone ?? '') : '';

  const penKitProduct = DEFAULT_PRODUCTS.find((product) => product.id === 'pen-kit');
  const isAccessoryOnly = selectedProduct?.product_type === 'accessory';
  const isSupplyOnly = selectedProduct?.product_type === 'supply';
  const isRxPlusOrder = isPortalCartFlow || Boolean(selectedProduct?.id.startsWith('mark-') && searchParams.get('order_ready') === '1');
  const isPricedProduct = Boolean(selectedProduct && selectedProduct.price > 0);
  const opensCheckout = Boolean(isRxPlusOrder || isPricedProduct);
  const isSimpleRequest = Boolean((isAccessoryOnly || isSupplyOnly) && !opensCheckout);
  const isMedicationFlow = Boolean(selectedProduct && !isSimpleRequest && !isRxPlusOrder);
  const needsShipping = Boolean(opensCheckout);
  const addonTotal = selectedAddons.reduce((sum, addon) => sum + addon.price, 0);
  const checkoutSubtotal = isPortalCartFlow && portalCart ? portalCart.total : (selectedProduct?.price ?? 0) + addonTotal;
  const receiptDiscountRequested = Boolean(
    receiptFile && selectedProduct?.requires_receipt_upload && !isPortalCartFlow,
  );
  const submissionType = getSubmissionType(selectedProduct);
  const pageTitle = opensCheckout ? 'Complete Your Order' : isAccessoryOnly ? 'Reusable Pen Kit Request' : isSupplyOnly ? 'Supply Request' : 'Start Refill Request';
  const pageCopy = isSimpleRequest && isAccessoryOnly
    ? 'Submit your information and our team will follow up with availability and next steps. The pen kit may be added to eligible orders.'
    : isSimpleRequest && isSupplyOnly
      ? 'Submit your information and our team will follow up with availability and next steps for this supply item.'
      : opensCheckout
        ? 'Select your product, confirm shipping, and continue directly to secure checkout. Receipt-discount requests are reviewed before payment.'
        : 'Select your product, confirm your information, and our team will review eligibility and next steps.';
  const activeScopeCode = activeCheckoutScope?.code ?? '';
  const isAactivatedCheckout = Boolean(
    portalCart?.distributor === 'guy' ||
    ['AACTIVATED', 'VITALITYINS', 'GUY60'].includes(activeScopeCode),
  );
  const isAlphaPrideCheckout = Boolean(
    portalCart?.distributor === 'alpha' ||
    ['ALPHAPRIDE', 'ALPHA45'].includes(activeScopeCode),
  );
  const checkoutPortal = getWhiteLabelPortal(
    searchParams.get('brand') ||
    portalCart?.distributor ||
    portalCart?.store_slug ||
    activeScopeCode ||
    (isAactivatedCheckout ? 'aactivated' : isAlphaPrideCheckout ? 'alphapride' : null),
  );
  const checkoutBrandName = checkoutPortal?.brandName ?? 'PepScriptRX';
  const checkoutHomePath = checkoutPortal?.path ?? '/';
  const termsPath = checkoutPortal ? `${checkoutPortal.path}/terms` : '/terms';
  const privacyPath = checkoutPortal ? `${checkoutPortal.path}/privacy` : '/privacy';
  const portalLeadCapture = getActivePortalLeadDiscount(checkoutPortal?.id);
  const portalCartDiscount = isPortalCartFlow && portalCart
    ? getCheckoutDiscount(portalCart.discount_code ?? '', checkoutSubtotal, Number(portalCart.discount_amount ?? 0))
    : null;
  const bundleDiscountAmount = isPortalCartFlow && portalCart ? getPortalCartBundleDiscount(portalCart) : 0;
  const manualPortalCheckoutDiscount = manualPortalDiscount
    ? {
        code: bundleDiscountAmount > 0 ? `${manualPortalDiscount.code}+BUNDLE` : manualPortalDiscount.code,
        amount: roundMoney(manualPortalDiscount.amount + bundleDiscountAmount),
        label: bundleDiscountAmount > 0 ? `${manualPortalDiscount.label} + bundle savings` : manualPortalDiscount.label,
      }
    : null;
  const standardCheckoutDiscount = !isPortalCartFlow
    ? getCheckoutDiscount(appliedDiscountCode, checkoutSubtotal, initialDiscountAmount)
    : null;
  const portalLeadCheckoutDiscount = checkoutPortal && !portalCartDiscount && !standardCheckoutDiscount && portalLeadCapture
    ? getPercentageCheckoutDiscount(PORTAL_LEAD_DISCOUNT_CODE, checkoutSubtotal, PORTAL_LEAD_DISCOUNT_PERCENT)
    : null;
  const checkoutDiscount = manualPortalCheckoutDiscount ?? portalCartDiscount ?? standardCheckoutDiscount ?? portalLeadCheckoutDiscount;
  const discountCode = checkoutDiscount?.code ?? '';
  const discountAmount = checkoutDiscount?.amount ?? 0;
  const checkoutTotal = Math.max(0, checkoutSubtotal - discountAmount);
  const selectedProductMetadata = selectedProduct
    ? getProductMetadata({ id: selectedProduct.id, name: selectedProduct.name })
    : null;
  const leadFullName = portalLeadCapture
    ? `${portalLeadCapture.firstName} ${portalLeadCapture.lastName}`.trim()
    : '';
  const returnTo = `${window.location.pathname}${window.location.search}`;
  const checkoutLoginPath = `/login?portal=patient&returnTo=${encodeURIComponent(returnTo)}`;
  const checkoutSignupPath = `/patient/signup?returnTo=${encodeURIComponent(returnTo)}${profileEmail ? `&email=${encodeURIComponent(profileEmail)}` : ''}`;
  const portalHasSpecialOrder = Boolean(portalCart?.items.some((item) => item.was_special_order));
  const inventoryByProductId = new Map(mainInventoryRows.map((row) => [row.product_id, row]));
  const inventoryStatusForMainProduct = (product: Product) => mapInventoryStatusRow(inventoryByProductId.get(product.id));
  const selectedInventoryStatus = selectedProduct ? inventoryStatusForMainProduct(selectedProduct) : null;

  useEffect(() => {
    if (profileEmail) {
      setEmailAccountStatus(null);
      setLoginEmail(profileEmail);
    }
  }, [profileEmail]);
  useEffect(() => {
    if (!supabase) return;
    const productIds = INTAKE_PRODUCTS.map((product) => product.id);
    supabase
      .from('public_inventory_status')
      .select('product_id, quantity_on_hand, low_stock_threshold, stock_status, allow_special_order, estimated_fulfillment_days, active, sellable, customer_visible, display_stock_status, display_stock_label, checkout_allowed, was_special_order, status_message')
      .in('product_id', productIds)
      .then(({ data }) => setMainInventoryRows((data as PublicInventoryStatusRow[]) ?? []));
  }, []);
  useEffect(() => {
    if (!initialCheckoutScope?.code) return;
    validateCheckoutScope(initialCheckoutScope.code)
      .then((result) => {
        if (result.valid && result.scope_code) {
          const next = { code: result.scope_code, source: initialCheckoutScope.source } as CheckoutScopeState;
          setCheckoutScope(next);
          setScopeInput(result.scope_code);
          setScopeDisplayName(result.display_name ?? result.scope_code);
          setScopeMessage(`Associated account: ${result.display_name ?? result.scope_code}`);
          storeCheckoutScope(next);
        } else {
          setCheckoutScope(null);
          setScopeDisplayName('');
          setScopeMessage('We could not verify that account code. You can continue without it or check the code.');
          storeCheckoutScope(null);
        }
      })
      .catch(() => {
        setScopeMessage('We could not verify that account code. You can continue without it or check the code.');
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function applyScopeCode() {
    const normalized = normalizeCheckoutScopeCode(scopeInput);
    if (!normalized) {
      setCheckoutScope(null);
      setScopeDisplayName('');
      setScopeMessage('Account code removed.');
      storeCheckoutScope(null);
      return;
    }

    if (!isValidCheckoutScopeFormat(normalized)) {
      setCheckoutScope(null);
      setScopeDisplayName('');
      setScopeMessage('We could not verify that account code. You can continue without it or check the code.');
      storeCheckoutScope(null);
      return;
    }

    try {
      const result = await validateCheckoutScope(normalized);
      if (!result.valid || !result.scope_code) {
        setCheckoutScope(null);
        setScopeDisplayName('');
        setScopeMessage('We could not verify that account code. You can continue without it or check the code.');
        storeCheckoutScope(null);
        return;
      }
      const next = { code: result.scope_code, source: 'manual_checkout' } as CheckoutScopeState;
      setCheckoutScope(next);
      setScopeInput(result.scope_code);
      setScopeDisplayName(result.display_name ?? result.scope_code);
      setScopeMessage(`Associated account: ${result.display_name ?? result.scope_code}`);
      storeCheckoutScope(next);
    } catch {
      setScopeMessage('We could not verify that account code. You can continue without it or check the code.');
    }
  }

  function handleProductSelect(product: Product) {
    const inventoryStatus = inventoryStatusForMainProduct(product);
    if (!inventoryStatus.checkout_allowed) {
      setError(`${product.name} is not currently sellable. Please choose another product.`);
      return;
    }
    setSelectedProduct(product);
    setSelectedAddons([]);
    setReceiptFile(null);
    setError('');
    setStep(2);
  }

  function handleFile(setter: (f: File | null) => void) {
    return (e: ChangeEvent<HTMLInputElement>) => setter(e.target.files?.[0] ?? null);
  }

  function toggleAddon(addon: Product) {
    setSelectedAddons((current) => (
      current.some((item) => item.id === addon.id)
        ? current.filter((item) => item.id !== addon.id)
        : [...current, addon]
    ));
  }

  async function applyPromoCode() {
    const normalized = promoInput.trim().toUpperCase();
    setManualPortalDiscount(null);
    if (!normalized) {
      setAppliedDiscountCode('');
      setPromoMessage('Discount code removed.');
      return;
    }

    if (isAactivatedCheckout && isPortalCartFlow && portalCart) {
      if (!supabase) {
        setAppliedDiscountCode('');
        setPromoMessage('Discount codes are temporarily unavailable.');
        return;
      }

      const { data, error: promoError } = await supabase
        .from('aactivated_promo_links')
        .select('promo_title,discount_code,discount_amount,discount_type,discount_percent,promo_kind,expires_at,usage_limit,uses_count,product_id,min_subtotal')
        .eq('discount_code', normalized)
        .eq('promo_kind', 'customer_discount')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (promoError || !data) {
        setAppliedDiscountCode('');
        setPromoMessage('Code not recognized or no longer active.');
        return;
      }

      const promo = data as AactivatedCheckoutPromo;
      const promoDiscount = discountForAactivatedPromo(promo, portalCart);
      if (!promoDiscount) {
        setAppliedDiscountCode('');
        if (promo.product_id) {
          setPromoMessage('That code is active, but the eligible product is not in this cart.');
        } else {
          setPromoMessage('That code is active, but the cart does not meet the discount requirements.');
        }
        return;
      }

      setAppliedDiscountCode(promo.discount_code);
      setPromoInput(promo.discount_code);
      setManualPortalDiscount(promoDiscount);
      setPromoMessage(`${promo.discount_code} applied: ${promoDiscount.label}.`);
      return;
    }

    const isEhwSubStoreDiscount = normalized === EHW_SUB_DISCOUNT_CODE
      && (initialDiscountCode.toUpperCase() === EHW_SUB_DISCOUNT_CODE || repSlug.toUpperCase() === 'EHWSUB');

    const isMainLeadDiscount = normalized === MAIN_DISCOUNT_CODE
      && (initialDiscountCode.toUpperCase() === MAIN_DISCOUNT_CODE || !repSlug);

    if (normalized === BROOKS_DISCOUNT_CODE || isMainLeadDiscount || isEhwSubStoreDiscount || normalized === initialDiscountCode.toUpperCase()) {
      setAppliedDiscountCode(normalized);
      setPromoInput(normalized);
      const nextDiscount = getCheckoutDiscount(normalized, checkoutSubtotal, initialDiscountAmount);
      setPromoMessage(nextDiscount ? `${normalized} applied: ${nextDiscount.label}.` : '');
      return;
    }

    setAppliedDiscountCode('');
    setPromoMessage('Code not recognized. Please check the spelling and try again.');
  }

  async function checkEmailAccount(email: string): Promise<{ accountExists: boolean; customerExists: boolean } | null> {
    const normalized = email.trim().toLowerCase();
    if (!normalized || isLoggedInCustomer) return null;
    try {
      const status = await getCustomerAccountStatus(normalized);
      const next = status
        ? {
            accountExists: status.account_exists,
            customerExists: status.customer_account_exists,
          }
        : null;
      if (next) {
        setEmailAccountStatus({
          checkedEmail: normalized,
          ...next,
        });
        if (next.customerExists) setLoginEmail(normalized);
      }
      return next;
    } catch {
      return null;
    }
  }

  async function handleCheckoutLogin() {
    setError('');
    setLoginMessage('');
    setLoginLoading(true);
    try {
      const result = await signIn(loginEmail, loginPassword);
      if (!result.profile || !roleMatchesPortal(result.profile.role, 'patient')) {
        const label = rolePortalLabel(result.profile?.role);
        await signOut();
        setLoginMessage(`This login belongs to ${label}. Please use a customer account for customer checkout.`);
        return;
      }
      setLoginPassword('');
      setEmailAccountStatus(null);
      setLoginMessage(`You are checked out as ${result.profile.email}.`);
      window.setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    } catch (err: unknown) {
      setLoginMessage(err instanceof Error ? err.message : 'Login failed. Please check your credentials.');
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!selectedProduct) return;
    setError('');

    if (user && profile && !isLoggedInCustomer) {
      setError(`${loggedInStaffLabel || 'This'} account cannot use customer checkout. Please sign out and use a customer account, or use the correct internal purchase flow.`);
      return;
    }

    const fd = new FormData(formRef.current!);
    const formEmail = String(fd.get('email') ?? '').trim().toLowerCase();
    if (!isLoggedInCustomer) {
      const status = emailAccountStatus?.checkedEmail === formEmail
        ? { accountExists: emailAccountStatus.accountExists, customerExists: emailAccountStatus.customerExists }
        : await checkEmailAccount(formEmail);
      if (status?.customerExists) {
        setLoginEmail(formEmail);
        setError('An account already exists for this email. Please log in to continue.');
        return;
      }
      if (status?.accountExists && !status.customerExists) {
        setError('This email belongs to a non-customer portal account. Please use a customer email for customer checkout.');
        return;
      }
    }
    if (isLoggedInCustomer && profileEmail) {
      fd.set('email', profileEmail);
      if (profileFullName) fd.set('full_name', profileFullName);
      if (profilePhone) fd.set('phone', profilePhone);
      fd.set('patient_profile_id', profile!.id);
    }
    const selectedProductLabel = productOrderLabel({ id: selectedProduct.id, name: selectedProduct.name });
    fd.set('medication', selectedProductLabel);
    fd.set('product_id', selectedProduct.id);
    fd.set('product_name', selectedProductLabel);
    fd.set('product_category', selectedProduct.category);
    fd.set('product_type', selectedProduct.product_type);
    fd.set('submission_type', submissionType);
    fd.set('is_accessory_only', String(isAccessoryOnly));
    fd.set('requires_receipt_upload', String(selectedProduct.requires_receipt_upload));
    fd.set('receipt_discount_review', String(receiptDiscountRequested));
    fd.set('order_ready', String(opensCheckout));
    fd.set('discount_code', discountCode);
    fd.set('discount_amount', String(discountAmount));
    fd.set('checkout_scope_code', activeCheckoutScope?.code ?? '');
    fd.set('attribution_source', activeCheckoutScope?.source ?? 'default');
    if (isPortalCartFlow && portalCart) {
      const portalScopeCode = portalCart.scope_code || portalCart.rep;
      fd.set('checkout_scope_code', portalScopeCode);
      fd.set('attribution_source', 'url');
      fd.set('discount_code', discountCode);
      fd.set('discount_amount', String(discountAmount));
      fd.set('source_portal', portalCart.source_portal ?? getPortalCartSourcePortal(portalCart));
      fd.set('source_route', portalCart.source_route ?? '');
      fd.set('source_store', portalCart.store_slug ?? portalCart.distributor);
      fd.set('source_admin', portalCart.admin_code ?? '');
      fd.set('source_rep', portalCart.rep ?? '');
      fd.set('admin_code', portalCart.admin_code ?? '');
      fd.set('store_slug', portalCart.store_slug ?? portalCart.distributor);
      fd.set('store_name', portalCart.store_name ?? getPortalCartStoreName(portalCart));
      fd.set('account_type', portalCart.account_type ?? 'rep');
      fd.set('parent_type', portalCart.parent_type ?? '');
      fd.set('medication', portalCart.items.map((i) => `${i.name} ${i.strength !== 'Standard' && i.strength !== 'Supply' ? i.strength : ''} ×${i.qty}`.trim()).join(', '));
      fd.set('medication', portalCart.items.map((i) => `${productOrderLabel(i)} x${i.qty}`).join(', '));
      fd.set('quoted_price', String(portalCart.total));
      fd.set('status', 'payment_sent');
      fd.set('order_items', JSON.stringify(portalCart.items.map((i) => ({
        id: i.id,
        sku: i.sku,
        quantity: i.qty,
        display_name_at_purchase: productOrderLabel(i),
        inventory_status_at_purchase: i.inventory_status_at_purchase ?? (i.was_special_order ? 'special_order' : undefined),
        inventory_status_label_at_purchase: normalizeInventoryStatusLabel(i.inventory_status_label_at_purchase ?? (i.was_special_order ? 'Out of Stock - Checkout Available' : undefined)),
        was_special_order: Boolean(i.was_special_order),
        estimated_fulfillment_days_at_purchase: i.estimated_fulfillment_days_at_purchase ?? (i.was_special_order ? 14 : undefined),
      }))));
      fd.set('order_total', String(checkoutTotal));
      fd.set('order_ready', 'true');
    } else if (opensCheckout) {
      const checkoutItems = [
        {
          id: selectedProduct.id,
          quantity: 1,
          display_name_at_purchase: selectedProductLabel,
          inventory_status_at_purchase: selectedInventoryStatus?.inventory_status,
          inventory_status_label_at_purchase: selectedInventoryStatus?.inventory_status_label,
          was_special_order: Boolean(selectedInventoryStatus?.was_special_order),
          estimated_fulfillment_days_at_purchase: selectedInventoryStatus?.estimated_fulfillment_days,
        },
        ...selectedAddons.map((addon) => ({
          id: addon.id,
          quantity: 1,
          display_name_at_purchase: productOrderLabel({ id: addon.id, name: addon.name }),
          inventory_status_at_purchase: mapInventoryStatusRow(inventoryByProductId.get(addon.id)).inventory_status,
          inventory_status_label_at_purchase: mapInventoryStatusRow(inventoryByProductId.get(addon.id)).inventory_status_label,
          was_special_order: mapInventoryStatusRow(inventoryByProductId.get(addon.id)).was_special_order,
          estimated_fulfillment_days_at_purchase: mapInventoryStatusRow(inventoryByProductId.get(addon.id)).estimated_fulfillment_days,
        })),
      ];
      fd.set('quoted_price', String(selectedProduct.price + addonTotal));
      fd.set('status', 'payment_sent');
      fd.set('order_items', JSON.stringify(checkoutItems));
      fd.set('checkout_scope_code', activeCheckoutScope?.code ?? '');
      fd.set('attribution_source', activeCheckoutScope?.source ?? 'default');
      fd.set('source_portal', activeCheckoutScope?.code ?? 'main');
      fd.set('source_route', window.location.pathname);
      fd.set('source_store', '');
      fd.set('source_admin', '');
      fd.set('source_rep', repSlug);
    }
    fd.set('selected_addons', JSON.stringify(selectedAddons.map((addon) => ({
      id: addon.id,
      name: addon.name,
      price: addon.price,
      product_type: addon.product_type,
    }))));
    if (receiptFile) fd.set('receipt', receiptFile);

    setLoading(true);
    try {
      const submission = await createPepScriptSubmission(fd, repSlug);
      const submissionId = submission.submissionId;
      const email = String(fd.get('email') ?? '').trim();
      if (opensCheckout) {
        const cartItems = isPortalCartFlow && portalCart
          ? portalCart.items.map((i) => ({ name: productOrderLabel(i), price: i.price, quantity: i.qty }))
          : [
              { name: selectedProductLabel, price: selectedProduct.price, quantity: 1 },
              ...selectedAddons.map((addon) => ({ name: productOrderLabel({ id: addon.id, name: addon.name }), price: addon.price, quantity: 1 })),
            ];
        if (receiptDiscountRequested) {
          const params = new URLSearchParams({ type: 'receipt_discount_review' });
          if (email) params.set('email', email);
          if (portalHasSpecialOrder || selectedInventoryStatus?.was_special_order) params.set('special_order', '1');
          navigate(`/submitted?${params}`);
          return;
        }
        const orderTotal = checkoutTotal;
        sendCustomerOrderEmail('order_confirmation', {
          id: submissionId,
          email,
          full_name: String(fd.get('full_name') ?? ''),
          order_number: `PSRX-${submissionId.slice(0, 8).toUpperCase()}`,
          order_items: cartItems,
          order_total: orderTotal,
          quoted_price: orderTotal,
          shipping_cost: Number(fd.get('shipping_speed') === 'expedited' ? 25 : fd.get('shipping_speed') === 'overnight' ? 50 : 0),
          discount_amount: discountAmount,
          medication: selectedProductLabel,
          product_name: selectedProductLabel,
          referral_code: repSlug,
          discount_code: discountCode,
        }).catch(() => {
          // Non-fatal — order is submitted. Email delivery may be delayed.
        });
        if (isPortalCartFlow) sessionStorage.removeItem('pepscriptrx_portal_cart');
        if (!submission.publicPaymentToken) {
          throw new Error('Checkout payment token was not returned by the server.');
        }
        navigate(`/pay/${submission.publicPaymentToken}`);
        return;
      }
      const params = new URLSearchParams();
      if (email) params.set('email', email);
      if (submissionType !== 'savings_check') params.set('type', submissionType);
      if (selectedInventoryStatus?.was_special_order) params.set('special_order', '1');
      navigate(`/submitted${params.toString() ? `?${params.toString()}` : ''}`);
    } catch (err: unknown) {
      console.error('PepScriptRX public submission failed', err);
      setError(import.meta.env.DEV && err instanceof Error ? err.message : 'Submission failed. Please try again or contact us.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <PublicLayout
      isolatedPortal={Boolean(checkoutPortal)}
      portalKey={checkoutPortal?.id}
      portalHomePath={checkoutPortal?.path}
      portalName={checkoutPortal?.brandName}
      portalLogoSrc={checkoutPortal?.logoSrc}
    >
      <div style={{ background: 'var(--ink)', padding: '48px 24px 36px' }}>
        <div className="container-sm">
          <Link to={checkoutHomePath} style={{ fontSize: 13, color: 'rgba(255,255,255,.6)', marginBottom: 16, display: 'inline-block' }}>
            {'<-'} Back to {checkoutPortal?.brandName ?? 'Home'}
          </Link>
          <h1 style={{ fontSize: 'clamp(26px, 4vw, 36px)', fontWeight: 800, color: '#fff', letterSpacing: '-.02em', marginBottom: 10 }}>
            {pageTitle}
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,.7)', lineHeight: 1.6 }}>
            {pageCopy}
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 12 }}>
            {!storedReferral?.repName && repSlug && <span className="badge badge-teal">Referral active</span>}
            {discountCode && <span className="badge badge-success">{discountCode} applied: {checkoutDiscount?.label}</span>}
          </div>
          <div style={{ marginTop: 22 }}>
            <ProductPurityGuaranteeBadge compact />
          </div>
        </div>
      </div>

      <div style={{ padding: '48px 24px 64px' }}>
        <div className="container-sm">
          {step === 1 && (
            <div>
              <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--navy)', marginBottom: 8 }}>
                Shop available products
              </h2>
              <p style={{ color: 'var(--text-muted)', marginBottom: 28 }}>
                Choose an item to start a refill, supply, or accessory request.
              </p>
              <PepRxBotBadge
                compact
                context="shopping"
                title="Need shopping help?"
                body="PEPRXbot can help compare general product categories, listed sizes, supplies, and checkout options."
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {INTAKE_PRODUCTS.map((product) => {
                  const imgSrc = PRODUCT_IMAGES[product.id];
                  const metadata = getProductMetadata({ id: product.id, name: product.name });
                  const isPhysician = product.status === 'physician_review';
                  const isManualReview = product.status === 'manual_review';
                  const isAddon = product.status === 'active_addon';
                  const hasReceiptDiscount = product.requires_receipt_upload;
                  const inventoryStatus = inventoryStatusForMainProduct(product);

                  return (
                    <div key={product.id} style={{ display: 'grid', gap: 8 }}>
                      <button
                        className="product-select-card"
                        disabled={!inventoryStatus.checkout_allowed}
                        onClick={() => handleProductSelect(product)}
                        style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 16,
                        padding: '16px 20px',
                        border: '2px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        background: 'var(--card)',
                        textAlign: 'left',
                        cursor: inventoryStatus.checkout_allowed ? 'pointer' : 'not-allowed',
                        width: '100%',
                        transition: 'border-color .15s, box-shadow .15s',
                      }}
                      onMouseEnter={(e) => {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.borderColor = 'var(--teal)';
                        el.style.boxShadow = '0 4px 16px rgba(37,199,217,.15)';
                      }}
                      onMouseLeave={(e) => {
                        const el = e.currentTarget as HTMLButtonElement;
                        el.style.borderColor = 'var(--border)';
                        el.style.boxShadow = 'none';
                      }}
                      >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 16, marginBottom: 2 }}>{metadata.commonName}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Dose: {metadata.doseLabel}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6 }}>{product.category}</div>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy)' }}>${product.price}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {hasReceiptDiscount ? '+ 20% off with receipt' : product.price > 0 ? 'Checkout available' : 'Availability request'}
                  </span>
                        </div>
                        <div style={{ marginTop: 6, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {isPhysician && <span className="badge badge-purple">Extra verification</span>}
                          {isManualReview && <span className="badge badge-success">Checkout available</span>}
                          {product.status === 'active' && <span className="badge badge-success">Immediate checkout</span>}
                          {isAddon && <span className="badge badge-success">Active add-on</span>}
                          <span className={`badge ${inventoryBadgeClass(inventoryStatus.inventory_status)}`}>{inventoryStatus.inventory_status_label}</span>
                        </div>
                        {inventoryStatus.supporting_copy && (
                          <div style={{ fontSize: 12, color: '#0e7490', fontWeight: 800, marginTop: 6 }}>
                            {inventoryStatus.supporting_copy}
                          </div>
                        )}
                      </div>
                      {imgSrc && (
                        <img
                          src={imgSrc}
                          alt={product.name}
                          style={{ width: 88, height: 88, objectFit: 'contain', flexShrink: 0, borderRadius: 8 }}
                        />
                      )}
                      <div style={{ color: 'var(--teal)', fontSize: 20, flexShrink: 0, fontWeight: 700 }}>{'>'}</div>
                      </button>
                      <Link
                        to={scopedMixingCenterPath({ id: product.id, name: product.name }, checkoutPortal?.path)}
                        className="store-mixing-link"
                      >
                        Need help mixing? Use Mixing Center
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && selectedProduct && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
                <button className="btn btn-ghost btn-sm" onClick={() => setStep(1)} style={{ padding: '6px 10px' }}>{'<-'}</button>
                <div>
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Selected product</span>
                  <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy)' }}>{selectedProductMetadata?.commonName ?? selectedProduct.name}</div>
                  {selectedProductMetadata && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Technical: {selectedProductMetadata.technicalName} · Dose: {selectedProductMetadata.doseLabel}
                    </div>
                  )}
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                  <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy)' }}>${selectedProduct.price + addonTotal}</div>
                  {selectedProduct.status === 'active' && <span className="badge badge-success">Immediate checkout</span>}
                  {selectedProduct.status === 'active_addon' && <span className="badge badge-success">Active add-on</span>}
                  {selectedProduct.status === 'physician_review' && <span className="badge badge-purple">Extra verification</span>}
                  {selectedProduct.status === 'manual_review' && <span className="badge badge-success">Checkout available</span>}
                  {selectedInventoryStatus && <span className={`badge ${inventoryBadgeClass(selectedInventoryStatus.inventory_status)}`}>{selectedInventoryStatus.inventory_status_label}</span>}
                </div>
              </div>
              {selectedInventoryStatus?.supporting_copy && (
                <div className="alert alert-info mb-6">
                  {selectedInventoryStatus.was_special_order ? SPECIAL_ORDER_ITEM_NOTICE : selectedInventoryStatus.supporting_copy}
                </div>
              )}
              <div className="card mb-6" style={{ background: 'var(--card-soft)' }}>
                <div className="card-body" style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  <AiAssistedBadge compact />{' '}
                  Not sure how to mix your vial?{' '}
                  <Link to={scopedMixingCenterPath({ id: selectedProduct.id, name: selectedProduct.name }, checkoutPortal?.path)} style={{ color: 'var(--teal)', fontWeight: 800 }}>
                    Visit the Mixing Center.
                  </Link>
                </div>
              </div>

              {!isSupabaseConfigured && (
                <div className="alert alert-info mb-6">
                  <strong>Demo mode:</strong> Supabase is not configured. Form submission is disabled until you add your environment variables.
                </div>
              )}

              {error && <div className="alert alert-error mb-6">{error}</div>}

              <form key={isLoggedInCustomer ? profile?.id : 'guest-checkout'} ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
                <input type="hidden" name="discount_code" value={discountCode} />
                <input type="hidden" name="discount_amount" value={discountAmount} />

                {/* Portal cart order summary */}
                {isPortalCartFlow && portalCart && (
                  <div className="card" style={{ borderColor: 'rgba(37,199,217,.4)', boxShadow: '0 4px 20px rgba(37,199,217,.1)' }}>
                    <div className="card-header" style={{ background: 'var(--navy)', borderRadius: 'var(--radius) var(--radius) 0 0' }}>
                      <div className="card-title" style={{ color: '#fff' }}>Your Selected Order</div>
                      <div className="card-subtitle" style={{ color: 'rgba(255,255,255,.6)' }}>
                        {getPortalCartStoreName(portalCart)}
                      </div>
                    </div>
                    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {isAactivatedCheckout && (
                        <AACTIVATEDRXVerificationBadge placement="checkout" />
                      )}
                      {portalCart.items.map((item) => {
                        const metadata = getProductMetadata(item);
                        return (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--card-soft)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                          <div>
                            <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 14 }}>
                              {item.name}{item.strength && item.strength !== 'Standard' && item.strength !== 'Supply' ? ` — ${item.strength}` : ''}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{item.category} · Qty {item.qty}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Technical: {metadata.technicalName}</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Dose: {metadata.doseLabel}</div>
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
                              <span className={`badge ${inventoryBadgeClass(String(item.inventory_status_at_purchase ?? 'special_order') as InventoryDisplayStatus)}`}>
                                {normalizeInventoryStatusLabel(item.inventory_status_label_at_purchase ?? (item.was_special_order ? 'Out of Stock - Checkout Available' : 'In Stock'))}
                              </span>
                              {item.was_special_order && (
                                <span style={{ fontSize: 12, color: '#0e7490', fontWeight: 800 }}>{SPECIAL_ORDER_ITEM_NOTICE}</span>
                              )}
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>
                              Not sure how to mix your vial?{' '}
                              <Link to={scopedMixingCenterPath({ id: item.id, product_name: item.name, strength: item.strength }, checkoutPortal?.path)} style={{ color: 'var(--teal)', fontWeight: 800 }}>
                                Visit the Mixing Center.
                              </Link>
                            </div>
                          </div>
                          <div style={{ fontWeight: 800, color: 'var(--navy)', fontSize: 15 }}>${(item.price * item.qty).toFixed(2)}</div>
                        </div>
                        );
                      })}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 8, borderTop: '1px solid var(--border)', marginTop: 4 }}>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Subtotal</span>
                        <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--navy)' }}>${portalCart.total.toFixed(2)}</span>
                      </div>
                      {checkoutDiscount && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                          <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 800 }}>{checkoutDiscount.code}</span>
                          <span style={{ fontSize: 15, color: 'var(--success)', fontWeight: 900 }}>-${checkoutDiscount.amount.toFixed(2)}</span>
                        </div>
                      )}
                      {portalHasSpecialOrder && (
                        <div className="alert alert-info" style={{ margin: 0 }}>
                          {SPECIAL_ORDER_CHECKOUT_NOTICE}
                        </div>
                      )}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingTop: 8, borderTop: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Order Total</span>
                        <span style={{ fontSize: 22, fontWeight: 900, color: 'var(--navy)' }}>${checkoutTotal.toFixed(2)}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Shipping is selected below. Checkout opens immediately after confirmation.</div>
                    </div>
                  </div>
                )}

                {opensCheckout && (
                  <div className="card">
                    <div className="card-header">
                      <div className="card-title">Customer Account</div>
                      <div className="card-subtitle">Returning customers can log in once and keep this cart, pricing, store, rep, and promo context attached.</div>
                    </div>
                    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      {authLoading ? (
                        <div className="alert alert-info">Checking customer session...</div>
                      ) : isLoggedInCustomer ? (
                        <div className="alert alert-success">
                          You are checked out as <strong>{profileEmail}</strong>. Continue as logged-in customer.
                        </div>
                      ) : user && profile ? (
                        <div className="alert alert-warning">
                          You are signed in as {loggedInStaffLabel}. Rep/admin accounts do not use customer checkout. Please sign out and use a customer account, or use the correct internal/sample flow.
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <Link className="btn btn-outline btn-sm" to={checkoutLoginPath}>Log in to existing account</Link>
                            <Link className="btn btn-ghost btn-sm" to={checkoutSignupPath}>Create new customer account</Link>
                          </div>
                          {emailAccountStatus?.customerExists && (
                            <div className="alert alert-warning" style={{ margin: 0 }}>
                              An account already exists for this email. Please log in to continue.
                            </div>
                          )}
                          {emailAccountStatus?.accountExists && !emailAccountStatus.customerExists && (
                            <div className="alert alert-warning" style={{ margin: 0 }}>
                              This email belongs to a non-customer portal account. Use a customer email for checkout.
                            </div>
                          )}
                          {emailAccountStatus?.customerExists && (
                            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                              <div className="form-group" style={{ flex: '1 1 220px', margin: 0 }}>
                                <label className="form-label">Existing account email</label>
                                <input type="email" className="form-input" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} required />
                              </div>
                              <div className="form-group" style={{ flex: '1 1 180px', margin: 0 }}>
                                <label className="form-label">Password</label>
                                <input type="password" className="form-input" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
                              </div>
                              <button type="button" className="btn btn-primary" disabled={loginLoading || !loginEmail || !loginPassword} onClick={handleCheckoutLogin}>
                                {loginLoading ? 'Logging in...' : 'Log in to continue'}
                              </button>
                            </div>
                          )}
                          {loginMessage && (
                            <div style={{ fontSize: 13, color: loginMessage.includes('checked out as') ? 'var(--success)' : 'var(--danger)', fontWeight: 700 }}>
                              {loginMessage}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Personal Information</div>
                  </div>
                  <div className="card-body">
                    <div className="form-grid form-grid-2" style={{ gap: 20 }}>
                      <div className="form-group">
                        <label className="form-label form-required">Full name</label>
                        <input name="full_name" type="text" className="form-input" required placeholder="Jane Smith" defaultValue={profileFullName || leadFullName} readOnly={isLoggedInCustomer && Boolean(profileFullName)} />
                      </div>
                      <div className="form-group">
                        <label className="form-label form-required">Email address</label>
                        <input
                          name="email"
                          type="email"
                          className="form-input"
                          required
                          placeholder="jane@example.com"
                          defaultValue={profileEmail || portalLeadCapture?.email || ''}
                          readOnly={isLoggedInCustomer}
                          onBlur={(event) => { void checkEmailAccount(event.currentTarget.value); }}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label form-required">Phone number</label>
                        <input name="phone" type="tel" className="form-input" required placeholder="(555) 555-5555" defaultValue={profilePhone || portalLeadCapture?.phone || ''} />
                      </div>
                      <div className="form-group">
                        <label className="form-label form-required">{isSimpleRequest ? 'Shipping state' : 'State'}</label>
                        <select name="state" className="form-select" required>
                          <option value="">Select state...</option>
                          {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                        </select>
                      </div>
                      {selectedProduct.requires_dob && (
                        <div className="form-group">
                          <label className="form-label form-required">Date of birth</label>
                          <input name="date_of_birth" type="date" className="form-input" required />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {isMedicationFlow && (
                  <div className="card">
                    <div className="card-header">
                      <div className="card-title">Prescription / Prior Supplier Details</div>
                      <div className="card-subtitle">Optional unless you upload a prior supplier receipt for the 20% discount review.</div>
                    </div>
                    <div className="card-body">
                      <div className="form-grid form-grid-2" style={{ gap: 20 }}>
                        <div className="form-group">
                            <label className="form-label">Current dose</label>
                            <input name="current_dose" type="text" className="form-input" placeholder="e.g. 2.5 mg, 5 mg, 10 mg" />
                        </div>
                        <div className="form-group">
                            <label className={`form-label${receiptFile ? ' form-required' : ''}`}>Current monthly price paid</label>
                          <div style={{ position: 'relative' }}>
                            <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontWeight: 600 }}>$</span>
                            <input name="current_price" type="number" className="form-input" required={receiptDiscountRequested} placeholder="399.00" step="0.01" min="0" style={{ paddingLeft: 28 }} />
                          </div>
                        </div>
                        <div className="form-group" style={{ gridColumn: '1/-1' }}>
                          <label className={`form-label${receiptFile ? ' form-required' : ''}`}>Current pharmacy / source / provider</label>
                          <input name="current_pharmacy" type="text" className="form-input" required={receiptDiscountRequested} placeholder="e.g. compounding pharmacy name, telehealth provider, med spa" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {isMedicationFlow && penKitProduct && (
                  <div className="card">
                    <div className="card-header">
                      <div className="card-title">Optional Add-ons</div>
                      <div className="card-subtitle">Add eligible accessories to the request for follow-up.</div>
                    </div>
                    <div className="card-body">
                      <label className="checkbox-item" style={{ alignItems: 'center' }}>
                        <input
                          type="checkbox"
                          checked={selectedAddons.some((addon) => addon.id === penKitProduct.id)}
                          onChange={() => toggleAddon(penKitProduct)}
                        />
                        <span>Add <strong>{penKitProduct.name}</strong> (+${penKitProduct.price})</span>
                      </label>
                    </div>
                  </div>
                )}

                {needsShipping && (
                  <div className="card">
                    <div className="card-header">
                      <div className="card-title">Shipping Address</div>
                      <div className="card-subtitle">Where should your order be delivered?</div>
                    </div>
                    <div className="card-body">
                      <div className="form-grid form-grid-2" style={{ gap: 20 }}>
                        <div className="form-group" style={{ gridColumn: '1/-1' }}>
                          <label className="form-label form-required">Street address</label>
                          <input name="shipping_address" type="text" className="form-input" required placeholder="123 Main St, Apt 4B" />
                        </div>
                        <div className="form-group">
                          <label className="form-label form-required">City</label>
                          <input name="shipping_city" type="text" className="form-input" required placeholder="Los Angeles" />
                        </div>
                        <div className="form-group">
                          <label className="form-label form-required">State</label>
                          <select name="shipping_state" className="form-select" required>
                            <option value="">Select state...</option>
                            {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                          </select>
                        </div>
                        <div className="form-group">
                          <label className="form-label form-required">ZIP code</label>
                          <input name="shipping_zip" type="text" className="form-input" required placeholder="90001" maxLength={10} />
                        </div>
                      </div>

                      <div style={{ marginTop: 24 }}>
                        <label className="form-label form-required">Shipping speed</label>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                          {SHIPPING_OPTIONS.map((opt) => (
                            <label
                              key={opt.value}
                              style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 18px', border: '2px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
                            >
                              <input type="radio" name="shipping_speed" value={opt.value} defaultChecked={opt.value === 'standard'} required style={{ accentColor: 'var(--teal)', width: 18, height: 18, flexShrink: 0 }} />
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 15 }}>{opt.label}</div>
                                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{opt.days}</div>
                              </div>
                              <div style={{ fontWeight: 700, color: opt.cost === 0 ? 'var(--success)' : 'var(--navy)', fontSize: 15 }}>
                                {opt.cost === 0 ? 'Included' : `+$${opt.cost}`}
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {opensCheckout && (
                  <div className="card">
                    <div className="card-header">
                      <div className="card-title">Referral / Account Code</div>
                      <div className="card-subtitle">Optional checkout attribution. This does not change pricing unless a separate discount is shown.</div>
                    </div>
                    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      <PepRxBotBadge
                        compact
                        context="checkout"
                        title="Need checkout help?"
                        body="PEPRXbot can help confirm your cart, understand supplies, upload a receipt, and follow payment instructions."
                      />
                      {isPortalCartFlow && portalCart ? (
                        <span className="badge badge-info" style={{ alignSelf: 'flex-start' }}>
                          Associated account: {portalCart.scope_code || portalCart.rep}
                        </span>
                      ) : (
                        <>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                            <div className="form-group" style={{ flex: '1 1 220px', margin: 0 }}>
                              <label className="form-label">Account code</label>
                              <input
                                type="text"
                                className="form-input"
                                value={scopeInput}
                                onChange={(e) => setScopeInput(e.target.value.toUpperCase())}
                                placeholder="Enter code if provided"
                                autoCapitalize="characters"
                              />
                            </div>
                            <button type="button" className="btn btn-outline" onClick={applyScopeCode}>
                              Apply
                            </button>
                          </div>
                          {(activeCheckoutScope?.code || scopeMessage) && (
                            <div style={{ fontSize: 13, color: activeCheckoutScope?.code ? 'var(--success)' : 'var(--text-muted)', fontWeight: 700 }}>
                              {activeCheckoutScope?.code ? `Associated account: ${scopeDisplayName || activeCheckoutScope.code}` : scopeMessage}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {opensCheckout && (!isPortalCartFlow || isAactivatedCheckout) && (
                  <div className="card">
                    <div className="card-header">
                      <div className="card-title">Discount Code</div>
                      <div className="card-subtitle">
                        {isAactivatedCheckout ? 'Enter your AACTIVATEDRX customer discount code before secure checkout.' : 'Promo codes are separate from referral/account attribution.'}
                      </div>
                    </div>
                    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ flex: '1 1 220px', margin: 0 }}>
                          <label className="form-label">Promo code</label>
                          <input
                            type="text"
                            className="form-input"
                            value={promoInput}
                            onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                            placeholder={isAactivatedCheckout ? 'SAVE-ADONIS' : 'Enter promo code'}
                            autoCapitalize="characters"
                          />
                        </div>
                        <button type="button" className="btn btn-outline" onClick={applyPromoCode}>
                          Apply
                        </button>
                      </div>
                      {promoMessage && (
                        <div style={{ fontSize: 13, color: discountAmount > 0 ? 'var(--success)' : 'var(--text-muted)', fontWeight: 700 }}>
                          {promoMessage}
                        </div>
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', background: 'var(--card-soft)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                          <span style={{ color: 'var(--text-muted)', fontSize: 13, fontWeight: 700 }}>Subtotal</span>
                          <span style={{ color: 'var(--navy)', fontWeight: 800 }}>${checkoutSubtotal.toFixed(2)}</span>
                        </div>
                        {discountAmount > 0 && (
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                            <span style={{ color: 'var(--success)', fontSize: 13, fontWeight: 800 }}>Discount {discountCode ? `(${discountCode})` : ''}</span>
                            <span style={{ color: 'var(--success)', fontWeight: 900 }}>-${discountAmount.toFixed(2)}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                          <span style={{ color: 'var(--navy)', fontSize: 14, fontWeight: 800 }}>Checkout total before shipping</span>
                          <span style={{ color: 'var(--navy)', fontSize: 20, fontWeight: 900 }}>${checkoutTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {isSimpleRequest && (
                  <div className="card">
                    <div className="card-header">
                      <div className="card-title">Request Notes</div>
                      <div className="card-subtitle">Optional details that may help our team follow up.</div>
                    </div>
                    <div className="card-body">
                      <textarea
                        name="inquiry_notes"
                        className="form-input"
                        placeholder={isAccessoryOnly ? 'Example: I want to add this to a future eligible order.' : 'Anything our team should know?'}
                        rows={4}
                      />
                    </div>
                  </div>
                )}

                {selectedProduct.requires_receipt_upload && (
                  <div className="card">
                    <div className="card-header">
                      <div className="card-title">Prior Supplier Receipt <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-muted)' }}>(Optional)</span></div>
                      <div className="card-subtitle">No receipt is required for immediate checkout. Uploading a prior supplier receipt sends the order for 20% discount review before payment.</div>
                    </div>
                    <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      <PepRxBotBadge
                        compact
                        context="receipt"
                        title="PEPRXbot Receipt Helper"
                        body="Upload a clear image or PDF of your qualifying receipt. Make sure the product, date, and amount are visible when possible."
                      />
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'var(--teal-pale)', border: '1px solid var(--teal-light)', borderRadius: 'var(--radius-sm)', padding: '12px 16px' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--teal)' }}>$</div>
                        <div>
                          <div style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 14 }}>Receipt = 20% Discount Review</div>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Skip this upload to pay now. Uploading a prior supplier receipt pauses checkout until the discount is verified.</div>
                        </div>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Recent receipt <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>(optional)</span></label>
                        <label className="file-upload">
                          <input type="file" accept=".pdf,.jpg,.jpeg,.png,.heic" onChange={handleFile(setReceiptFile)} />
                          <div className="file-upload-icon">PDF</div>
                          <div className="file-upload-label">Upload your most recent receipt</div>
                          <div className="file-upload-hint">Shows your current medication, dose, and price paid. PDF, JPG, PNG, HEIC - max 10 MB</div>
                          {receiptFile && <div className="file-selected">✓ {receiptFile.name}</div>}
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                <ProductPurityGuaranteeBadge compact />

                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Consent &amp; Acknowledgment</div>
                  </div>
                  <div className="card-body">
                    <div className="checkbox-group">
                      {isMedicationFlow && (
                        <div className="checkbox-item">
                          <input type="checkbox" id="consent1" required />
                          <label htmlFor="consent1">
                            I confirm that I have received a valid prescription for <strong>{selectedProduct.name}</strong> from a licensed provider within the last 5 months, and I am submitting this information for a refill-savings review only.
                          </label>
                        </div>
                      )}
                      {isPortalCartFlow && portalCart ? (
                        <div className="checkbox-item">
                          <input type="checkbox" id="consent1" required />
                          <label htmlFor="consent1">
                            I understand that my order of {portalCart.items.length} item{portalCart.items.length !== 1 ? 's' : ''} will continue to secure checkout now. Fulfillment remains subject to standard verification, state availability, and applicable law.
                          </label>
                        </div>
                      ) : isRxPlusOrder && (
                        <div className="checkbox-item">
                          <input type="checkbox" id="consent1" required />
                          <label htmlFor="consent1">
                            I understand this is an order request for <strong>{selectedProduct.name}</strong>. Checkout opens immediately unless I uploaded a prior supplier receipt for discount review.
                          </label>
                        </div>
                      )}
                      <div className="checkbox-item">
                        <input type="checkbox" id="consent2" required />
                        <label htmlFor="consent2">
                          I understand that {checkoutBrandName} is not a pharmacy, medical provider, or emergency medical service, and does not provide medical advice, prescribing, dosing, injection, or reconstitution instructions.
                        </label>
                      </div>
                      {isMedicationFlow && (
                        <>
                          <div className="checkbox-item">
                            <input type="checkbox" id="consent3" required />
                            <label htmlFor="consent3">
                              I understand that if I upload a prior supplier receipt, the 20% discount must be verified before payment. Without a receipt upload, this order continues directly to checkout.
                            </label>
                          </div>
                          <div className="checkbox-item">
                            <input type="checkbox" id="consent4" required />
                            <label htmlFor="consent4">
                              I understand that any medication use must follow written instructions from a licensed provider or dispensing pharmacy. I will not mix, inject, or use any product without professional written instructions.
                            </label>
                          </div>
                        </>
                      )}
                      {isSimpleRequest && (
                        <div className="checkbox-item">
                          <input type="checkbox" id="consent3" required />
                          <label htmlFor="consent3">
                            I understand this is an availability request only. {checkoutBrandName} will contact me with availability and next steps, and submission does not guarantee fulfillment.
                          </label>
                        </div>
                      )}
                      <div className="checkbox-item">
                        <input type="checkbox" id="consent5" required />
                        <label htmlFor="consent5">
                          I consent to {checkoutBrandName} contacting me via phone and email regarding my submission, review status, and available options. I agree to the{' '}
                          <Link to={termsPath} target="_blank" style={{ color: 'var(--teal)', fontWeight: 600 }}>Terms of Service</Link>
                          {' '}and{' '}
                          <Link to={privacyPath} target="_blank" style={{ color: 'var(--teal)', fontWeight: 600 }}>Privacy Policy</Link>.
                        </label>
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    className="btn btn-primary btn-lg w-full"
                    disabled={loading || !isSupabaseConfigured}
                    style={{ justifyContent: 'center' }}
                  >
                    {loading ? 'Submitting...' : receiptDiscountRequested ? 'Submit Receipt for 20% Discount Review' : isPortalCartFlow ? `Continue to Secure Checkout — $${checkoutTotal.toFixed(2)}` : opensCheckout ? `Continue to Checkout — $${checkoutTotal.toFixed(2)}` : isAccessoryOnly ? 'Submit Accessory Request' : isSupplyOnly ? 'Submit Supply Request' : 'Continue Request'}
                  </button>
                  <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', marginTop: 12 }}>
                    {opensCheckout
                      ? receiptDiscountRequested
                        ? 'Submitted securely. We will verify the receipt discount before sending payment.'
                        : 'Submitted securely. Checkout will open immediately for the selected order.'
                      : isSimpleRequest
                      ? 'Submitted securely. Our team will follow up with availability and next steps.'
                      : 'Submitted securely. Our team will review your request and contact you with next steps.'}
                  </p>
                </div>
              </form>

              <div className="disclaimer mt-6">
                <strong>Important:</strong> {checkoutBrandName} is not a pharmacy, medical provider, or emergency medical service. Eligibility, pricing, savings, and fulfillment are not guaranteed and depend on your attestation, receipt review, licensed partner review, state availability, and applicable law. {checkoutBrandName} does not provide medical advice, prescribing, dosing, injection, or reconstitution instructions. Any medication use must follow written instructions from a licensed provider or dispensing pharmacy.
              </div>
            </div>
          )}
        </div>
      </div>
    </PublicLayout>
  );
}

function getSubmissionType(product: Product | null): string {
  if (!product) return 'savings_check';
  if (product.product_type === 'accessory') return 'accessory_inquiry';
  if (product.product_type === 'supply') return 'supply_inquiry';
  if (product.product_type === 'physician_review') return 'physician_review';
  if (product.product_type === 'manual_review') return 'availability_review';
  return 'savings_check';
}

function getStoredReferral(hasExplicitReferral: boolean, pathname: string): StoredReferral | null {
  if (typeof window === 'undefined') return null;
  if (!hasExplicitReferral && !pathname.toLowerCase().includes('ehwsub')) return null;
  return applyReferralFromUrl(window.location.search, pathname) ?? restoreReferral();
}

function normalizeDiscountCodeForAutofill(code: string): string {
  const normalized = code.trim().toUpperCase();
  return normalized === MAIN_DISCOUNT_CODE ? '' : code;
}

function getCheckoutDiscount(code: string, subtotal: number, fallbackAmount: number): { code: string; amount: number; label: string } | null {
  const normalized = code.trim().toUpperCase();
  if (!normalized || subtotal <= 0) return null;

  if (normalized === BROOKS_DISCOUNT_CODE) {
    const amount = roundMoney(subtotal * BROOKS_DISCOUNT_PERCENT);
    return { code: normalized, amount, label: '25% off' };
  }

  if (normalized === MAIN_DISCOUNT_CODE) {
    const amount = roundMoney(subtotal * MAIN_DISCOUNT_PERCENT);
    return { code: normalized, amount, label: '10% off' };
  }

  if (fallbackAmount > 0) {
    const amount = Math.min(roundMoney(fallbackAmount), subtotal);
    return { code: normalized, amount, label: `$${amount.toFixed(2)} off first eligible order` };
  }

  return null;
}

function getPortalCartBundleDiscount(cart: PortalCartOrder): number {
  const explicitBundle = Number(cart.bundle_discount_amount ?? 0);
  if (explicitBundle > 0) return roundMoney(explicitBundle);
  if (String(cart.discount_code ?? '').toUpperCase() === 'BUNDLE') {
    return roundMoney(Number(cart.discount_amount ?? 0));
  }
  return 0;
}

function discountForAactivatedPromo(promo: AactivatedCheckoutPromo, cart: PortalCartOrder): { code: string; amount: number; label: string } | null {
  if (promo.expires_at && new Date(promo.expires_at).getTime() <= Date.now()) return null;
  if (promo.usage_limit != null && Number(promo.usage_limit) > 0 && Number(promo.uses_count ?? 0) >= Number(promo.usage_limit)) return null;

  const eligibleTotal = promo.product_id
    ? cart.items.reduce((sum, item) => item.id === promo.product_id ? sum + (Number(item.price ?? 0) * Number(item.qty ?? 1)) : sum, 0)
    : cart.total;
  if (eligibleTotal <= 0) return null;
  if (Number(promo.min_subtotal ?? 0) > cart.total) return null;

  const rawDiscount = promo.discount_type === 'percentage'
    ? eligibleTotal * (Number(promo.discount_percent ?? 0) / 100)
    : Number(promo.discount_amount ?? 0);
  const amount = Math.min(roundMoney(rawDiscount), eligibleTotal, cart.total);
  if (amount <= 0) return null;

  return {
    code: promo.discount_code,
    amount,
    label: promo.discount_type === 'percentage'
      ? `${Number(promo.discount_percent ?? 0).toFixed(2).replace(/\.00$/, '')}% off`
      : `$${Number(promo.discount_amount ?? 0).toFixed(2)} off`,
  };
}

function getPercentageCheckoutDiscount(code: string, subtotal: number, percent: number): { code: string; amount: number; label: string } | null {
  const normalized = code.trim().toUpperCase();
  if (!normalized || subtotal <= 0 || percent <= 0) return null;
  const amount = roundMoney(subtotal * percent);
  return { code: normalized, amount, label: `${Math.round(percent * 100)}% off` };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

type PortalCartItem = {
  id: string;
  sku?: string;
  name: string;
  strength: string;
  category: string;
  price: number;
  qty: number;
  inventory_status_at_purchase?: InventoryDisplayStatus | string;
  inventory_status_label_at_purchase?: string;
  was_special_order?: boolean;
  estimated_fulfillment_days_at_purchase?: number;
};
type AactivatedCheckoutPromo = {
  promo_title?: string;
  discount_code: string;
  discount_amount: number;
  discount_type?: 'fixed_amount' | 'percentage' | null;
  discount_percent?: number | null;
  promo_kind?: 'customer_discount' | 'rep_sample' | 'rep_internal' | 'wholesale' | null;
  expires_at?: string | null;
  usage_limit?: number | null;
  uses_count?: number | null;
  product_id?: string | null;
  min_subtotal?: number | null;
};
type PortalCartOrder = {
  rep: string;
  scope_code?: string;
  discount_code?: string;
  discount_amount?: number;
  bundle_discount_amount?: number;
  promo_title?: string;
  promo_slug?: string;
  promo_product_id?: string;
  distributor: string;
  source_portal?: string;
  source_route?: string;
  store_slug?: string;
  store_name?: string;
  admin_code?: string;
  account_type?: 'admin' | 'rep' | string;
  parent_type?: string;
  items: PortalCartItem[];
  total: number;
  capturedAt: string;
};

function makeCartSummaryProduct(cart: PortalCartOrder): Product {
  const firstName = cart.items[0];
  const firstMetadata = firstName ? getProductMetadata(firstName) : null;
  const label = cart.items.length === 1
    ? firstMetadata
      ? productOrderLabel(firstName)
      : `${firstName.name}${firstName.strength && firstName.strength !== 'Standard' && firstName.strength !== 'Supply' ? ` ${firstName.strength}` : ''}`
    : `${cart.items.length}-item order`;
  return {
    id: `portal-cart-${cart.distributor}`,
    name: label,
    price: cart.total,
    category: firstName?.category ?? 'Wellness',
    status: 'manual_review',
    product_type: 'manual_review',
    requires_prescription_upload: false,
    requires_receipt_upload: false,
    requires_dob: false,
    requires_physician_review: false,
    display_note: `${getPortalCartStoreName(cart)} portal order.`,
    sort_order: 0,
  };
}

function getPortalCartStoreName(cart: PortalCartOrder): string {
  if (cart.store_name) return cart.store_name;
  if (cart.distributor === 'optimax') return 'Optimax Peptide Therapy';
  if (cart.distributor === 'scott') return 'Peak Form Peptides';
  if (cart.distributor === 'alpha') return 'Alpha Pride Wellness';
  if (cart.distributor === 'agprime') return 'AG Prime Lab';
  if (cart.distributor === 'ehwsub') return 'Ellie';
  if (cart.distributor === 'guy') return 'AACTIVATED-RX';
  if (cart.distributor === 'robert') return 'WarXlabz';
  return 'Empire Health & Wellness';
}

function getPortalCartSourcePortal(cart: PortalCartOrder): string {
  if (cart.source_portal) return cart.source_portal;
  if (cart.distributor === 'optimax') return 'Optimax';
  if (cart.distributor === 'agprime') return 'AG Prime Lab';
  if (cart.distributor === 'ehwsub') return 'Ellie';
  if (cart.distributor === 'guy') return 'VITALITYINS';
  if (cart.distributor === 'scott') return 'Peak Form';
  if (cart.distributor === 'alpha') return 'Alpha Pride Wellness';
  if (cart.distributor === 'robert') return 'WarXlabz';
  if (cart.distributor === 'mark') return 'Empire Health & Wellness';
  return cart.distributor || 'main';
}

function readPortalCart(sourceParam: string): PortalCartOrder | null {
  try {
    const raw = sessionStorage.getItem('pepscriptrx_portal_cart');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PortalCartOrder;
    if (!parsed.items || parsed.items.length === 0) return null;
    if (!sourceParam) {
      sessionStorage.removeItem('pepscriptrx_portal_cart');
      return null;
    }

    const sourceKey = normalizeSourceKey(sourceParam);
    const cartSourceKeys = [
      parsed.distributor,
      parsed.store_slug,
      parsed.source_portal,
      parsed.source_route,
    ].filter(Boolean).map((value) => normalizeSourceKey(String(value)));

    if (!cartSourceKeys.includes(sourceKey)) {
      sessionStorage.removeItem('pepscriptrx_portal_cart');
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

function normalizeSourceKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/^\/+/, '')
    .replace(/-portal$/, '')
    .replace(/[^a-z0-9]/g, '');
}

function getInitialPortalProduct(searchParams: URLSearchParams): Product | null {
  const productId = searchParams.get('product');
  const isMarkOrder = searchParams.get('order_ready') === '1'
    && (searchParams.get('rep') ?? '').toUpperCase() === 'MARK65';

  if (!productId) return null;

  if (!isMarkOrder) {
    return INTAKE_PRODUCTS.find((product) => product.id === productId) ?? null;
  }

  const portalProduct = getDistributorProductById('mark', productId);
  if (!portalProduct) return null;

  const label = productOrderLabel(portalProduct);
  return {
    id: portalProduct.id,
    name: label,
    price: portalProduct.displayPrice ?? portalProduct.suggested_retail_price ?? 0,
    category: portalProduct.category,
    status: 'active',
    product_type: 'manual_review',
    requires_prescription_upload: false,
    requires_receipt_upload: false,
    requires_dob: false,
    requires_physician_review: false,
    display_note: 'Empire Health & Wellness portal item.',
    sort_order: 0,
  };
}
