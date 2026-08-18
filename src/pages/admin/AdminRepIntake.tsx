import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import DashLayout from '../../components/layout/DashLayout';
import { getPasswordResetUrl, supabase } from '../../lib/supabase';
import type { RepStoreIntakeProduct, RepStoreIntakeStatus, RepStoreIntakeSubmission } from '../../types';
import { ADMIN_NAV, RX_PLUS_ADMIN_NAV } from './adminNav';
import { useAuth } from '../../context/AuthContext';
import {
  AACTIVATED_ADMIN_REP_CODE,
  AACTIVATED_PARENT_STORE_NAME,
  AACTIVATED_PARENT_STORE_SLUG,
  AACTIVATED_PARTNER_ADMIN_EMAIL,
  canSeeAactivatedPartnerScope,
  intakeApprovalStatus,
  isAactivatedIntake,
  isAactivatedPartnerAdmin,
} from '../../lib/aactivatedScope';
import {
  ROCKPHORM_ADMIN_EMAIL_ALIASES,
  ROCKPHORM_ADMIN_NAV,
  ROCKPHORM_SCOPE_CODE,
  ROCKPHORM_STORE_NAME,
  ROCKPHORM_STORE_SLUG,
  isRockPhormIntake,
  isRockPhormScopedAdmin,
} from '../../lib/rockPhormScope';
import type { Rep } from '../../types';

const STATUS_OPTIONS: RepStoreIntakeStatus[] = [
  'new',
  'reviewing',
  'more_info_requested',
  'logo_needed',
  'pricing_review',
  'ready_to_build',
  'launched',
  'rejected',
];
const AACTIVATED_STORE_SCOPE = 'AACTIVATEDRX';
const MAX_PARTNER_COMMISSION_PERCENT = 50;
const HARD_MAX_COMMISSION_PERCENT = 70;
const REVIEW_BUCKETS = ['pending', 'approved', 'rejected', 'more_info_requested'] as const;
type ReviewBucket = typeof REVIEW_BUCKETS[number];

type ApprovedRepSetupDraft = {
  repName: string;
  publicDisplayName: string;
  repCode: string;
  payoutEmail: string;
  commissionPercent: string;
  commissionType: string;
  productListId: string;
  pricingMode: string;
  storeStatus: string;
  enableRepPortalLogin: boolean;
  setupNote: string;
};

type PartnerProductListLite = {
  id: string;
  list_name: string;
  default_pricing_mode: string;
  status: string;
};
type AdminFunctionResponse = { ok?: boolean; error?: string; [key: string]: unknown };

