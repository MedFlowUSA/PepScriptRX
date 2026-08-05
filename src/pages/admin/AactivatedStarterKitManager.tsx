import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { AACTIVATED_STARTER_KITS } from '../../lib/aactivatedStarterKits';
import type { Rep } from '../../types';

type PackageRow = {
  package_id: string;
  package_name: string;
  promo_label: string | null;
  retail_value: number;
  promo_price: number;
  savings: number;
  purchase_limit: number;
  enabled: boolean;
  updated_at: string;
};

type KitOrderRow = {
  id: string;
  submission_id: string;
  package_id: string;
  variation_id: string | null;
  package_name: string;
  variation_name: string | null;
  rep_slug: string | null;
  rep_name: string | null;
  rep_email: string | null;
  promo_price: number;
  payment_status: string;
  fulfillment_status: string;
  completed_at: string | null;
  created_at: string;
};

type AvailabilityRow = {
  package_id: string;
  variation_id: string | null;
  components: Array<{ sku: string; name: string; quantity: number; current_qty: number; active: boolean }> | null;
  is_available: boolean;
  message: string;
};

type PackageDraft = {
  retail_value: string;
  promo_price: string;
  savings: string;
  purchase_limit: string;
  enabled: boolean;
};

type Props = {
  reps: Rep[];
  onMessage?: (message: string) => void;
};

