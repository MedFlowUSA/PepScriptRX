import { Link, useSearchParams } from 'react-router-dom';
import PublicLayout from '../../components/layout/PublicLayout';
import { usePageMeta } from '../../hooks/usePageMeta';

export default function Submitted() {
  usePageMeta(
    'Submission Received',
    'Your savings check has been submitted. Our team will review your prescription and contact you with available refill options within 1–2 business days.',
  );
  const [searchParams] = useSearchParams();
  const email = searchParams.get('email') ?? '';
  const type = searchParams.get('type') ?? 'savings_check';
  const isAccessory = type === 'accessory_inquiry';
  const isSupply = type === 'supply_inquiry';
  const isReceiptDiscountReview = type === 'receipt_discount_review';
  const isSimpleRequest = isAccessory || isSupply;
  const signupPath = `/patient/signup${email ? `?email=${encodeURIComponent(email)}` : ''}`;
  const title = isAccessory
    ? 'Your accessory request was submitted.'
    : isSupply
      ? 'Your supply request was submitted.'
      : isReceiptDiscountReview
        ? 'Your receipt discount review was submitted.'
        : 'Your savings check has been submitted.';
  const description = isReceiptDiscountReview
    ? 'We will verify the prior supplier receipt before sending the discounted payment link. Orders without a receipt upload continue directly to secure checkout.'
    : isSimpleRequest
    ? 'Our team will follow up with availability and next steps.'
    : 'Our team will review your prescription and receipt, then contact you with available refill options. Most reviews are completed within 1-2 business days.';
  const nextSteps = isReceiptDiscountReview
    ? [
        { step: '1', text: 'Our team verifies the uploaded prior supplier receipt.' },
        { step: '2', text: 'If the receipt qualifies, the 20% discount is applied to the order.' },
        { step: '3', text: 'A secure payment link is sent for the verified discounted amount.' },
      ]
    : isSimpleRequest
    ? [
        { step: '1', text: 'Our team reviews your request and state availability.' },
        { step: '2', text: 'We contact you with availability and next steps.' },
        { step: '3', text: 'If eligible, the item may be added to an eligible order.' },
      ]
    : [
        { step: '1', text: 'Our team reviews your receipt and valid-prescription attestation.' },
        { step: '2', text: 'A physician or fulfillment partner may perform an additional review.' },
        { step: '3', text: 'We contact you with your savings quote and next steps.' },
        { step: '4', text: 'If you choose to proceed, a payment link is sent for the quoted amount.' },
      ];

  return (
    <PublicLayout>
      <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 24px' }}>
        <div style={{ maxWidth: 560, textAlign: 'center' }}>
          <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'var(--success-bg)', color: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', fontSize: 32, fontWeight: 800 }}>
            ✓
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: 'var(--navy)', marginBottom: 16, letterSpacing: '-.02em' }}>
            {title}
          </h1>
          <p style={{ fontSize: 17, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 32 }}>
            {description}
          </p>

          <div className="card" style={{ marginBottom: 32 }}>
            <div className="card-body" style={{ textAlign: 'left' }}>
              <div style={{ fontWeight: 700, color: 'var(--navy)', marginBottom: 12 }}>What happens next</div>
              {nextSteps.map((item) => (
                <div key={item.step} style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: 14 }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--teal-pale)', color: 'var(--teal)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0, fontSize: 12 }}>
                    {item.step}
                  </div>
                  <span style={{ color: 'var(--text)', lineHeight: 1.6, paddingTop: 2 }}>{item.text}</span>
                </div>
              ))}
            </div>
          </div>

          {!isSimpleRequest && (
            <div className="card" style={{ marginBottom: 32, borderColor: 'rgba(20, 184, 166, .35)' }}>
              <div className="card-body" style={{ textAlign: 'left' }}>
                <div style={{ fontWeight: 800, color: 'var(--navy)', marginBottom: 8 }}>
                  Create your patient account
                </div>
                <p style={{ color: 'var(--text-muted)', lineHeight: 1.6, marginBottom: 18, fontSize: 14 }}>
                  Track your review status, payment link, Zelle verification, shipping notifications, tracking, Mixing Center access, profile, goals, and progress from one private dashboard.
                </p>
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  <Link to={signupPath} className="btn btn-primary">Create Patient Account</Link>
                  <Link to="/login" className="btn btn-outline">Already have an account?</Link>
                </div>
              </div>
            </div>
          )}

          <div className="disclaimer" style={{ marginBottom: 32 }}>
            PepScriptRX does not guarantee approval, availability, savings, or fulfillment. Eligibility depends on verification, state availability, and fulfillment partner review.
          </div>

          <Link to="/" className="btn btn-outline">{'<-'} Back to Home</Link>
        </div>
      </div>
    </PublicLayout>
  );
}
