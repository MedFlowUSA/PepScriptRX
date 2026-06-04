export type NotificationAudience = 'rep' | 'customer' | 'admin';

export type NotificationEvent =
  | 'rep_application_submitted'
  | 'rep_approved'
  | 'rep_rejected'
  | 'customer_account_created'
  | 'order_received'
  | 'order_processing'
  | 'order_shipped'
  | 'tracking_available'
  | 'admin_new_rep_request'
  | 'admin_new_order';

export type NotificationPayload = {
  audience: NotificationAudience;
  event: NotificationEvent;
  recipientEmail: string;
  recipientName?: string | null;
  subjectContext?: string | null;
  metadata?: Record<string, unknown>;
};

export function buildNotificationKey(payload: Pick<NotificationPayload, 'audience' | 'event'>): string {
  return `${payload.audience}.${payload.event}`;
}

export function queueNotification(payload: NotificationPayload): NotificationPayload {
  // Framework placeholder: centralizes the shape before wiring an email provider.
  return payload;
}
