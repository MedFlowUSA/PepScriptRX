import { useEffect, useMemo, useState } from 'react';
import DashLayout from '../../components/layout/DashLayout';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { ADMIN_NAV } from './adminNav';
import { computeInventoryStatus } from '../../lib/inventoryStatus';

interface InventoryItem {
  id: string;
  sku: string;
  product_name: string;
  strength: string | null;
  batch_no: string | null;
  starting_qty: number;
  current_qty: number;
  base_total_cost: number;
  base_cost_per_vial: number;
  allocated_shipping_per_vial: number;
  allocated_label_per_vial: number;
  true_landed_cost_per_vial: number;
  retail_price: number | null;
  reorder_level: number;
  low_stock_threshold: number;
  stock_status: string | null;
  allow_special_order: boolean;
  estimated_fulfillment_days: number;
  customer_visible: boolean;
  sellable: boolean;
  admin_manageable: boolean;
  inventory_source: string | null;
  parent_product_id: string | null;
  active: boolean;
  notes: string | null;
}

interface SalesLogEntry {
  id: string;
  sold_at: string;
  order_number: string | null;
  sku: string | null;
  product_name: string | null;
  qty_sold: number;
  unit_cost: number;
  revenue: number;
  rep_code: string | null;
  payment_processing_fee: number;
  shipping_subsidy: number;
  ad_spend: number;
  refund_amount: number;
  profit: number;
}

const BLANK_ITEM: Omit<InventoryItem, 'id'> = {
  sku: '',
  product_name: '',
  strength: '',
  batch_no: '',
  starting_qty: 0,
  current_qty: 0,
  base_total_cost: 0,
  base_cost_per_vial: 0,
  allocated_shipping_per_vial: 1.5,
  allocated_label_per_vial: 0.5,
  true_landed_cost_per_vial: 0,
  retail_price: null,
  reorder_level: 3,
  low_stock_threshold: 3,
  stock_status: null,
  allow_special_order: true,
  estimated_fulfillment_days: 14,
  customer_visible: true,
  sellable: true,
  admin_manageable: true,
  inventory_source: 'main',
  parent_product_id: null,
  active: true,
  notes: null,
};

function money(v: number | null | undefined) {
  return `$${Number(v ?? 0).toFixed(2)}`;
}
function marginDollars(item: InventoryItem) {
  return Number(item.retail_price ?? 0) - Number(item.true_landed_cost_per_vial ?? 0);
}
function marginPercent(item: InventoryItem) {
  const retail = Number(item.retail_price ?? 0);
  if (!retail) return 0;
  return (marginDollars(item) / retail) * 100;
}

