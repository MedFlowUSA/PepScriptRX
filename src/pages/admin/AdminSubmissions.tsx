import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import DashLayout from '../../components/layout/DashLayout';
import { supabase } from '../../lib/supabase';
import type { PatientSubmission, SubmissionStatus } from '../../types';
import { STATUS_LABELS, STATUS_COLORS, ALL_STATUSES } from '../../types';

import { ADMIN_NAV } from './adminNav';

export default function AdminSubmissions() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [submissions, setSubmissions] = useState<PatientSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const statusFilter = searchParams.get('status') as SubmissionStatus | null;

  useEffect(() => {
    loadSubmissions();
  }, [statusFilter]);

  async function loadSubmissions() {
    if (!supabase) { setLoading(false); return; }
    setLoading(true);
    let q = supabase
      .from('patient_submissions')
      .select('*, rep:reps(rep_slug)')
      .order('created_at', { ascending: false });
    if (statusFilter) q = q.eq('status', statusFilter);
    const { data } = await q;
    setSubmissions((data as PatientSubmission[]) ?? []);
    setLoading(false);
  }

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

  function exportCsv() {
    const esc = (v: string | number | null | undefined) => {
      const s = v == null ? '' : String(v);
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = ['Name', 'Email', 'Phone', 'Medication', 'Dose', 'State', 'DOB',
      'Current Price', 'Quoted Price', 'Rep', 'Discount Code', 'Status', 'Submitted'];
    const rows = filtered.map((s) => [
      s.full_name, s.email, s.phone, s.medication, s.current_dose, s.state, s.date_of_birth,
      s.current_price ?? '', s.quoted_price ?? '',
      (s.rep as unknown as { rep_slug: string })?.rep_slug ?? '',
      s.discount_code ?? '', s.status,
      new Date(s.created_at).toLocaleDateString(),
    ].map(esc).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `submissions-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <DashLayout title="Submissions" navItems={ADMIN_NAV}>
      <div className="card">
        <div className="filter-bar" style={{ borderBottom: '1px solid var(--border)', gap: 12 }}>
          <input
            type="search" className="form-input" style={{ maxWidth: 260 }}
            placeholder="Search by name, email, medication…"
            value={search} onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="form-select" style={{ maxWidth: 220 }}
            value={statusFilter ?? ''}
            onChange={(e) => {
              const v = e.target.value;
              v ? setSearchParams({ status: v }) : setSearchParams({});
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

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Patient</th>
                  <th>Medication / Dose</th>
                  <th>State</th>
                  <th>Current Price</th>
                  <th>Quoted</th>
                  <th>Rep</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan={9}>
                    <div className="empty-state" style={{ padding: '40px 0' }}>
                      <div className="empty-state-title">No submissions found</div>
                    </div>
                  </td></tr>
                ) : filtered.map((s) => (
                  <tr key={s.id}>
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
                    <td>{s.current_price ? `$${s.current_price.toFixed(2)}` : '—'}</td>
                    <td style={{ fontWeight: 600, color: s.quoted_price ? 'var(--success)' : 'var(--text-muted)' }}>
                      {s.quoted_price ? `$${s.quoted_price.toFixed(2)}` : '—'}
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {(s.rep as unknown as { rep_slug: string })?.rep_slug ?? '—'}
                    </td>
                    <td>
                      <span className={`badge ${STATUS_COLORS[s.status as SubmissionStatus] ?? 'badge-default'}`}>
                        {STATUS_LABELS[s.status as SubmissionStatus] ?? s.status}
                      </span>
                    </td>
                    <td style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                      {new Date(s.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <Link to={`/admin/submissions/${s.id}`} className="table-link">Review →</Link>
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
