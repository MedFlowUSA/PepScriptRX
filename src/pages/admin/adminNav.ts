export const ADMIN_NAV = [
  { label: 'Dashboard', path: '/admin', icon: '01' },
  { label: 'Submissions', path: '/admin/submissions', icon: '02' },
  { label: 'Analytics', path: '/admin/analytics', icon: '03' },
  { label: 'Products', path: '/admin/products', icon: '04' },
  { label: 'Inventory', path: '/admin/inventory', icon: '05' },
  { label: 'Rx+', path: '/admin/rx-plus', icon: '06' },
  { label: 'Reps', path: '/admin/reps', icon: '07' },
  { label: 'Payouts', path: '/admin/payouts', icon: '08' },
  { label: 'PayPal Audit', path: '/admin/payment-audit', icon: '09' },
  { label: 'Fulfillment', path: '/admin/fulfillment', icon: '10' },
];

export const RX_PLUS_ADMIN_NAV = ADMIN_NAV.filter(
  (item) => item.path !== '/admin/payouts' && item.path !== '/admin/payment-audit',
);
