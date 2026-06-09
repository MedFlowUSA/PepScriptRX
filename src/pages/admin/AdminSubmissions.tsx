import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import DashLayout from '../../components/layout/DashLayout';
import { supabase } from '../../lib/supabase';
import type { PatientSubmission, SubmissionStatus } from '../../types';
import { STATUS_LABELS, STATUS_COLORS, ALL_STATUSES, CUSTOMER_MANUAL_REVIEW_STATUS_LABELS } from '../../types';
import { useRealtime } from '../../hooks/useRealtime';
import { useAuth } from '../../context/AuthContext';
import { isAactivatedOrder, isAactivatedPartnerAdmin } from '../../lib/aactivatedScope';

import { ADMIN_NAV } from './adminNav';

export default function AdminSubmissions() {
  const { profile } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [submissions, setSubmissions] = useState<PatientSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<SubmissionStatus>('under_review');
  const [bulkApplying, setBulkApplying] = useState(false);

  const statusFilter = searchParams.get('status') as SubmissionStatus | null;
  const [newToast, setNewToast] = useState(false);

  const loadSubmissions = useCallback(async () => {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    let q = supabase
      .from('patient_submissions')
      .select('*, rep:reps!patient_submissions_rep_id_fkey(rep_slug)')
      .order('created_at', { ascending: false });
    if (statusFilter) q = q.eq('status', statusFilter);
    const { data } = await q;
    const nextRows = (data as PatientSubmission[]) ?? [];
    setSubmissions(isAactivatedPartnerAdmin(profile) ? nextRows.filter(isAactivatedOrder) : nextRows);
    setLoading(false);
  }, [profile, statusFilter]);

  useEffect(() => { loadSubmissions(); }, [loadSubmissions]);

  const onRealtimeChange = useCallback(() => {
    setNewToast(true);
    loadSubmissions();
  }, [loadSubmissions]);

  useRealtime('admin-submissions', 'patient_submissions', undefined, onRealtimeChange);

  const filtered = submissions.filter((s) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      s.full_name?.toLowerCase().includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.medication?.toLowerCase().includes(q) ||
      s.state?.toLowerCase().includes(q)
    );
  });

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const allIds = filtered.map((s) => s.id);
    const allChecked = allIds.every((id) => selected.has(id));
    setSelected(allChecked ? new Set() : new Set(allIds));
  }

  async function applyBulk() {
    if (!supabase || selected.size === 0) return;
    setBulkApplying(true);
    await supabase
      .from('patient_submissions')
      .update({ status: bulkStatus, updated_at: new Date().toISOString() })
      .in('id', Array.from(selected));
    setSelected(new Set());
    await loadSubmissions();
    setBulkApplying(false);
  }

  function exportCsv() {
    const esc = (v: string | number | null | undefined) => {
      const s = v == null ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = ['Name', 'Email', 'Phone', 'Medication', 'Dose', 'State', 'DOB',
      'Current Price', 'Quoted Price', 'Rep', 'Discount Code', 'Status', 'Customer Link Review', 'Submitted'];
    const rows = filtered.map((s) => [
      s.full_name, s.email, s.phone, s.medication, s.current_dose, s.state, s.date_of_birth,
      s.current_price ?? '', s.quoted_price ?? '',
      (s.rep as unknown as { rep_slug: string })?.rep_slug ?? '',
      s.discount_code ?? '', s.status,
      s.manual_review_status ? CUSTOMER_MANUAL_REVIEW_STATUS_LABELS[s.manual_review_status] : '',
      new Date(s.created_at).toLocaleDateString(),
    ].map(esc).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <DashLayout title="Orders" navItems={ADMIN_NAV}>
      {newToast && (
        <div
          style={{ marginBottom: 12, padding: '10px 16px', background: 'var(--success-bg)', border: '1px solid rgba(34,197,94,.25)', borderRadius: 'var(--radius-sm)', fontSize: 13, fontWeight: 600, color: 'var(--success)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        >
          <span>Live update — submission list refreshed.</span>
          <button onClick={() => setNewToast(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--success)', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
      )}
      <div className="card">
        <div className="filter-bar" style={{ borderBottom: '1px solid var(--border)', gap: 12 }}>
          <input
            type="search"
            className="form-input"
            style={{ maxWidth: 260 }}
            placeholder="Search by name, email, medication..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="form-select"
            style={{ maxWidth: 220 }}
            value={statusFilter ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              if (v) setSearchParams({ status: v });
              else setSearchParams({});
            }}
          >
            <option value="">All statuses</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <span className="text-muted text-sm" style={{ marginLeft: 'auto' }}>
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
          <button className="btn btn-outline btn-sm" onClick={exportCsv} title="Download current view as CSV">
            Export CSV
          </button>
        </div>

        {selected.size > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 20px', background: 'rgba(37,199,217,.07)', borderBottom: '1px solid rgba(37,199,217,.2)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--teal)' }}>{selected.size} selected</span>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Change status to:</span>
            <select
              className="form-select"
              style={{ maxWidth: 220, padding: '5px 10px', fontSize: 13 }}
              value={bulkStatus}
              onChange={(e) => setBulkStatus(e.target.value as SubmissionStatus)}
            >
              {ALL_STATUSES.map((s) => (
                <option key={s} value={s}>{STATUS_LABELS[s]}</option>
              ))}
            </select>
            <button className="btn btn-primary btn-sm" onClick={applyBulk} disabled={bulkApplying}>
              {bulkApplying ? 'Applying…' : `Apply to ${selected.size}`}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        )}

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      checked={filtered.length > 0 && filtered.every((s) => selected.has(s.id))}
                      onChange={toggleAll}
                      style={{ cursor: 'pointer' }}
                      title="Select all"
                    />
                  </th>
                  <th>Patient</th>
                  <th>Medication / Dose</th>
                  <th>State</th>
                  <th>Current Price</th>
                  <th>Quoted</th>
                  <th>Rep</th>
                  <th>Status</th>
                  <th>Customer Link</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={11}>
                    <div className="empty-state" style={{ padding: '40px 0' }}>
                      <div className="empty-state-title">No submissions found</div>
                    </div>
                  </td></tr>
                ) : filtered.map((s) => (
                  <tr key={s.id} style={{ background: selected.has(s.id) ? 'rgba(37,199,217,.04)' : undefined }}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => toggleOne(s.id)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, color: 'var(--navy)' }}>{s.full_name}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{s.email}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.phone}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>{s.medication}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{s.current_dose}</div>
                    </td>
                    <td>{s.state}</td>
                    <td>{s.current_price ? `$${s.current_price.toFixed(2)}` : '-'}</td>
                    <td style={{ fontWeight: 600, color: s.quoted_price ? 'var(--success)' : 'var(--text-muted)' }}>
                      {s.quoted_price ? `$${s.quoted_price.toFixed(2)}` : '-'}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {(s.rep as unknown as { rep_slug: string })?.rep_slug ?? '-'}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_COLORS[s.status as SubmissionStatus] ?? 'badge-default'}`}>
                        {STATUS_LABELS[s.status as SubmissionStatus] ?? s.status}
                      </span>
                    </td>
                    <td>
                      {s.manual_review_status ? (
                        <span className="badge badge-warning">
                          {CUSTOMER_MANUAL_REVIEW_STATUS_LABELS[s.manual_review_status]}
                        </span>
                      ) : s.patient_profile_id ? (
                        <span className="badge badge-success">Linked</span>
                      ) : (
                        <span className="badge badge-default">Unlinked</span>
                      )}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {new Date(s.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <Link to={`/admin/submissions/${s.id}`} className="table-link">Review -&gt;</Link>
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
