import { useCallback, useEffect, useMemo, useState } from 'react';
import DashLayout from '../../components/layout/DashLayout';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { ADMIN_NAV, RX_PLUS_ADMIN_NAV } from './adminNav';
import { AACTIVATED_SCOPE_CODES, isAactivatedPartnerAdmin, normalizeScopeToken } from '../../lib/aactivatedScope';

type LeadStatus = 'captured' | 'checkout_started' | 'abandoned' | 'converted' | 'follow_up_needed' | 'closed';

type AbandonedLead = {
  id: string;
  created_at: string;
  status: LeadStatus;
  first_name: string | null;
  last_name: string | null;
  email: string;
  phone: string | null;
  source_scope: string;
  source_portal: string | null;
  source_route: string | null;
  rep_code: string | null;
  checkout_scope_code: string | null;
  discount_code: string | null;
  discount_percent: number | null;
  product_interest: string | null;
  product_interest_id: string | null;
};

const STATUS_OPTIONS: LeadStatus[] = [
  'captured',
  'checkout_started',
  'abandoned',
  'converted',
  'follow_up_needed',
  'closed',
];

const AACTIVATED_REP_TOKENS = [
  'ADONIS',
  'AAMIR',
  '2LEGIT',
  'WENDYCREATES54',
  'WENDY',
  'JUJUAN',
  'POWERS',
  'OMGBILLY',
  'BOSSIQUIT',
];
const AACTIVATED_CUSTOMER_DISCOUNT_TOKENS = [
  'SAVE-ADONIS',
  'SAVE-AAMIR',
  'SAVE-2LEGIT',
  'SAVE-WENDY',
  'SAVE-JUJUAN',
  'SAVE-POWERS',
];

function isAactivatedLead(row: AbandonedLead): boolean {
  const tokens = [
    row.source_scope,
    row.source_portal,
    row.source_route,
    row.rep_code,
    row.checkout_scope_code,
    row.discount_code,
  ].map(normalizeScopeToken);

  return tokens.some((token) => (
    AACTIVATED_SCOPE_CODES.includes(token)
    || AACTIVATED_REP_TOKENS.includes(token)
    || AACTIVATED_CUSTOMER_DISCOUNT_TOKENS.includes(token)
    || token.includes('AACTIVATED')
    || AACTIVATED_REP_TOKENS.some((repToken) => token.startsWith(repToken))
  ));
}

export default function AdminLeads() {
  const { profile } = useAuth();
  const [rows, setRows] = useState<AbandonedLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [statsClock, setStatsClock] = useState(0);
  const navItems = profile?.role === 'rx_plus_admin' ? RX_PLUS_ADMIN_NAV : ADMIN_NAV;

  const filteredRows = useMemo(() => (
    statusFilter === 'all' ? rows : rows.filter((row) => row.status === statusFilter)
  ), [rows, statusFilter]);

  const stats = useMemo(() => {
    const weekAgo = statsClock - 1000 * 60 * 60 * 24 * 7;
    return {
      total: rows.length,
      main: rows.filter((row) => row.source_scope === 'MAIN').length,
      ehwsub: rows.filter((row) => row.source_scope === 'EHWSub').length,
      followUp: rows.filter((row) => row.status === 'follow_up_needed' || row.status === 'captured').length,
      week: rows.filter((row) => new Date(row.created_at).getTime() >= weekAgo).length,
    };
  }, [rows, statsClock]);

  const loadRows = useCallback(async () => {
    if (!supabase) {
      setLoading(false);
      setError('Supabase is not configured, so leads cannot be loaded yet.');
      return;
    }

    setLoading(true);
    setError('');
    const { data, error: loadError } = await supabase
      .from('abandoned_leads')
      .select('id,created_at,status,first_name,last_name,email,phone,source_scope,source_portal,source_route,rep_code,checkout_scope_code,discount_code,discount_percent,product_interest,product_interest_id')
      .order('created_at', { ascending: false })
      .limit(250);

    if (loadError) setError(loadError.message);
    else {
      const nextRows = (data as AbandonedLead[]) ?? [];
      setRows(isAactivatedPartnerAdmin(profile) ? nextRows.filter(isAactivatedLead) : nextRows);
    }
    setStatsClock(Date.now());
    setLoading(false);
  }, [profile]);

  useEffect(() => {
    void loadRows();
  }, [loadRows]);

  async function updateStatus(row: AbandonedLead, status: LeadStatus) {
    if (!supabase) return;
    setError('');
    const { error: updateError } = await supabase
      .from('abandoned_leads')
      .update({ status })
      .eq('id', row.id);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setRows((current) => current.map((item) => (
      item.id === row.id ? { ...item, status } : item
    )));
  }

  return (
    <DashLayout title="Lead Recovery" navItems={navItems}>
      <div className="stats-grid mb-8">
        <div className="stat-card">
          <div className="stat-value">{stats.total}</div>
          <div className="stat-label">Captured leads</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.week}</div>
          <div className="stat-label">Last 7 days</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.main}</div>
          <div className="stat-label">Main source</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.ehwsub}</div>
          <div className="stat-label">EHWSub source</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.followUp}</div>
          <div className="stat-label">Open follow-up</div>
        </div>
      </div>

      {error && <div className="alert alert-error mb-4">{error}</div>}

      <div className="card mb-6">
        <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <div className="card-title">Abandoned Opportunity Queue</div>
            <div className="card-subtitle">Lead captures before checkout, including discount, source, scope, and product interest.</div>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="form-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={{ minWidth: 190 }}>
              <option value="all">All statuses</option>
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>{formatStatus(status)}</option>
              ))}
            </select>
            <button type="button" className="btn btn-outline" onClick={loadRows}>Refresh</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Source</th>
                <th>Discount</th>
                <th>Product Interest</th>
                <th>Attribution</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7}>Loading leads...</td></tr>
              ) : filteredRows.length === 0 ? (
                <tr><td colSpan={7}>No leads found.</td></tr>
              ) : filteredRows.map((row) => (
                <tr key={row.id}>
                  <td>{formatDate(row.created_at)}</td>
                  <td>
                    <strong>{formatName(row)}</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{row.email}</div>
                    {row.phone && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{row.phone}</div>}
                  </td>
                  <td>
                    <strong>{row.source_scope}</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{row.source_route ?? '-'}</div>
                  </td>
                  <td>
                    <strong>{row.discount_code ?? '-'}</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{formatPercent(row.discount_percent)}</div>
                  </td>
                  <td>
                    <strong>{row.product_interest ?? '-'}</strong>
                    {row.product_interest_id && <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{row.product_interest_id}</div>}
                  </td>
                  <td>
                    <strong>{row.rep_code ?? '-'}</strong>
                    <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>scope: {row.checkout_scope_code ?? '-'}</div>
                  </td>
                  <td>
                    <select className="form-select" value={row.status} onChange={(event) => updateStatus(row, event.target.value as LeadStatus)}>
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>{formatStatus(status)}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashLayout>
  );
}

function formatName(row: AbandonedLead): string {
  const full = `${row.first_name ?? ''} ${row.last_name ?? ''}`.trim();
  return full || 'No name captured';
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

function formatPercent(value: number | null): string {
  if (!value) return '-';
  return `${Math.round(value * 100)}% off`;
}

function formatStatus(value: string): string {
  return value.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}