export default function AdminRepIntake() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const requestedRowId = searchParams.get('request');
  const requestedBucket = searchParams.get('bucket');
  const [rows, setRows] = useState<RepStoreIntakeSubmission[]>([]);
  const [parentRep, setParentRep] = useState<Rep | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [creatingRep, setCreatingRep] = useState(false);
  const [resettingPassword, setResettingPassword] = useState('');
  const [activeBucket, setActiveBucket] = useState<ReviewBucket | 'create'>('pending');
  const [copiedLink, setCopiedLink] = useState(false);
  const [message, setMessage] = useState('');
  const [statusDraft, setStatusDraft] = useState<RepStoreIntakeStatus>('new');
  const [notesDraft, setNotesDraft] = useState('');
  const [setupDrafts, setSetupDrafts] = useState<Record<string, ApprovedRepSetupDraft>>({});
  const [productLists, setProductLists] = useState<PartnerProductListLite[]>([]);

  const selected = useMemo(() => rows.find((row) => row.id === selectedId) ?? rows[0] ?? null, [rows, selectedId]);
  const isScopedAactivatedAdmin = isAactivatedPartnerAdmin(profile);
  const isScopedRockPhormAdmin = isRockPhormScopedAdmin(profile);
  const isScopedApprovalAdmin = isScopedAactivatedAdmin || isScopedRockPhormAdmin;
  const canUseAactivatedCenter = canSeeAactivatedPartnerScope(profile);
  const navItems = isScopedRockPhormAdmin
    ? ROCKPHORM_ADMIN_NAV
    : profile?.role === 'rx_plus_admin'
      ? RX_PLUS_ADMIN_NAV
      : ADMIN_NAV;
  const approvalScopeName = isScopedRockPhormAdmin ? ROCKPHORM_STORE_NAME : 'AACTIVATEDRX';
  const selectedIsScopedApproval = selected ? isAactivatedIntake(selected) || isRockPhormIntake(selected) : false;

  function selectSubmission(row: RepStoreIntakeSubmission) {
    selectSubmissionDrafts(row, setSelectedId, setStatusDraft, setNotesDraft);
  }

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.email, profile?.role, requestedRowId, requestedBucket]);

  async function loadRows() {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    setError('');
    let query = supabase
      .from('rep_store_intake_submissions')
      .select('*')
      .order('created_at', { ascending: false });
    if (isScopedAactivatedAdmin) {
      query = query.or([
        'source_portal_id.ilike.aactivated',
        'source_portal_id.ilike.AACTIVATEDRX',
        'source_portal_id.ilike.*AACTIVATED*',
        'source_portal.ilike.*AACTIVATED*',
        'source_url.ilike.*AACTIVATED*',
        'source_route.ilike.*AACTIVATED*',
        'review_queue.ilike.aactivated',
        'review_queue.ilike.*AACTIVATED*',
        `parent_store_slug.ilike.${AACTIVATED_PARENT_STORE_SLUG}`,
        'parent_store_slug.ilike.AACTIVATEDRX',
        'parent_store_slug.ilike.*AACTIVATED*',
        'parent_store_name.ilike.*AACTIVATED*',
        'parent_rep_or_admin_name.ilike.*AACTIVATED*',
        'parent_rep_or_admin_name.ilike.*GUY*',
        'store_brand_name.ilike.*AACTIVATED*',
        'review_admin_name.ilike.*GUY*',
        'internal_notes.ilike.*AACTIVATED*',
        `partner_admin_email.ilike.${AACTIVATED_PARTNER_ADMIN_EMAIL}`,
        `approval_owner_email.ilike.${AACTIVATED_PARTNER_ADMIN_EMAIL}`,
        `review_admin_code.ilike.${AACTIVATED_ADMIN_REP_CODE}`,
      ].join(','));
    } else if (isScopedRockPhormAdmin) {
      query = query.or([
        'source_portal_id.ilike.rockphorm',
        'source_portal.ilike.*Rock Phorm*',
        'source_portal.ilike.*ROCKPHORM*',
        'source_url.ilike.*rockphorm*',
        'source_route.ilike.*rockphorm*',
        'review_queue.ilike.rockphorm',
        `parent_store_slug.ilike.${ROCKPHORM_STORE_SLUG}`,
        'parent_store_name.ilike.*Rock Phorm*',
        ...ROCKPHORM_ADMIN_EMAIL_ALIASES.flatMap((email) => [
          `partner_admin_email.ilike.${email}`,
          `approval_owner_email.ilike.${email}`,
        ]),
        `review_admin_code.ilike.${ROCKPHORM_SCOPE_CODE}`,
      ].join(','));
    }
    const { data, error: loadError } = await query;

    if (loadError) {
      setError(loadError.message);
    } else {
      const allRows = (data as RepStoreIntakeSubmission[]) ?? [];
      const nextRows = isScopedAactivatedAdmin
        ? allRows.filter(isAactivatedIntake)
        : isScopedRockPhormAdmin
          ? allRows.filter(isRockPhormIntake)
          : allRows;
      setRows(nextRows);
      const requestedSelected = requestedRowId ? nextRows.find((row) => row.id === requestedRowId) ?? null : null;
      const nextSelected = requestedSelected ?? nextRows.find((row) => row.id === selectedId) ?? nextRows[0] ?? null;
      if (requestedSelected) {
        const selectedBucket = intakeApprovalStatus(requestedSelected);
        setActiveBucket(isReviewBucket(requestedBucket) ? requestedBucket : isReviewBucket(selectedBucket) ? selectedBucket : 'pending');
      }
      if (nextSelected) selectSubmission(nextSelected);
    }
    if (canUseAactivatedCenter) await Promise.all([loadParentRep(), loadProductLists()]);
    setLoading(false);
  }

  async function loadParentRep() {
    if (!supabase || !profile) return;
    const { data } = await supabase
      .from('reps')
      .select('*')
      .or(`profile_id.eq.${profile.id},managed_by_profile_id.eq.${profile.id},payout_email.eq.${profile.email},rep_slug.eq.${AACTIVATED_ADMIN_REP_CODE}`)
      .is('parent_rep_id', null)
      .order('created_at', { ascending: true })
      .limit(1);
    setParentRep(((data as Rep[]) ?? [])[0] ?? null);
  }

  async function loadProductLists() {
    if (!supabase) return;
    const { data } = await supabase
      .from('partner_product_lists')
      .select('id, list_name, default_pricing_mode, status')
      .eq('store_scope', AACTIVATED_STORE_SCOPE)
      .order('created_at', { ascending: true });
    setProductLists((data as PartnerProductListLite[]) ?? []);
  }

  async function saveSelected() {
    if (!supabase || !selected) return;
    setSaving(true);
    setError('');
    const { error: saveError } = await supabase
      .from('rep_store_intake_submissions')
      .update({
        status: statusDraft,
        approval_status: statusToApprovalStatus(statusDraft),
        approval_notes: notesDraft.trim() || null,
        internal_notes: notesDraft.trim() || null,
      })
      .eq('id', selected.id);
    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }
    await loadRows();
  }

  async function quickReview(nextStatus: RepStoreIntakeStatus) {
    if (!supabase || !selected) return;
    setSaving(true);
    setError('');
    const nextNotes = notesDraft.trim() || defaultReviewNote(nextStatus, profile?.full_name ?? 'Admin');
    const { error: saveError } = await supabase
      .from('rep_store_intake_submissions')
      .update({
        status: nextStatus,
        approval_status: statusToApprovalStatus(nextStatus),
        approval_notes: nextNotes,
        internal_notes: nextNotes,
      })
      .eq('id', selected.id);
    setSaving(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }
    setStatusDraft(nextStatus);
    setNotesDraft(nextNotes);
    await loadRows();
  }

  async function createRepFromSelected(draftOverride?: ApprovedRepSetupDraft) {
    if (!supabase || !selected || !profile) return;
    if (!canUseAactivatedCenter || !isAactivatedIntake(selected)) {
      setError('Only AACTIVATEDRX rep requests can be activated from this approval center.');
      return;
    }
    if (!parentRep) {
      setError('Guy is not connected to the AACTIVATEDRX parent rep record yet.');
      return;
    }

    const draft = draftOverride ?? setupDraftForSubmission(selected);
    const repSlug = normalizeRepSlug(draft.repCode || buildRepCode(selected));
    if (!draft.commissionPercent.trim()) {
      setError('Enter a custom commission percentage before activating this rep.');
      return;
    }
    // The rebuilt AACTIVATEDRX workflow approves into secure onboarding. It must
    // not create an active storefront, referral link, commission, payout, or
    // plaintext/temporary password from the browser.
    setCreatingRep(true);
    setError('');
    const { data: approvalResult, error: approvalError } = await invokeAuthenticatedAdminFunction('approve-aactivated-onboarding', {
        application_id: selected.id,
        rep_code: repSlug,
        commission_percent: Number(draft.commissionPercent || 0),
        sponsor_rep_id: parentRep?.id ?? null,
        internal_note: draft.setupNote.trim() || notesDraft.trim() || null,
        redirect_to: `${window.location.origin}/rep/onboarding`,
    });
    setCreatingRep(false);
    if (approvalError || approvalResult?.ok !== true) {
      setError(await edgeFunctionErrorMessage(approvalError, approvalResult?.error, 'Secure approval could not be completed.'));
      return;
    }
    setMessage('Application approved. A secure account-activation email was queued; commissions and referrals remain disabled until onboarding is verified.');
    navigate(`/admin/rep-store-manager?rep=${encodeURIComponent(repSlug)}`, { replace: false });
    return;

  }

  async function sendRepPasswordReset() {
    if (!supabase || !selected?.email) return;
    const email = selected.email.trim().toLowerCase();
    setResettingPassword(selected.id);
    setError('');
    setMessage('');
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getPasswordResetUrl({ brand: 'aactivated', portal: 'rep' }),
    });
    setResettingPassword('');
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setMessage(`Secure AACTIVATEDRX rep password-reset email sent to ${email}.`);
  }

  const counts = ['pending', 'approved', 'rejected', 'more_info_requested'].reduce<Record<string, number>>((acc, status) => {
    acc[status] = rows.filter((row) => intakeApprovalStatus(row) === status).length;
    return acc;
  }, {});
  const visibleRows = activeBucket === 'create' ? [] : rows.filter((row) => intakeApprovalStatus(row) === activeBucket);
  const publicIntakePath = isScopedRockPhormAdmin ? '/rockphorm/rep-intake' : '/aactivated/rep-intake';
  const publicIntakeLink = typeof window !== 'undefined' ? `${window.location.origin}${publicIntakePath}` : publicIntakePath;

  async function copyPublicIntakeLink() {
    await navigator.clipboard.writeText(publicIntakeLink);
    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 1600);
  }

  return (
    <DashLayout title="Rep Requests" navItems={navItems}>
      <div className="stats-grid mb-8">
        <div className="stat-card">
          <div className="stat-value">{rows.length}</div>
          <div className="stat-label">{isScopedApprovalAdmin ? `${approvalScopeName} rep requests` : 'Total rep requests'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--info)' }}>{counts.pending ?? 0}</div>
          <div className="stat-label">Pending</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{counts.more_info_requested ?? 0}</div>
          <div className="stat-label">More info requested</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--success)' }}>{counts.approved ?? 0}</div>
          <div className="stat-label">Approved</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--error)' }}>{counts.rejected ?? 0}</div>
          <div className="stat-label">Rejected</div>
        </div>
      </div>

      {error && <div className="alert alert-error mb-4">{error}</div>}
      {message && <div className="alert alert-success mb-4">{message}</div>}

      {isScopedApprovalAdmin && (
        <div className="card mb-4">
          <div className="card-body" style={{ display: 'grid', gap: 12 }}>
            <div>
              <div className="card-title">Public Rep Intake Link</div>
              <div className="card-subtitle">Share this link with {approvalScopeName} applicants. Submissions route to the scoped admin queue for review.</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 10, alignItems: 'center' }}>
              <div style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--navy)', background: 'var(--card-soft)', border: '1px solid var(--border)', borderRadius: 8, padding: '11px 12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {publicIntakeLink}
              </div>
              <button className="btn btn-outline btn-sm" type="button" onClick={copyPublicIntakeLink}>
                {copiedLink ? 'Copied' : 'Copy Link'}
              </button>
            </div>
          </div>
        </div>
      )}

      {isScopedApprovalAdmin && (
        <div className="filter-bar mb-4" style={{ gap: 10 }}>
          {[
            ['pending', 'Pending Requests'],
            ['approved', 'Approved Reps'],
            ['rejected', 'Rejected'],
            ['more_info_requested', 'More Info Requested'],
            ...(isScopedAactivatedAdmin ? [['create', 'Create Rep']] : []),
          ].map(([bucket, label]) => (
            <button
              key={bucket}
              className={`btn btn-sm ${activeBucket === bucket ? 'btn-primary' : 'btn-outline'}`}
              type="button"
              onClick={() => setActiveBucket(bucket as typeof activeBucket)}
            >
              {bucket === 'create' ? label : `${label} (${counts[bucket] ?? 0})`}
            </button>
          ))}
        </div>
      )}

      {activeBucket === 'create' && isScopedAactivatedAdmin ? (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Create Rep</div>
              <div className="card-subtitle">Create or manage AACTIVATEDRX reps after approval.</div>
            </div>
          </div>
          <div className="card-body" style={{ display: 'grid', gap: 14 }}>
            <div className="alert alert-info">
              Use the rep table to create a rep manually, or select a pending request and use Create Rep from the approval actions.
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link className="btn btn-primary" to="/admin/reps">Create Rep</Link>
              <button className="btn btn-outline" type="button" onClick={() => setActiveBucket('pending')}>View Pending Requests</button>
            </div>
          </div>
        </div>
      ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, .9fr) minmax(0, 1.4fr)', gap: 18, alignItems: 'start' }} className="rep-intake-admin-grid">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Rep Requests</div>
              <div className="card-subtitle">Newest first</div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={loadRows}>Refresh</button>
          </div>
          <div className="card-body" style={{ display: 'grid', gap: 10 }}>
            {loading ? (
              <div className="loading-inline"><div className="spinner" />Loading intake submissions...</div>
            ) : visibleRows.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-title">No intakes yet</div>
                <div className="empty-state-desc">
                  Partner rep approval requests will appear here.
                </div>
              </div>
            ) : visibleRows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => selectSubmission(row)}
                className={`rep-intake-admin-list-item ${selected?.id === row.id ? 'active' : ''}`}
              >
                <span>
                  <strong>{row.store_brand_name}</strong>
                  <small>{row.full_name} - {row.email}</small>
                  {isAactivatedIntake(row) && <small>AACTIVATEDRX - Guy approval owner</small>}
                  {isRockPhormIntake(row) && <small>Rock Phorm - Rick approval owner</small>}
                </span>
                <ApprovalBadge status={intakeApprovalStatus(row)} />
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          {selected ? (
            <>
              <div className="card-header">
                <div>
                  <div className="card-title">{selected.store_brand_name}</div>
                  <div className="card-subtitle">{formatDate(selected.created_at)} - {selected.full_name}</div>
                </div>
                <ApprovalBadge status={intakeApprovalStatus(selected)} />
              </div>
              <div className="card-body" style={{ display: 'grid', gap: 22 }}>
                {isAactivatedIntake(selected) && intakeApprovalStatus(selected) === 'approved' && (
                  <section aria-label="Rep account access" className="card" style={{ boxShadow: 'none', border: '2px solid var(--teal)' }}>
                    <div className="card-body" style={{ display: 'grid', gap: 12 }}>
                      <div>
                        <div className="detail-section-title" style={{ marginBottom: 4 }}>Rep Account Access</div>
                        <p style={{ margin: 0 }}>Send {selected.full_name} a secure, expiring link to choose a new password. Administrators never see or create the rep's password.</p>
                      </div>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <button className="btn btn-primary" type="button" onClick={() => void sendRepPasswordReset()} disabled={resettingPassword === selected.id}>
                          {resettingPassword === selected.id ? 'Sending Reset Link...' : 'Send Rep Password Reset'}
                        </button>
                        <Link className="btn btn-outline" to="/admin/rep-onboarding">Open Rep Onboarding Center</Link>
                      </div>
                    </div>
                  </section>
                )}
                <section>
                  <div className="detail-section-title">Contact and Store</div>
                  <DetailGrid rows={[
                    ['Intake source', intakeSourceLabel(selected)],
                    ['Source URL', selected.source_url],
                    ['Review queue', selected.review_queue],
                    ['Review admin', reviewAdminLabel(selected)],
                    ['Parent store', selected.parent_store_name],
                    ['Partner admin', selected.partner_admin_email],
                    ['Approval owner', selected.approval_owner_email],
                    ['Source route', selected.source_route],
                    ['Full name', selected.full_name],
                    ['Email', selected.email],
                    ['Phone', selected.phone],
                    ['Store type', selected.store_type],
                    ['Parent rep/admin', selected.parent_rep_or_admin_name],
                    ['Desired rep code', selected.desired_rep_code],
                  ]} />
                </section>

                <section>
                  <div className="detail-section-title">{selectedIsScopedApproval ? 'Approval Notes' : 'Branding'}</div>
                  {selectedIsScopedApproval ? (
                    <DetailGrid rows={[
                      ['Requested upload/profile link', selected.preferred_color_1],
                      ['Approval notes', selected.brand_style_notes],
                      ['Portal/product choice', 'Locked until account is approved'],
                      ['White-label option', `Not available for ${intakeSourceLabel(selected)} rep intake`],
                    ]} />
                  ) : (
                    <DetailGrid rows={[
                      ['Logo needed', selected.logo_needed],
                      ['Preferred colors', [selected.preferred_color_1, selected.preferred_color_2, selected.preferred_color_3].filter(Boolean).join(', ')],
                      ['Style notes', selected.brand_style_notes],
                    ]} />
                  )}
                </section>

                {selectedIsScopedApproval ? (
                  <section>
                    <div className="detail-section-title">Product Portal</div>
                    <div className="alert alert-info">
                      Product catalog selection and public rep route setup should happen only after this {intakeSourceLabel(selected)} rep request is approved.
                    </div>
                  </section>
                ) : (
                  <>
                    <section>
                      <div className="detail-section-title">Selected Products</div>
                      <ProductList products={selected.selected_products ?? []} />
                    </section>

                    <section>
                      <div className="detail-section-title">Other Requested Products</div>
                      <ProductList products={selected.custom_products ?? []} emptyText="No custom products requested." />
                    </section>
                  </>
                )}

                {isAactivatedIntake(selected) && intakeApprovalStatus(selected) === 'approved' && (
                  <RepSetupWorkflow
                      submission={selected}
                      parentRep={parentRep}
                      draft={setupDrafts[selected.id] ?? setupDraftForSubmission(selected)}
                      productLists={productLists}
                      onDraftChange={(patch) => setSetupDrafts((drafts) => ({
                        ...drafts,
                        [selected.id]: { ...(drafts[selected.id] ?? setupDraftForSubmission(selected)), ...patch },
                      }))}
                      onCreateRep={createRepFromSelected}
                      creatingRep={creatingRep}
                  />
                )}

                <section>
                  <div className="detail-section-title">Admin Review</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                    <button className="btn btn-primary btn-sm" type="button" onClick={() => quickReview('ready_to_build')} disabled={saving}>
                      Approve
                    </button>
                    <button className="btn btn-outline btn-sm" type="button" onClick={() => quickReview('more_info_requested')} disabled={saving}>
                      Request More Information
                    </button>
                    <button className="btn btn-outline btn-sm" type="button" onClick={() => quickReview('rejected')} disabled={saving}>
                      Reject
                    </button>
                    {isAactivatedIntake(selected) && (
                      <button className="btn btn-outline btn-sm" type="button" onClick={() => createRepFromSelected()} disabled={creatingRep || saving}>
                        {creatingRep ? 'Creating...' : 'Create Rep'}
                      </button>
                    )}
                  </div>
                  <div className="form-grid-2">
                    <label className="form-group">
                      <span className="form-label">Status</span>
                      <select className="form-select" value={statusDraft} onChange={(e) => setStatusDraft(e.target.value as RepStoreIntakeStatus)}>
                        {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
                      </select>
                    </label>
                  </div>
                  <label className="form-group">
                    <span className="form-label">Internal Notes</span>
                    <textarea className="form-textarea" rows={5} value={notesDraft} onChange={(e) => setNotesDraft(e.target.value)} />
                  </label>
                  <button className="btn btn-primary" type="button" onClick={saveSelected} disabled={saving}>
                    {saving ? 'Saving...' : 'Save Review'}
                  </button>
                </section>
              </div>
            </>
          ) : (
            <div className="empty-state card-body">
              <div className="empty-state-title">Select a submission</div>
              <div className="empty-state-desc">Choose an intake submission to review details and update status.</div>
            </div>
          )}
        </div>
      </div>
      )}
    </DashLayout>
  );
}

