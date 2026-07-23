export type DiligenceOrder = {
  id: string;
  email?: string | null;
  patient_profile_id?: string | null;
  medication?: string | null;
  product_name?: string | null;
  brand_id?: string | null;
  store_slug?: string | null;
  store_name?: string | null;
  status?: string | null;
  payment_status?: string | null;
  order_total?: number | null;
  quoted_price?: number | null;
  discount_amount?: number | null;
  amount_due_cents?: number | null;
  cost_of_goods?: number | null;
  shipping_cost?: number | null;
  paid_at?: string | null;
  created_at: string;
  updated_at?: string | null;
  fulfillment_status?: string | null;
};

export type CommissionRow = { commission_amount?: number | null; status?: string | null };
export type InventoryRow = {
  sku?: string | null;
  product_name?: string | null;
  current_qty?: number | null;
  true_landed_cost_per_vial?: number | null;
  retail_price?: number | null;
  reorder_level?: number | null;
};

const round = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
const monthOf = (value: string) => value.slice(0, 7);

export function isRecognizedOrder(order: DiligenceOrder) {
  return order.payment_status === 'paid'
    || ['paid', 'shipped', 'fulfilled'].includes(String(order.status));
}

export function recognizedRevenue(order: DiligenceOrder) {
  if (typeof order.amount_due_cents === 'number') return round(order.amount_due_cents / 100);
  if (typeof order.order_total === 'number') return round(order.order_total);
  return round(Math.max(0, Number(order.quoted_price ?? 0) - Number(order.discount_amount ?? 0)));
}

function customerKey(order: DiligenceOrder) {
  if (order.patient_profile_id) return `profile:${order.patient_profile_id}`;
  const email = order.email?.trim().toLowerCase();
  return email ? `email:${email}` : `order:${order.id}`;
}

export function buildDiligenceReport(
  orders: DiligenceOrder[],
  commissions: CommissionRow[],
  inventory: InventoryRow[],
) {
  const paid = orders.filter(isRecognizedOrder).sort((a, b) =>
    String(a.paid_at ?? a.created_at).localeCompare(String(b.paid_at ?? b.created_at)));
  const firstMonth = new Map<string, string>();
  paid.forEach((order) => {
    const key = customerKey(order);
    if (!firstMonth.has(key)) firstMonth.set(key, monthOf(order.paid_at ?? order.created_at));
  });

  const monthlyMap = new Map<string, { month: string; orders: number; customers: Set<string>; revenue: number; repeatRevenue: number; repeatCustomers: Set<string> }>();
  paid.forEach((order) => {
    const month = monthOf(order.paid_at ?? order.created_at);
    const customer = customerKey(order);
    const row = monthlyMap.get(month) ?? { month, orders: 0, customers: new Set(), revenue: 0, repeatRevenue: 0, repeatCustomers: new Set() };
    row.orders += 1;
    row.customers.add(customer);
    row.revenue += recognizedRevenue(order);
    if (firstMonth.get(customer) !== month) {
      row.repeatRevenue += recognizedRevenue(order);
      row.repeatCustomers.add(customer);
    }
    monthlyMap.set(month, row);
  });
  const monthly = [...monthlyMap.values()].sort((a, b) => a.month.localeCompare(b.month)).map((row) => ({
    month: row.month, orders: row.orders, customers: row.customers.size,
    revenue: round(row.revenue), repeatRevenue: round(row.repeatRevenue),
    repeatCustomers: row.repeatCustomers.size,
  }));

  const cohortMap = new Map<string, { customers: Set<string>; repeat: Set<string>; orders: number; revenue: number }>();
  const orderCounts = new Map<string, number>();
  paid.forEach((order) => orderCounts.set(customerKey(order), (orderCounts.get(customerKey(order)) ?? 0) + 1));
  paid.forEach((order) => {
    const customer = customerKey(order);
    const cohort = firstMonth.get(customer)!;
    const row = cohortMap.get(cohort) ?? { customers: new Set(), repeat: new Set(), orders: 0, revenue: 0 };
    row.customers.add(customer);
    if ((orderCounts.get(customer) ?? 0) > 1) row.repeat.add(customer);
    row.orders += 1;
    row.revenue += recognizedRevenue(order);
    cohortMap.set(cohort, row);
  });
  const cohorts = [...cohortMap].sort(([a], [b]) => a.localeCompare(b)).map(([cohort, row]) => ({
    cohort, customers: row.customers.size, repeatCustomers: row.repeat.size,
    paidOrders: row.orders, revenue: round(row.revenue),
    revenuePerCustomer: round(row.revenue / Math.max(row.customers.size, 1)),
  }));

  const totalRevenue = round(paid.reduce((sum, order) => sum + recognizedRevenue(order), 0));
  const groupConcentration = (key: (order: DiligenceOrder) => string) => {
    const grouped = new Map<string, { revenue: number; orders: number }>();
    paid.forEach((order) => {
      const name = key(order) || 'Unattributed';
      const row = grouped.get(name) ?? { revenue: 0, orders: 0 };
      row.revenue += recognizedRevenue(order); row.orders += 1; grouped.set(name, row);
    });
    return [...grouped].map(([name, row]) => ({
      name, orders: row.orders, revenue: round(row.revenue),
      share: totalRevenue ? round((row.revenue / totalRevenue) * 100) : 0,
    })).sort((a, b) => b.revenue - a.revenue);
  };

  const refunds = orders.filter((order) =>
    order.payment_status === 'refunded' || order.payment_status === 'reversed' || order.status === 'cancelled_refunded');
  const recordedCogs = round(paid.reduce((sum, order) => sum + Number(order.cost_of_goods ?? 0), 0));
  const missingCostOrders = paid.filter((order) => order.cost_of_goods == null).length;
  const repLiability = round(commissions.filter((row) => ['pending', 'payable'].includes(String(row.status)))
    .reduce((sum, row) => sum + Number(row.commission_amount ?? 0), 0));
  const inventoryExposure = round(inventory.reduce((sum, row) =>
    sum + Math.max(0, Number(row.current_qty ?? 0)) * Number(row.true_landed_cost_per_vial ?? 0), 0));

  return {
    monthly, cohorts,
    partners: groupConcentration((order) => order.store_name ?? order.store_slug ?? order.brand_id ?? ''),
    products: groupConcentration((order) => order.product_name ?? order.medication ?? ''),
    totals: {
      recognizedRevenue: totalRevenue,
      recognizedOrders: paid.length,
      recordedCogs,
      grossMargin: round(totalRevenue - recordedCogs),
      missingCostOrders,
      refundCount: refunds.length,
      refundValue: round(refunds.reduce((sum, order) => sum + recognizedRevenue(order), 0)),
      repLiability,
      inventoryExposure,
      lowStockItems: inventory.filter((row) => Number(row.current_qty ?? 0) <= Number(row.reorder_level ?? 0)).length,
    },
  };
}

export function rowsToCsv(rows: Record<string, unknown>[]) {
  if (!rows.length) return '';
  const columns = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    const text = value == null ? '' : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [columns.join(','), ...rows.map((row) => columns.map((column) => escape(row[column])).join(','))].join('\r\n');
}
