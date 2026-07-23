import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashLayout from '../../components/layout/DashLayout';
import { patientNav } from './patientNav';
import { usePatientOrders } from './patientPortalData';
import { buildPatientNotifications } from './orderNotificationModel';

export default function PatientNotifications() {
  const { orders, loading, error, profile } = usePatientOrders();
  const storageKey = `pepscriptrx:read-notifications:${profile?.id ?? 'guest'}`;
  const [readIds, setReadIds] = useState<Set<string>>(() => readStored(storageKey));
  const notifications = useMemo(() => buildPatientNotifications(orders), [orders]);
  const unread = notifications.filter((item) => !readIds.has(item.id)).length;

  function markRead(id: string) {
    setReadIds((current) => saveStored(storageKey, new Set(current).add(id)));
  }
  function markAllRead() {
    setReadIds(saveStored(storageKey, new Set(notifications.map((item) => item.id))));
  }

  return (
    <DashLayout title="Notifications" navItems={patientNav} actions={unread > 0 ? <button className="btn btn-outline btn-sm" onClick={markAllRead}>Mark all read</button> : null}>
      <div className="notification-center">
        <header className="notification-center-head">
          <div><div className="text-teal font-semibold text-sm">ORDER COMMUNICATION</div><h1>Updates that tell you what happens next</h1><p>Payment, review, fulfillment, shipping, exceptions, delivery, and refill reminders update from your live order records.</p></div>
          <div className="notification-count"><strong>{unread}</strong><span>unread</span></div>
        </header>
        {loading ? <div className="loading-screen"><div className="spinner" />Loading notifications...</div> : error ? <div className="alert alert-error">{error}</div> : notifications.length === 0 ? <div className="card"><div className="empty-state"><div className="empty-state-title">No notifications yet</div><div className="empty-state-desc">Order updates will appear here automatically.</div></div></div> : (
          <div className="notification-list">
            {notifications.map((item) => {
              const isUnread = !readIds.has(item.id);
              return <Link key={item.id} to={item.href} onClick={() => markRead(item.id)} className={`notification-item notification-${item.priority}${isUnread ? ' unread' : ''}`}>
                <span className="notification-dot" aria-label={isUnread ? 'Unread' : 'Read'} />
                <div><div className="notification-meta"><strong>{item.title}</strong><time>{formatDate(item.createdAt)}</time></div><p>{item.body}</p><small>Open related order →</small></div>
              </Link>;
            })}
          </div>
        )}
      </div>
    </DashLayout>
  );
}

function readStored(key: string) { try { return new Set<string>(JSON.parse(localStorage.getItem(key) ?? '[]')); } catch { return new Set<string>(); } }
function saveStored(key: string, value: Set<string>) { localStorage.setItem(key, JSON.stringify([...value])); return value; }
function formatDate(value: string) { const date = new Date(value); return Number.isNaN(date.getTime()) ? 'Recent update' : date.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }); }
