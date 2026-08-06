import { useMemo, useState } from 'react';
import type { Dispatch, FormEvent, ReactNode, SetStateAction } from 'react';
import PublicLayout from '../../components/layout/PublicLayout';
import { usePageMeta } from '../../hooks/usePageMeta';
import { REP_INTAKE_PRODUCT_CATEGORIES, REP_INTAKE_PRODUCTS } from '../../data/repIntakeCatalog';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { getWhiteLabelPortal } from '../../config/whiteLabelPortals';
import {
  AACTIVATED_ADMIN_REP_CODE,
  AACTIVATED_PARENT_STORE_NAME,
  AACTIVATED_PARENT_STORE_SLUG,
  AACTIVATED_PARTNER_ADMIN_EMAIL,
  AACTIVATED_PARTNER_ADMIN_NAME,
  AACTIVATED_SOURCE_PORTAL,
} from '../../lib/aactivatedScope';
import {
  ROCKPHORM_ADMIN_EMAIL,
  ROCKPHORM_SCOPE_CODE,
  ROCKPHORM_STORE_NAME,
  ROCKPHORM_STORE_SLUG,
  AURORA_ADMIN_CODE,
  AURORA_ADMIN_EMAIL,
  AURORA_STORE_NAME,
  AURORA_STORE_SLUG,
} from '../../lib/rockPhormScope';
import type { RepStoreIntakeProduct } from '../../types';

type StoreType = 'Direct store with PepScriptRX' | 'Rep under another admin / parent account' | 'White-label storefront' | 'Not sure yet' | '';
type LogoNeeded = 'Yes, help me create one' | 'No, I already have a logo' | 'I will send logo later' | '';

type IntakeForm = {
  full_name: string;
  phone: string;
  email: string;
  desired_rep_code: string;
  parent_rep_or_admin_name: string;
  store_type: StoreType;
  store_brand_name: string;
  logo_needed: LogoNeeded;
  preferred_color_1: string;
  preferred_color_2: string;
  preferred_color_3: string;
  brand_style_notes: string;
};

type ProductDraft = {
  selected: boolean;
  requested_retail_price: string;
  notes: string;
};

type CustomProductDraft = {
  product_name: string;
  requested_retail_price: string;
  notes: string;
};

const EMPTY_FORM: IntakeForm = {
  full_name: '',
  phone: '',
  email: '',
  desired_rep_code: '',
  parent_rep_or_admin_name: '',
  store_type: '',
  store_brand_name: '',
  logo_needed: '',
  preferred_color_1: '',
  preferred_color_2: '',
  preferred_color_3: '',
  brand_style_notes: '',
};

const STORE_TYPE_OPTIONS: StoreType[] = [
  'Direct store with PepScriptRX',
  'Rep under another admin / parent account',
  'White-label storefront',
  'Not sure yet',
];

const LOGO_OPTIONS: LogoNeeded[] = [
  'Yes, help me create one',
  'No, I already have a logo',
  'I will send logo later',
];

const PRICE_NOTICE = 'Suggested retail pricing is provided as a starting point. Final storefront pricing may be adjusted before launch based on product availability, admin/rep structure, parent override, and platform approval.';

type RepIntakeProps = {
  portalKey?: string;
};

