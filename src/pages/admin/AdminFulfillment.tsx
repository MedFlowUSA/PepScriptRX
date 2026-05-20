import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashLayout from '../../components/layout/DashLayout';
import { supabase } from '../../lib/supabase';
import type { FulfillmentOrder } from '../../types';

import { ADMIN_NAV } from './adminNav';

const STATUS_BADGE: Record<string, string> = {
  not_sent:     'badge-default',
  sent:         'badge-info',
  in_progress:  'badge-purple',
  shipped:      'badge-teal',
  delivered:    'badge-success',
  cancelled:    'badge-error',
};

export default function AdminFulfillment() {
  const [orders, setOrders] = useState<FulfillmentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [trackingInput, setTrackingInput] = useState('');

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase
      .from('fulfillment_orders')
      .select('*, submission:patient_submissions(full_name, email, medication, current_dose, state)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOrders((data as FulfillmentOrder[]) ?? []);
        setLoading(false);
      });
  }, []);

  async function saveTracking(orderId: string, status: string) {
    await supabase!.from('fulfillment_orders').update({
      tracking_number: trackingInput,
      fulfillment_status: status,
    }).eq('id', orderId);
    setOrders((prev) =>
      prev.map((o) => o.id === orderId ? { ...o, tracking_number: trackingInput, fulfillment_status: status } : o),
    );
    setEditing(null);
    setTrackingInput('');
  }

  return (
    <DashLayout title="Fulfillment Orders" navItems={ADMIN_NAV}>
      <div className="card">
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Medication</th>
                  <th>Partner</th>
                  <th>Status</th>
                  <th>Tracking</th>
                  <th>Retail Price</th>
                  <th>Submission</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr><td colSpan={8}>
                    <div className="empty-state" style={{ padding: '40px 0' }}>
                      <div className="empty-state-title">No fulfillment orders yet</div>
                      <div className="empty-state-desc">Orders appear here when submissions are marked as paid.</div>
                    </div>
                  </td></tr>
                ) : orders.map((order) => {
                  const sub = order.submission as unknown as { full_name: string; email: string; medication: string; current_dose: string; state: string };
                  return (
                    <tr key={order.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{sub?.full_name}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{sub?.state}</div>
                      </td>
                      <td>
                        <div>{sub?.medication}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{sub?.current_dose}</div>
                      </td>
                      <td>{order.fulfillment_partner || '—'}</td>
                      <td>
                        <span className={`badge ${STATUS_BADGE[order.fulfillment_status] ?? 'badge-default'}`}>
                          {order.fulfillment_status}
                        </span>
                      </td>
                      <td>
                        {editing === order.id ? (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input
                              className="form-input" style={{ width: 130, padding: '4px 8px', fontSize: 13 }}
                              value={trackingInput} placeholder="Tracking #"
                              onChange={(e) => setTrackingInput(e.target.value)}
                            />
                            <button className="btn btn-primary btn-sm" onClick={() => saveTracking(order.id, 'shipped')}>Save</button>
                            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(null)}>✕</button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: 13 }}>{order.tracking_number || '—'}</span>
                            <button className="btn btn-ghost btn-sm" onClick={() => { setEditing(order.id); setTrackingInput(order.tracking_number || ''); }}>
                              Edit
                            </button>
                          </div>
                        )}
                      </td>
                      <td>{order.retail_price ? `$${order.retail_price.toFixed(2)}` : '—'}</td>
                      <td>
                        <Link to={`/admin/submissions/${order.submission_id}`} className="table-link">View →</Link>
                      </td>
                      <td>
                        <select
                          className="form-select" style={{ fontSize: 13, padding: '4px 8px' }}
                          value={order.fulfillment_status}
                          onChange={async (e) => {
                            const newStatus = e.target.value;
                            await supabase!.from('fulfillment_orders').update({ fulfillment_status: newStatus }).eq('id', order.id);
                            setOrders((prev) => prev.map((o) => o.id === order.id ? { ...o, fulfillment_status: newStatus } : o));
                          }}
                        >
                          {['not_sent','sent','in_progress','shipped','delivered','cancelled'].map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashLayout>
  );
}
