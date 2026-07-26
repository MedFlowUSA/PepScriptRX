import { useLocation } from 'react-router-dom';

const STOREFRONT_PATHS = new Set([
  '/', '/warxlabz', '/optimax-peptide-therapy', '/aactivated', '/aactivatedrx-pure',
  '/guy', '/peakform', '/alphapride', '/ronin', '/agprimelab', '/vyigenix',
  '/aurora', '/auroralabs', '/aurorajl', '/auroramd', '/auroradd', '/auroraet',
  '/aurorato', '/aurorage', '/aurorarm', '/megdel', '/zenora', '/physiopeptides',
  '/ginto', '/ginto-wellness-labs', '/beastmode', '/beastmode-performance-labs',
  '/viltrumpeptide', '/glow', '/klow', '/paulrevere', '/vitality', '/sandman',
  '/blackline', '/the-p-lounge', '/empirehealth&wellness', '/ehwsub',
]);

function isShoppingRoute(pathname: string) {
  const path = pathname.toLowerCase().replace(/\/+$/, '') || '/';
  return path === '/start'
    || path === '/checkout'
    || path.startsWith('/rx-plus/')
    || path.startsWith('/aactivated/product/')
    || path.startsWith('/aactivatedrx-pure/product/')
    || STOREFRONT_PATHS.has(path);
}

export default function FreeBacWaterBanner() {
  const { pathname } = useLocation();
  if (!isShoppingRoute(pathname)) return null;

  return (
    <div
      role="note"
      aria-label="Free bacteriostatic water included"
      style={{
        position: 'relative', zIndex: 900, width: '100%', boxSizing: 'border-box',
        padding: '10px 16px', background: 'linear-gradient(90deg, #0b1726, #12354b, #0b1726)',
        borderBottom: '1px solid rgba(255,255,255,.18)', color: '#fff', textAlign: 'center',
        fontSize: 'clamp(12px, 2.7vw, 14px)', fontWeight: 800, letterSpacing: '.02em', lineHeight: 1.35,
      }}
    >
      Complimentary with every order: <span style={{ color: '#75e6f1' }}>FREE 3 mL bottle of bacteriostatic water</span>
    </div>
  );
}
