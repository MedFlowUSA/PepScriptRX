type OrderListRecord = {
  status?: string | null;
  order_number?: string | null;
  full_name?: string | null;
  email?: string | null;
  medication?: string | null;
  product_name?: string | null;
  submission_type?: string | null;
  store_slug?: string | null;
  store_name?: string | null;
  attribution_source?: string | null;
  source_portal?: string | null;
  source_route?: string | null;
  source_store?: string | null;
};

const NON_PRODUCTION_LABEL = /^(?:misc(?:ellaneous)?|test(?:ing)?|sample|demo|dummy|fake|qa)(?:[\s_-]*(?:order|submission|patient|customer|product|store))?$/i;
const NON_PRODUCTION_PREFIX = /^(?:misc(?:ellaneous)?|test(?:ing)?|sample|demo|dummy|fake|qa)(?:[\s_-]|$)/i;
const NON_PRODUCTION_EMAIL = /^(?:misc|test|testing|sample|demo|dummy|fake|qa)(?:[+._-]|@)/i;

export function isNonProductionOrder(order: OrderListRecord): boolean {
  const exactFields = [
    order.order_number,
    order.submission_type,
    order.store_slug,
    order.store_name,
    order.attribution_source,
    order.source_portal,
    order.source_route,
    order.source_store,
  ];
  if (exactFields.some((value) => NON_PRODUCTION_LABEL.test(clean(value)))) return true;

  const descriptiveFields = [
    order.full_name,
    order.medication,
    order.product_name,
  ];
  if (descriptiveFields.some((value) => NON_PRODUCTION_PREFIX.test(clean(value)))) return true;

  return NON_PRODUCTION_EMAIL.test(clean(order.email));
}

export function isVisibleMainAdminOrder(order: OrderListRecord): boolean {
  return order.status !== 'not_eligible' && !isNonProductionOrder(order);
}

function clean(value: unknown): string {
  return String(value ?? '').trim();
}
