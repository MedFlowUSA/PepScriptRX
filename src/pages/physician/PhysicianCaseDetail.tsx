import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import DashLayout from '../../components/layout/DashLayout';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import type { PatientSubmission, SubmissionDocument, PhysicianReviewStatus } from '../../types';

const PHYSICIAN_NAV = [
  { label: 'My Cases', path: '/physician', icon: '🩺' },
];

const REVIEW_OPTIONS: { value: PhysicianReviewStatus; label: string }[] = [
  { value: 'approved_for_refill_review',   label: 'Approved for refill review' },
  { value: 'needs_more_information',        label: 'Needs more information' },
  { value: 'not_appropriate',               label: 'Not appropriate — do not proceed' },
  { value: 'refer_to_fulfillment_partner',  label: 'Refer to fulfillment partner' },
  { value: 'clinical_review_complete',      label: 'Clinical review complete' },
];

export default function PhysicianCaseDetail() {
  const { id } = useParams<{ id: string }>();
  const { profile } = useAuth();
  const [submission, setSubmission] = useState<PatientSubmission | null>(null);
  const [documents, setDocuments] = useState<SubmissionDocument[]>([]);
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});
  const [reviewStatus, setReviewStatus] = useState<PhysicianReviewStatus>('approved_for_refill_review');
  const [reviewNotes, setReviewNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase || !id) { setLoading(false); return; }
    Promise.all([loadSubmission(), loadDocs()]).finally(() => setLoading(false));
  }, [id]);

  async function loadSubmission() {
    const { data } = await supabase!.from('patient_submissions').select('*').eq('id', id).single();
    setSubmission(data as PatientSubmission);

    // Load existing review if any
    const { data: review } = await supabase!
      .from('physician_reviews')
      .select('*')
      .eq('submission_id', id)
      .eq('physician_id', profile!.id)
      .maybeSingle();
    if (review) {
      setReviewStatus(review.review_status as PhysicianReviewStatus);
      setReviewNotes(review.review_notes ?? '');
    }
  }

  async function loadDocs() {
    const { data } = await supabase!.from('submission_documents').select('*').eq('submission_id', id);
    const docs = (data as SubmissionDocument[]) ?? [];
    setDocuments(docs);
    const urls: Record<string, string> = {};
    await Promise.all(
      docs.map(async (doc) => {
        const { data: signed } = await supabase!.storage.from('submission-documents').createSignedUrl(doc.file_path, 3600);
        if (signed?.signedUrl) urls[doc.id] = signed.signedUrl;
      }),
    );
    setDocUrls(urls);
  }

  async function handleSubmitReview() {
    if (!supabase || !profile || !id) return;
    setSaving(true);
    await supabase!.from('physician_reviews').upsert({
      submission_id: id,
      physician_id:  profile.id,
      review_status: reviewStatus,
      review_notes:  reviewNotes,
      reviewed_at:   new Date().toISOString(),
    }, { onConflict: 'submission_id,physician_id' });

    // Update submission status based on review
    let newStatus = 'physician_review';
    if (reviewStatus === 'approved_for_refill_review' || reviewStatus === 'refer_to_fulfillment_partner' || reviewStatus === 'clinical_review_complete') {
      newStatus = 'fulfillment_review';
    } else if (reviewStatus === 'not_appropriate') {
      newStatus = 'not_eligible';
    }
    await supabase!.from('patient_submissions').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
    await supabase!.from('audit_logs').insert({ actor_profile_id: profile.id, submission_id: id, action: 'physician_review', notes: reviewStatus });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  if (loading) {
    return (
      <DashLayout title="Case Review" navItems={PHYSICIAN_NAV}>
        <div style={{ padding: 64, textAlign: 'center' }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
      </DashLayout>
    );
  }

  if (!submission) {
    return (
      <DashLayout title="Case Not Found" navItems={PHYSICIAN_NAV}>
        <div className="empty-state"><div className="empty-state-title">Case not found.</div></div>
      </DashLayout>
    );
  }

  return (
    <DashLayout
      title={`Case: ${submission.full_name}`}
      navItems={PHYSICIAN_NAV}
      actions={
        <div className="flex items-center gap-3">
          {saved && <span className="text-success text-sm">Review submitted.</span>}
          <button className="btn btn-primary btn-sm" onClick={handleSubmitReview} disabled={saving}>
            {saving ? 'Submitting…' : 'Submit Review'}
          </button>
        </div>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <Link to="/physician" style={{ fontSize: 14, color: 'var(--text-muted)' }}>← All Cases</Link>
      </div>

      <div className="detail-grid">
        <div>
          <div className="card mb-6">
            <div className="card-header" style={{ paddingBottom: 16 }}>
              <div className="card-title">Patient Information</div>
              <div className="card-subtitle">Review only — do not contact patient directly</div>
            </div>
            <div className="card-body">
              <div className="detail-row"><span className="detail-label">Name</span><span className="detail-value">{submission.full_name}</span></div>
              <div className="detail-row"><span className="detail-label">Date of birth</span><span className="detail-value">{submission.date_of_birth}</span></div>
              <div className="detail-row"><span className="detail-label">State</span><span className="detail-value">{submission.state}</span></div>
              <div className="detail-row"><span className="detail-label">Medication</span><span className="detail-value" style={{ fontWeight: 700 }}>{submission.medication}</span></div>
              <div className="detail-row"><span className="detail-label">Current dose</span><span className="detail-value">{submission.current_dose || '—'}</span></div>
              <div className="detail-row"><span className="detail-label">Current price</span><span className="detail-value">{submission.current_price ? `$${submission.current_price}/mo` : '—'}</span></div>
              <div className="detail-row"><span className="detail-label">Current source</span><span className="detail-value">{submission.current_pharmacy || '—'}</span></div>
            </div>
          </div>

          <div className="card">
            <div className="card-header" style={{ paddingBottom: 16 }}>
              <div className="card-title">Uploaded Documents</div>
            </div>
            <div className="card-body">
              {documents.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No documents.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {documents.map((doc) => (
                    <div key={doc.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', background: 'var(--card-soft)' }}>
                      <span style={{ fontSize: 18 }}>{doc.document_type === 'prescription' ? '📄' : doc.document_type === 'receipt' ? '🧾' : '💊'}</span>
                      <div style={{ flex: 1, fontSize: 14, fontWeight: 600, textTransform: 'capitalize', color: 'var(--navy)' }}>{doc.document_type.replace('_', ' ')}</div>
                      {docUrls[doc.id]
                        ? <a href={docUrls[doc.id]} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">View ↗</a>
                        : <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Loading…</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div>
          <div className="card">
            <div className="card-header" style={{ paddingBottom: 16 }}>
              <div className="card-title">Clinical Review</div>
            </div>
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div className="form-group">
                <label className="form-label">Review decision</label>
                <select className="form-select" value={reviewStatus} onChange={(e) => setReviewStatus(e.target.value as PhysicianReviewStatus)}>
                  {REVIEW_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Review notes</label>
                <textarea className="form-textarea w-full" style={{ minHeight: 140 }} value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="Clinical observations, notes for the fulfillment team, or reason for decision…" />
              </div>
              <button className="btn btn-primary w-full" onClick={handleSubmitReview} disabled={saving} style={{ justifyContent: 'center' }}>
                {saving ? 'Submitting…' : 'Submit Review'}
              </button>
              {saved && <div className="alert alert-success">Review submitted successfully.</div>}
              <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                Your review will update the case status and notify the admin team. You are reviewing for clinical appropriateness only — PepScriptRX handles all fulfillment and payment.
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashLayout>
  );
}
