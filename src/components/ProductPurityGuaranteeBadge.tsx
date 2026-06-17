import { Link } from 'react-router-dom';

type ProductPurityGuaranteeBadgeProps = {
  compact?: boolean;
  expanded?: boolean;
  variant?: 'pepscriptrx' | 'aactivated';
  locale?: 'en' | 'tr';
  className?: string;
};

const COMPACT_TEXT =
  'Third-party testing supported. If approved independent testing shows a verified PepScriptRX product is below 99.2% purity, the customer may qualify for a refund of the product purchase price and approved testing cost.';

const EXPANDED_TEXT =
  'PepScriptRX is committed to product quality, transparency, and customer confidence. Products are represented at 99.2% purity or better when supported by the applicable third-party testing documentation. If a verified PepScriptRX product is independently tested by an approved third-party laboratory and the result shows purity below 99.2%, the customer may qualify for a refund of the product purchase price and approved testing cost under our verification policy.';

const DISCLAIMER_TEXT =
  'This guarantee applies only to product purity verification based on acceptable third-party laboratory testing. It does not guarantee medical results, treatment outcomes, patient response, or product availability. Refund eligibility applies only to verified PepScriptRX orders and is subject to review of the full lab report.';

const TR_COMPACT_TEXT =
  'Üçüncü taraf testleri desteklenir. Onaylı bağımsız test, doğrulanmış bir ürünün %99.2 saflığın altında olduğunu gösterirse müşteri ürün bedeli ve onaylı test masrafı için iade incelemesine uygun olabilir.';

const TR_EXPANDED_TEXT =
  'PepScriptRX ürün kalitesi, şeffaflık ve müşteri güvenine önem verir. Ürünler, ilgili üçüncü taraf test belgeleriyle desteklendiğinde %99.2 veya daha yüksek saflıkta temsil edilir. Doğrulanmış bir ürün onaylı bağımsız laboratuvarda test edilip %99.2 altında çıkarsa müşteri politika kapsamında iade incelemesine uygun olabilir.';

const TR_DISCLAIMER_TEXT =
  'Bu güvence yalnızca kabul edilebilir üçüncü taraf laboratuvar testlerine dayalı ürün saflığı doğrulaması için geçerlidir. Tıbbi sonuç, tedavi sonucu, hasta yanıtı veya ürün bulunurluğunu garanti etmez.';

export default function ProductPurityGuaranteeBadge({
  compact,
  expanded,
  variant = 'pepscriptrx',
  locale = 'en',
  className = '',
}: ProductPurityGuaranteeBadgeProps) {
  const isExpanded = Boolean(expanded && !compact);
  const isAactivated = variant === 'aactivated';
  const isTurkish = locale === 'tr';
  const policyPath = isAactivated ? '/AACTIVATED/product-confidence' : '/product-confidence';
  const compactText = isTurkish ? TR_COMPACT_TEXT : COMPACT_TEXT;
  const expandedText = isTurkish ? TR_EXPANDED_TEXT : EXPANDED_TEXT;
  const disclaimerText = isTurkish ? TR_DISCLAIMER_TEXT : DISCLAIMER_TEXT;

  return (
    <aside className={`purity-guarantee-badge ${isExpanded ? 'expanded' : 'compact'} brand-${variant} ${className}`.trim()}>
      <div className="purity-guarantee-art" aria-hidden="true">
        <div className="purity-guarantee-seal">
          <div className="purity-guarantee-shield">{isAactivated ? 'A' : 'RX'}</div>
          <div className="purity-guarantee-percent">99.2%</div>
          <div className="purity-guarantee-seal-text">{isTurkish ? 'Saflık Güveni' : 'Purity Confidence'}</div>
          <div className="purity-guarantee-ribbon">{isTurkish ? 'Üçüncü Taraf Testli' : 'Third-Party Tested'}</div>
          <div className="purity-guarantee-brand">
            {isAactivated ? 'AACTIVATED-' : 'PepScript'}<span>RX</span>
          </div>
        </div>
      </div>
      <div className="purity-guarantee-copy">
        <div className="purity-guarantee-kicker">
          {isTurkish ? 'Üçüncü taraf testleri desteklenir' : isAactivated ? 'AACTIVATED-RX quality confidence' : 'Third-party testing supported'}
        </div>
        <h3>{isTurkish ? '%99.2 Saflık Güvence Politikası' : '99.2% Purity Confidence Guarantee'}</h3>
        <p>{isExpanded ? expandedText : compactText}</p>
        {isExpanded && <p className="purity-guarantee-disclaimer">{disclaimerText}</p>}
        <Link to={policyPath} className="purity-guarantee-link">
          {isTurkish ? 'Daha Fazla Bilgi' : 'Learn More'}
        </Link>
      </div>
    </aside>
  );
}