export default function RepIntake({ portalKey }: RepIntakeProps) {
  const portal = getWhiteLabelPortal(portalKey);
  const isAactivated = portal?.id === 'aactivated';
  const isRockPhorm = portal?.id === 'rockphorm';
  const isAurora = portal?.id === 'aurora';
  const isScopedRepApproval = isAactivated || isRockPhorm || isAurora;
  const brandName = portal?.brandName ?? 'PepScriptRX';
  const approvalStoreName = isRockPhorm ? ROCKPHORM_STORE_NAME : isAurora ? AURORA_STORE_NAME : isAactivated ? AACTIVATED_PARENT_STORE_NAME : brandName;
  const scopedStoreSlug = isRockPhorm ? ROCKPHORM_STORE_SLUG : isAurora ? AURORA_STORE_SLUG : AACTIVATED_PARENT_STORE_SLUG;
  const scopedAdminEmail = isRockPhorm ? ROCKPHORM_ADMIN_EMAIL : isAurora ? AURORA_ADMIN_EMAIL : AACTIVATED_PARTNER_ADMIN_EMAIL;
  const reviewAdminCode = isAactivated ? portal?.repSlug ?? AACTIVATED_ADMIN_REP_CODE : isRockPhorm ? ROCKPHORM_SCOPE_CODE : isAurora ? AURORA_ADMIN_CODE : null;
  const reviewAdminName = isAactivated ? AACTIVATED_PARTNER_ADMIN_NAME : isRockPhorm ? 'Rick / Rock Phorm' : isAurora ? 'Mike / Aurora Labs' : null;
  const scopedSourcePortal = isRockPhorm ? ROCKPHORM_STORE_NAME : isAurora ? AURORA_STORE_NAME : AACTIVATED_SOURCE_PORTAL;
  const scopedSampleRoute = isAurora ? '/auroralabs?rep=SAMPLEREP' : isAactivated ? '/aactivated?rep=SAMPLEREP' : `${portal?.path ?? '/rockphorm'}?rep=SAMPLEREP`;
  const fallbackParentName = isAactivated ? 'AACTIVATEDRX / Guy' : isAurora ? 'Aurora Labs / Mike' : isRockPhorm ? `${ROCKPHORM_STORE_NAME} / Admin` : null;
  const heroEyebrow = isAactivated ? 'AACTIVATED Rep Network' : isScopedRepApproval ? `${approvalStoreName} Partner Approval` : 'PepScriptRX Partner Onboarding';
  const heroTitle = isAactivated ? 'AACTIVATED Rep Request' : isScopedRepApproval ? `${approvalStoreName} Store & Rep Approval Intake` : 'Rep Store Setup Intake';
  const heroCopy = isAactivated
    ? 'Submit your AACTIVATED rep request directly to the AACTIVATED review queue. This form does not create a public route, product portal, webhook, or main-app handoff.'
    : isScopedRepApproval
    ? `Submit your information for ${approvalStoreName} rep approval. Product portal access, catalog choices, and storefront routing are reviewed only after the account is approved.`
    : 'Submit contact details, storefront preferences, payout information, and product pricing requests for admin review.';
  const submitCopy = isAactivated
    ? 'This request stays inside the AACTIVATED rep approval queue. It does not create a live storefront, product portal, product catalog, commission record, payout record, webhook, or public rep route.'
    : isScopedRepApproval
    ? `This request does not create a live storefront, product portal, product catalog, commission record, payout record, or public rep route. ${approvalStoreName} admin and platform admin review are required before approval.`
    : 'This intake form does not create live products, live prices, commission records, payout records, or storefront routes. PepScriptRX will review the submission before launch.';
  const confirmationCopy = isAactivated
    ? 'Thank you. Your AACTIVATED rep request has been received for AACTIVATED review. No public route, product portal, webhook, or main-app workflow was created.'
    : isScopedRepApproval
    ? `Thank you. Your ${approvalStoreName} rep approval request has been received. ${approvalStoreName} admin and platform admin will review it before any public rep route, product portal, or storefront access is created.`
    : 'Thank you. Your PepScriptRX store setup form has been received. Our team will review your product selections, pricing, branding details, and payout information before creating your storefront.';

  usePageMeta(
    isScopedRepApproval ? `${approvalStoreName} Store & Rep Approval Intake` : 'PepScriptRX Rep Store Setup Intake',
    isScopedRepApproval ? `Submit ${approvalStoreName} rep, sub-rep, or white-label store details for approval.` : 'Submit rep, sub-rep, admin, or white-label store setup information for PepScriptRX review.',
  );

  const [form, setForm] = useState<IntakeForm>(EMPTY_FORM);
  const [productDrafts, setProductDrafts] = useState<Record<string, ProductDraft>>(() => (
    Object.fromEntries(REP_INTAKE_PRODUCTS.map((product) => [product.id, {
      selected: false,
      requested_retail_price: '',
      notes: '',
    }]))
  ));
  const [customProducts, setCustomProducts] = useState<CustomProductDraft[]>(
    Array.from({ length: 5 }, () => ({ product_name: '', requested_retail_price: '', notes: '' })),
  );
  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>(() => (
    Object.fromEntries(REP_INTAKE_PRODUCT_CATEGORIES.map((category, index) => [category, index < 2]))
  ));
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const selectedProducts = useMemo(() => buildSelectedProducts(productDrafts), [productDrafts]);
  const completedCustomProducts = useMemo(() => buildCustomProducts(customProducts), [customProducts]);
  const selectedCount = selectedProducts.length + completedCustomProducts.length;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    const validationError = validateForm(form, selectedProducts, completedCustomProducts, isScopedRepApproval);
    if (validationError) {
      setError(validationError);
      return;
    }

    if (!isSupabaseConfigured || !supabase) {
      setError(isAactivated ? 'AACTIVATED rep requests are temporarily unavailable. Please contact AACTIVATED support.' : 'Store setup intake is temporarily unavailable. Please contact PepScriptRX support.');
      return;
    }

    setSubmitting(true);
    const { error: submitError } = await supabase
      .from('rep_store_intake_submissions')
      .insert({
        status: 'new',
        full_name: form.full_name.trim(),
        phone: cleanOptional(form.phone),
        email: form.email.trim(),
        desired_rep_code: cleanOptional(form.desired_rep_code),
        parent_rep_or_admin_name: cleanOptional(form.parent_rep_or_admin_name) ?? fallbackParentName,
        store_type: isScopedRepApproval ? 'Rep under another admin / parent account' : form.store_type,
        store_brand_name: isScopedRepApproval ? buildScopedRepRequestName(form, approvalStoreName) : form.store_brand_name.trim(),
        logo_needed: cleanOptional(form.logo_needed),
        preferred_color_1: cleanOptional(form.preferred_color_1),
        preferred_color_2: cleanOptional(form.preferred_color_2),
        preferred_color_3: cleanOptional(form.preferred_color_3),
        brand_style_notes: cleanOptional(form.brand_style_notes),
        selected_products: isScopedRepApproval ? [] : selectedProducts,
        custom_products: isScopedRepApproval ? [] : completedCustomProducts,
        source_portal_id: portal?.id ?? null,
        source_portal: isScopedRepApproval ? scopedSourcePortal : portal?.brandName ?? null,
        source_url: typeof window !== 'undefined' ? window.location.href : null,
        source_route: typeof window !== 'undefined' ? window.location.pathname : portal?.path ?? null,
        parent_store_slug: isScopedRepApproval ? scopedStoreSlug : null,
        parent_store_name: isScopedRepApproval ? approvalStoreName : null,
        partner_admin_email: isScopedRepApproval ? scopedAdminEmail : null,
        partner_admin_id: null,
        approval_owner_email: isScopedRepApproval ? scopedAdminEmail : null,
        approval_owner_id: null,
        approval_status: isScopedRepApproval ? 'pending' : null,
        approval_notes: null,
        review_queue: isScopedRepApproval ? scopedStoreSlug : null,
        review_admin_code: reviewAdminCode,
        review_admin_name: reviewAdminName,
        internal_notes: isAactivated
          ? `${reviewAdminCode ?? scopedStoreSlug}_REP_INTAKE: Submitted through the AACTIVATED rep request route. Keep this request inside the AACTIVATED review queue for ${reviewAdminName ?? 'AACTIVATED admin'} (${reviewAdminCode ?? scopedStoreSlug}, ${scopedAdminEmail}). No webhook, public route, product portal, product catalog, commission record, payout record, or main-app handoff is created by this intake.`
          : isScopedRepApproval
          ? `${reviewAdminCode ?? scopedStoreSlug}_REP_INTAKE: Submitted through ${approvalStoreName} rep approval route. Route to ${reviewAdminName ?? `${approvalStoreName} admin`} (${reviewAdminCode ?? scopedStoreSlug}, ${scopedAdminEmail}) for approval and review. Rep/product portal choices hidden until approval. No white-label option requested or granted by this intake.`
          : null,
      });
    setSubmitting(false);

    if (submitError) {
      setError(submitError.message);
      return;
    }

    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  if (submitted) {
    return (
      <PublicLayout
        isolatedPortal={Boolean(portal)}
        portalKey={portal?.id}
        portalHomePath={portal?.path ?? '/'}
        portalName={brandName}
        portalLogoSrc={portal?.logoSrc}
      >
        <section style={{ background: isScopedRepApproval ? 'linear-gradient(135deg, #05070b 0%, #0b1729 54%, #111827 100%)' : 'linear-gradient(135deg, #07111f 0%, #0d2040 62%, #0e2d4a 100%)', padding: '72px 0' }}>
          <div className="container-sm">
            <div className="card" style={{ padding: 32, textAlign: 'center' }}>
              {isScopedRepApproval && portal?.logoSrc && (
                <img src={portal.logoSrc} alt={brandName} style={{ width: 190, height: 'auto', display: 'block', margin: '0 auto 18px' }} />
              )}
              <div style={{ width: 56, height: 56, margin: '0 auto 18px', borderRadius: 16, background: 'rgba(37,199,217,.12)', color: 'var(--teal)', display: 'grid', placeItems: 'center', fontWeight: 900, fontSize: 24 }}>
                OK
              </div>
              <h1 style={{ margin: '0 0 12px', color: 'var(--navy)', fontSize: 32 }}>{isScopedRepApproval ? 'Approval intake received' : 'Store setup received'}</h1>
              <p style={{ margin: '0 auto', maxWidth: 620, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                 {confirmationCopy}
              </p>
            </div>
          </div>
        </section>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout
      isolatedPortal={Boolean(portal)}
      portalKey={portal?.id}
      portalHomePath={portal?.path ?? '/'}
      portalName={brandName}
      portalLogoSrc={portal?.logoSrc}
    >
      <section style={{ background: isScopedRepApproval ? 'linear-gradient(135deg, #05070b 0%, #0b1729 54%, #111827 100%)' : 'linear-gradient(135deg, #07111f 0%, #0d2040 62%, #0e2d4a 100%)', color: '#fff', padding: '64px 0 42px' }}>
        <div className="container">
          <div style={{ maxWidth: 860 }}>
            {isScopedRepApproval && portal?.logoSrc && (
              <img
                src={portal.logoSrc}
                alt={brandName}
                style={{ width: 'min(310px, 80vw)', height: 'auto', display: 'block', marginBottom: 24, filter: 'drop-shadow(0 18px 36px rgba(37,199,217,.22))' }}
              />
            )}
            <div style={{ color: 'var(--teal-light)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '.1em', fontSize: 12, marginBottom: 12 }}>
              {heroEyebrow}
            </div>
            <h1 style={{ margin: '0 0 14px', fontSize: 'clamp(32px, 5vw, 52px)', lineHeight: 1.05 }}>{heroTitle}</h1>
            <p style={{ margin: 0, maxWidth: 720, color: 'rgba(255,255,255,.74)', fontSize: 17, lineHeight: 1.65 }}>
              {heroCopy}
            </p>
          </div>
        </div>
      </section>

      <section style={{ background: '#f4f6f9', padding: '32px 0 72px' }}>
        <div className="container">
          <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 22 }}>
            {error && <div className="alert alert-error">{error}</div>}

            <div className="card" style={{ padding: 22 }}>
              <StepHeading step="1" title="Contact Info" subtitle="Rep, store owner, or admin details." />
              <div className="form-grid-2">
                <Field label="Full Name" required>
                  <input className="form-input" value={form.full_name} onChange={(e) => setField(setForm, 'full_name', e.target.value)} />
                </Field>
                <Field label="Email Address" required>
                  <input className="form-input" type="email" value={form.email} onChange={(e) => setField(setForm, 'email', e.target.value)} />
                </Field>
                <Field label="Phone Number">
                  <input className="form-input" value={form.phone} onChange={(e) => setField(setForm, 'phone', e.target.value)} />
                </Field>
                <Field label="Desired Rep Code">
                  <input className="form-input" value={form.desired_rep_code} onChange={(e) => setField(setForm, 'desired_rep_code', e.target.value.toUpperCase())} placeholder="Optional" />
                </Field>
                <Field label="Parent Name">
                  <input className="form-input" value={form.parent_rep_or_admin_name} onChange={(e) => setField(setForm, 'parent_rep_or_admin_name', e.target.value)} placeholder={fallbackParentName ?? 'If under another admin or rep'} />
                </Field>
              </div>
                {!isScopedRepApproval ? (
                  <Field label="Store Type" required>
                    <div className="rep-intake-option-grid">
                      {STORE_TYPE_OPTIONS.map((option) => (
                        <label key={option} className={`rep-intake-radio ${form.store_type === option ? 'active' : ''}`}>
                          <input type="radio" name="store_type" checked={form.store_type === option} onChange={() => setField(setForm, 'store_type', option)} />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </Field>
                ) : (
                  <div className="alert alert-info" style={{ marginTop: 18 }}>
                    {isAactivated
                      ? 'This AACTIVATED request is for rep approval only. It stays in the AACTIVATED review queue and does not create a webhook, live storefront, product portal, or main-app workflow.'
                      : `This ${approvalStoreName} request is for rep approval only. No live storefront or product portal is created from this form. Approved reps can be assigned a route such as ${scopedSampleRoute} after admin review.`}
                  </div>
                )}
            </div>

            {!isScopedRepApproval && <div className="card" style={{ padding: 22 }}>
              <StepHeading step="2" title="Store Setup" subtitle="Branding details for the storefront build queue." />
              <div className="form-grid-2">
                <Field label="Store / Brand Name" required>
                  <input className="form-input" value={form.store_brand_name} onChange={(e) => setField(setForm, 'store_brand_name', e.target.value)} />
                </Field>
                <Field label="Do you need help creating a logo?">
                  <select className="form-select" value={form.logo_needed} onChange={(e) => setField(setForm, 'logo_needed', e.target.value as LogoNeeded)}>
                    <option value="">Select one</option>
                    {LOGO_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                  </select>
                </Field>
              </div>

              <div className="form-grid-3">
                <Field label="Preferred Color 1">
                  <input className="form-input" value={form.preferred_color_1} onChange={(e) => setField(setForm, 'preferred_color_1', e.target.value)} placeholder="#25C7D9 or teal" />
                </Field>
                <Field label="Preferred Color 2">
                  <input className="form-input" value={form.preferred_color_2} onChange={(e) => setField(setForm, 'preferred_color_2', e.target.value)} />
                </Field>
                <Field label="Preferred Color 3">
                  <input className="form-input" value={form.preferred_color_3} onChange={(e) => setField(setForm, 'preferred_color_3', e.target.value)} />
                </Field>
              </div>

              <Field label="Brand style notes">
                <textarea className="form-textarea" rows={4} value={form.brand_style_notes} onChange={(e) => setField(setForm, 'brand_style_notes', e.target.value)} placeholder="Examples: clean medical, black and gold, gym performance, luxury wellness..." />
              </Field>

              <div className="rep-intake-upload-placeholder">
                Existing logo upload will be added when storage-bucket support is enabled for this workflow. For now, submit this form and send logo files to the PepScriptRX team separately.
              </div>
            </div>}

            {!isScopedRepApproval && <div className="card" style={{ padding: 22 }}>
              <StepHeading step="3" title="Product Selection" subtitle={`${selectedCount} product${selectedCount === 1 ? '' : 's'} selected or requested.`} />
              <div className="alert alert-info" style={{ marginBottom: 16 }}>{PRICE_NOTICE}</div>

              <div style={{ display: 'grid', gap: 12 }}>
                {REP_INTAKE_PRODUCT_CATEGORIES.map((category) => {
                  const categoryProducts = REP_INTAKE_PRODUCTS.filter((product) => product.category === category);
                  const categorySelected = categoryProducts.filter((product) => productDrafts[product.id]?.selected).length;
                  return (
                    <div key={category} className="rep-intake-category">
                      <button
                        type="button"
                        className="rep-intake-category-toggle"
                        onClick={() => setOpenCategories((current) => ({ ...current, [category]: !current[category] }))}
                      >
                        <span>{category}</span>
                        <small>{categorySelected}/{categoryProducts.length} selected</small>
                      </button>
                      {openCategories[category] && (
                        <div className="rep-intake-product-table">
                          <div className="rep-intake-product-head">
                            <span>Carry</span>
                            <span>Product</span>
                            <span>Suggested</span>
                            <span>Requested retail</span>
                            <span>Notes</span>
                          </div>
                          {categoryProducts.map((product) => {
                            const draft = productDrafts[product.id];
                            return (
                              <div key={product.id} className="rep-intake-product-row">
                                <label className="rep-intake-check">
                                  <input
                                    type="checkbox"
                                    checked={draft.selected}
                                    onChange={(e) => updateProduct(product.id, { selected: e.target.checked })}
                                  />
                                </label>
                                <div>
                                  <strong>{product.productName}</strong>
                                </div>
                                <div>${product.suggestedRetailPrice}</div>
                                <input
                                  className="form-input"
                                  type="number"
                                  min="0"
                                  value={draft.requested_retail_price}
                                  onChange={(e) => updateProduct(product.id, { requested_retail_price: e.target.value })}
                                  placeholder={String(product.suggestedRetailPrice)}
                                />
                                <input
                                  className="form-input"
                                  value={draft.notes}
                                  onChange={(e) => updateProduct(product.id, { notes: e.target.value })}
                                  placeholder="Variation or note"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>}

            {!isScopedRepApproval && <div className="card" style={{ padding: 22 }}>
              <StepHeading step="4" title="Other Requested Products" subtitle="Optional custom items for admin review." />
              <div className="rep-intake-custom-grid">
                {customProducts.map((product, index) => (
                  <div className="rep-intake-custom-row" key={index}>
                    <input className="form-input" value={product.product_name} onChange={(e) => updateCustomProduct(index, { product_name: e.target.value })} placeholder="Product name" />
                    <input className="form-input" type="number" min="0" value={product.requested_retail_price} onChange={(e) => updateCustomProduct(index, { requested_retail_price: e.target.value })} placeholder="Requested retail" />
                    <input className="form-input" value={product.notes} onChange={(e) => updateCustomProduct(index, { notes: e.target.value })} placeholder="Notes" />
                  </div>
                ))}
              </div>
            </div>}

            {isScopedRepApproval && (
              <div className="card" style={{ padding: 22 }}>
                <StepHeading step="2" title="Approval Notes" subtitle={`Tell ${approvalStoreName} admin how to review this rep request.`} />
                <div className="form-grid-2">
                  <Field label="Requested rep display / handle">
                    <input className="form-input" value={form.store_brand_name} onChange={(e) => setField(setForm, 'store_brand_name', e.target.value)} placeholder="Example: SAMPLEREP or Sample Rep" />
                  </Field>
                  <Field label="Upload / profile / document link">
                    <input className="form-input" value={form.preferred_color_1} onChange={(e) => setField(setForm, 'preferred_color_1', e.target.value)} placeholder="Optional URL for approval materials" />
                  </Field>
                </div>
                <Field label="Approval notes">
                  <textarea className="form-textarea" rows={5} value={form.brand_style_notes} onChange={(e) => setField(setForm, 'brand_style_notes', e.target.value)} placeholder={`Background, sales channel, audience, requested route such as ${scopedSampleRoute}, or anything admin should know.`} />
                </Field>
              </div>
            )}

            <div className="card" style={{ padding: 22 }}>
              <StepHeading step={isScopedRepApproval ? '3' : '5'} title="Submit for Review" subtitle={isScopedRepApproval ? `${approvalStoreName} and platform admin approval are required before account activation.` : 'Admin review is required before any storefront is created.'} />
              <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, marginTop: 0 }}>
                {submitCopy}
              </p>
              <button className="btn btn-primary" type="submit" disabled={submitting} style={{ minWidth: 220, justifyContent: 'center' }}>
                {submitting ? 'Submitting...' : isAactivated ? 'Submit AACTIVATED Rep Request' : 'Submit Store Setup'}
              </button>
            </div>
          </form>
        </div>
      </section>
    </PublicLayout>
  );

  function updateProduct(id: string, patch: Partial<ProductDraft>) {
    setProductDrafts((current) => ({
      ...current,
      [id]: { ...current[id], ...patch },
    }));
  }

  function updateCustomProduct(index: number, patch: Partial<CustomProductDraft>) {
    setCustomProducts((current) => current.map((product, currentIndex) => (
      currentIndex === index ? { ...product, ...patch } : product
    )));
  }
}

function StepHeading({ step, title, subtitle }: { step: string; title: string; subtitle: string }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', marginBottom: 18 }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--teal-pale)', color: 'var(--teal)', display: 'grid', placeItems: 'center', fontWeight: 900 }}>
        {step}
      </div>
      <div>
        <h2 style={{ margin: 0, color: 'var(--navy)', fontSize: 21 }}>{title}</h2>
        <p style={{ margin: '4px 0 0', color: 'var(--text-muted)', fontSize: 14 }}>{subtitle}</p>
      </div>
    </div>
  );
}

function Field({ label, required = false, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="form-group">
      <span className="form-label">{label}{required ? ' *' : ''}</span>
      {children}
    </label>
  );
}

function setField<T extends keyof IntakeForm>(
  setter: Dispatch<SetStateAction<IntakeForm>>,
  key: T,
  value: IntakeForm[T],
) {
  setter((current) => ({ ...current, [key]: value }));
}

function buildSelectedProducts(productDrafts: Record<string, ProductDraft>): RepStoreIntakeProduct[] {
  return REP_INTAKE_PRODUCTS
    .filter((product) => productDrafts[product.id]?.selected)
    .map((product) => {
      const draft = productDrafts[product.id];
      return {
        id: product.id,
        category: product.category,
        product_name: product.productName,
        suggested_retail_price: product.suggestedRetailPrice,
        requested_retail_price: parseMoney(draft.requested_retail_price) ?? product.suggestedRetailPrice,
        notes: cleanOptional(draft.notes),
      };
    });
}

function buildCustomProducts(customProducts: CustomProductDraft[]): RepStoreIntakeProduct[] {
  return customProducts
    .filter((product) => product.product_name.trim())
    .map((product) => ({
      product_name: product.product_name.trim(),
      requested_retail_price: parseMoney(product.requested_retail_price),
      notes: cleanOptional(product.notes),
    }));
}

function validateForm(
  form: IntakeForm,
  selectedProducts: RepStoreIntakeProduct[],
  customProducts: RepStoreIntakeProduct[],
  isScopedRepApproval: boolean,
): string {
  if (!form.full_name.trim()) return 'Full Name is required.';
  if (!isValidEmail(form.email)) return 'A valid Email Address is required.';
  if (isScopedRepApproval) return '';
  if (!form.store_brand_name.trim()) return 'Store / Brand Name is required.';
  if (!form.store_type) return 'Store Type is required.';
  if (form.logo_needed === 'Yes, help me create one') {
    if (!form.preferred_color_1.trim() || !form.preferred_color_2.trim() || !form.preferred_color_3.trim()) {
      return 'Please enter three preferred colors for logo help.';
    }
  }
  if (selectedProducts.length === 0 && customProducts.length === 0) {
    return 'Select at least one product or enter one custom requested product.';
  }
  return '';
}

function buildScopedRepRequestName(form: IntakeForm, storeName: string): string {
  return cleanOptional(form.store_brand_name)
    ?? cleanOptional(form.desired_rep_code)
    ?? `${form.full_name.trim()} ${storeName} Rep Request`;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function parseMoney(value: string): number | null {
  if (!value.trim()) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

function cleanOptional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}