export default function AdminInventory() {
  const { profile } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [sales, setSales] = useState<SalesLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Modals
  const [itemModal, setItemModal] = useState<'add' | 'edit' | null>(null);
  const [editTarget, setEditTarget] = useState<InventoryItem | null>(null);
  const [itemForm, setItemForm] = useState<Omit<InventoryItem, 'id'>>(BLANK_ITEM);

  const [adjModal, setAdjModal] = useState(false);
  const [adjTarget, setAdjTarget] = useState<InventoryItem | null>(null);
  const [adjQty, setAdjQty] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [adjNotes, setAdjNotes] = useState('');

  const [logModal, setLogModal] = useState(false);
  const [logForm, setLogForm] = useState({
    sku: '', product_name: '', qty_sold: '1', revenue: '', unit_cost: '',
    rep_code: '', payment_processing_fee: '0', shipping_subsidy: '0',
    ad_spend: '0', refund_amount: '0', order_number: '',
  });

  useEffect(() => { load(); }, []);

  async function load() {
    if (!supabase) { setLoading(false); return; }
    setError('');
    const [inv, sl] = await Promise.all([
      supabase.from('inventory_items').select('*').order('sku'),
      supabase.from('sales_log').select('*').order('sold_at', { ascending: false }).limit(50),
    ]);
    if (inv.error) setError(inv.error.message);
    if (sl.error) setError(sl.error.message);
    setItems((inv.data as InventoryItem[]) ?? []);
    setSales((sl.data as SalesLogEntry[]) ?? []);
    setLoading(false);
  }

  function flash(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  }

  /* ── Item CRUD ── */
  function openAdd() {
    setItemForm({ ...BLANK_ITEM });
    setEditTarget(null);
    setItemModal('add');
  }

  function openEdit(item: InventoryItem) {
    setItemForm({
      ...item,
      low_stock_threshold: item.low_stock_threshold ?? item.reorder_level ?? 3,
      stock_status: item.stock_status ?? null,
      allow_special_order: item.allow_special_order ?? true,
      estimated_fulfillment_days: item.estimated_fulfillment_days ?? 14,
      customer_visible: item.customer_visible ?? true,
      sellable: item.sellable ?? true,
      admin_manageable: item.admin_manageable ?? true,
      inventory_source: item.inventory_source ?? 'main',
      parent_product_id: item.parent_product_id ?? null,
    });
    setEditTarget(item);
    setItemModal('edit');
  }

  async function saveItem() {
    if (!supabase) return;
    setSaving(true);
    const landed =
      Number(itemForm.base_cost_per_vial) +
      Number(itemForm.allocated_shipping_per_vial) +
      Number(itemForm.allocated_label_per_vial);
    const payload = {
      ...itemForm,
      true_landed_cost_per_vial: landed,
      starting_qty: itemModal === 'add' ? Number(itemForm.current_qty) : itemForm.starting_qty,
      reorder_level: Number(itemForm.low_stock_threshold ?? itemForm.reorder_level ?? 3),
      low_stock_threshold: Number(itemForm.low_stock_threshold ?? itemForm.reorder_level ?? 3),
    };

    let err;
    if (itemModal === 'add') {
      ({ error: err } = await supabase.from('inventory_items').insert(payload));
    } else if (editTarget) {
      ({ error: err } = await supabase.from('inventory_items').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editTarget.id));
    }
    setSaving(false);
    if (err) { setError(err.message); return; }
    setItemModal(null);
    flash(itemModal === 'add' ? 'Item added successfully.' : 'Item updated.');
    load();
  }

  async function deleteItem(item: InventoryItem) {
    if (!supabase) return;
    const confirmed = window.confirm(`Permanently remove ${item.sku} - ${item.product_name} from Admin Inventory? This cannot be undone.`);
    if (!confirmed) return;

    setSaving(true);
    setError('');
    const { error: err } = await supabase
      .from('inventory_items')
      .delete()
      .eq('id', item.id);
    setSaving(false);

    if (err) {
      setError(err.message);
      return;
    }

    flash(`${item.sku} removed from inventory.`);
    load();
  }

  /* ── Quantity adjustment ── */
  function openAdj(item: InventoryItem) {
    setAdjTarget(item);
    setAdjQty('');
    setAdjReason('');
    setAdjNotes('');
    setAdjModal(true);
  }

  async function saveAdj() {
    if (!supabase || !adjTarget) return;
    const qty = parseInt(adjQty, 10);
    if (isNaN(qty) || qty === 0) { setError('Enter a non-zero quantity (use negative for removals).'); return; }
    if (!adjReason.trim()) { setError('Reason is required.'); return; }
    setSaving(true);
    const newQty = adjTarget.current_qty + qty;
    const stockStatus = newQty <= 0
      ? 'out_of_stock'
      : newQty <= Number(adjTarget.low_stock_threshold ?? adjTarget.reorder_level ?? 3)
        ? 'low_stock'
        : 'in_stock';
    const [updRes, logRes] = await Promise.all([
      supabase.from('inventory_items').update({ current_qty: newQty, stock_status: stockStatus, updated_at: new Date().toISOString() }).eq('id', adjTarget.id),
      supabase.from('inventory_adjustments').insert({
        inventory_item_id: adjTarget.id,
        actor_profile_id: profile?.id ?? null,
        adjustment_qty: qty,
        reason: adjReason.trim(),
        notes: adjNotes.trim() || null,
      }),
    ]);
    setSaving(false);
    if (updRes.error) { setError(updRes.error.message); return; }
    if (logRes.error) { setError(logRes.error.message); return; }
    setAdjModal(false);
    flash(`Quantity adjusted by ${qty > 0 ? '+' : ''}${qty}. New qty: ${newQty}.`);
    load();
  }

  /* ── Log sale ── */
  async function saveLog() {
    if (!supabase) return;
    setSaving(true);
    const { error: err } = await supabase.from('sales_log').insert({
      sku: logForm.sku || null,
      product_name: logForm.product_name || null,
      qty_sold: parseInt(logForm.qty_sold) || 1,
      revenue: parseFloat(logForm.revenue) || 0,
      unit_cost: parseFloat(logForm.unit_cost) || 0,
      rep_code: logForm.rep_code || null,
      payment_processing_fee: parseFloat(logForm.payment_processing_fee) || 0,
      shipping_subsidy: parseFloat(logForm.shipping_subsidy) || 0,
      ad_spend: parseFloat(logForm.ad_spend) || 0,
      refund_amount: parseFloat(logForm.refund_amount) || 0,
      order_number: logForm.order_number || null,
    });
    setSaving(false);
    if (err) { setError(err.message); return; }
    setLogModal(false);
    flash('Sale logged.');
    load();
  }

  const stats = useMemo(() => ({
    totalUnits: items.reduce((s, i) => s + Number(i.current_qty || 0), 0),
    inventoryValue: items.reduce((s, i) => s + Number(i.current_qty || 0) * Number(i.true_landed_cost_per_vial || 0), 0),
    retailValue: items.reduce((s, i) => s + Number(i.current_qty || 0) * Number(i.retail_price || 0), 0),
    lowStock: items.filter((i) => i.current_qty <= i.reorder_level).length,
    salesProfit: sales.reduce((s, e) => s + Number(e.profit || 0), 0),
  }), [items, sales]);

  return (
    <DashLayout title="Inventory & Margins" navItems={ADMIN_NAV}>
      {loading ? (
        <div className="flex items-center justify-center" style={{ padding: 64 }}><div className="spinner" /></div>
      ) : (
        <>
          {error   && <div className="alert alert-error mb-6">{error}</div>}
          {success && <div className="alert alert-success mb-6">{success}</div>}

          {/* Stats */}
          <div className="stats-grid mb-8">
            <div className="stat-card">
              <div className="stat-value">{stats.totalUnits}</div>
              <div className="stat-label">Current vials</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{money(stats.inventoryValue)}</div>
              <div className="stat-label">Landed cost value</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{money(stats.retailValue)}</div>
              <div className="stat-label">Potential retail value</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: stats.lowStock > 0 ? 'var(--warning)' : 'var(--success)' }}>{stats.lowStock}</div>
              <div className="stat-label">Low stock alerts</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--success)' }}>{money(stats.salesProfit)}</div>
              <div className="stat-label">Logged profit</div>
            </div>
          </div>

          {/* Inventory table */}
          <div className="card mb-6">
            <div className="card-header" style={{ paddingBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div className="card-title">Inventory</div>
                <div className="card-subtitle">Live stock levels, landed cost, and margin per SKU.</div>
              </div>
              <button className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Item</button>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th>Stock</th>
                    <th>Base Cost</th>
                    <th>Shipping</th>
                    <th>Label</th>
                    <th>Landed Cost</th>
                    <th>Retail</th>
                    <th>Margin</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={11} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                      No inventory items yet. Click "+ Add Item" to get started.
                    </td></tr>
                  ) : items.map((item) => {
                    const displayStatus = computeInventoryStatus({
                      active: item.active,
                      sellable: item.sellable,
                      customer_visible: item.customer_visible,
                      quantity_on_hand: item.current_qty,
                      low_stock_threshold: item.low_stock_threshold ?? item.reorder_level,
                      stock_status: item.stock_status,
                      allow_special_order: item.allow_special_order,
                      estimated_fulfillment_days: item.estimated_fulfillment_days,
                    });
                    return (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 800, color: 'var(--navy)' }}>{item.sku}</td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{item.product_name}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                            {item.strength || ''}{item.batch_no ? ` · Batch ${item.batch_no}` : ''}
                          </div>
                        </td>
                        <td>
                          <strong style={{ color: displayStatus.inventory_status === 'low_stock' || displayStatus.inventory_status === 'special_order' ? 'var(--warning)' : undefined }}>{item.current_qty}</strong>
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}> / {item.starting_qty}</span>
                        </td>
                        <td>{money(item.base_cost_per_vial)}</td>
                        <td>{money(item.allocated_shipping_per_vial)}</td>
                        <td>{money(item.allocated_label_per_vial)}</td>
                        <td style={{ fontWeight: 700 }}>{money(item.true_landed_cost_per_vial)}</td>
                        <td>{money(item.retail_price)}</td>
                        <td>
                          <div style={{ fontWeight: 800, color: marginDollars(item) > 0 ? 'var(--success)' : 'var(--error)' }}>{money(marginDollars(item))}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{marginPercent(item).toFixed(1)}%</div>
                        </td>
                        <td>
                          <span className={`badge ${
                            displayStatus.inventory_status === 'in_stock' ? 'badge-success'
                            : displayStatus.inventory_status === 'low_stock' ? 'badge-warning'
                            : displayStatus.inventory_status === 'special_order' ? 'badge-info'
                            : displayStatus.inventory_status === 'out_of_stock' ? 'badge-error'
                            : 'badge-default'
                          }`}>
                            {displayStatus.inventory_status_label}
                          </span>
                          {displayStatus.supporting_copy && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{displayStatus.supporting_copy}</div>}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-ghost btn-sm" onClick={() => openAdj(item)} title="Adjust quantity">±</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => openEdit(item)}>Edit</button>
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => void deleteItem(item)}
                              disabled={saving}
                              style={{ borderColor: 'rgba(220,38,38,.35)', color: 'var(--error)' }}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Sales log */}
          <div className="card">
            <div className="card-header" style={{ paddingBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
              <div>
                <div className="card-title">Sales Log</div>
                <div className="card-subtitle">Revenue minus landed cost, fees, and adjustments — your profit source of truth.</div>
              </div>
              <button className="btn btn-outline btn-sm" onClick={() => { setLogForm({ sku: '', product_name: '', qty_sold: '1', revenue: '', unit_cost: '', rep_code: '', payment_processing_fee: '0', shipping_subsidy: '0', ad_spend: '0', refund_amount: '0', order_number: '' }); setLogModal(true); }}>
                + Log Sale
              </button>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Order</th>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Cost</th>
                    <th>Revenue</th>
                    <th>Fees</th>
                    <th>Rep</th>
                    <th>Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.length === 0 ? (
                    <tr><td colSpan={9} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
                      No sales logged yet. Log a sale when an order is marked paid.
                    </td></tr>
                  ) : sales.map((entry) => (
                    <tr key={entry.id}>
                      <td>{new Date(entry.sold_at).toLocaleDateString()}</td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{entry.order_number || '—'}</td>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{entry.sku || '—'}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{entry.product_name || ''}</div>
                      </td>
                      <td>{entry.qty_sold}</td>
                      <td>{money(entry.unit_cost * entry.qty_sold)}</td>
                      <td>{money(entry.revenue)}</td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{money(entry.payment_processing_fee + entry.shipping_subsidy + entry.ad_spend + entry.refund_amount)}</td>
                      <td style={{ fontSize: 13 }}>{entry.rep_code || '—'}</td>
                      <td style={{ fontWeight: 800, color: Number(entry.profit) >= 0 ? 'var(--success)' : 'var(--error)' }}>
                        {money(entry.profit)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Add / Edit Item Modal ─────────────────────────────────── */}
      {itemModal && (
        <div className="modal-overlay" onClick={() => setItemModal(null)}>
          <div className="modal" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">{itemModal === 'add' ? 'Add Inventory Item' : 'Edit Item'}</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setItemModal(null)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gap: 16 }}>
              <div className="form-grid form-grid-2" style={{ gap: 14 }}>
                <div className="form-group">
                  <label className="form-label form-required">SKU</label>
                  <input className="form-input" value={itemForm.sku} onChange={(e) => setItemForm({ ...itemForm, sku: e.target.value })} placeholder="e.g. TR60" />
                </div>
                <div className="form-group">
                  <label className="form-label form-required">Product name</label>
                  <input className="form-input" value={itemForm.product_name} onChange={(e) => setItemForm({ ...itemForm, product_name: e.target.value })} placeholder="e.g. Tirzepatide" />
                </div>
                <div className="form-group">
                  <label className="form-label">Strength</label>
                  <input className="form-input" value={itemForm.strength ?? ''} onChange={(e) => setItemForm({ ...itemForm, strength: e.target.value })} placeholder="e.g. 60mg" />
                </div>
                <div className="form-group">
                  <label className="form-label">Batch #</label>
                  <input className="form-input" value={itemForm.batch_no ?? ''} onChange={(e) => setItemForm({ ...itemForm, batch_no: e.target.value })} placeholder="Optional" />
                </div>
                <div className="form-group">
                  <label className="form-label form-required">Current quantity</label>
                  <input type="number" className="form-input" value={itemForm.current_qty} onChange={(e) => setItemForm({ ...itemForm, current_qty: parseInt(e.target.value) || 0 })} min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Low-stock threshold</label>
                  <input type="number" className="form-input" value={itemForm.low_stock_threshold ?? itemForm.reorder_level} onChange={(e) => {
                    const threshold = parseInt(e.target.value) || 3;
                    setItemForm({ ...itemForm, low_stock_threshold: threshold, reorder_level: threshold });
                  }} min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Base cost per vial ($)</label>
                  <input type="number" className="form-input" value={itemForm.base_cost_per_vial} onChange={(e) => setItemForm({ ...itemForm, base_cost_per_vial: parseFloat(e.target.value) || 0 })} step="0.01" min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Retail price ($)</label>
                  <input type="number" className="form-input" value={itemForm.retail_price ?? ''} onChange={(e) => setItemForm({ ...itemForm, retail_price: parseFloat(e.target.value) || null })} step="0.01" min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Allocated shipping / vial ($)</label>
                  <input type="number" className="form-input" value={itemForm.allocated_shipping_per_vial} onChange={(e) => setItemForm({ ...itemForm, allocated_shipping_per_vial: parseFloat(e.target.value) || 0 })} step="0.01" min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Allocated label / vial ($)</label>
                  <input type="number" className="form-input" value={itemForm.allocated_label_per_vial} onChange={(e) => setItemForm({ ...itemForm, allocated_label_per_vial: parseFloat(e.target.value) || 0 })} step="0.01" min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Status override</label>
                  <select className="form-select" value={itemForm.stock_status ?? ''} onChange={(e) => setItemForm({ ...itemForm, stock_status: e.target.value || null })}>
                    <option value="">Calculated from quantity</option>
                    <option value="in_stock">In Stock</option>
                    <option value="low_stock">Low Stock</option>
                    <option value="special_order">Special Order</option>
                    <option value="out_of_stock">Out of Stock</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Estimated fulfillment days</label>
                  <input type="number" className="form-input" value={itemForm.estimated_fulfillment_days} onChange={(e) => setItemForm({ ...itemForm, estimated_fulfillment_days: parseInt(e.target.value) || 14 })} min="1" />
                </div>
              </div>

              {/* Calculated landed cost preview */}
              <div style={{ background: 'var(--card-soft)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: '12px 16px', fontSize: 14 }}>
                <span style={{ color: 'var(--text-muted)' }}>Calculated landed cost: </span>
                <strong style={{ color: 'var(--teal)' }}>
                  {money(Number(itemForm.base_cost_per_vial) + Number(itemForm.allocated_shipping_per_vial) + Number(itemForm.allocated_label_per_vial))} / vial
                </strong>
                {itemForm.retail_price && (
                  <span style={{ marginLeft: 16, color: 'var(--text-muted)' }}>
                    Margin: <strong style={{ color: 'var(--success)' }}>
                      {money(Number(itemForm.retail_price) - (Number(itemForm.base_cost_per_vial) + Number(itemForm.allocated_shipping_per_vial) + Number(itemForm.allocated_label_per_vial)))}
                    </strong>
                  </span>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">Notes</label>
                <textarea className="form-textarea" style={{ minHeight: 64 }} value={itemForm.notes ?? ''} onChange={(e) => setItemForm({ ...itemForm, notes: e.target.value })} placeholder="Supplier info, order details, etc." />
              </div>

              <div className="form-group">
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={itemForm.active} onChange={(e) => setItemForm({ ...itemForm, active: e.target.checked })} />
                  Active (visible to fulfillment team)
                </label>
              </div>
              <div className="form-grid form-grid-2" style={{ gap: 10 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={itemForm.customer_visible} onChange={(e) => setItemForm({ ...itemForm, customer_visible: e.target.checked })} />
                  Customer visible
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={itemForm.sellable} onChange={(e) => setItemForm({ ...itemForm, sellable: e.target.checked })} />
                  Sellable
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={itemForm.allow_special_order} onChange={(e) => setItemForm({ ...itemForm, allow_special_order: e.target.checked })} />
                  Allow special order
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                  <input type="checkbox" checked={itemForm.admin_manageable} onChange={(e) => setItemForm({ ...itemForm, admin_manageable: e.target.checked })} />
                  Admin manageable
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost btn-sm" onClick={() => setItemModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveItem} disabled={saving || !itemForm.sku || !itemForm.product_name}>
                {saving ? 'Saving…' : itemModal === 'add' ? 'Add Item' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Adjust Quantity Modal ─────────────────────────────────── */}
      {adjModal && adjTarget && (
        <div className="modal-overlay" onClick={() => setAdjModal(false)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Adjust Quantity — {adjTarget.sku}</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setAdjModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gap: 14 }}>
              <div style={{ background: 'var(--card-soft)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 14 }}>
                Current qty: <strong>{adjTarget.current_qty}</strong> · Reorder at: {adjTarget.reorder_level}
              </div>
              <div className="form-group">
                <label className="form-label form-required">Adjustment quantity</label>
                <input
                  type="number"
                  className="form-input"
                  value={adjQty}
                  onChange={(e) => setAdjQty(e.target.value)}
                  placeholder="Use + to add, − to remove (e.g. -3 or +10)"
                />
                {adjQty && !isNaN(parseInt(adjQty)) && (
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                    New quantity: <strong>{adjTarget.current_qty + parseInt(adjQty)}</strong>
                  </div>
                )}
              </div>
              <div className="form-group">
                <label className="form-label form-required">Reason</label>
                <select className="form-select" value={adjReason} onChange={(e) => setAdjReason(e.target.value)}>
                  <option value="">Select reason…</option>
                  <option value="New stock received">New stock received</option>
                  <option value="Order fulfilled">Order fulfilled</option>
                  <option value="Damaged / unusable">Damaged / unusable</option>
                  <option value="Return to supplier">Return to supplier</option>
                  <option value="Internal use / testing">Internal use / testing</option>
                  <option value="Inventory correction">Inventory correction</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Notes (optional)</label>
                <input className="form-input" value={adjNotes} onChange={(e) => setAdjNotes(e.target.value)} placeholder="Order number, batch, etc." />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost btn-sm" onClick={() => setAdjModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveAdj} disabled={saving || !adjQty || !adjReason}>
                {saving ? 'Saving…' : 'Save Adjustment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Log Sale Modal ────────────────────────────────────────── */}
      {logModal && (
        <div className="modal-overlay" onClick={() => setLogModal(false)}>
          <div className="modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Log Sale</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setLogModal(false)}>✕</button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gap: 14 }}>
              <div className="form-grid form-grid-2" style={{ gap: 14 }}>
                <div className="form-group">
                  <label className="form-label">Order #</label>
                  <input className="form-input" value={logForm.order_number} onChange={(e) => setLogForm({ ...logForm, order_number: e.target.value })} placeholder="Optional" />
                </div>
                <div className="form-group">
                  <label className="form-label">SKU</label>
                  <select className="form-select" value={logForm.sku} onChange={(e) => {
                    const item = items.find((i) => i.sku === e.target.value);
                    setLogForm({ ...logForm, sku: e.target.value, product_name: item?.product_name ?? logForm.product_name, unit_cost: String(item?.true_landed_cost_per_vial ?? logForm.unit_cost) });
                  }}>
                    <option value="">Select SKU…</option>
                    {items.map((i) => <option key={i.sku} value={i.sku}>{i.sku} — {i.product_name}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Qty sold</label>
                  <input type="number" className="form-input" value={logForm.qty_sold} onChange={(e) => setLogForm({ ...logForm, qty_sold: e.target.value })} min="1" />
                </div>
                <div className="form-group">
                  <label className="form-label form-required">Revenue ($)</label>
                  <input type="number" className="form-input" value={logForm.revenue} onChange={(e) => setLogForm({ ...logForm, revenue: e.target.value })} step="0.01" min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Unit cost ($)</label>
                  <input type="number" className="form-input" value={logForm.unit_cost} onChange={(e) => setLogForm({ ...logForm, unit_cost: e.target.value })} step="0.01" min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Rep code</label>
                  <input className="form-input" value={logForm.rep_code} onChange={(e) => setLogForm({ ...logForm, rep_code: e.target.value })} placeholder="Optional" />
                </div>
                <div className="form-group">
                  <label className="form-label">Processing fee ($)</label>
                  <input type="number" className="form-input" value={logForm.payment_processing_fee} onChange={(e) => setLogForm({ ...logForm, payment_processing_fee: e.target.value })} step="0.01" min="0" />
                </div>
                <div className="form-group">
                  <label className="form-label">Shipping subsidy ($)</label>
                  <input type="number" className="form-input" value={logForm.shipping_subsidy} onChange={(e) => setLogForm({ ...logForm, shipping_subsidy: e.target.value })} step="0.01" min="0" />
                </div>
              </div>

              {/* Profit preview */}
              {logForm.revenue && (
                <div style={{ background: 'var(--card-soft)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 14 }}>
                  Estimated profit:{' '}
                  <strong style={{ color: 'var(--success)' }}>
                    {money(
                      parseFloat(logForm.revenue || '0') -
                      (parseFloat(logForm.unit_cost || '0') * parseInt(logForm.qty_sold || '1')) -
                      parseFloat(logForm.payment_processing_fee || '0') -
                      parseFloat(logForm.shipping_subsidy || '0') -
                      parseFloat(logForm.ad_spend || '0') -
                      parseFloat(logForm.refund_amount || '0')
                    )}
                  </strong>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost btn-sm" onClick={() => setLogModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveLog} disabled={saving || !logForm.revenue}>
                {saving ? 'Saving…' : 'Log Sale'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashLayout>
  );
}
