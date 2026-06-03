import DashLayout from '../../components/layout/DashLayout';
import { STATUS_LABELS } from '../../types';
import { patientNav } from './patientNav';
import { trackingUrl, usePatientOrders } from './patientPortalData';

export default function PatientShipping() {
  const { orders, loading, error } = usePatientOrders();
  const shippingOrders = orders.filter((order) => order.shipping_address || order.tracking_number || order.status === 'shipped' || order.shipping_email_sent_at);

  return (
    <DashLayout title="Shipping Center" navItems={patientNav}>
      <div style={{ display: 'grid', gap: 20 }}>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Shipping and tracking</div>
              <div className="card-subtitle">Track packages, confirm destination details, and watch shipping updates.</div>
            </div>
          </div>
          <div className="card-body" style={{ display: 'grid', gap: 12 }}>
            {loading ? (
              <div className="loading-inline"><div className="spinner" />Loading shipping updates...</div>
            ) : shippingOrders.length === 0 ? (
              <div className="empty-state"><div className="empty-state-title">No shipping updates yet</div><div className="empty-state-desc">Shipping details appear after an order is approved and processed.</div></div>
            ) : shippingOrders.map((order) => (
              <div key={order.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 16, background: 'var(--card-soft)', display: 'grid', gap: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 900, color: 'var(--navy)' }}>{order.medication}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{STATUS_LABELS[order.status]}</div>
                  </div>
                  <span className={`badge ${order.tracking_number ? 'badge-success' : 'badge-info'}`}>
                    {order.tracking_number ? 'Tracking live' : 'Preparing'}
                  </span>
                </div>

                {order.shipping_address && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 14, lineHeight: 1.6 }}>
                    <strong style={{ color: 'var(--navy)' }}>Ship to:</strong><br />
                    {order.shipping_address}<br />
                    {order.shipping_city}, {order.shipping_state} {order.shipping_zip}
                  </div>
                )}

                {order.tracking_number ? (
                  <a className="btn btn-primary btn-sm" href={trackingUrl(order.tracking_carrier, order.tracking_number)} target="_blank" rel="noreferrer">
                    Track {order.tracking_carrier ?? 'package'} {order.tracking_number}
                  </a>
                ) : (
                  <div className="alert alert-info">Tracking will appear here as soon as fulfillment adds it.</div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashLayout>
  );
}
