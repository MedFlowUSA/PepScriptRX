import { useEffect, useState } from 'react';
import DashLayout from '../../components/layout/DashLayout';
import { supabase } from '../../lib/supabase';
import { STATUS_LABELS, STATUS_COLORS } from '../../data/products';
import type { Product, ProductStatus } from '../../data/products';
import { ADMIN_NAV } from './adminNav';
import { getProductMetadata, productOrderLabel } from '../../lib/productMetadata';

interface EditForm {
  price: string;
  status: ProductStatus;
  display_note: string;
  customer_visible: boolean;
  sellable: boolean;
  allow_special_order: boolean;
  estimated_fulfillment_days: string;
}

export default function AdminProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ price: '', status: 'active', display_note: '', customer_visible: true, sellable: true, allow_special_order: true, estimated_fulfillment_days: '14' });
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  async function loadProducts() {
    if (!supabase) { setLoading(false); return; }
    const { data } = await supabase
      .from('products')
      .select('*')
      .order('sort_order', { ascending: true });
    setProducts((data as Product[]) ?? []);
    setLoading(false);
  }

  function startEdit(product: Product) {
    setEditing(product.id);
    setEditForm({
      price: product.price.toString(),
      status: product.status,
      display_note: product.display_note ?? '',
      customer_visible: product.customer_visible ?? !['hidden', 'inactive'].includes(product.status),
      sellable: product.sellable ?? !['hidden', 'inactive'].includes(product.status),
      allow_special_order: product.allow_special_order ?? true,
      estimated_fulfillment_days: String(product.estimated_fulfillment_days ?? 14),
    });
  }

  function cancelEdit() {
    setEditing(null);
  }

  async function saveEdit(productId: string) {
    const newPrice = parseFloat(editForm.price);
    if (isNaN(newPrice) || newPrice < 0) return;
    setSaving(true);
    const displayNote = editForm.display_note.trim() || undefined;
    const patch = {
      price: newPrice,
      status: editForm.status,
      display_note: displayNote,
      active: !['hidden', 'inactive'].includes(editForm.status),
      customer_visible: editForm.customer_visible && !['hidden', 'inactive'].includes(editForm.status),
      sellable: editForm.sellable && !['hidden', 'inactive'].includes(editForm.status),
      allow_special_order: editForm.allow_special_order,
      estimated_fulfillment_days: parseInt(editForm.estimated_fulfillment_days, 10) || 14,
    };
    const { error } = await supabase!
      .from('products')
      .update({ ...patch, display_note: displayNote ?? null })
      .eq('id', productId);
    if (!error) {
      setProducts((prev) => prev.map((p) => p.id === productId ? { ...p, ...patch } : p));
      setEditing(null);
      showFlash('Saved.');
    } else {
      showFlash('Save failed: ' + error.message);
    }
    setSaving(false);
  }

  function showFlash(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 3000);
  }

  function buildScript(prods: Product[]) {
    const activeList = prods
      .filter((p) => p.status === 'active' || p.status === 'active_addon' || p.status === 'manual_review' || p.status === 'physician_review')
      .map((p) => `${productOrderLabel({ id: p.id, name: p.name })} for $${p.price}`)
      .join(', ');
    return `PepScriptRX offers cash-pay refill support for eligible patients. Current listed options include ${activeList}. Eligibility, availability, and fulfillment are subject to review.`;
  }

  async function copyScript() {
    await navigator.clipboard.writeText(buildScript(products));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const active = products.filter((p) => p.status === 'active' || p.status === 'active_addon');
  const review = products.filter((p) => p.status === 'manual_review' || p.status === 'physician_review');
  const other  = products.filter((p) => p.status === 'hidden' || p.status === 'inactive');

  return (
    <DashLayout title="Products & Pricing" navItems={ADMIN_NAV}>
      {flash && (
        <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success)', color: 'var(--success)', borderRadius: 'var(--radius-sm)', padding: '10px 16px', marginBottom: 16, fontSize: 14, fontWeight: 600 }}>
          {flash}
        </div>
      )}

      {loading ? (
        <div style={{ padding: 64, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      ) : (
        <>
          {/* Stats */}
          <div className="stats-grid mb-8">
            <div className="stat-card">
              <div className="stat-value">{active.length}</div>
              <div className="stat-label">Active products</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{review.length}</div>
              <div className="stat-label">Review-gated</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{other.length}</div>
              <div className="stat-label">Hidden / inactive</div>
            </div>
          </div>

          {/* Product table */}
          <div className="card mb-6">
            <div className="card-header" style={{ paddingBottom: 16 }}>
              <div className="card-title">Product Catalog</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Changes save to the database and take effect immediately on the intake form and pricing page.</div>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Product</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Visibility</th>
                    <th>Display Note</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const metadata = getProductMetadata({ id: product.id, name: product.name });
                    return (
                    <tr key={product.id}>
                      <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{product.sort_order}</td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{metadata.commonName}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Technical: {metadata.technicalName}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Dose: {metadata.doseLabel}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>{product.id}</div>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{product.category}</td>
                      <td>
                        {editing === product.id ? (
                          <input
                            type="number"
                            className="form-input"
                            style={{ width: 90, padding: '4px 8px', fontSize: 13 }}
                            value={editForm.price}
                            step="0.01"
                            min="0"
                            onChange={(e) => setEditForm({ ...editForm, price: e.target.value })}
                          />
                        ) : (
                          <span style={{ fontWeight: 700, fontSize: 15 }}>${product.price}</span>
                        )}
                      </td>
                      <td>
                        {editing === product.id ? (
                          <select
                            className="form-select"
                            style={{ fontSize: 13, padding: '4px 8px' }}
                            value={editForm.status}
                            onChange={(e) => setEditForm({ ...editForm, status: e.target.value as ProductStatus })}
                          >
                            {(Object.keys(STATUS_LABELS) as ProductStatus[]).map((s) => (
                              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`badge ${STATUS_COLORS[product.status]}`}>{STATUS_LABELS[product.status]}</span>
                        )}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)', minWidth: 170 }}>
                        {editing === product.id ? (
                          <div style={{ display: 'grid', gap: 6 }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <input type="checkbox" checked={editForm.customer_visible} onChange={(e) => setEditForm({ ...editForm, customer_visible: e.target.checked })} />
                              Customer visible
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <input type="checkbox" checked={editForm.sellable} onChange={(e) => setEditForm({ ...editForm, sellable: e.target.checked })} />
                              Sellable
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <input type="checkbox" checked={editForm.allow_special_order} onChange={(e) => setEditForm({ ...editForm, allow_special_order: e.target.checked })} />
                              Special order
                            </label>
                            <input
                              type="number"
                              className="form-input"
                              style={{ width: 90, padding: '4px 8px', fontSize: 13 }}
                              value={editForm.estimated_fulfillment_days}
                              min="1"
                              onChange={(e) => setEditForm({ ...editForm, estimated_fulfillment_days: e.target.value })}
                              aria-label="Estimated fulfillment days"
                            />
                          </div>
                        ) : (
                          <div style={{ display: 'grid', gap: 4 }}>
                            <span className={`badge ${(product.customer_visible ?? true) && (product.sellable ?? true) ? 'badge-success' : 'badge-default'}`}>
                              {(product.customer_visible ?? true) && (product.sellable ?? true) ? 'Sellable' : 'Hidden'}
                            </span>
                            {(product.allow_special_order ?? true) && <span>Special order allowed</span>}
                            <span>{product.estimated_fulfillment_days ?? 14} day estimate</span>
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)', maxWidth: 200 }}>
                        {editing === product.id ? (
                          <input
                            type="text"
                            className="form-input"
                            style={{ width: '100%', padding: '4px 8px', fontSize: 13 }}
                            placeholder="Optional note shown to patients"
                            value={editForm.display_note}
                            onChange={(e) => setEditForm({ ...editForm, display_note: e.target.value })}
                          />
                        ) : (
                          product.display_note || '—'
                        )}
                      </td>
                      <td>
                        {editing === product.id ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => saveEdit(product.id)}
                              disabled={saving}
                            >
                              {saving ? '...' : 'Save'}
                            </button>
                            <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>✕</button>
                          </div>
                        ) : (
                          <button className="btn btn-ghost btn-sm" onClick={() => startEdit(product)}>Edit</button>
                        )}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* AI Receptionist Script — auto-generated from live prices */}
          <div className="card">
            <div className="card-header" style={{ paddingBottom: 12 }}>
              <div className="card-title">AI Receptionist Script</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Auto-generated from live pricing. Copy into your AI phone system knowledge base.</div>
            </div>
            <div className="card-body">
              <div
                style={{
                  background: 'var(--card-soft)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '16px 18px',
                  fontSize: 14,
                  lineHeight: 1.7,
                  color: 'var(--navy)',
                  marginBottom: 14,
                }}
              >
                {buildScript(products)}
              </div>
              <button className="btn btn-outline btn-sm" onClick={copyScript}>
                {copied ? '✓ Copied!' : 'Copy to Clipboard'}
              </button>
            </div>
          </div>
        </>
      )}
    </DashLayout>
  );
}
