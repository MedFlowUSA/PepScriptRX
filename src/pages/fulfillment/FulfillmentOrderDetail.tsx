import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashLayout from '../../components/layout/DashLayout';
import { supabase } from '../../lib/supabase';
import type { FulfillmentOrder, PatientSubmission } from '../../types';

const FF_NAV = [
  { label: 'Orders', path: '/fulfillment', icon: '📦' },
];

const STATUSES = ['not_sent', 'sent', 'in_progress', 'shipped', 'delivered', 'cancelled'];

export default function FulfillmentOrderDetail() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<FulfillmentOrder | null>(null);
  const [submission, setSubmission] = useState<PatientSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [status, setStatus]    = useState('not_sent');
  const [tracking, setTracking] = useState('');
  const [partner, setPartner]  = useState('');
  const [costBasis, setCostBasis] = useState('');
  const [retailPrice, setRetailPrice] = useState('');

  useEffect(() => {
    if (!supabase || !id) { setLoading(false); return; }
    supabase
      .from('fulfillment_orders')
      .select('*, submission:patient_submissions(*)')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        if (data) {
          const o = data as FulfillmentOrder;
          setOrder(o);
          setSubmission(o.submission as unknown as PatientSubmission);
          setStatus(o.fulfillment_status);
          setTracking(o.tracking_number ?? '');
          setPartner(o.fulfillment_partner ?? '');
          setCostBasis(o.cost_basis?.toString() ?? '');
          setRetailPrice(o.retail_price?.toString() ?? '');
        }
        setLoading(false);
      });
  }, [id]);

  async function handleSave() {
    if (!supabase || !id) return;
    setSaving(true);
    const cb = parseFloat(costBasis);
    const rp = parseFloat(retailPrice);
    await supabase!.from('fulfillment_orders').update({
      fulfillment_status: status,
      tracking_number:    tracking || null,
      fulfillment_partner: partner || null,
      cost_basis:         isFinite(cb) ? cb : null,
      retail_price:       isFinite(rp) ? rp : null,
      margin:             (isFinite(cb) && isFinite(rp)) ? rp - cb : null,
    }).eq('id', id);

    if (status === 'delivered') {
      await supabase!.from('patient_submissions').update({ status: 'fulfilled', updated_at: new Date().toISOString() }).eq('id', order!.submission_id);
      await supabase!.from('commission_ledger').update({ status: 'payable' }).eq('submission_id', order!.submission_id);
    }

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) {
    return (
      <DashLayout title="Order Detail" navItems={FF_NAV}>
        <div style={{ padding: 64, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      </DashLayout>
    );
  }

  return (
    <DashLayout
      title="Update Order"
      navItems={FF_NAV}
      actions={
        <div className="flex items-center gap-3">
          {saved && <span className="text-success text-sm">Saved.</span>}
          <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button>
        </div>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <Link to="/fulfillment" style={{ fontSize: 14, color: 'var(--text-muted)' }}>← All Orders</Link>
      </div>

      <div className="detail-grid">
        <div className="card">
          <div className="card-header" style={{ paddingBottom: 16 }}>
            <div className="card-title">Patient &amp; Order Info</div>
          </div>
          <div className="card-body">
            {submission && (
              <>
                <div className="detail-row"><span className="detail-label">Name</span><span className="detail-value">{submission.full_name}</span></div>
                <div className="detail-row"><span className="detail-label">Phone</span><span className="detail-value">{submission.phone}</span></div>
                <div className="detail-row"><span className="detail-label">Email</span><span className="detail-value">{submission.email}</span></div>
                <div className="detail-row"><span className="detail-label">State</span><span className="detail-value">{submission.state}</span></div>
                <div className="detail-row"><span className="detail-label">Medication</span><span className="detail-value" style={{ fontWeight: 700 }}>{submission.medication}</span></div>
                <div className="detail-row"><span className="detail-label">Dose</span><span className="detail-value">{submission.current_dose}</span></div>
                <div className="detail-row"><span className="detail-label">Sale price</span><span className="detail-value" style={{ fontWeight: 700, color: 'var(--success)' }}>{submission.quoted_price ? `$${submission.quoted_price.toFixed(2)}` : '—'}</span></div>
              </>
            )}
          </div>
        </div>

        <div>
          <div className="card">
            <div className="card-header" style={{ paddingBottom: 16 }}>
              <div className="card-title">Fulfillment Update</div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Fulfillment status</label>
                <select className="form-select" value={status} onChange={(e) => setStatus(e.target.value)}>
                  {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Fulfillment partner</label>
                <input type="text" className="form-input" placeholder="Partner name…" value={partner} onChange={(e) => setPartner(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Tracking number</label>
                <input type="text" className="form-input" placeholder="Carrier tracking #" value={tracking} onChange={(e) => setTracking(e.target.value)} />
              </div>
              <div className="form-grid form-grid-2">
                <div className="form-group">
                  <label className="form-label">Cost basis ($)</label>
                  <input type="number" className="form-input" step="0.01" placeholder="0.00" value={costBasis} onChange={(e) => setCostBasis(e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Retail price ($)</label>
                  <input type="number" className="form-input" step="0.01" placeholder="0.00" value={retailPrice} onChange={(e) => setRetailPrice(e.target.value)} />
                </div>
              </div>
              {costBasis && retailPrice && (
                <div style={{ background: 'var(--card-soft)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', fontSize: 14 }}>
                  Margin: <strong>${(parseFloat(retailPrice) - parseFloat(costBasis)).toFixed(2)}</strong>
                </div>
              )}
              <button className="btn btn-primary w-full" onClick={handleSave} disabled={saving} style={{ justifyContent: 'center' }}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Setting status to "delivered" will automatically mark the order as fulfilled and release rep commission.</p>
            </div>
          </div>
        </div>
      </div>
    </DashLayout>
  );
}