export default function AactivatedStarterKitManager({ reps, onMessage }: Props) {
  const [packages, setPackages] = useState<PackageRow[]>([]);
  const [orders, setOrders] = useState<KitOrderRow[]>([]);
  const [availability, setAvailability] = useState<AvailabilityRow[]>([]);
  const [drafts, setDrafts] = useState<Record<string, PackageDraft>>({});
  const [selectedRep, setSelectedRep] = useState('');
  const [selectedPackage, setSelectedPackage] = useState('starter-experience-kit');
  const [overrideReason, setOverrideReason] = useState('Admin reopened starter-kit eligibility.');
  const [savingId, setSavingId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    if (!supabase) return;
    setError('');
    const [{ data: packageData, error: packageError }, { data: orderData, error: orderError }, { data: availabilityData, error: availabilityError }] = await Promise.all([
      supabase.from('aactivated_starter_kit_packages').select('*').order('sort_order', { ascending: true }),
      supabase.from('aactivated_starter_kit_orders').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.rpc('get_aactivated_starter_kit_availability'),
    ]);
    const anyError = packageError || orderError || availabilityError;
    if (anyError) setError(anyError.message);
    const nextPackages = (packageData as PackageRow[] | null) ?? [];
    setPackages(nextPackages);
    setOrders((orderData as KitOrderRow[] | null) ?? []);
    setAvailability(((availabilityData as AvailabilityRow[] | null) ?? []).map((row) => ({
      ...row,
      components: Array.isArray(row.components) ? row.components : [],
    })));
    setDrafts(Object.fromEntries(nextPackages.map((row) => [row.package_id, draftFromPackage(row)])));
  }

  const repsById = useMemo(() => new Map(reps.map((rep) => [rep.id, rep])), [reps]);

  function updateDraft(packageId: string, patch: Partial<PackageDraft>) {
    setDrafts({ ...drafts, [packageId]: { ...(drafts[packageId] ?? draftFromPackage(packages.find((row) => row.package_id === packageId))), ...patch } });
  }

  async function savePackage(row: PackageRow) {
    if (!supabase) return;
    const draft = drafts[row.package_id] ?? draftFromPackage(row);
    setSavingId(row.package_id);
    setError('');
    const { error: saveError } = await supabase
      .from('aactivated_starter_kit_packages')
      .update({
        retail_value: Number(draft.retail_value),
        promo_price: Number(draft.promo_price),
        savings: Number(draft.savings),
        purchase_limit: Number(draft.purchase_limit),
        enabled: draft.enabled,
      })
      .eq('package_id', row.package_id);
    setSavingId('');
    if (saveError) {
      setError(saveError.message);
      return;
    }
    onMessage?.(`${row.package_name} updated.`);
    await load();
  }

  async function createOverride() {
    if (!supabase || !selectedRep) return;
    const rep = repsById.get(selectedRep);
    if (!rep) return;
    setError('');
    const { error: saveError } = await supabase.from('aactivated_starter_kit_eligibility_overrides').insert({
      rep_profile_id: rep.profile_id,
      rep_id: rep.id,
      package_id: selectedPackage || null,
      override_type: 'reopen',
      reason: overrideReason,
      active: true,
    });
    if (saveError) {
      setError(saveError.message);
      return;
    }
    onMessage?.(`${rep.rep_name || rep.rep_slug} can repurchase the selected starter kit.`);
  }

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      {error && <div className="alert alert-error">{error}</div>}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Rep Starter Kit Manager</div>
            <div className="card-subtitle">Package pricing, availability, purchase limits, and internal rep-kit order visibility.</div>
          </div>
          <a className="btn btn-outline btn-sm" href="/aactivated/rep/starter-kits" target="_blank" rel="noreferrer">Open Private Link</a>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Package</th>
                <th>Price Controls</th>
                <th>Limit</th>
                <th>Inventory</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {packages.map((row) => {
                const draft = drafts[row.package_id] ?? draftFromPackage(row);
                const availabilityRows = availability.filter((item) => item.package_id === row.package_id);
                const staticKit = AACTIVATED_STARTER_KITS.find((kit) => kit.packageId === row.package_id);
                return (
                  <tr key={row.package_id}>
                    <td>
                      <strong>{row.package_name}</strong>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{row.promo_label || staticKit?.label}</div>
                    </td>
                    <td>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(80px, 1fr))', gap: 8 }}>
                        <MoneyInput label="Retail" value={draft.retail_value} onChange={(value) => updateDraft(row.package_id, { retail_value: value })} />
                        <MoneyInput label="Rep price" value={draft.promo_price} onChange={(value) => updateDraft(row.package_id, { promo_price: value })} />
                        <MoneyInput label="Savings" value={draft.savings} onChange={(value) => updateDraft(row.package_id, { savings: value })} />
                      </div>
                    </td>
                    <td>
                      <input className="form-input" type="number" min="0" value={draft.purchase_limit} onChange={(event) => updateDraft(row.package_id, { purchase_limit: event.target.value })} />
                    </td>
                    <td>
                      {availabilityRows.map((item) => (
                        <div key={`${item.package_id}-${item.variation_id ?? 'base'}`} style={{ fontSize: 12, marginBottom: 8 }}>
                          <strong>{item.variation_id ? item.variation_id.toUpperCase() : 'Base'}</strong>
                          <span className={item.is_available ? 'badge badge-success' : 'badge badge-warning'} style={{ marginLeft: 6 }}>{item.is_available ? 'Ready' : 'Needs stock'}</span>
                          <div style={{ color: 'var(--text-muted)', marginTop: 4 }}>
                            {(item.components ?? []).map((component) => `${component.name} x${component.quantity} (${component.current_qty})`).join(', ')}
                          </div>
                        </div>
                      ))}
                    </td>
                    <td>
                      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <input type="checkbox" checked={draft.enabled} onChange={(event) => updateDraft(row.package_id, { enabled: event.target.checked })} />
                        {draft.enabled ? 'Enabled' : 'Disabled'}
                      </label>
                    </td>
                    <td>
                      <button className="btn btn-primary btn-sm" type="button" disabled={savingId === row.package_id} onClick={() => savePackage(row)}>
                        {savingId === row.package_id ? 'Saving...' : 'Save'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Eligibility Overrides</div>
            <div className="card-subtitle">Reopen a package for one rep after review. Overrides are audited in the starter-kit tables.</div>
          </div>
        </div>
        <div className="card-body" style={{ display: 'grid', gap: 12 }}>
          <div className="form-grid-3">
            <label className="form-group">
              <span className="form-label">Rep</span>
              <select className="form-select" value={selectedRep} onChange={(event) => setSelectedRep(event.target.value)}>
                <option value="">Select rep</option>
                {reps.filter((rep) => rep.rep_slug !== 'GUY60').map((rep) => (
                  <option key={rep.id} value={rep.id}>{rep.rep_name || rep.rep_slug} ({rep.rep_slug})</option>
                ))}
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Package</span>
              <select className="form-select" value={selectedPackage} onChange={(event) => setSelectedPackage(event.target.value)}>
                {packages.map((row) => <option key={row.package_id} value={row.package_id}>{row.package_name}</option>)}
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Reason</span>
              <input className="form-input" value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} />
            </label>
          </div>
          <button className="btn btn-outline" type="button" disabled={!selectedRep} onClick={createOverride}>Create Reopen Override</button>
        </div>
      </div>

      <SimpleOrdersTable orders={orders} />
    </div>
  );
}

function draftFromPackage(row?: PackageRow): PackageDraft {
  return {
    retail_value: String(row?.retail_value ?? 0),
    promo_price: String(row?.promo_price ?? 0),
    savings: String(row?.savings ?? 0),
    purchase_limit: String(row?.purchase_limit ?? 1),
    enabled: row?.enabled ?? true,
  };
}

function MoneyInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="form-group" style={{ margin: 0 }}>
      <span className="form-label">{label}</span>
      <input className="form-input" type="number" min="0" step="0.01" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function SimpleOrdersTable({ orders }: { orders: KitOrderRow[] }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Starter Kit Orders</div>
          <div className="card-subtitle">Internal rep starter-kit orders remain separate from normal AACTIVATED customer orders.</div>
        </div>
      </div>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr><th>Rep</th><th>Package</th><th>Payment</th><th>Fulfillment</th><th>Price</th><th>Created</th></tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text-muted)' }}>No starter-kit orders yet.</td></tr>
            ) : orders.map((order) => (
              <tr key={order.id}>
                <td><strong>{order.rep_name || order.rep_slug}</strong><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{order.rep_email}</div></td>
                <td>{order.package_name}<div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{order.variation_name || order.variation_id || 'Base kit'}</div></td>
                <td><span className={order.payment_status === 'paid' ? 'badge badge-success' : order.payment_status === 'payment_exception' ? 'badge badge-error' : 'badge badge-warning'}>{order.payment_status}</span></td>
                <td>{order.fulfillment_status}</td>
                <td>${Number(order.promo_price ?? 0).toFixed(2)}</td>
                <td>{new Date(order.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
