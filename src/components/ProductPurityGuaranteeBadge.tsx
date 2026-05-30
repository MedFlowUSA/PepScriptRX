import { Link } from 'react-router-dom';

type ProductPurityGuaranteeBadgeProps = {
  compact?: boolean;
  expanded?: boolean;
  className?: string;
};

const COMPACT_TEXT =
  'Third-party testing supported. If approved independent testing shows a verified PepScriptRX product is below 99.2% purity, the customer may qualify for a refund of the product purchase price and approved testing cost.';

const EXPANDED_TEXT =
  'PepScriptRX is committed to product quality, transparency, and customer confidence. Products are represented at 99.2% purity or better when supported by the applicable third-party testing documentation. If a verified PepScriptRX product is independently tested by an approved third-party laboratory and the result shows purity below 99.2%, the customer may qualify for a refund of the product purchase price and approved testing cost under our verification policy.';

const DISCLAIMER_TEXT =
  'This guarantee applies only to product purity verification based on acceptable third-party laboratory testing. It does not guarantee medical results, treatment outcomes, patient response, or product availability. Refund eligibility applies only to verified PepScriptRX orders and is subject to review of the full lab report.';

const BADGE_IMAGE_SRC = '/marketing/purity-confidence-badge.png';

export default function ProductPurityGuaranteeBadge({
  compact,
  expanded,
  className = '',
}: ProductPurityGuaranteeBadgeProps) {
  const isExpanded = Boolean(expanded && !compact);

  return (
    <aside className={`purity-guarantee-badge ${isExpanded ? 'expanded' : 'compact'} ${className}`.trim()}>
      <div className="purity-guarantee-art" aria-hidden="true">
        <img src={BADGE_IMAGE_SRC} alt="" loading="lazy" />
      </div>
      <div className="purity-guarantee-copy">
        <div className="purity-guarantee-kicker">Third-party testing supported</div>
        <h3>99.2% Purity Confidence Guarantee</h3>
        <p>{isExpanded ? EXPANDED_TEXT : COMPACT_TEXT}</p>
        {isExpanded && <p className="purity-guarantee-disclaimer">{DISCLAIMER_TEXT}</p>}
        <Link to="/product-confidence" className="purity-guarantee-link">
          Learn More
        </Link>
      </div>
    </aside>
  );
}
