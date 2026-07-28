import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import DashLayout from '../../components/layout/DashLayout';
import { supabase } from '../../lib/supabase';
import { isVisibleMainAdminOrder } from '../../lib/nonProductionOrders';
import type { PatientSubmission, Profile } from '../../types';
import { ADMIN_NAV } from './adminNav';

type CustomerRow = Profile & {
  orders: number;
  paidOrders: number;
  lastOrder: PatientSubmission | null;
};

const CUSTOMER_ROLES = ['patient', 'customer', 'client'];

export default function AdminCustomerActivity() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [orders, setOrders] = useState<PatientSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!supabase) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError('');
      const [profileResult, orderResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id,full_name,email,phone,role,sms_opted_out,created_at')
          .in('role', CUSTOMER_ROLES)
          .order('created_at', { ascending: false }),
        supabase
          .from('patient_submissions')
          .select('*')
          .order('created_at', { ascending: false }),
      ]);
      if (cancelled) return;
      if (profileResult.error || orderResult.error) {
        setError(profileResult.error?.message || orderResult.error?.message || 'Could not load customers.');
      }
      setProfiles((profileResult.data as Profile[] | null) ?? []);
      setOrders(((orderResult.data as PatientSubmission[] | null) ?? []).filter(isVisibleMainAdminOrder));
      setLoading(false);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const customers = useMemo<CustomerRow[]>(() => {
    const ordersByProfile = new Map<string, PatientSubmission[]>();
    const ordersByEmail = new Map<string, PatientSubmission[]>();
    orders.forEach((order) => {
      if (order.patient_profile_id) {
        const rows = ordersByProfile.get(order.patient_profile_id) ?? [];
        rows.push(order);
        ordersByProfile.set(order.patient_profile_id, rows);
      }
      const email = normalizeEmail(order.email);
      if (email) {
        const rows = ordersByEmail.get(email) ?? [];
        rows.push(order);
        ordersByEmail.set(email, rows);
      }
    });

    return profiles.map((profile) => {
      const linked = ordersByProfile.get(profile.id) ?? ordersByEmail.get(normalizeEmail(profile.email)) ?? [];
      return {
        ...profile,
        orders: linked.length,
        paidOrders: linked.filter((order) => order.status === 'paid' || order.status === 'fulfilled').length,
        lastOrder: linked[0] ?? null,
      };
    });
  }, [orders, profiles]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return customers;
    return customers.filter((customer) => (
      customer.full_name?.toLowerCase().includes(query)
      || customer.email?.toLowerCase().includes(query)
      || customer.phone?.toLowerCase().includes(query)
    ));
  }, [customers, search]);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const newThisMonth = customers.filter((customer) => new Date(customer.created_at) >= monthStart).length;
  const withOrders = customers.filter((customer) => customer.orders > 0).length;
  const repeatCustomers = customers.filter((customer) => customer.orders > 1).length;

  return (
    <DashLayout title="Customer Activity" navItems={ADMIN_NAV}>
      {loading ? (
        <div style={{ padding: 64, display: 'grid', placeItems: 'center' }}><div className="spinner" /></div>
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>
          {error && <div className="alert alert-error">{error}</div>}
          <div className="stats-grid">
            <Stat label="Customer accounts" value={customers.length} />
            <Stat label="New this month" value={newThisMonth} />
            <Stat label="Customers with orders" value={withOrders} />
            <Stat label="Repeat customers" value={repeatCustomers} />
          </div>

          <div className="card">
            <div className="filter-bar" style={{ borderBottom: '1px solid var(--border)' }}>
              <input
                className="form-input"
                type="search"
                placeholder="Search customer accounts..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                style={{ maxWidth: 320 }}
              />
              <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                {filtered.length} of {customers.length} customer accounts
              </span>
            </div>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Orders</th>
                    <th>Paid</th>
                    <th>Last activity</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} style={{ padding: 36, textAlign: 'center', color: 'var(--text-muted)' }}>No customer accounts found.</td></tr>
                  ) : filtered.map((customer) => (
                    <tr key={customer.id}>
                      <td>
                        <div style={{ fontWeight: 800, color: 'var(--navy)' }}>{customer.full_name || 'Unnamed customer'}</div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>{customer.email}</div>
                      </td>
                      <td>{customer.phone || '-'}</td>
                      <td>{customer.orders}</td>
                      <td>{customer.paidOrders}</td>
                      <td>{customer.lastOrder ? new Date(customer.lastOrder.created_at).toLocaleDateString() : new Date(customer.created_at).toLocaleDateString()}</td>
                      <td>{customer.lastOrder && <Link className="table-link" to={`/admin/submissions/${customer.lastOrder.id}`}>View latest</Link>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </DashLayout>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

function normalizeEmail(value: string | null | undefined) {
  return String(value ?? '').trim().toLowerCase();
}
