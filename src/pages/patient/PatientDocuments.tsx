import { Link } from 'react-router-dom';
import DashLayout from '../../components/layout/DashLayout';
import { patientNav } from './patientNav';
import { usePatientOrders } from './patientPortalData';

export default function PatientDocuments() {
  const { orders, loading, error } = usePatientOrders();
  const documents = orders.flatMap((order) => (order.documents ?? []).map((doc) => ({ ...doc, order })));

  return (
    <DashLayout title="Documents Vault" navItems={patientNav}>
      <div style={{ display: 'grid', gap: 20 }}>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Documents vault</div>
              <div className="card-subtitle">Keep receipts, uploads, quality links, and order resources in one place.</div>
            </div>
          </div>
          <div className="card-body" style={{ display: 'grid', gap: 14 }}>
            {loading ? (
              <div className="loading-inline"><div className="spinner" />Loading documents...</div>
            ) : documents.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-title">No uploaded documents yet</div>
                <div className="empty-state-desc">Receipt uploads, prescription files, and payment proofs will be tied to your orders as they are added.</div>
              </div>
            ) : documents.map((doc) => (
              <div key={doc.id} style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', padding: 14, background: 'var(--card-soft)' }}>
                <div style={{ fontWeight: 900, color: 'var(--navy)' }}>{doc.document_type.replace(/_/g, ' ')}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{doc.order.medication} - uploaded {new Date(doc.uploaded_at).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 900, color: 'var(--navy)' }}>Quality and education links</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>Use these resources for product education and compliance documents.</div>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link className="btn btn-outline btn-sm" to="/certificates">Certificates</Link>
              <Link className="btn btn-outline btn-sm" to="/product-confidence">Quality policy</Link>
              <Link className="btn btn-primary btn-sm" to="/mixing">Mixing Center</Link>
            </div>
          </div>
        </div>
      </div>
    </DashLayout>
  );
}
