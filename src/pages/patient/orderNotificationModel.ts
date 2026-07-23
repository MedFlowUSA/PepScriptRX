import type { PatientSubmission } from '../../types';

export type PatientNotificationKind =
  | 'intake_received' | 'information_missing' | 'review_started'
  | 'payment_requested' | 'payment_confirmed' | 'sent_to_fulfillment'
  | 'shipped' | 'delivery_exception' | 'delivered' | 'refill_approaching';

export type PatientNotification = {
  id: string;
  orderId: string;
  kind: PatientNotificationKind;
  title: string;
  body: string;
  href: string;
  createdAt: string;
  priority: 'normal' | 'important' | 'success';
};

const REVIEW_STATUSES = ['under_review', 'physician_review', 'fulfillment_review', 'eligible'];
const EXCEPTION_PATTERN = /exception|failed|hold|problem|return|undeliver/i;

export function buildPatientNotifications(orders: PatientSubmission[], now = new Date()): PatientNotification[] {
  return orders.flatMap((order) => {
    const href = `/patient#order-${order.id}`;
    const createdAt = order.created_at || now.toISOString();
    const updatedAt = order.updated_at || createdAt;
    const notifications: PatientNotification[] = [notice(order, 'intake_received', 'Request received', `${order.medication} was received and added to your order journey.`, href, createdAt)];

    if (order.status === 'missing_info') notifications.push(notice(order, 'information_missing', 'Information needed', 'The care team needs more information before review can continue.', href, updatedAt, 'important'));
    if (REVIEW_STATUSES.includes(order.status)) notifications.push(notice(order, 'review_started', 'Review started', `${order.medication} is now in review.`, href, updatedAt));
    if (order.status === 'payment_sent') notifications.push(notice(order, 'payment_requested', 'Payment requested', 'Secure payment is ready for this order.', `/pay/${order.id}`, updatedAt, 'important'));
    if (order.status === 'paid' || order.payment_status === 'paid') notifications.push(notice(order, 'payment_confirmed', 'Payment confirmed', 'Payment was confirmed and the order can move to fulfillment.', href, order.paid_at || updatedAt, 'success'));
    if (['fulfillment_review', 'paid', 'shipped', 'fulfilled'].includes(order.status) || Boolean(order.fulfillment_status)) notifications.push(notice(order, 'sent_to_fulfillment', 'Sent to fulfillment', 'The order has entered the fulfillment workflow.', href, updatedAt));
    if (order.status === 'shipped' || order.tracking_number) notifications.push(notice(order, 'shipped', 'Order shipped', order.tracking_number ? `Carrier tracking is available through ${order.tracking_carrier ?? 'the shipping center'}.` : 'The order has shipped; tracking will appear when available.', '/patient/shipping', updatedAt, 'success'));
    if (EXCEPTION_PATTERN.test(order.fulfillment_status ?? '') || order.payment_status === 'payment_exception') notifications.push(notice(order, 'delivery_exception', 'Order exception needs attention', 'There is an exception affecting payment, fulfillment, or delivery. Open the order and contact support.', href, updatedAt, 'important'));
    if (order.status === 'fulfilled' || /delivered/i.test(order.fulfillment_status ?? '')) notifications.push(notice(order, 'delivered', 'Order complete', 'The order journey is marked complete. Check carrier tracking for final delivery details.', href, updatedAt, 'success'));

    const completedAt = new Date(updatedAt);
    const daysSinceCompletion = Number.isFinite(completedAt.getTime()) ? (now.getTime() - completedAt.getTime()) / 86_400_000 : 0;
    if (order.status === 'fulfilled' && daysSinceCompletion >= 25) notifications.push(notice(order, 'refill_approaching', 'Refill window approaching', 'If you need another refill, review the completed order and start a new request. Refills are never automatic.', href, now.toISOString(), 'important'));
    return notifications;
  }).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

function notice(order: PatientSubmission, kind: PatientNotificationKind, title: string, body: string, href: string, createdAt: string, priority: PatientNotification['priority'] = 'normal'): PatientNotification {
  return { id: `${order.id}:${kind}`, orderId: order.id, kind, title, body, href, createdAt, priority };
}