function RepSetupWorkflow({
  submission,
  parentRep,
  draft,
  productLists,
  onDraftChange,
  onCreateRep,
  creatingRep,
}: {
  submission: RepStoreIntakeSubmission;
  parentRep: Rep | null;
  draft: ApprovedRepSetupDraft;
  productLists: PartnerProductListLite[];
  onDraftChange: (patch: Partial<ApprovedRepSetupDraft>) => void;
  onCreateRep: (draft: ApprovedRepSetupDraft) => void;
  creatingRep: boolean;
}) {
  const repCode = normalizeRepSlug(draft.repCode || buildRepCode(submission));
  const storefrontLink = `/aactivated?rep=${encodeURIComponent(repCode)}`;
  const checkoutCode = repCode;
  const hasCustomCommission = draft.commissionPercent.trim() !== '';
  const commissionPercent = Number(draft.commissionPercent);
  const commissionHelp = !hasCustomCommission
    ? 'Required. Enter the custom commission for this rep before activation.'
    : Number.isFinite(commissionPercent) && commissionPercent > MAX_PARTNER_COMMISSION_PERCENT
    ? 'This will be saved as Needs Platform Approval.'
    : 'This will be saved as active when activated.';
  return (
    <section>
      <div className="detail-section-title">Rep Approval Setup Workflow</div>
      <div className="card" style={{ boxShadow: 'none' }}>
        <div className="card-body" style={{ display: 'grid', gap: 16 }}>
          <div className="alert alert-info">
            Guided setup is scoped to AACTIVATEDRX. Platform-only financial controls are locked from this portal.
          </div>
          <div className="stats-grid">
            <div className="stat-card"><div className="stat-value">1</div><div className="stat-label">Rep Info</div></div>
            <div className="stat-card"><div className="stat-value">2</div><div className="stat-label">Commission Setup</div></div>
            <div className="stat-card"><div className="stat-value">3</div><div className="stat-label">Product Selection</div></div>
            <div className="stat-card"><div className="stat-value">4</div><div className="stat-label">Pricing Overrides</div></div>
            <div className="stat-card"><div className="stat-value">5</div><div className="stat-label">Store Features</div></div>
            <div className="stat-card"><div className="stat-value">6</div><div className="stat-label">Promo / Attribution</div></div>
            <div className="stat-card"><div className="stat-value">7</div><div className="stat-label">Review & Activate</div></div>
          </div>
          <div className="form-grid-2">
            <label className="form-group">
              <span className="form-label">Rep name</span>
              <input className="form-input" value={draft.repName} onChange={(event) => onDraftChange({ repName: event.target.value })} />
            </label>
            <label className="form-group">
              <span className="form-label">Public display name</span>
              <input className="form-input" value={draft.publicDisplayName} onChange={(event) => onDraftChange({ publicDisplayName: event.target.value })} />
            </label>
            <label className="form-group">
              <span className="form-label">Rep code / attribution</span>
              <input className="form-input" value={draft.repCode} onChange={(event) => onDraftChange({ repCode: event.target.value.toUpperCase() })} />
              <p className="form-help">Used for the storefront link, checkout attribution, referral link, and discount code.</p>
            </label>
            <label className="form-group">
              <span className="form-label">Payout email</span>
              <input className="form-input" type="email" value={draft.payoutEmail} onChange={(event) => onDraftChange({ payoutEmail: event.target.value })} />
            </label>
            <label className="form-group">
              <span className="form-label">Commission structure</span>
              <select className="form-select" value={draft.commissionType} onChange={(event) => onDraftChange({ commissionType: event.target.value })}>
                <option value="flat_net_profit">Flat net profit</option>
                <option value="net_profit_share">Net profit share</option>
                <option value="tiered">Tiered</option>
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Commission %</span>
              <input className="form-input" type="number" min="0" max={HARD_MAX_COMMISSION_PERCENT} step="0.01" required placeholder="Enter custom %" value={draft.commissionPercent} onChange={(event) => onDraftChange({ commissionPercent: event.target.value })} />
              <p className="form-help">{commissionHelp} Values above {HARD_MAX_COMMISSION_PERCENT}% are blocked.</p>
            </label>
            <label className="form-group">
              <span className="form-label">Product list</span>
              <select className="form-select" value={draft.productListId} onChange={(event) => onDraftChange({ productListId: event.target.value })}>
                <option value="">Full AACTIVATEDRX Catalog</option>
                {productLists.map((list) => <option key={list.id} value={list.id}>{list.list_name}</option>)}
              </select>
              <p className="form-help">Assigns the starting catalog for this rep store. Guy can edit it later in Rep Store Manager.</p>
            </label>
            <label className="form-group">
              <span className="form-label">Pricing mode</span>
              <select className="form-select" value={draft.pricingMode} onChange={(event) => onDraftChange({ pricingMode: event.target.value })}>
                <option value="aactivated_default">Default AACTIVATEDRX pricing</option>
                <option value="sale_price">Apply AACTIVATEDRX sale price where enabled</option>
                <option value="rep_override">Rep-specific override if enabled</option>
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Store status</span>
              <select className="form-select" value={draft.storeStatus} onChange={(event) => onDraftChange({ storeStatus: event.target.value })}>
                <option value="active">Active</option>
                <option value="draft">Draft</option>
                <option value="disabled">Disabled</option>
              </select>
            </label>
          </div>
          <label className="checkbox-item">
            <input type="checkbox" checked={draft.enableRepPortalLogin} onChange={(event) => onDraftChange({ enableRepPortalLogin: event.target.checked })} />
            <span>Grant rep portal login and generate temporary password for this rep</span>
          </label>
          <label className="form-group">
            <span className="form-label">Setup note</span>
            <textarea className="form-textarea" rows={3} value={draft.setupNote} onChange={(event) => onDraftChange({ setupNote: event.target.value })} />
          </label>
          <DetailGrid rows={[
            ['Rep name', submission.full_name],
            ['Email', submission.email],
            ['Phone', submission.phone],
            ['Public display name', draft.publicDisplayName],
            ['Requested handle / slug', repCode],
            ['Parent store', AACTIVATED_PARENT_STORE_NAME],
            ['Approval owner', 'Guy Griffithe'],
            ['Parent rep', parentRep?.rep_slug ?? AACTIVATED_ADMIN_REP_CODE],
            ['Custom commission', hasCustomCommission ? `${draft.commissionPercent}% (${draft.commissionType})` : 'Required before activation'],
            ['Rep storefront link', storefrontLink],
            ['Checkout attribution code', checkoutCode],
            ['Promo/referral link', `/r/${repCode}`],
            ['Product list', productLists.find((list) => list.id === draft.productListId)?.list_name ?? 'Full AACTIVATEDRX Catalog'],
            ['Pricing mode', draft.pricingMode],
            ['Rep portal login', draft.enableRepPortalLogin ? 'Grant on activation' : 'Off'],
          ]} />
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" type="button" onClick={() => onCreateRep(draft)} disabled={creatingRep || !hasCustomCommission}>
              {creatingRep ? 'Creating...' : 'Activate Rep Store'}
            </button>
            <Link className="btn btn-outline" to="/admin/commission-center">Configure Commission</Link>
            <Link className="btn btn-outline" to="/admin/product-lists">Select Product List</Link>
            <Link className="btn btn-outline" to="/admin/rep-store-manager">Edit Store Features</Link>
            <button className="btn btn-outline" type="button" onClick={() => navigator.clipboard.writeText([
              `Rep: ${draft.repName}`,
              `Store slug: ${repCode}`,
              `Commission: ${hasCustomCommission ? `${draft.commissionPercent}% (${draft.commissionType})` : 'Not set'}`,
              `Parent store: ${AACTIVATED_PARENT_STORE_NAME}`,
              `Storefront: ${storefrontLink}`,
              `Attribution code: ${checkoutCode}`,
            ].join('\n'))}>
              Copy Setup Summary
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function selectSubmissionDrafts(
  row: RepStoreIntakeSubmission,
  setSelectedId: (id: string) => void,
  setStatusDraft: (status: RepStoreIntakeStatus) => void,
  setNotesDraft: (notes: string) => void,
) {
  setSelectedId(row.id);
  setStatusDraft(row.status);
  setNotesDraft(row.internal_notes ?? '');
}

function intakeSourceLabel(row: RepStoreIntakeSubmission): string {
  if (isAactivatedIntake(row)) return row.source_portal ?? 'AACTIVATED rep approval route';
  if (isRockPhormIntake(row)) return row.source_portal ?? 'Rock Phorm rep approval route';
  return row.source_portal ?? 'PepScriptRX intake';
}

function reviewAdminLabel(row: RepStoreIntakeSubmission): string | null {
  if (!row.review_admin_name && !row.review_admin_code) return null;
  return [row.review_admin_name, row.review_admin_code].filter(Boolean).join(' - ');
}

function setupDraftForSubmission(row: RepStoreIntakeSubmission): ApprovedRepSetupDraft {
  const repCode = buildRepCode(row);
  return {
    repName: row.full_name ?? '',
    publicDisplayName: row.store_brand_name || row.full_name || repCode,
    repCode,
    payoutEmail: row.email || '',
    commissionPercent: '',
    commissionType: 'flat_net_profit',
    productListId: '',
    pricingMode: 'aactivated_default',
    storeStatus: 'active',
    enableRepPortalLogin: true,
    setupNote: row.brand_style_notes || '',
  };
}

function DetailGrid({ rows }: { rows: Array<[string, string | null | undefined]> }) {
  return (
    <div style={{ display: 'grid', gap: 4 }}>
      {rows.map(([label, value]) => (
        <div className="detail-row" key={label}>
          <span className="detail-label">{label}</span>
          <span className="detail-value">{value || '-'}</span>
        </div>
      ))}
    </div>
  );
}

function ProductList({ products, emptyText = 'No products selected.' }: { products: RepStoreIntakeProduct[]; emptyText?: string }) {
  if (products.length === 0) return <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>{emptyText}</div>;

  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Suggested</th>
            <th>Requested</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product, index) => (
            <tr key={`${product.product_name}-${index}`}>
              <td>
                <div style={{ fontWeight: 800, color: 'var(--navy)' }}>{product.product_name}</div>
                {product.category && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{product.category}</div>}
              </td>
              <td>{formatMoney(product.suggested_retail_price)}</td>
              <td>{formatMoney(product.requested_retail_price)}</td>
              <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{product.notes || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ApprovalBadge({ status }: { status: string }) {
  const className = status === 'approved'
    ? 'badge-success'
    : status === 'rejected'
      ? 'badge-error'
      : status === 'more_info_requested'
        ? 'badge-warning'
        : 'badge-info';
  return <span className={`badge ${className}`}>{approvalStatusLabel(status)}</span>;
}

function statusLabel(status: RepStoreIntakeStatus): string {
  if (status === 'new') return 'Pending';
  if (status === 'ready_to_build') return 'Approved - Ready to Build';
  if (status === 'launched') return 'Launched';
  return status.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
}

function approvalStatusLabel(status: string): string {
  if (status === 'pending') return 'Pending';
  if (status === 'approved') return 'Approved';
  if (status === 'rejected') return 'Rejected';
  if (status === 'more_info_requested') return 'More Info Requested';
  return status.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
}

function statusToApprovalStatus(status: RepStoreIntakeStatus): string {
  if (status === 'ready_to_build' || status === 'launched') return 'approved';
  if (status === 'rejected') return 'rejected';
  if (status === 'more_info_requested') return 'more_info_requested';
  return 'pending';
}

function isReviewBucket(value: string | null): value is ReviewBucket {
  return REVIEW_BUCKETS.includes(value as ReviewBucket);
}

function defaultReviewNote(status: RepStoreIntakeStatus, adminName: string): string {
  const action = status === 'ready_to_build'
    ? 'Approved for next-step rep setup.'
    : status === 'more_info_requested'
      ? 'More information requested before approval.'
      : status === 'rejected'
        ? 'Rejected after admin review.'
        : `Updated to ${statusLabel(status)}.`;
  return `${action} Reviewed by ${adminName}.`;
}

function buildRepCode(row: RepStoreIntakeSubmission): string {
  const base = row.desired_rep_code || row.store_brand_name || row.full_name || 'AACTIVATEDREP';
  const normalized = normalizeRepSlug(base);
  return normalized || 'AACTIVATEDREP';
}

function normalizeRepSlug(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 24);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatMoney(value?: number | null): string {
  return typeof value === 'number' ? `$${value.toFixed(0)}` : '-';
}

async function invokeAuthenticatedAdminFunction(name: string, body: Record<string, unknown>): Promise<{ data: AdminFunctionResponse | null; error: unknown }> {
  const client = supabase!;
  const { data: refreshed, error: refreshError } = await client.auth.refreshSession();
  const accessToken = refreshed.session?.access_token;
  if (refreshError || !accessToken) {
    return {
      data: { error: 'Your admin session expired. Sign in again, then retry this action.' },
      error: refreshError ?? new Error('Admin session expired'),
    };
  }
  return client.functions.invoke<AdminFunctionResponse>(name, {
    body,
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

async function edgeFunctionErrorMessage(error: unknown, serverMessage: unknown, fallback: string) {
  if (typeof serverMessage === 'string' && serverMessage.trim()) return serverMessage;
  const context = (error as { context?: Response } | null)?.context;
  if (context && typeof context.clone === 'function') {
    try {
      const body = await context.clone().json() as { error?: unknown };
      if (typeof body.error === 'string' && body.error.trim()) return body.error;
    } catch {
      // Fall through to the SDK message when the response is not JSON.
    }
  }
  const sdkMessage = (error as { message?: unknown } | null)?.message;
  return typeof sdkMessage === 'string' && sdkMessage !== 'Edge Function returned a non-2xx status code'
    ? sdkMessage
    : fallback;
}
