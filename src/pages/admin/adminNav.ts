export const ADMIN_NAV = [
  { label: 'Dashboard', path: '/admin', icon: '01' },
  { label: 'Submissions', path: '/admin/submissions', icon: '02' },
  { label: 'Analytics', path: '/admin/analytics', icon: '03' },
  { label: 'Products', path: '/admin/products', icon: '04' },
  { label: 'Inventory', path: '/admin/inventory', icon: '05' },
  { label: 'Rx+', path: '/admin/rx-plus', icon: '06' },
  { label: 'Promo Links', path: '/admin/aactivated-promos', icon: '07' },
  { label: 'Rep Intake', path: '/admin/rep-intake', icon: '08' },
  { label: 'Reps', path: '/admin/reps', icon: '09' },
  { label: 'Payouts', path: '/admin/payouts', icon: '10' },
  { label: 'Scope Codes', path: '/admin/scope-codes', icon: '11' },
  { label: 'PayPal Audit', path: '/admin/payment-audit', icon: '12' },
  { label: 'Fulfillment', path: '/admin/fulfillment', icon: '13' },
];

export const RX_PLUS_ADMIN_NAV = ADMIN_NAV.filter(
  (item) => item.path !== '/admin/payouts' && item.path !== '/admin/payment-audit' && item.path !== '/admin/scope-codes',
);
