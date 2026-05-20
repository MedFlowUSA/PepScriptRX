import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import DashLayout from '../../components/layout/DashLayout';
import { supabase } from '../../lib/supabase';
import type { FulfillmentOrder } from '../../types';

const FF_NAV = [
  { label: 'Orders', path: '/fulfillment', icon: '📦' },
];

const STATUS_BADGE: Record<string, string> = {
  not_sent:    'badge-default',
  sent:        'badge-info',
  in_progress: 'badge-purple',
  shipped:     'badge-teal',
  delivered:   'badge-success',
  cancelled:   'badge-error',
};

export default function FulfillmentOrders() {
  const [orders, setOrders] = useState<FulfillmentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    supabase
      .from('fulfillment_orders')
      .select('*, submission:patient_submissions(full_name, email, phone, medication, current_dose, state, quoted_price)')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOrders((data as FulfillmentOrder[]) ?? []);
        setLoading(false);
      });
  }, []);

  return (
    <DashLayout title="Fulfillment Orders" navItems={FF_NAV}>
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
                  <th>State</th>
                  <th>Sale Price</th>
                  <th>Partner</th>
                  <th>Status</th>
                  <th>Tracking</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr><td colSpan={8}>
                    <div className="empty-state" style={{ padding: '40px 0' }}>
                      <div className="empty-state-icon">📦</div>
                      <div className="empty-state-title">No orders assigned</div>
                      <div className="empty-state-desc">Orders appear here when routed by the admin team.</div>
                    </div>
                  </td></tr>
                ) : orders.map((order) => {
                  type Sub = { full_name: string; email: string; phone: string; medication: string; current_dose: string; state: string; quoted_price: number | null };
                  const sub = order.submission as unknown as Sub;
                  return (
                    <tr key={order.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{sub?.full_name}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{sub?.phone}</div>
                      </td>
                      <td>
                        <div>{sub?.medication}</div>
                        <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{sub?.current_dose}</div>
                      </td>
                      <td>{sub?.state}</td>
                      <td style={{ fontWeight: 600 }}>{sub?.quoted_price ? `$${sub.quoted_price.toFixed(2)}` : '—'}</td>
                      <td style={{ fontSize: 13 }}>{order.fulfillment_partner || '—'}</td>
                      <td><span className={`badge ${STATUS_BADGE[order.fulfillment_status] ?? 'badge-default'}`}>{order.fulfillment_status}</span></td>
                      <td style={{ fontSize: 13 }}>{order.tracking_number || '—'}</td>
                      <td>
                        <Link to={`/fulfillment/orders/${order.id}`} className="table-link">Update →</Link>
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
