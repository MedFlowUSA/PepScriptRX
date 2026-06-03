import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useRealtime } from '../../hooks/useRealtime';
import { supabase } from '../../lib/supabase';
import type { PatientSubmission } from '../../types';

export function usePatientOrders() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<PatientSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    if (!supabase || !profile) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    const { data, error: loadError } = await supabase
      .from('patient_submissions')
      .select('*, documents:submission_documents(*)')
      .or(`patient_profile_id.eq.${profile.id},email.eq.${profile.email}`)
      .order('created_at', { ascending: false });

    if (loadError) {
      setError(loadError.message);
      setOrders([]);
    } else {
      setOrders((data ?? []) as PatientSubmission[]);
    }
    setLoading(false);
  }, [profile]);

  useEffect(() => { load(); }, [load]);

  useRealtime(
    `patient-orders-${profile?.id}`,
    'patient_submissions',
    profile ? `patient_profile_id=eq.${profile.id}` : undefined,
    load,
    Boolean(profile?.id),
  );

  useRealtime(
    `patient-orders-email-${profile?.email}`,
    'patient_submissions',
    profile?.email ? `email=eq.${profile.email}` : undefined,
    load,
    Boolean(profile?.email),
  );

  return { orders, loading, error, reload: load, profile };
}

export function orderTotal(order: PatientSubmission): number {
  const productTotal = order.quoted_price ?? order.order_total ?? 0;
  const discountAmount = Math.min(order.discount_amount ?? 0, productTotal);
  return Math.max(0, productTotal - discountAmount) + (order.shipping_cost ?? 0);
}

export function trackingUrl(carrier: string | null, number: string): string {
  switch (carrier) {
    case 'UPS':   return `https://www.ups.com/track?tracknum=${number}`;
    case 'FedEx': return `https://www.fedex.com/fedextrack/?trknbr=${number}`;
    case 'USPS':  return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${number}`;
    case 'DHL':   return `https://www.dhl.com/us-en/home/tracking.html?tracking-id=${number}`;
    default:      return `https://www.google.com/search?q=${encodeURIComponent(`${carrier ?? ''} tracking ${number}`)}`;
  }
}

export function orderStepIndex(order: PatientSubmission): number {
  if (order.tracking_number || order.status === 'shipped' || order.status === 'fulfilled') return 5;
  if (order.status === 'paid' || order.payment_status === 'paid') return 4;
  if (order.status === 'payment_sent') return 3;
  if (['under_review', 'physician_review', 'fulfillment_review', 'eligible'].includes(order.status)) return 2;
  return 1;
}

export const ORDER_STEPS = ['Submitted', 'Review', 'Payment', 'Paid', 'Shipping', 'Delivered'];
