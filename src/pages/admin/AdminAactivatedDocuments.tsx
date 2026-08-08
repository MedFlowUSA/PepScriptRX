import { useEffect, useState } from 'react';
import DashLayout from '../../components/layout/DashLayout';
import { supabase } from '../../lib/supabase';

type RepRow = {
  id: string;
  application?: { full_name?: string; email?: string } | null;
};
type AgreementDocument = {
  id: string;
  onboarding_id: string;
  legal_name: string;
  agreement_version: string;
  pdf_storage_path: string | null;
  signed_at: string;
};
type W9Document = {
  id: string;
  onboarding_id: string;
  status: string;
  tax_name: string;
  tin_last_four: string;
  pdf_storage_path: string | null;
  signed_at: string;
};

export default function AdminAactivatedDocuments() {
  const [reps, setReps] = useState<RepRow[]>([]);
  const [agreements, setAgreements] = useState<AgreementDocument[]>([]);
  const [w9s, setW9s] = useState<W9Document[]>([]);
  const [error, setError] = useState('');
  const [opening, setOpening] = useState('');

  useEffect(() => { void load(); }, []);

  async function load() {
    const [profiles, snapshot] = await Promise.all([
      supabase!.from('aactivated_onboarding_profiles')
        .select('id,application:rep_store_intake_submissions(full_name,email)')
        .eq('brand_id', 'aactivated')
        .order('last_activity_at', { ascending: false }),
      supabase!.functions.invoke('manage-aactivated-onboarding', { body: { action: 'status_snapshot' } }),
    ]);
    if (profiles.error || snapshot.error || snapshot.data?.error) {
      setError(String(profiles.error?.message || snapshot.data?.error || snapshot.error?.message || 'Unable to load signed documents.'));
      return;
    }
    if (!snapshot.data?.document_access) {
      setError('PepScriptRX main administrator authorization is required to access signed documents.');
      return;
    }
    setReps((profiles.data ?? []) as unknown as RepRow[]);
    setAgreements((snapshot.data?.agreements ?? []) as AgreementDocument[]);
    setW9s((snapshot.data?.w9s ?? []) as W9Document[]);
  }

  async function openDocument(type: 'agreement' | 'w9', id: string, disposition: 'view' | 'download') {
    const key = `${type}-${id}-${disposition}`;
    setOpening(key);
    setError('');
    const { data, error: functionError } = await supabase!.functions.invoke('manage-aactivated-onboarding', {
      body: { action: 'document_url', document_type: type, document_id: id, disposition },
    });
    setOpening('');
    if (functionError || data?.error || !data?.signed_url) {
      setError(String(data?.error || functionError?.message || 'Unable to open the signed document.'));
      return;
    }
    window.open(String(data.signed_url), '_blank', 'noopener,noreferrer');
  }

  return <DashLayout role="admin">
    <div style={{ display: 'grid', gap: 18 }}>
      <div>
        <p className="eyebrow">PepScriptRX main administration</p>
        <h1>AACTIVATEDRX Signed Rep Documents</h1>
        <p>Secure access to signed representative agreements and Form W-9 records. Links expire after five minutes and every access is audited.</p>
      </div>
      {error && <div className="alert alert-error">{error}</div>}
      <div style={{ display: 'grid', gap: 14 }}>
        {reps.map(rep => {
          const agreement = agreements.find(item => item.onboarding_id === rep.id);
          const w9 = w9s.find(item => item.onboarding_id === rep.id && item.status !== 'superseded');
          return <div className="card" key={rep.id} style={{ padding: 20 }}>
            <h3 style={{ marginBottom: 4 }}>{rep.application?.full_name || 'AACTIVATEDRX representative'}</h3>
            <p style={{ marginTop: 0 }}>{rep.application?.email}</p>
            <div className="form-grid-2">
              <DocumentPanel title="Signed Rep Agreement" detail={agreement ? `Version ${agreement.agreement_version} · Signed ${formatDate(agreement.signed_at)}` : 'Not signed'} available={Boolean(agreement?.pdf_storage_path)} opening={opening} viewKey={agreement ? `agreement-${agreement.id}-view` : ''} downloadKey={agreement ? `agreement-${agreement.id}-download` : ''} onView={() => agreement && void openDocument('agreement', agreement.id, 'view')} onDownload={() => agreement && void openDocument('agreement', agreement.id, 'download')} />
              <DocumentPanel title="Signed Form W-9" detail={w9 ? `${w9.tax_name} · TIN ending ${w9.tin_last_four} · ${w9.status}` : 'Not submitted'} available={Boolean(w9?.pdf_storage_path)} opening={opening} viewKey={w9 ? `w9-${w9.id}-view` : ''} downloadKey={w9 ? `w9-${w9.id}-download` : ''} onView={() => w9 && void openDocument('w9', w9.id, 'view')} onDownload={() => w9 && void openDocument('w9', w9.id, 'download')} />
            </div>
          </div>;
        })}
        {reps.length === 0 && !error && <div className="empty-state card"><div className="empty-state-title">No AACTIVATEDRX onboarding records found</div></div>}
      </div>
    </div>
  </DashLayout>;
}

function DocumentPanel({ title, detail, available, opening, viewKey, downloadKey, onView, onDownload }: { title: string; detail: string; available: boolean; opening: string; viewKey: string; downloadKey: string; onView: () => void; onDownload: () => void }) {
  return <div className="card" style={{ padding: 16 }}>
    <strong>{title}</strong>
    <p>{detail}</p>
    {available ? <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <button className="btn btn-secondary btn-sm" disabled={Boolean(opening)} onClick={onView}>{opening === viewKey ? 'Opening…' : 'View PDF'}</button>
      <button className="btn btn-primary btn-sm" disabled={Boolean(opening)} onClick={onDownload}>{opening === downloadKey ? 'Preparing…' : 'Download PDF'}</button>
    </div> : <span className="badge">PDF unavailable</span>}
  </div>;
}

function formatDate(value: string) {
  return value ? new Date(value).toLocaleDateString() : 'unknown date';
}
