import { Link } from 'react-router-dom';

type Props = {
  compact?: boolean;
  expanded?: boolean;
  variant?: 'pepscriptrx' | 'aactivated';
  locale?: 'en' | 'tr';
  className?: string;
};

export default function ProductPurityGuaranteeBadge({ variant = 'pepscriptrx', className = '' }: Props) {
  const isAactivated = variant === 'aactivated';
  const documentsPath = isAactivated ? '/aactivated/certificates' : '/certificates';
  return (
    <aside className={`purity-guarantee-badge compact brand-${variant} ${className}`.trim()}>
      <div className="purity-guarantee-art" aria-hidden="true">
        <div className="purity-guarantee-seal"><div className="purity-guarantee-shield">{isAactivated ? 'A' : 'RX'}</div></div>
      </div>
      <div className="purity-guarantee-copy">
        <div className="purity-guarantee-kicker">Product-specific transparency</div>
        <h3>Quality document status</h3>
        <p>Testing or purity statements are shown only when supported by a verified, current document for the applicable product and batch.</p>
        <Link to={documentsPath} className="purity-guarantee-link">Check document status</Link>
      </div>
    </aside>
  );
}
