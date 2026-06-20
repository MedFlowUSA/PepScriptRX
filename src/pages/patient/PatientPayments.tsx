import { Link } from 'react-router-dom';
import DashLayout from '../../components/layout/DashLayout';
import { STATUS_LABELS } from '../../types';
import { patientNav } from './patientNav';
import { orderTotal, usePatientOrders } from './patientPortalData';

export default function PatientPayments() {
  const { orders, loading, error } = usePatientOrders();
  const paymentOrders = orders.filter((order) => order.quoted_price || order.order_total || order.payment_provider || order.status === 'payment_sent');
  const pending = paymentOrders.filter((order) => order.payment_status === 'payment_pending' || order.status === 'payment_sent');
  const paid = paymentOrders.filter((order) => order.payment_status === 'paid' || order.status === 'paid' || order.paid_at);

  return (
    <DashLayout title="Payment Center" navItems={patientNav}>
      <div style={{ display: 'grid', gap: 20 }}>
        <div className="stats-grid">
          <div className="stat-card"><div className="stat-value">{pending.length}</div><div className="stat-label">Needs attention</div></div>
          <div className="stat-card"><div className="stat-value">{paid.length}</div><div className="stat-label">Paid orders</div></div>
          <div className="stat-card"><div className="stat-value">{paymentOrders.length}</div><div className="stat-label">Payment records</div></div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Payments and manual status</div>
              <div className="card-subtitle">Review pending payments, manual verification, and paid order history.</div>
            </div>
          </div>
          <div className="card-body" style={{ display: 'grid', gap: 12 }}>
            {loading ? (
              <div className="loading-inline"><div className="spinner" />Loading payments...</div>
            ) : paymentOrders.length === 0 ? (
              <div className="empty-state"><div className="empty-state-title">No payment records yet</div><div className="empty-state-desc">When checkout opens, your payment options will appear here.</div></div>
            ) : paymentOrders.map((order) => (
              <div key={order.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 14, background: 'var(--card-soft)', display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontWeight: 900, color: 'var(--navy)' }}>{order.medication}</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{STATUS_LABELS[order.status]} - ${orderTotal(order).toFixed(2)}</div>
                  </div>
                  <span className={`badge ${order.payment_status === 'paid' ? 'badge-success' : order.payment_status === 'payment_pending' ? 'badge-warning' : 'badge-info'}`}>
                    {order.payment_provider ? `${order.payment_provider.toUpperCase()} ` : ''}{order.payment_status ?? 'unpaid'}
                  </span>
                </div>

                {['zelle', 'venmo'].includes(order.payment_provider ?? '') && order.payment_status === 'payment_pending' && (
                  <div className="alert alert-info">
                    {formatPaymentProvider(order.payment_provider)} payment is waiting for manual verification. Your order will process after payment is verified.
                  </div>
                )}

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {order.status === 'payment_sent' && <Link className="btn btn-primary btn-sm" to={`/pay/${order.id}`}>Open payment page</Link>}
                  <Link className="btn btn-outline btn-sm" to="/patient/documents">View documents</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashLayout>
  );
}

function formatPaymentProvider(provider: string | null) {
  if (provider === 'venmo') return 'Venmo';
  if (provider === 'zelle') return 'Zelle';
  return 'Manual';
}
