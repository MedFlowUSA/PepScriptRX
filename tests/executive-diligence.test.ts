import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildDiligenceReport, recognizedRevenue, rowsToCsv, type DiligenceOrder } from '../src/lib/executiveDiligence.ts';

const order = (partial: Partial<DiligenceOrder>): DiligenceOrder => ({
  id: crypto.randomUUID(), created_at: '2026-01-01T00:00:00Z', ...partial,
});

describe('executive diligence reporting', () => {
  it('uses amount due as the canonical revenue value', () => {
    assert.equal(recognizedRevenue(order({ amount_due_cents: 12345, order_total: 999 })), 123.45);
  });

  it('separates first-month and repeat-month revenue', () => {
    const report = buildDiligenceReport([
      order({ id: '1', email: 'Person@Example.com', payment_status: 'paid', paid_at: '2026-01-05', amount_due_cents: 10000 }),
      order({ id: '2', email: 'person@example.com', payment_status: 'paid', paid_at: '2026-02-05', amount_due_cents: 15000 }),
    ], [], []);
    assert.equal(report.monthly[0].repeatRevenue, 0);
    assert.equal(report.monthly[1].repeatRevenue, 150);
    assert.deepEqual(
      { customers: report.cohorts[0].customers, repeatCustomers: report.cohorts[0].repeatCustomers, paidOrders: report.cohorts[0].paidOrders, revenue: report.cohorts[0].revenue },
      { customers: 1, repeatCustomers: 1, paidOrders: 2, revenue: 250 },
    );
  });

  it('reconciles concentration, liabilities, costs, and inventory', () => {
    const report = buildDiligenceReport([
      order({ status: 'fulfilled', store_name: 'Clinic A', product_name: 'Product X', order_total: 200, cost_of_goods: 50 }),
    ], [{ status: 'payable', commission_amount: 25 }], [
      { current_qty: 10, true_landed_cost_per_vial: 4, reorder_level: 3 },
    ]);
    assert.equal(report.partners[0].share, 100);
    assert.deepEqual(
      { recognizedRevenue: report.totals.recognizedRevenue, recordedCogs: report.totals.recordedCogs, grossMargin: report.totals.grossMargin, repLiability: report.totals.repLiability, inventoryExposure: report.totals.inventoryExposure },
      { recognizedRevenue: 200, recordedCogs: 50, grossMargin: 150, repLiability: 25, inventoryExposure: 40 },
    );
  });

  it('escapes CSV values', () => {
    assert.match(rowsToCsv([{ name: 'A, "B"', value: 2 }]), /"A, ""B"""/);
  });
});
