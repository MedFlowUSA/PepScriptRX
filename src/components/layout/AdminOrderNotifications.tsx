import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { isAactivatedOrder, isAactivatedPartnerAdmin } from '../../lib/aactivatedScope';
import { supabase } from '../../lib/supabase';
import { getSubmissionStorefrontLabel } from '../../lib/storeAttribution';
import type { PatientSubmission } from '../../types';

const MAX_NOTIFICATIONS = 20;

export default function AdminOrderNotifications() {
  const { profile } = useAuth();
  const enabled = isAactivatedPartnerAdmin(profile);
  const [orders, setOrders] = useState<PatientSubmission[]>([]);
  const [open, setOpen] = useState(false);
  const storageKey = `aactivated-admin-orders-seen:${profile?.id ?? profile?.email ?? 'admin'}`;
  const [lastSeen, setLastSeen] = useState(() => readLastSeen(storageKey));

  const loadOrders = useCallback(async () => {
    if (!enabled || !supabase) return;
    const { data } = await supabase
      .from('patient_submissions')
      .select('id, full_name, medication, product_name, order_number, status, created_at, checkout_scope_code, source_portal, source_route, source_store, source_admin, source_rep, admin_code, brand_id, store_slug, store_name, parent_type, commission_owner, referral_code, discount_code, rep:reps!patient_submissions_rep_id_fkey(rep_slug,brand_name,custom_store_slug,brand_id,parent_brand_id,assigned_store_slug)')
      .order('created_at', { ascending: false })
      .limit(250);

    setOrders(((data as unknown as PatientSubmission[]) ?? []).filter(isAactivatedOrder).slice(0, MAX_NOTIFICATIONS));
  }, [enabled]);

  useEffect(() => {
    setLastSeen(readLastSeen(storageKey));
  }, [storageKey]);

  useEffect(() => {
    if (!enabled || !supabase) return;
    void loadOrders();
    const channel = supabase
      .channel(`aactivated-admin-order-notifications-${profile?.id ?? 'admin'}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'patient_submissions' }, () => void loadOrders())
      .subscribe();
    return () => { void supabase?.removeChannel(channel); };
  }, [enabled, loadOrders, profile?.id]);

  const unread = useMemo(
    () => orders.filter((order) => new Date(order.created_at).getTime() > lastSeen).length,
    [lastSeen, orders],
  );

  if (!enabled) return null;

  function toggleOpen() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      const seenAt = Date.now();
      localStorage.setItem(storageKey, String(seenAt));
      setLastSeen(seenAt);
    }
  }

  return (
    <div className="admin-order-notifications">
      <button
        type="button"
        className="admin-order-notifications-button"
        aria-label={unread ? `${unread} new order notification${unread === 1 ? '' : 's'}` : 'Order notifications'}
        aria-expanded={open}
        onClick={toggleOpen}
      >
        <span aria-hidden="true">&#128276;</span>
        {unread > 0 && <span className="admin-order-notifications-badge">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="admin-order-notifications-menu" role="region" aria-label="Recent orders">
          <div className="admin-order-notifications-heading">
            <strong>Order notifications</strong>
            <Link to="/admin/submissions" onClick={() => setOpen(false)}>View all</Link>
          </div>
          {orders.length === 0 ? (
            <div className="admin-order-notifications-empty">No orders yet.</div>
          ) : orders.map((order) => (
            <Link
              key={order.id}
              to="/admin/submissions"
              className="admin-order-notification"
              onClick={() => setOpen(false)}
            >
              <span className="admin-order-notification-dot" aria-hidden="true" />
              <span>
                <strong>New order from {order.full_name || 'a customer'}</strong>
                <small>{order.product_name || order.medication || 'Store order'} · {getSubmissionStorefrontLabel(order)}</small>
                <small>{formatOrderTime(order.created_at)}</small>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function readLastSeen(key: string): number {
  if (typeof window === 'undefined') return 0;
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) ? value : 0;
}

function formatOrderTime(value: string): string {
  return new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
