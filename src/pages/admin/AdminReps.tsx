import { useEffect, useState } from 'react';
import DashLayout from '../../components/layout/DashLayout';
import { supabase } from '../../lib/supabase';
import type { Rep } from '../../types';
import { buildReferralLink, REFERRAL_DISPLAY_BASE_URL } from '../../config/referrals';

import { ADMIN_NAV } from './adminNav';

interface CreateForm {
  rep_slug: string;
  commission_rate: string;
  payout_email: string;
  discount_code: string;
  discount_amount: string;
}

interface EditForm {
  rep_name: string;
  commission_rate: string;
  payout_email: string;
  discount_code: string;
  discount_amount: string;
  rep_tier: string;
  handle: string;
}

export default function AdminReps() {
  const [reps, setReps] = useState<Rep[]>([]);
  const [loading, setLoading] = useState(true);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({
    rep_slug: '', commission_rate: '0.20', payout_email: '', discount_code: '', discount_amount: '0',
  });
  const [createError, setCreateError] = useState('');

  // Edit modal
  const [editingRep, setEditingRep] = useState<Rep | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({
    rep_name: '', commission_rate: '', payout_email: '', discount_code: '', discount_amount: '', rep_tier: '', handle: '',
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => { loadReps(); }, []);

  async function loadReps() {
    if (!supabase) { setLoading(false); return; }
    const { data } = await supabase.from('reps').select('*').order('created_at', { ascending: false });
    setReps((data as Rep[]) ?? []);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    const slug = createForm.rep_slug.toUpperCase().trim();
    const { error: err } = await supabase!.from('reps').insert({
      rep_slug:           slug,
      commission_rate:    parseFloat(createForm.commission_rate),
      payout_email:       createForm.payout_email.trim(),
      discount_code:      createForm.discount_code.trim().toUpperCase() || null,
      discount_amount:    parseFloat(createForm.discount_amount || '0'),
      referral_path:      `/r/${slug}`,
      attribution_locked: true,
      active:             true,
    });
    if (err) {
      setCreateError(err.message);
    } else {
      setShowCreate(false);
      setCreateForm({ rep_slug: '', commission_rate: '0.20', payout_email: '', discount_code: '', discount_amount: '0' });
      showFlash('Rep created.');
      await loadReps();
    }
    setCreating(false);
  }

  function openEdit(rep: Rep) {
    setEditingRep(rep);
    setEditForm({
      rep_name:        rep.rep_name ?? '',
      commission_rate: (rep.commission_rate * 100).toFixed(0),
      payout_email:    rep.payout_email ?? '',
      discount_code:   rep.discount_code ?? '',
      discount_amount: (rep.discount_amount ?? 0).toString(),
      rep_tier:        rep.rep_tier ?? '',
      handle:          rep.handle ?? '',
    });
    setEditError('');
  }

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editingRep) return;
    setEditError('');
    setEditSaving(true);
    const { error: err } = await supabase!.from('reps').update({
      rep_name:        editForm.rep_name.trim() || null,
      commission_rate: parseFloat(editForm.commission_rate) / 100,
      payout_email:    editForm.payout_email.trim(),
      discount_code:   editForm.discount_code.trim().toUpperCase() || null,
      discount_amount: parseFloat(editForm.discount_amount || '0'),
      rep_tier:        editForm.rep_tier.trim() || null,
      handle:          editForm.handle.trim() || null,
    }).eq('id', editingRep.id);
    if (err) {
      setEditError(err.message);
    } else {
      setEditingRep(null);
      showFlash('Rep updated.');
      await loadReps();
    }
    setEditSaving(false);
  }

  async function toggleActive(rep: Rep) {
    await supabase!.from('reps').update({ active: !rep.active }).eq('id', rep.id);
    setReps((prev) => prev.map((r) => r.id === rep.id ? { ...r, active: !r.active } : r));
  }

  function showFlash(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 3000);
  }

  const origin = REFERRAL_DISPLAY_BASE_URL;

  const REP_TIERS = [
    { value: '', label: 'Standard Rep (default)' },
    { value: 'standard_rep', label: 'Standard Rep' },
    { value: 'senior_rep', label: 'Senior Rep' },
    { value: 'team_lead', label: 'Team Lead' },
    { value: 'affiliate', label: 'Affiliate' },
    { value: 'influencer', label: 'Influencer' },
  ];

  return (
    <DashLayout
      title="Reps & Marketers"
      navItems={ADMIN_NAV}
      actions={<button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ Add Rep</button>}
    >
      {flash && (
        <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success)', color: 'var(--success)', borderRadius: 'var(--radius-sm)', padding: '10px 16px', marginBottom: 16, fontSize: 14, fontWeight: 600 }}>
          {flash}
        </div>
      )}

      {/* Create Rep modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Add New Rep</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>✕</button>
            </div>
            <form onSubmit={handleCreate}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {createError && <div className="alert alert-error">{createError}</div>}
                <div className="form-group">
                  <label className="form-label form-required">Rep slug (used in link)</label>
                  <input type="text" className="form-input" required placeholder="CYNTHIA"
                    value={createForm.rep_slug} onChange={(e) => setCreateForm({ ...createForm, rep_slug: e.target.value })} />
                  <p className="form-help">{buildReferralLink((createForm.rep_slug || 'SLUG').toUpperCase(), origin)}</p>
                </div>
                <div className="form-group">
                  <label className="form-label form-required">Commission rate (%)</label>
                  <input type="number" className="form-input" required step="1" min="0" max="100"
                    value={createForm.commission_rate}
                    onChange={(e) => setCreateForm({ ...createForm, commission_rate: e.target.value })} />
                  <p className="form-help">{createForm.commission_rate}% of net profit per sale</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Customer discount code</label>
                  <input type="text" className="form-input" placeholder="RICK50"
                    value={createForm.discount_code} onChange={(e) => setCreateForm({ ...createForm, discount_code: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Customer discount ($)</label>
                  <input type="number" className="form-input" step="0.01" min="0"
                    value={createForm.discount_amount} onChange={(e) => setCreateForm({ ...createForm, discount_amount: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Payout email (PayPal)</label>
                  <input type="email" className="form-input" placeholder="rep@example.com"
                    value={createForm.payout_email} onChange={(e) => setCreateForm({ ...createForm, payout_email: e.target.value })} />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={creating}>{creating ? 'Creating…' : 'Create Rep'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Rep modal */}
      {editingRep && (
        <div className="modal-overlay" onClick={() => setEditingRep(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="modal-title">Edit Rep — {editingRep.rep_slug}</div>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditingRep(null)}>✕</button>
            </div>
            <form onSubmit={handleEditSave}>
              <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {editError && <div className="alert alert-error">{editError}</div>}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Rep name (display name)</label>
                    <input type="text" className="form-input" placeholder="Jane Smith"
                      value={editForm.rep_name} onChange={(e) => setEditForm({ ...editForm, rep_name: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label form-required">Commission rate (%)</label>
                    <input type="number" className="form-input" required step="1" min="0" max="100"
                      value={editForm.commission_rate}
                      onChange={(e) => setEditForm({ ...editForm, commission_rate: e.target.value })} />
                    <p className="form-help">{editForm.commission_rate}% of net profit</p>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Tier</label>
                    <select className="form-select" value={editForm.rep_tier}
                      onChange={(e) => setEditForm({ ...editForm, rep_tier: e.target.value })}>
                      {REP_TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Discount code</label>
                    <input type="text" className="form-input" placeholder="SLUG50"
                      value={editForm.discount_code}
                      onChange={(e) => setEditForm({ ...editForm, discount_code: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Discount amount ($)</label>
                    <input type="number" className="form-input" step="0.01" min="0"
                      value={editForm.discount_amount}
                      onChange={(e) => setEditForm({ ...editForm, discount_amount: e.target.value })} />
                  </div>
                  <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                    <label className="form-label">Payout email (PayPal)</label>
                    <input type="email" className="form-input" placeholder="rep@example.com"
                      value={editForm.payout_email}
                      onChange={(e) => setEditForm({ ...editForm, payout_email: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Handle / @username</label>
                    <input type="text" className="form-input" placeholder="@handle"
                      value={editForm.handle}
                      onChange={(e) => setEditForm({ ...editForm, handle: e.target.value })} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Referral link preview</label>
                    <div style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--teal)', padding: '10px 12px', background: 'var(--card-soft)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                      {buildReferralLink(editingRep.rep_slug, origin)}
                    </div>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-ghost" onClick={() => setEditingRep(null)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={editSaving}>{editSaving ? 'Saving…' : 'Save Changes'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="card">
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Rep</th>
                  <th>Code</th>
                  <th>Referral Link</th>
                  <th>Tier</th>
                  <th>Commission</th>
                  <th>Discount</th>
                  <th>Payout Email</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reps.length === 0 ? (
                  <tr><td colSpan={10}>
                    <div className="empty-state" style={{ padding: '40px 0' }}>
                      <div className="empty-state-title">No reps yet</div>
                      <div className="empty-state-desc">Add your first rep to get started.</div>
                    </div>
                  </td></tr>
                ) : reps.map((rep) => (
                  <tr key={rep.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{rep.rep_name || rep.rep_slug}</div>
                      {rep.handle && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{rep.handle}</div>}
                    </td>
                    <td><span style={{ fontWeight: 700, color: 'var(--navy)' }}>{rep.rep_slug}</span></td>
                    <td>
                      <a href={buildReferralLink(rep.rep_slug, origin)} target="_blank" rel="noreferrer"
                        style={{ fontSize: 13, color: 'var(--teal)' }}>
                        /r/{rep.rep_slug}
                      </a>
                    </td>
                    <td>
                      <span className="badge badge-purple">
                        {(rep.rep_tier || 'standard rep').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700 }}>{(rep.commission_rate * 100).toFixed(0)}%</td>
                    <td>{rep.discount_code ? `${rep.discount_code} — $${(rep.discount_amount ?? 0).toFixed(2)} off` : '—'}</td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{rep.payout_email || '—'}</td>
                    <td>
                      <span className={`badge ${rep.active ? 'badge-success' : 'badge-default'}`}>
                        {rep.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {new Date(rep.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(rep)}>Edit</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => toggleActive(rep)}>
                          {rep.active ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashLayout>
  );
}
