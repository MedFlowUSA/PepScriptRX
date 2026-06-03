import { useEffect, useMemo, useState } from 'react';
import DashLayout from '../../components/layout/DashLayout';
import { supabase } from '../../lib/supabase';
import type { RepStoreIntakeProduct, RepStoreIntakeStatus, RepStoreIntakeSubmission } from '../../types';
import { ADMIN_NAV, RX_PLUS_ADMIN_NAV } from './adminNav';
import { useAuth } from '../../context/AuthContext';

const STATUS_OPTIONS: RepStoreIntakeStatus[] = [
  'new',
  'reviewing',
  'logo_needed',
  'pricing_review',
  'ready_to_build',
  'launched',
  'rejected',
];

export default function AdminRepIntake() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<RepStoreIntakeSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusDraft, setStatusDraft] = useState<RepStoreIntakeStatus>('new');
  const [notesDraft, setNotesDraft] = useState('');

  const selected = useMemo(() => rows.find((row) => row.id === selectedId) ?? rows[0] ?? null, [rows, selectedId]);
  const navItems = profile?.role === 'rx_plus_admin' ? RX_PLUS_ADMIN_NAV : ADMIN_NAV;

  function selectSubmission(row: RepStoreIntakeSubmission) {
    selectSubmissionDrafts(row, setSelectedId, setStatusDraft, setNotesDraft);
  }

  useEffect(() => {
    loadRows();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.role]);

  async function loadRows() {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase
      .from('rep_store_intake_submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (loadError) {
      setError(loadError.message);
    } else {
      const allRows = (data as RepStoreIntakeSubmission[]) ?? [];
      const nextRows = profile?.role === 'rx_plus_admin'
        ? allRows.filter(isAactivatedIntake)
        : allRows;
      setRows(nextRows);
      const nextSelected = nextRows.find((row) => row.id === selectedId) ?? nextRows[0] ?? null;
      if (nextSelected) selectSubmission(nextSelected);
    }
    setLoading(false);
  }

  async function saveSelected() {
    if (!supabase || !selected) return;
    setSaving(true);
    setError('');
    const { error: saveError } = await supabase
      .from('rep_store_intake_submissions')
      .update({
        status: statusDraft,
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

  const counts = STATUS_OPTIONS.reduce<Record<string, number>>((acc, status) => {
    acc[status] = rows.filter((row) => row.status === status).length;
    return acc;
  }, {});

  return (
    <DashLayout title="Rep Intake Submissions" navItems={navItems}>
      <div className="stats-grid mb-8">
        <div className="stat-card">
          <div className="stat-value">{rows.length}</div>
          <div className="stat-label">{profile?.role === 'rx_plus_admin' ? 'AACTIVATED intakes' : 'Total intakes'}</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--info)' }}>{counts.new ?? 0}</div>
          <div className="stat-label">New</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--warning)' }}>{(counts.pricing_review ?? 0) + (counts.logo_needed ?? 0)}</div>
          <div className="stat-label">Needs review</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--success)' }}>{counts.launched ?? 0}</div>
          <div className="stat-label">Launched</div>
        </div>
      </div>

      {error && <div className="alert alert-error mb-4">{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, .9fr) minmax(0, 1.4fr)', gap: 18, alignItems: 'start' }} className="rep-intake-admin-grid">
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Submissions</div>
              <div className="card-subtitle">Newest first</div>
            </div>
            <button className="btn btn-outline btn-sm" onClick={loadRows}>Refresh</button>
          </div>
          <div className="card-body" style={{ display: 'grid', gap: 10 }}>
            {loading ? (
              <div className="loading-inline"><div className="spinner" />Loading intake submissions...</div>
            ) : rows.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-title">No intakes yet</div>
                <div className="empty-state-desc">
                  {profile?.role === 'rx_plus_admin' ? 'AACTIVATED rep approval requests will appear here.' : 'Public submissions from /rep-intake will appear here.'}
                </div>
              </div>
            ) : rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => selectSubmission(row)}
                className={`rep-intake-admin-list-item ${selected?.id === row.id ? 'active' : ''}`}
              >
                <span>
                  <strong>{row.store_brand_name}</strong>
                  <small>{row.full_name} - {row.email}</small>
                  {isAactivatedIntake(row) && <small>AACTIVATED rep approval</small>}
                </span>
                <StatusBadge status={row.status} />
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
                <StatusBadge status={selected.status} />
              </div>
              <div className="card-body" style={{ display: 'grid', gap: 22 }}>
                <section>
                  <div className="detail-section-title">Contact and Store</div>
                  <DetailGrid rows={[
                    ['Intake source', isAactivatedIntake(selected) ? 'AACTIVATED rep approval route' : 'PepScriptRX intake'],
                    ['Full name', selected.full_name],
                    ['Email', selected.email],
                    ['Phone', selected.phone],
                    ['Store type', selected.store_type],
                    ['Parent rep/admin', selected.parent_rep_or_admin_name],
                    ['Desired rep code', selected.desired_rep_code],
                    ['PayPal account', selected.paypal_account],
                  ]} />
                </section>

                <section>
                  <div className="detail-section-title">{isAactivatedIntake(selected) ? 'Approval Notes' : 'Branding'}</div>
                  {isAactivatedIntake(selected) ? (
                    <DetailGrid rows={[
                      ['Requested upload/profile link', selected.preferred_color_1],
                      ['Approval notes', selected.brand_style_notes],
                      ['Portal/product choice', 'Locked until account is approved'],
                      ['White-label option', 'Not available for AACTIVATED rep intake'],
                    ]} />
                  ) : (
                    <DetailGrid rows={[
                      ['Logo needed', selected.logo_needed],
                      ['Preferred colors', [selected.preferred_color_1, selected.preferred_color_2, selected.preferred_color_3].filter(Boolean).join(', ')],
                      ['Style notes', selected.brand_style_notes],
                    ]} />
                  )}
                </section>

                {isAactivatedIntake(selected) ? (
                  <section>
                    <div className="detail-section-title">Product Portal</div>
                    <div className="alert alert-info">
                      Product catalog selection and public rep route setup should happen only after this AACTIVATED rep request is approved.
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

                <section>
                  <div className="detail-section-title">Admin Review</div>
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
    </DashLayout>
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

function isAactivatedIntake(row: RepStoreIntakeSubmission): boolean {
  const haystack = [
    row.internal_notes,
    row.parent_rep_or_admin_name,
    row.store_type,
    row.store_brand_name,
  ].filter(Boolean).join(' ').toUpperCase();
  return haystack.includes('AACTIVATED');
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

function StatusBadge({ status }: { status: RepStoreIntakeStatus }) {
  const className = status === 'launched'
    ? 'badge-success'
    : status === 'rejected'
      ? 'badge-error'
      : status === 'new'
        ? 'badge-info'
        : 'badge-warning';
  return <span className={`badge ${className}`}>{statusLabel(status)}</span>;
}

function statusLabel(status: RepStoreIntakeStatus): string {
  return status.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
}

function formatDate(value: string): string {
  return new Date(value).toLocaleString([], { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function formatMoney(value?: number | null): string {
  return typeof value === 'number' ? `$${value.toFixed(0)}` : '-';
}
