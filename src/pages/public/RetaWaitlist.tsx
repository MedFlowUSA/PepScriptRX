import { useState, useRef } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import { createRetaWaitlist } from '../../lib/supabase';
import { US_STATES } from '../../types';

export default function RetaWaitlist() {
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const repSlug = new URLSearchParams(window.location.search).get('rep') || '';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const fd = new FormData(formRef.current!);
      await createRetaWaitlist(fd, repSlug);
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <PublicLayout>
        <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
          <div style={{ maxWidth: 480, textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🧪</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--navy)', marginBottom: 12 }}>You're on the list.</h1>
            <p style={{ fontSize: 16, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 28 }}>
              We'll notify you when Retatrutide refill savings reviews become available. Thank you for your interest.
            </p>
            <Link to="/" className="btn btn-outline">Back to Home</Link>
          </div>
        </div>
      </PublicLayout>
    );
  }

  return (
    <PublicLayout>
      <div style={{ background: 'var(--ink)', padding: '60px 24px 48px', color: '#fff' }}>
        <div className="container-sm">
          <span className="badge badge-warning" style={{ marginBottom: 16 }}>Waitlist only</span>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, letterSpacing: '-.02em', marginBottom: 16 }}>
            Retatrutide Interest List
          </h1>
          <p style={{ fontSize: 17, color: 'rgba(255,255,255,.75)', lineHeight: 1.65, maxWidth: 520 }}>
            Retatrutide refill savings reviews are not yet available. Join the interest list and we'll reach out when we're ready to accept submissions for this medication.
          </p>
        </div>
      </div>

      <div style={{ padding: '48px 24px' }}>
        <div className="container-sm">
          {error && <div className="alert alert-error mb-6">{error}</div>}

          <div className="card">
            <div className="card-body">
              <form ref={formRef} onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                <div className="form-grid form-grid-2">
                  <div className="form-group">
                    <label className="form-label form-required">Full name</label>
                    <input name="full_name" type="text" className="form-input" required placeholder="Jane Smith" />
                  </div>
                  <div className="form-group">
                    <label className="form-label form-required">Email address</label>
                    <input name="email" type="email" className="form-input" required placeholder="jane@example.com" />
                  </div>
                  <div className="form-group">
                    <label className="form-label form-required">Phone number</label>
                    <input name="phone" type="tel" className="form-input" required placeholder="(555) 555-5555" />
                  </div>
                  <div className="form-group">
                    <label className="form-label form-required">State</label>
                    <select name="state" className="form-select" required>
                      <option value="">Select state…</option>
                      {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes (optional)</label>
                  <textarea name="interest_notes" className="form-textarea" placeholder="Current dose, current source, or any other information…" style={{ minHeight: 80 }} />
                </div>
                <button type="submit" className="btn btn-primary btn-lg" disabled={loading} style={{ justifyContent: 'center' }}>
                  {loading ? 'Submitting…' : 'Join the Interest List'}
                </button>
              </form>
            </div>
          </div>

          <div className="disclaimer mt-6">
            Joining this list does not guarantee access or approval. PepScriptRX will contact you when Retatrutide savings reviews become available.
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
