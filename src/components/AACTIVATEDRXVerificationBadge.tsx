import { Link } from 'react-router-dom';

type Props = { placement?: 'hero' | 'card' | 'detail' | 'checkout'; productName?: string; className?: string };

export default function AACTIVATEDRXVerificationBadge({ placement = 'card', productName, className = '' }: Props) {
  return (
    <aside className={`aactivated-verify-badge aactivated-verify-badge-${placement} ${className}`.trim()}>
      <span>
        <strong>QUALITY DOCUMENT STATUS</strong>
        <small>{productName ? `Check documentation for ${productName}` : 'Product- and batch-specific verification'}</small>
      </span>
      <Link to="/aactivated/certificates">Review documents</Link>
    </aside>
  );
}

export function AACTIVATEDRXVerificationModal() {
  return null;
}
