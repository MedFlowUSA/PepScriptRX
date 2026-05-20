import PublicLayout from '../../components/layout/PublicLayout';

export default function Privacy() {
  return (
    <PublicLayout>
      <div style={{ padding: '64px 24px' }}>
        <div className="container-sm">
          <h1 style={{ fontSize: 36, fontWeight: 800, color: 'var(--navy)', marginBottom: 8, letterSpacing: '-.02em' }}>Privacy Policy</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 40 }}>Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

          {[
            {
              title: '1. Information We Collect',
              body: 'When you submit a refill-savings request, we collect your name, email address, phone number, state of residence, date of birth, current medication and dosage, current price paid, current pharmacy or source, prescription attestation, and uploaded receipt.',
            },
            {
              title: '2. How We Use Your Information',
              body: 'We use your information solely to review your refill-savings submission, review your attestation and receipt, coordinate with authorized fulfillment partners, and contact you with your review outcome. We do not sell, rent, or share your personal information with third parties for marketing purposes.',
            },
            {
              title: '3. Document Storage',
              body: 'Uploaded receipts are stored securely using encrypted cloud storage. Access is restricted to authorized PepScriptRX staff, verified physician reviewers, and authorized fulfillment partners who are bound by confidentiality agreements.',
            },
            {
              title: '4. Data Retention',
              body: 'We retain your submission data and documents for as long as necessary to fulfill your request and comply with applicable laws. You may request deletion of your data by contacting us.',
            },
            {
              title: '5. Cookies and Analytics',
              body: 'We may use basic analytics to understand how visitors use our platform. We do not use tracking cookies for advertising purposes.',
            },
            {
              title: '6. Contact Us',
              body: 'If you have questions about this privacy policy or your data, contact us at info@pepscriptrx.com.',
            },
          ].map((section) => (
            <div key={section.title} style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>{section.title}</h2>
              <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.8 }}>{section.body}</p>
            </div>
          ))}

          <div className="disclaimer">
            PepScriptRX is not a pharmacy or medical provider. This privacy policy applies to the PepScriptRX savings-check platform only.
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
