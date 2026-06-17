import PublicLayout from '../../components/layout/PublicLayout';
import { getWhiteLabelPortal } from '../../config/whiteLabelPortals';
import { usePageMeta } from '../../hooks/usePageMeta';

type TermsProps = {
  portalKey?: string;
};

export default function Terms({ portalKey }: TermsProps) {
  const portal = getWhiteLabelPortal(portalKey);
  const brandName = portal?.brandName ?? 'PepScriptRX';
  const isPortal = Boolean(portal);
  const isAnatolia = portal?.id === 'anatolia';
  const portalLabel = isPortal
    ? (isAnatolia ? `${brandName} iş ortağı portalı` : `${brandName} partner portal`)
    : 'PepScriptRX savings-check platform';
  const termsSections = isAnatolia
    ? [
        {
          title: '1. Tıbbi Tavsiye Yoktur',
          body: `${brandName} bir eczane, sağlık hizmeti sağlayıcısı veya sağlık kuruluşu değildir. Tıbbi tavsiye, teşhis veya reçete sunmayız. Tüm gönderimler yalnızca bulunurluk ve uygunluk incelemesi içindir.`,
        },
        {
          title: '2. Uygunluk',
          body: 'Uygunluk ve teslimat; gerektiğinde reçete doğrulaması, eyalet bulunurluğu, iş ortağı kapasitesi ve geçerli yasalara bağlıdır. Gönderim veya ödeme, bulunurluk, tasarruf ya da teslimatı garanti etmez.',
        },
        {
          title: '3. Geçerli Reçete Gerekebilir',
          body: 'Yenileme tasarrufu talebi göndererek, seçilen ürün için geçerli ve aktif bir reçeteye sahip olduğunuzu beyan edersiniz. Yanlış beyan veya hileli bilgi yasaktır ve talebin reddedilmesine yol açabilir.',
        },
        {
          title: '4. Ödeme ve İadeler',
          body: 'Fiyatlandırılmış katalog siparişleri güvenli ödemeye doğrudan devam edebilir. İsteğe bağlı %20 indirim incelemesi için önceki tedarikçi fişi yüklerseniz, ödeme fiş indirimi doğrulandıktan sonra istenir. Sipariş teslimat sürecine girdikten sonra tüm satışlar nihaidir.',
        },
        {
          title: '5. İletişim',
          body: `Bilgilerinizi göndererek ${brandName} ekibinin gönderim durumunuz, inceleme sonucu ve mevcut seçenekler hakkında sizinle telefon veya e-posta yoluyla iletişime geçmesine izin verirsiniz.`,
        },
        {
          title: '6. Sorumluluk Sınırı',
          body: `${brandName}; teslimat gecikmeleri, iş ortağı hataları, ürün bulunurluğundaki değişiklikler veya ürünlerden kaynaklanan olumsuz sonuçlardan sorumlu değildir. Reçete yazan hekiminizle ilişkiniz değişmez.`,
        },
        {
          title: '7. Şartlarda Değişiklik',
          body: 'Bu şartları herhangi bir zamanda güncelleyebiliriz. Platformu kullanmaya devam etmeniz güncellenmiş şartları kabul ettiğiniz anlamına gelir.',
        },
      ]
    : [
        {
          title: '1. No Medical Advice',
          body: `${brandName} is not a pharmacy, medical provider, or healthcare organization. We do not provide medical advice, diagnoses, or prescriptions. All submissions are for availability-review purposes only.`,
        },
        {
          title: '2. Eligibility',
          body: 'Eligibility and fulfillment depend on prescription verification where applicable, state availability, fulfillment partner capacity, and applicable law. Submission or checkout does not guarantee availability, savings, or fulfillment.',
        },
        {
          title: '3. Valid Prescriptions Required',
          body: 'By submitting a refill-savings request, you attest that you hold a valid, active prescription for the medication selected. False attestations or fraudulent information are prohibited and may result in denial or legal action.',
        },
        {
          title: '4. Payment and Refunds',
          body: 'Priced catalog orders may continue directly to secure checkout. If you upload a prior supplier receipt for the optional 20% discount review, payment is requested after the receipt discount is verified. All sales are final once your order enters fulfillment. Refunds may be issued at our sole discretion in cases of fulfillment failure or error.',
        },
        {
          title: '5. Communications',
          body: `By submitting your information, you consent to ${brandName} contacting you via phone or email regarding your submission status, review outcome, and available refill options.`,
        },
        {
          title: '6. Limitation of Liability',
          body: `${brandName} is not responsible for fulfillment delays, errors by fulfillment partners, changes in product availability, or any adverse outcomes from medications. Your relationship with your prescribing physician remains unchanged.`,
        },
        {
          title: '7. Changes to These Terms',
          body: 'We may update these terms at any time. Continued use of the platform constitutes acceptance of the updated terms.',
        },
      ];

  usePageMeta(
    isAnatolia ? `${brandName} | Kullanım Şartları` : `${brandName} | Terms of Service`,
    isAnatolia ? `${brandName} kullanım şartları, uygunluk, ödeme ve sorumluluk sınırlarını açıklar.` : `${brandName} terms of service covering eligibility, prescriptions, payments, and limitations of liability.`,
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
          <h1 style={{ fontSize: 36, fontWeight: 800, color: 'var(--navy)', marginBottom: 8, letterSpacing: '-.02em' }}>{isAnatolia ? 'Kullanım Şartları' : 'Terms of Service'}</h1>
          {portal && (
            <a href={portal.path} className="btn btn-outline btn-sm" style={{ marginBottom: 18 }}>
              {isAnatolia ? `${brandName} mağazasına dön` : `Back to ${brandName}`}
            </a>
          )}
          <p style={{ color: 'var(--text-muted)', marginBottom: 40 }}>{isAnatolia ? 'Son güncelleme' : 'Last updated'}: {new Date().toLocaleDateString(isAnatolia ? 'tr-TR' : 'en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>

          {termsSections.map((section) => (
            <div key={section.title} style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy)', marginBottom: 10 }}>{section.title}</h2>
              <p style={{ fontSize: 15, color: 'var(--text-muted)', lineHeight: 1.8 }}>{section.body}</p>
            </div>
          ))}

          <div className="disclaimer">
            {isAnatolia
              ? `${brandName} bir eczane veya sağlık hizmeti sağlayıcısı değildir. Bu şartlar yalnızca ${portalLabel} kullanımınızı düzenler.`
              : `${brandName} is not a pharmacy or medical provider. These terms govern your use of the ${portalLabel} only.`}
          </div>
        </div>
      </div>
    </PublicLayout>
  );
}
