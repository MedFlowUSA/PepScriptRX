import { useCallback, useEffect, useMemo, useState } from 'react';
import DashLayout from '../../components/layout/DashLayout';
import { useAuth } from '../../context/AuthContext';
import { buildDiligenceReport, rowsToCsv, type CommissionRow, type DiligenceOrder, type InventoryRow } from '../../lib/executiveDiligence';
import { isProductIntelligenceAdmin } from '../../lib/productIntelligenceAccess';
import { supabase } from '../../lib/supabase';
import { ADMIN_NAV } from './adminNav';

const money = (value: number) => value.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
const tableStyle = { width: '100%', borderCollapse: 'collapse' as const, fontSize: 13 };
const cellStyle = { padding: '10px 12px', borderBottom: '1px solid var(--border)', textAlign: 'left' as const };

function downloadCsv(name: string, rows: Record<string, unknown>[]) {
  const blob = new Blob([rowsToCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function DataTable({ rows, columns }: { rows: Record<string, unknown>[]; columns: { key: string; label: string; format?: (value: unknown) => string }[] }) {
  return <div style={{ overflowX: 'auto' }}><table style={tableStyle}>
    <thead><tr>{columns.map((column) => <th key={column.key} style={cellStyle}>{column.label}</th>)}</tr></thead>
    <tbody>{rows.length ? rows.map((row, index) => <tr key={index}>{columns.map((column) =>
      <td key={column.key} style={cellStyle}>{column.format ? column.format(row[column.key]) : String(row[column.key] ?? '')}</td>)}</tr>) :
      <tr><td style={cellStyle} colSpan={columns.length}>No source records in this period.</td></tr>}</tbody>
  </table></div>;
}

export default function AdminExecutiveDiligence() {
  const { profile } = useAuth();
  const [orders, setOrders] = useState<DiligenceOrder[]>([]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [auditCount, setAuditCount] = useState(0);
  const [loadedAt, setLoadedAt] = useState('');
  const [error, setError] = useState('');
  const allowed = isProductIntelligenceAdmin(profile);

  const load = useCallback(async () => {
    if (!supabase || !allowed) return;
    setError('');
    const [orderResult, commissionResult, inventoryResult, auditResult] = await Promise.all([
      supabase.from('patient_submissions').select('id,email,patient_profile_id,medication,product_name,brand_id,store_slug,store_name,status,payment_status,order_total,quoted_price,discount_amount,amount_due_cents,cost_of_goods,shipping_cost,paid_at,created_at,updated_at,fulfillment_status'),
      supabase.from('commission_ledger').select('commission_amount,status'),
      supabase.from('inventory_items').select('sku,product_name,current_qty,true_landed_cost_per_vial,retail_price,reorder_level'),
      supabase.from('audit_logs').select('id', { count: 'exact', head: true }),
    ]);
    const firstError = orderResult.error ?? commissionResult.error ?? inventoryResult.error ?? auditResult.error;
    if (firstError) setError(firstError.message);
    setOrders((orderResult.data as DiligenceOrder[]) ?? []);
    setCommissions((commissionResult.data as CommissionRow[]) ?? []);
    setInventory((inventoryResult.data as InventoryRow[]) ?? []);
    setAuditCount(auditResult.count ?? 0);
    setLoadedAt(new Date().toISOString());
  }, [allowed]);

  useEffect(() => { void load(); }, [load]);
  const report = useMemo(() => buildDiligenceReport(orders, commissions, inventory), [orders, commissions, inventory]);
  const exceptions = [
    report.totals.missingCostOrders ? `${report.totals.missingCostOrders} recognized orders lack recorded cost of goods.` : '',
    report.totals.refundCount ? `${report.totals.refundCount} refunded/reversed orders require settlement reconciliation.` : '',
    'Subscription contracts are not modeled; monthly revenue is transaction revenue, not contractual MRR.',
    'Chargeback amounts and payment-processor fees do not have an authoritative ledger.',
  ].filter(Boolean);
  const governance = [
    { register: 'Security controls', status: auditCount ? 'Partial evidence' : 'Gap', source: `${auditCount} audit-log events; no control register` },
    { register: 'Incident history', status: 'Gap', source: 'No authoritative incident register connected' },
    { register: 'Vendor agreements', status: 'Gap', source: 'No authoritative agreement repository connected' },
    { register: 'Regulatory / claims review', status: 'Gap', source: 'No authoritative claims-review register connected' },
  ];

  if (!allowed) return <DashLayout title="Executive Diligence" navItems={ADMIN_NAV}>
    <div className="card"><h2>Platform-admin access required</h2><p className="muted">This read-only area contains company-wide financial and operational reporting.</p></div>
  </DashLayout>;

  return <DashLayout title="Executive Diligence" navItems={ADMIN_NAV} actions={<button className="btn btn-secondary" onClick={() => void load()}>Refresh sources</button>}>
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div><h2 style={{ marginBottom: 6 }}>Read-only diligence workspace</h2>
            <p className="muted" style={{ margin: 0 }}>Reconciled from live order, commission, inventory, fulfillment, and audit sources. Exports contain aggregates only—no patient PHI.</p></div>
          <div className="muted" style={{ fontSize: 12 }}>Source snapshot: {loadedAt ? new Date(loadedAt).toLocaleString() : 'Loading…'}</div>
        </div>
        {error && <div className="alert alert-error" style={{ marginTop: 14 }}>Source error: {error}</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 12 }}>
        {[
          ['Recognized revenue', money(report.totals.recognizedRevenue)],
          ['Paid orders', report.totals.recognizedOrders.toLocaleString()],
          ['Gross margin (recorded)', money(report.totals.grossMargin)],
          ['Rep liabilities', money(report.totals.repLiability)],
          ['Inventory exposure', money(report.totals.inventoryExposure)],
          ['Refund / reversal records', report.totals.refundCount.toLocaleString()],
        ].map(([label, value]) => <div className="card" key={label}><div className="muted" style={{ fontSize: 12 }}>{label}</div><div style={{ fontSize: 24, fontWeight: 800, marginTop: 5 }}>{value}</div></div>)}
      </div>

      <div className="card"><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><h3>Monthly revenue & repeat behavior</h3><p className="muted">Cash-recognized transaction revenue; repeat means a customer whose first paid month was earlier.</p></div><button className="btn btn-secondary" onClick={() => downloadCsv('monthly-revenue', report.monthly)}>Export CSV</button></div>
        <DataTable rows={report.monthly} columns={[{ key: 'month', label: 'Month' }, { key: 'revenue', label: 'Revenue', format: (v) => money(Number(v)) }, { key: 'repeatRevenue', label: 'Repeat revenue', format: (v) => money(Number(v)) }, { key: 'orders', label: 'Paid orders' }, { key: 'customers', label: 'Customers' }, { key: 'repeatCustomers', label: 'Repeat customers' }]} /></div>

      <div className="card"><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div><h3>Customer cohorts</h3><p className="muted">Aggregated by first paid month. No names or email addresses are exported.</p></div><button className="btn btn-secondary" onClick={() => downloadCsv('customer-cohorts', report.cohorts)}>Export CSV</button></div>
        <DataTable rows={report.cohorts} columns={[{ key: 'cohort', label: 'First paid month' }, { key: 'customers', label: 'Customers' }, { key: 'repeatCustomers', label: 'Repeat customers' }, { key: 'paidOrders', label: 'Paid orders' }, { key: 'revenue', label: 'Revenue', format: (v) => money(Number(v)) }, { key: 'revenuePerCustomer', label: 'Revenue / customer', format: (v) => money(Number(v)) }]} /></div>

      {[['Partner concentration', report.partners, 'partner-concentration'], ['Product concentration', report.products, 'product-concentration']].map(([title, rows, file]) =>
        <div className="card" key={String(title)}><div style={{ display: 'flex', justifyContent: 'space-between' }}><h3>{String(title)}</h3><button className="btn btn-secondary" onClick={() => downloadCsv(String(file), rows as Record<string, unknown>[])}>Export CSV</button></div>
          <DataTable rows={rows as Record<string, unknown>[]} columns={[{ key: 'name', label: 'Source' }, { key: 'orders', label: 'Orders' }, { key: 'revenue', label: 'Revenue', format: (v) => money(Number(v)) }, { key: 'share', label: 'Revenue share', format: (v) => `${v}%` }]} /></div>)}

      <div className="card"><h3>Reconciliation exceptions</h3><p className="muted">A zero-exception report is the readiness target. Exceptions remain visible instead of being silently estimated.</p>
        <ul>{exceptions.map((exception) => <li key={exception} style={{ marginBottom: 8 }}>{exception}</li>)}</ul>
        <button className="btn btn-secondary" onClick={() => downloadCsv('reconciliation-exceptions', exceptions.map((exception) => ({ exception })))}>Export exceptions</button>
      </div>

      <div className="card"><div style={{ display: 'flex', justifyContent: 'space-between' }}><div><h3>Controls, incidents, agreements & claims</h3><p className="muted">Coverage matrix for non-financial diligence evidence.</p></div><button className="btn btn-secondary" onClick={() => downloadCsv('governance-coverage', governance)}>Export CSV</button></div>
        <DataTable rows={governance} columns={[{ key: 'register', label: 'Register' }, { key: 'status', label: 'Coverage' }, { key: 'source', label: 'Evidence source' }]} /></div>
    </div>
  </DashLayout>;
}
