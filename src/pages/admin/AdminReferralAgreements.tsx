import { useCallback, useEffect, useState } from 'react';
import DashLayout from '../../components/layout/DashLayout';
import { supabase } from '../../lib/supabase';
import { agreementPdf, downloadAgreement, electronicConsent, type ReferralAgreement } from '../../lib/referralAgreements';
import { ADMIN_NAV } from './adminNav';

type Order = { order_id: string; email: string; created_at: string; order_status: string; agreement_id: string | null; revision: number; collected_gross: number | null; sales_tax: number | null; product_cost: number | null; processing_fees: number | null; company_shipping: number | null; cash_loss: number | null; net_profit: number | null; commission: number | null; evidence: string | null; needs_review: boolean };
type Customer = { id: string; email: string; introduced_at: string; evidence: string };
type Account = { id: string; name: string; email: string };
type Payout = { id: string; amount: number; reference: string; paid_at: string };
type Audit = { id: number; action: string; created_at: string; actor_id: string; detail: { commission_adjustment?: number } };
const money = (n: number | null) => n === null ? 'Pending' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n));
const fieldStyle = { display: 'grid', gap: 6 } as const;
const financialFields = [
  ['collected_gross', 'Collected revenue before refunds, including tax'], ['sales_tax', 'Sales tax in original collections'],
  ['product_cost', 'Actual product cost'], ['processing_fees', 'Payment processing fees'],
  ['company_shipping', 'Shipping paid by Company'], ['cash_loss', 'Refund / chargeback principal, excluding tax and net of recoveries'],
] as const;

