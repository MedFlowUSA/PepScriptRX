import { useEffect, useState } from 'react';
import DashLayout from '../../components/layout/DashLayout';
import { supabase } from '../../lib/supabase';
import type { Rep } from '../../types';
import { buildReferralLink, REFERRAL_DISPLAY_BASE_URL } from '../../config/referrals';
import { useAuth } from '../../context/AuthContext';

import { ADMIN_NAV, RX_PLUS_ADMIN_NAV } from './adminNav';

interface RepPerf {
  leads: number;
  conversions: number;
  revenue: number;
  override: number;
}

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
  const { profile } = useAuth();
  const [reps, setReps] = useState<Rep[]>([]);
  const [parentRep, setParentRep] = useState<Rep | null>(null);
  const [repById, setRepById] = useState<Record<string, Rep>>({});
  const [perfMap, setPerfMap] = useState<Record<string, RepPerf>>({});
  const [loading, setLoading] = useState(true);

  // Create modal
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createForm, setCreateForm] = useState<CreateForm>({
    rep_slug: '', commission_rate: '20', payout_email: '', discount_code: '', discount_amount: '0',
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
  const isScopedRxPlusAdmin = profile?.role === 'rx_plus_admin';

  useEffect(() => { loadReps(); }, [profile?.id, profile?.role]);

  async function loadReps() {
    if (!supabase) { setLoading(false); return; }
    if (isScopedRxPlusAdmin && !profile) { setLoading(false); return; }
    setLoading(true);

    let repData: Rep[] = [];
    let scopedParent: Rep | null = null;

    if (isScopedRxPlusAdmin && profile) {
      const { data: parentData } = await supabase
        .from('reps')
        .select('*')
        .or(`profile_id.eq.${profile.id},managed_by_profile_id.eq.${profile.id},payout_email.eq.${profile.email}`)
        .is('parent_rep_id', null)
        .order('created_at', { ascending: true })
        .limit(10);

      scopedParent = ((parentData as Rep[]) ?? [])[0] ?? null;
      setParentRep(scopedParent);

      if (scopedParent) {
        const { data } = await supabase
          .from('reps')
          .select('*')
          .eq('managed_by_profile_id', profile.id)
          .order('created_at', { ascending: false });
        repData = (data as Rep[]) ?? [];
      }
    } else {
      const { data } = await supabase
        .from('reps')
        .select('*')
        .order('created_at', { ascending: false });
      repData = (data as Rep[]) ?? [];
    }

    setReps(repData);
    const { data: allRepRows } = await supabase
      .from('reps')
      .select('*');
    const allRepMap: Record<string, Rep> = {};
    ((allRepRows as Rep[]) ?? repData).forEach((rep) => { allRepMap[rep.id] = rep; });
    setRepById(allRepMap);

    const repIds = repData.map((rep) => rep.id);
    const ledgerRepIds = isScopedRxPlusAdmin && scopedParent
      ? [scopedParent.id, ...repIds]
      : repIds;
    const [{ data: subData }, { data: ledgerData }] = await Promise.all([
      repIds.length > 0
        ? supabase
          .from('patient_submissions')
          .select('rep_id, status, quoted_price')
          .in('rep_id', repIds)
        : Promise.resolve({ data: [] }),
      ledgerRepIds.length > 0
        ? supabase
          .from('commission_ledger')
          .select('rep_id, commission_role, commission_amount')
          .in('rep_id', ledgerRepIds)
        : Promise.resolve({ data: [] }),
    ]);

    const map: Record<string, RepPerf> = {};
    ((subData ?? []) as { rep_id: string; status: string; quoted_price: number | null }[]).forEach((row) => {
      if (!row.rep_id) return;
      if (!map[row.rep_id]) map[row.rep_id] = { leads: 0, conversions: 0, revenue: 0, override: 0 };
      map[row.rep_id].leads++;
      if (row.status === 'paid' || row.status === 'fulfilled') {
        map[row.rep_id].conversions++;
        map[row.rep_id].revenue += row.quoted_price ?? 0;
      }
    });
    ((ledgerData ?? []) as { rep_id: string; commission_role: string | null; commission_amount: number | null }[]).forEach((row) => {
      if (!row.rep_id || row.commission_role !== 'override_owner') return;
      if (!map[row.rep_id]) map[row.rep_id] = { leads: 0, conversions: 0, revenue: 0, override: 0 };
      map[row.rep_id].override += Number(row.commission_amount ?? 0);
    });
    setPerfMap(map);
    setLoading(false);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreateError('');
    if (isScopedRxPlusAdmin && (!profile || !parentRep)) {
      setCreateError('Your distributor profile is not connected yet.');
      return;
    }
    setCreating(true);
    const slug = createForm.rep_slug.toUpperCase().trim();
    const commissionRate = Math.max(0, Math.min(100, parseFloat(createForm.commission_rate || '0'))) / 100;
    const { error: err } = await supabase!.from('reps').insert({
      rep_slug:           slug,
      rep_name:           slug,
      commission_type:    'net_profit_share',
      commission_rate:    commissionRate,
      payout_email:       createForm.payout_email.trim(),
      discount_code:      createForm.discount_code.trim().toUpperCase() || null,
      discount_amount:    parseFloat(createForm.discount_amount || '0'),
      referral_path:      `/r/${slug}`,
      attribution_locked: true,
      attribution_window_days: 60,
      rep_tier:           isScopedRxPlusAdmin ? 'rx_plus_sub_rep' : 'standard_rep',
      rep_channel:        isScopedRxPlusAdmin ? 'rx_plus_downline' : 'company_direct',
      parent_rep_id:      isScopedRxPlusAdmin ? parentRep?.id : null,
      managed_by_profile_id: isScopedRxPlusAdmin ? profile?.id : null,
      active:             true,
    });
    if (err) {
      setCreateError(err.message);
    } else {
      setShowCreate(false);
      setCreateForm({ rep_slug: '', commission_rate: '20', payout_email: '', discount_code: '', discount_amount: '0' });
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
    let updateQuery = supabase!.from('reps').update({
      rep_name:        editForm.rep_name.trim() || null,
      commission_rate: parseFloat(editForm.commission_rate) / 100,
      payout_email:    editForm.payout_email.trim(),
      discount_code:   editForm.discount_code.trim().toUpperCase() || null,
      discount_amount: parseFloat(editForm.discount_amount || '0'),
      rep_tier:        editForm.rep_tier.trim() || null,
      handle:          editForm.handle.trim() || null,
    }).eq('id', editingRep.id);
    if (isScopedRxPlusAdmin && profile) updateQuery = updateQuery.eq('managed_by_profile_id', profile.id);
    const { error: err } = await updateQuery;
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
    let updateQuery = supabase!.from('reps').update({ active: !rep.active }).eq('id', rep.id);
    if (isScopedRxPlusAdmin && profile) updateQuery = updateQuery.eq('managed_by_profile_id', profile.id);
    await updateQuery;
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

  function getStoreSlug(rep: Rep): string | null {
    if (rep.custom_store_slug) return rep.custom_store_slug;
    if (rep.rep_slug === 'GUY60') return 'aactivated';
    if (rep.rep_slug === 'ROBERT') return 'warxlabz';
    if (rep.rep_slug === 'MARK65') return 'EmpireHealth&Wellness';
    return null;
  }

  return (
    <DashLayout
      title={isScopedRxPlusAdmin ? 'My Reps' : 'Reps & Marketers'}
      navItems={isScopedRxPlusAdmin ? RX_PLUS_ADMIN_NAV : ADMIN_NAV}
      actions={<button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>+ Add Rep</button>}
    >
      {flash && (
        <div style={{ background: 'var(--success-bg)', border: '1px solid var(--success)', color: 'var(--success)', borderRadius: 'var(--radius-sm)', padding: '10px 16px', marginBottom: 16, fontSize: 14, fontWeight: 600 }}>
          {flash}
        </div>
      )}

      {/* Leaderboard */}
      {!loading && reps.length > 0 && (() => {
        const ranked = [...reps]
          .map((r) => ({ rep: r, perf: perfMap[r.id] ?? { leads: 0, conversions: 0, revenue: 0, override: 0 } }))
          .sort((a, b) => b.perf.revenue - a.perf.revenue || b.perf.conversions - a.perf.conversions || b.perf.leads - a.perf.leads)
          .slice(0, 3);
        const totalRevenue = Object.values(perfMap).reduce((s, p) => s + p.revenue, 0);
        const totalLeads   = Object.values(perfMap).reduce((s, p) => s + p.leads, 0);
        const totalConv    = Object.values(perfMap).reduce((s, p) => s + p.conversions, 0);
        return (
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--success)' }}>${totalRevenue.toFixed(2)}</div>
                <div className="stat-label">Total Rep Revenue</div>
              </div>
              {parentRep && (
                <div className="stat-card">
                  <div className="stat-value" style={{ color: 'var(--warning)' }}>
                    ${(perfMap[parentRep.id]?.override ?? 0).toFixed(2)}
                  </div>
                  <div className="stat-label">Override Commissions</div>
                </div>
              )}
              <div className="stat-card">
                <div className="stat-value">{totalLeads}</div>
                <div className="stat-label">Total Leads</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{totalConv}</div>
                <div className="stat-label">Total Conversions</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{totalLeads > 0 ? ((totalConv / totalLeads) * 100).toFixed(1) : '0'}%</div>
                <div className="stat-label">Overall Conv. Rate</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
              {ranked.map(({ rep, perf }, i) => (
                <div key={rep.id} className="card" style={{ padding: '16px 20px', borderLeft: i === 0 ? '3px solid var(--teal)' : undefined }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      #{i + 1} {i === 0 ? '🏆' : i === 1 ? '🥈' : '🥉'}
                    </div>
                    <span className={`badge ${rep.active ? 'badge-success' : 'badge-default'}`} style={{ fontSize: 10 }}>{rep.active ? 'Active' : 'Inactive'}</span>
                  </div>
                  <div style={{ fontWeight: 800, color: 'var(--navy)', fontSize: 15 }}>{rep.rep_name || rep.rep_slug}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>{rep.rep_slug} · {(rep.commission_rate * 100).toFixed(0)}% commission</div>
                  <div style={{ display: 'flex', gap: 16 }}>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--success)' }}>${perf.revenue.toFixed(0)}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Revenue</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)' }}>{perf.leads}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Leads</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--teal)' }}>{perf.conversions}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sales</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })()}

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
                  <label className="form-label form-required">Negotiated commission (%)</label>
                  <input type="number" className="form-input" required step="1" min="0" max="100"
                    value={createForm.commission_rate}
                    onChange={(e) => setCreateForm({ ...createForm, commission_rate: e.target.value })} />
                  <p className="form-help">{createForm.commission_rate}% of net profit per sale. This can be negotiated per rep.</p>
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
                    <label className="form-label form-required">Negotiated commission (%)</label>
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
                  <th>Parent</th>
                  <th>Referral Link</th>
                  <th>Storefront</th>
                  <th>Pricing</th>
                  <th>PayPal</th>
                  <th>Tier</th>
                  <th>Commission</th>
                  <th>Leads</th>
                  <th>Sales</th>
                  <th>Revenue</th>
                  <th>Conv.%</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reps.length === 0 ? (
                  <tr><td colSpan={15}>
                    <div className="empty-state" style={{ padding: '40px 0' }}>
                      <div className="empty-state-title">No reps yet</div>
                      <div className="empty-state-desc">Add your first rep to get started.</div>
                    </div>
                  </td></tr>
                ) : reps.map((rep) => {
                  const perf = perfMap[rep.id] ?? { leads: 0, conversions: 0, revenue: 0, override: 0 };
                  const parent = rep.parent_rep_id ? repById[rep.parent_rep_id] : null;
                  const storeSlug = getStoreSlug(rep);
                  const convRate = perf.leads > 0 ? ((perf.conversions / perf.leads) * 100).toFixed(0) : '0';
                  return (
                  <tr key={rep.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--navy)' }}>{rep.rep_name || rep.rep_slug}</div>
                      {rep.handle && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{rep.handle}</div>}
                    </td>
                    <td><span style={{ fontWeight: 700, color: 'var(--navy)' }}>{rep.rep_slug}</span></td>
                    <td>
                      <div style={{ fontSize: 13, fontWeight: 700, color: parent ? 'var(--navy)' : 'var(--text-muted)' }}>
                        {parent ? (parent.brand_name || parent.rep_name || parent.rep_slug) : 'PepScriptRX'}
                      </div>
                      {parent?.brand_name && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{parent.rep_name}</div>}
                    </td>
                    <td>
                      <a href={buildReferralLink(rep.rep_slug, origin)} target="_blank" rel="noreferrer"
                        style={{ fontSize: 13, color: 'var(--teal)' }}>
                        /r/{rep.rep_slug}
                      </a>
                    </td>
                    <td>
                      {storeSlug ? (
                        <a href={`/${storeSlug}`} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--teal)', fontWeight: 700 }}>
                          /{storeSlug}
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                    <td style={{ fontSize: 13, fontWeight: 700, color: rep.custom_price_list?.length ? 'var(--navy)' : 'var(--text-muted)' }}>
                      {rep.custom_price_list?.length ? `${rep.custom_price_list.length} custom prices` : 'Standard'}
                    </td>
                    <td>
                      {rep.paypal_link ? (
                        <a href={rep.paypal_link} target="_blank" rel="noreferrer" style={{ fontSize: 13, color: 'var(--teal)', fontWeight: 700 }}>
                          PayPal
                        </a>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>-</span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-purple">
                        {(rep.rep_tier || 'standard rep').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700 }}>{(rep.commission_rate * 100).toFixed(0)}%</td>
                    <td style={{ fontWeight: 600 }}>{perf.leads}</td>
                    <td style={{ fontWeight: 600, color: perf.conversions > 0 ? 'var(--teal)' : undefined }}>{perf.conversions}</td>
                    <td style={{ fontWeight: 700, color: perf.revenue > 0 ? 'var(--success)' : 'var(--text-muted)' }}>
                      {perf.revenue > 0 ? `$${perf.revenue.toFixed(0)}` : '—'}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>{convRate}%</td>
                    <td>
                      <span className={`badge ${rep.active ? 'badge-success' : 'badge-default'}`}>
                        {rep.active ? 'Active' : 'Inactive'}
                      </span>
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
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashLayout>
  );
}
