import PublicLayout from '../../components/layout/PublicLayout';
import { getWhiteLabelPortal } from '../../config/whiteLabelPortals';
import { usePageMeta } from '../../hooks/usePageMeta';

type PrivacyProps = {
  portalKey?: string;
};

export default function Privacy({ portalKey }: PrivacyProps) {
  const portal = getWhiteLabelPortal(portalKey);
  const brandName = portal?.brandName ?? 'PepScriptRX';
  const isPortal = Boolean(portal);
  const isAnatolia = portal?.id === 'anatolia';
  const portalLabel = isPortal
    ? (isAnatolia ? `${brandName} iş ortağı portalı` : `${brandName} partner portal`)
    : 'PepScriptRX savings-check platform';
  const privacySections = isAnatolia
    ? [
        {
          title: '1. Topladığımız Bilgiler',
          body: 'Yenileme tasarrufu veya katalog talebi gönderdiğinizde adınız, e-posta adresiniz, telefon numaranız, ikamet eyaletiniz, doğum tarihiniz, seçilen ürün, doz, mevcut fiyat, mevcut eczane veya kaynak, beyanınız ve yüklenen fiş gibi bilgileri toplayabiliriz.',
        },
        {
          title: '2. Bilgilerinizi Nasıl Kullanırız',
          body: 'Bilgilerinizi gönderiminizi incelemek, beyan ve fiş bilgilerini değerlendirmek, yetkili iş ortaklarıyla koordinasyon sağlamak ve inceleme sonucunuz hakkında sizinle iletişime geçmek için kullanırız. Kişisel bilgilerinizi pazarlama amacıyla üçüncü taraflara satmayız veya kiralamayız.',
        },
        {
          title: '3. Belge Saklama',
          body: `Yüklenen fişler şifreli bulut depolama ile güvenli şekilde saklanır. Erişim yalnızca yetkili ${brandName} personeli, doğrulanmış inceleyiciler ve gizlilik yükümlülüğü bulunan yetkili iş ortaklarıyla sınırlıdır.`,
        },
        {
          title: '4. Veri Saklama Süresi',
          body: 'Gönderim verilerinizi ve belgelerinizi talebinizi yerine getirmek ve geçerli yasalara uymak için gerekli olduğu sürece saklarız. Verilerinizin silinmesini talep etmek için destek ekibiyle iletişime geçebilirsiniz.',
        },
        {
          title: '5. Çerezler ve Analitik',
          body: 'Ziyaretçilerin platformu nasıl kullandığını anlamak için temel analitik kullanabiliriz. Reklam amaçlı takip çerezleri kullanmayız.',
        },
        {
          title: '6. Bize Ulaşın',
          body: 'Bu gizlilik politikası veya verileriniz hakkında sorularınız varsa bu portal üzerinden destek ekibiyle iletişime geçin.',
        },
      ]
    : [
        {
          title: '1. Information We Collect',
          body: 'When you submit a refill-savings request, we collect your name, email address, phone number, state of residence, date of birth, current medication and dosage, current price paid, current pharmacy or source, prescription attestation, and uploaded receipt.',
        },
        {
          title: '2. How We Use Your Information',
          body: 'We use your information solely to review your submission, review your attestation and receipt, coordinate with authorized fulfillment partners, and contact you with your review outcome. We do not sell, rent, or share your personal information with third parties for marketing purposes.',
        },
        {
          title: '3. Document Storage',
          body: `Uploaded receipts are stored securely using encrypted cloud storage. Access is restricted to authorized ${brandName} staff, verified physician reviewers, and authorized fulfillment partners who are bound by confidentiality agreements.`,
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
          body: 'If you have questions about this privacy policy or your data, contact the support team through this portal.',
        },
      ];

  usePageMeta(
    isAnatolia ? 'Gizlilik Politikası' : 'Privacy Policy',
    isAnatolia ? `${brandName} kişisel bilgilerinizi nasıl toplar, kullanır ve korur.` : `How ${brandName} collects, uses, and protects your personal information.`,
  );
  return (
    <PublicLayout
      isolatedPortal={isPortal}
      portalKey={portal?.id}
      portalHomePath={portal?.path}
      portalName={brandName}
      portalLogoSrc={portal?.logoSrc}
    >
      <div style={{ padding: '64px 24px' }}>
        <div className="container-sm">
          <h1 style={{ fontSize: 36, fontWeight: 800, color: 'var(--navy)', marginBottom: 8, letterSpacing: '-.02em' }}>{isAnatolia ? 'Gizlilik Politikası' : 'Privacy Policy'}</h1>
          {portal && (
            <a href={portal.path} className="btn btn-outline btn-sm" style={{ marginBottom: 18 }}>
              {isAnatolia ? `${brandName} mağazasına dön` : `Back to ${brandName}`}
            </a>
          )}
          <p style={{ color: 'var(--text-muted)', marginBottom: 40 }}>{isAnatolia ? 'Son güncelleme' : 'Last updated'}: {new Date().toLocaleDateString(isAnatolia ? 'tr-TR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

          {privacySections.map((section) => (
            <div key={section.title} style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>{section.title}</h2>
              <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.8 }}>{section.body}</p>
            </div>
          ))}

          <div className="disclaimer">
            {isAnatolia
              ? `${brandName} bir eczane veya sağlık hizmeti sağlayıcısı değildir. Bu gizlilik politikası yalnızca ${portalLabel} için geçerlidir.`
              : `${brandName} is not a pharmacy or medical provider. This privacy policy applies to the ${portalLabel} only.`}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