export default function AdminReferralAgreements() {
  const [account, setAccount] = useState<Account | null>(null);
  const [agreements, setAgreements] = useState<ReferralAgreement[]>([]);
  const [draft, setDraft] = useState<ReferralAgreement | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [signature, setSignature] = useState('');
  const [consent, setConsent] = useState(false);
  const [link, setLink] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const load = useCallback(async () => {
    if (!supabase) throw new Error('Supabase is not configured.');
    // Page every result set; totals must never silently stop at the API row limit.
    async function all<T>(table: string, order: string): Promise<T[]> {
      const rows: T[] = [];
      for (let offset = 0; ; offset += 500) {
        const result = await supabase!.from(table).select('*').order(order, { ascending: false }).range(offset, offset + 499);
        if (result.error) throw new Error(result.error.message);
        rows.push(...result.data as T[]);
        if (result.data.length < 500) return rows;
      }
    }
    const [a, c, o, p, events, accounts] = await Promise.all([
      all<ReferralAgreement>('referral_agreements', 'version'), all<Customer>('referral_customers', 'id'),
      all<Order>('referral_order_review', 'order_id'), all<Payout>('referral_payouts', 'id'), all<Audit>('referral_audit', 'id'),
      all<Account>('referral_accounts', 'id'),
    ]);
    setAgreements(a); setDraft(a[0] ?? null); setCustomers(c); setOrders(o); setPayouts(p); setAudit(events);
    setAccount(accounts[0] ?? null);
    setConfirmed(false); setConsent(false);
  }, []);
  useEffect(() => { void load().catch(e => setError(String(e))); }, [load]);
  async function run(work: () => Promise<void>) {
    setBusy(true); setError(''); setMessage('');
    try { await work(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  }
  async function action(name: string, data: Record<string, unknown> = {}) {
    if (!supabase) throw new Error('Service unavailable.');
    const result = await supabase.rpc('referral_admin', { p_action: name, p_data: data });
    if (result.error) throw new Error(result.error.message);
    await load();
    setMessage('Saved and audited.');
    return result.data;
  }
  const earned = orders.reduce((s, o) => s + Math.round(Number(o.commission ?? 0) * 100), 0) / 100;
  const paid = payouts.reduce((s, p) => s + Math.round(Number(p.amount) * 100), 0) / 100;
  const pending = orders.filter(o => o.needs_review).length;
  const saved = agreements.find(a => a.id === draft?.id);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  return <DashLayout title="Private Referral Agreements" navItems={ADMIN_NAV}>
    <p>{account ? `${account.name} · ${account.email}` : 'Private referral account'} · Platform administrators only</p>
    <p>Review the actual terms below. Creating a link does not send email. Commission figures require accounting review; recording a payout records an external payment and does not transfer money.</p>
    {error && <div className="alert alert-danger" role="alert">{error}</div>}
    {message && <div className="alert alert-info" role="status">{message}</div>}
    <section className="card card-body mb-6" style={{ display: 'grid', gap: 16 }}>
      <h2>Agreement review</h2>
      <label style={fieldStyle}>Version<select className="form-input" value={draft?.id ?? ''} onChange={e => { setDraft(agreements.find(a => a.id === e.target.value) ?? null); setConfirmed(false); setLink(''); }}>
        {agreements.map(a => <option key={a.id} value={a.id}>Version {a.version} — {a.status.replaceAll('_', ' ')}</option>)}
      </select></label>
      {draft && <>
        {(['company_name', 'payout_schedule', 'termination_terms', 'contact_email'] as const).map((key, i) => <label style={fieldStyle} key={key}>
          {['Company legal name', 'Payout schedule (timing, method, and reconciliation cutoff)', 'Termination and continuing commissions (notice, duration, and treatment of existing referrals)', 'Company contact email for records / paper signing'][i]}
          <textarea className="form-input" rows={key.endsWith('name') || key.endsWith('email') ? 1 : 3} disabled={draft.status !== 'draft' || busy} value={draft[key]} onChange={e => { setDraft({ ...draft, [key]: e.target.value }); setConfirmed(false); }} />
        </label>)}
        {draft.status === 'draft' && <button className="btn btn-secondary" disabled={busy || !dirty} onClick={() => void run(async () => { await action('save', { ...draft }); })}>Save terms and refresh draft</button>}
        {dirty && <p role="status">Save your changes to update the agreement preview before reviewing or issuing it.</p>}
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', lineHeight: 1.7 }}>{draft.terms}</pre>
        <button className="btn btn-secondary" disabled={busy || dirty} onClick={() => void run(() => downloadAgreement(draft))}>Download {draft.status === 'signed' ? 'signed' : 'review'} PDF</button>
        {(draft.status === 'draft' || draft.status === 'issued') && <>
          <label><input type="checkbox" checked={confirmed} disabled={dirty} onChange={e => setConfirmed(e.target.checked)} /> I reviewed this exact agreement and confirm the legal entity, payout schedule, and post-termination commission terms.</label>
          <button className="btn btn-primary" disabled={busy || dirty || !confirmed} onClick={() => void run(async () => {
            // Ensure the retained text is downloadable before freezing/issuing it.
            await agreementPdf(draft);
            const result = await action(draft.status === 'draft' ? 'issue' : 'rotate_link', { id: draft.id, revision: draft.revision, confirmed });
            setLink(`${window.location.origin}/referral-agreement/${result.id}#token=${result.token}`);
            setMessage('Private link created, valid for 7 days. No email has been sent. Any previous link is invalid.');
          })}>{draft.status === 'draft' ? 'Approve and create private signing link' : 'Replace expiring signing link'}</button>
          <button className="btn btn-secondary" disabled={busy} onClick={() => void run(async () => { await action('void', { id: draft.id, revision: draft.revision }); setLink(''); })}>Void unsigned version</button>
        </>}
        {link && <label style={fieldStyle}>Private signing link — shown only in this session<input className="form-input" readOnly value={link} onFocus={e => e.target.select()} /></label>}
        {draft.partner_signed_at && <p>Referrer signed {draft.partner_signed_at} as {draft.partner_signature}.</p>}
        {draft.status === 'partner_signed' && <>
          <label style={fieldStyle}>Authorized company signer name (use unaccented Latin characters)<input className="form-input" maxLength={200} pattern="[ -~]+" value={signature} onChange={e => setSignature(e.target.value)} /></label>
          <label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> {electronicConsent} I am authorized to bind {draft.company_name}.</label>
          <button className="btn btn-primary" disabled={busy || !consent || signature.trim().length < 3} onClick={() => void run(async () => { await action('countersign', { id: draft.id, revision: draft.revision, signature, consent }); })}>Countersign and lock agreement</button>
        </>}
        {draft.company_signed_at && <p>Company countersigned {draft.company_signed_at} as {draft.company_signature}. This signed version is locked.</p>}
      </>}
      <button className="btn btn-secondary" disabled={busy || agreements.some(a => ['draft', 'issued', 'partner_signed'].includes(a.status))} onClick={() => void run(async () => { await action('new_draft'); })}>Create new agreement version</button>
    </section>

    <section className="card card-body mb-6">
      <h2>Referred customers</h2>
      <p>Record the customer’s checkout email and actual introduction date. All matching orders on or after that date, including future repeat orders, appear below across storefronts. Attribute additional verified email addresses separately if a customer changes email.</p>
      <form style={{ display: 'grid', gap: 12 }} onSubmit={e => {
        e.preventDefault(); const form = e.currentTarget; const data = new FormData(form);
        void run(async () => { await action('attribute', { email: data.get('email'), introduced_at: new Date(String(data.get('introduced_at'))).toISOString(), evidence: data.get('evidence') }); form.reset(); });
      }}>
        <label style={fieldStyle}>Customer email<input className="form-input" name="email" type="email" required /></label>
        <label style={fieldStyle}>Introduced at (local time)<input className="form-input" name="introduced_at" type="datetime-local" required /></label>
        <label style={fieldStyle}>Introduction evidence<input className="form-input" name="evidence" minLength={5} required /></label>
        <button className="btn btn-primary" disabled={busy}>Attribute customer to {account?.name ?? 'referral account'}</button>
      </form>
      <ul>{customers.map(c => <li key={c.id}>{c.email} · {new Date(c.introduced_at).toLocaleString()} · {c.evidence}</li>)}</ul>
    </section>

    <section className="card card-body mb-6">
      <h2>Commission ledger</h2>
      <p>Earned: {money(earned)} · Paid: {money(paid)} · Outstanding: {money(earned - paid)} · Orders pending review: {pending}</p>
      <div className="table-wrap"><table className="table"><thead><tr><th>Order / customer</th><th>Gross collected</th><th>Tax</th><th>Product cost</th><th>Fees</th><th>Company shipping</th><th>Refunds / chargebacks</th><th>Net profit</th><th>50% earned</th><th>Review</th></tr></thead>
        <tbody>{orders.map(o => <tr key={o.order_id}><td>{o.order_id}<br />{o.email}<br />{o.order_status}{o.needs_review && <p>Accounting review required</p>}</td>{financialFields.map(([key]) => <td key={key}>{money(o[key])}</td>)}<td>{money(o.net_profit)}</td><td>{money(o.commission)}</td><td><button className="btn btn-secondary" disabled={busy} onClick={() => setSelectedOrder(o)}>Reconcile</button></td></tr>)}</tbody></table></div>
      {!orders.length && <p>No attributed orders yet.</p>}
      {selectedOrder && <form key={`${selectedOrder.order_id}-${selectedOrder.revision}`} style={{ display: 'grid', gap: 12, marginTop: 24 }} onSubmit={e => {
        e.preventDefault(); const data = Object.fromEntries(new FormData(e.currentTarget));
        void run(async () => { await action('reconcile', { ...data, order_id: selectedOrder.order_id, revision: selectedOrder.revision, confirmed: true }); setSelectedOrder(null); });
      }}>
        <h3>Reconcile {selectedOrder.order_id}</h3>
        <p>Enter cumulative totals, not changes. Use original gross collections; do not enter revenue already reduced by refunds. For a refunded chargeback, count only the actual unrecovered loss once. Deduct any recovered principal and refunded tax from the loss total. Costs must reflect actual costs after credits. Confirm that the selected agreement covers this order, including any termination provisions.</p>
        <label style={fieldStyle}>Signed agreement<select className="form-input" name="agreement_id" required defaultValue={selectedOrder.agreement_id ?? ''}>
          <option value="" disabled>Select signed version</option>{agreements.filter(a => a.status === 'signed' && (!selectedOrder.agreement_id || a.id === selectedOrder.agreement_id)).map(a => <option key={a.id} value={a.id}>Version {a.version}</option>)}
        </select></label>
        {financialFields.map(([key, label]) => <label key={key} style={fieldStyle}>{label}<input className="form-input" name={key} type="number" step="0.01" min="0" required defaultValue={selectedOrder[key] ?? ''} /></label>)}
        <label style={fieldStyle}>Evidence / reconciliation explanation<textarea className="form-input" name="evidence" minLength={5} required defaultValue={selectedOrder.evidence ?? ''} /></label>
        <label><input type="checkbox" required /> I verified the collections, tax, all permitted costs, and nonduplicated refund / chargeback losses against source records, and confirmed this order is eligible under the selected signed agreement.</label>
        <button className="btn btn-primary" disabled={busy}>Save reviewed totals and adjustment</button>
        <button className="btn btn-secondary" type="button" onClick={() => setSelectedOrder(null)}>Cancel</button>
      </form>}
    </section>

    <section className="card card-body mb-6"><h2>Payout history</h2>
      <form style={{ display: 'grid', gap: 12 }} onSubmit={e => {
        e.preventDefault(); const form = e.currentTarget; const data = new FormData(form);
        void run(async () => { await action('record_payout', { amount: data.get('amount'), reference: data.get('reference'), paid_at: new Date(String(data.get('paid_at'))).toISOString() }); form.reset(); });
      }}>
        <label style={fieldStyle}>Amount paid (USD)<input className="form-input" name="amount" type="number" min="0.01" step="0.01" required /></label>
        <label style={fieldStyle}>Payment reference<input className="form-input" name="reference" minLength={3} required /></label>
        <label style={fieldStyle}>Paid at (local time)<input className="form-input" name="paid_at" type="datetime-local" required /></label>
        <button className="btn btn-primary" disabled={busy}>Record completed external payout</button>
      </form>
      <ul>{payouts.map(p => <li key={p.id}>{money(p.amount)} · {new Date(p.paid_at).toLocaleString()} · {p.reference}</li>)}</ul>
    </section>
    <section className="card card-body"><h2>Audit and adjustments</h2><div className="table-wrap"><table className="table"><thead><tr><th>Event</th><th>UTC timestamp</th><th>Actor</th><th>Commission change</th></tr></thead><tbody>{audit.map(a => <tr key={a.id}><td>#{a.id} {a.action}</td><td>{a.created_at}</td><td>{a.actor_id}</td><td>{a.detail.commission_adjustment === undefined ? '—' : money(a.detail.commission_adjustment)}</td></tr>)}</tbody></table></div></section>
  </DashLayout>;
}
