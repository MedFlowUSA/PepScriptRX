import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import '../../pages/public/PetTides.css';
export default function PetTidesLayout({ children }: { children: ReactNode }) {
 return <div className="pt-site"><header className="pt-header"><Link to="/pettides"><img className="pt-logo" src="/brands/pettides/logo.jpg" alt="PetTides" /></Link><nav aria-label="PetTides"><Link to="/pettides">Home</Link><Link to="/pettides#concepts">Shop Products</Link><Link to="/pettides/library">PetTides Library</Link><Link to="/pettides#about">About</Link></nav></header><main>{children}</main><footer className="pt-footer"><Link to="/pettides" className="pt-wordmark">Pet<span>Tides</span></Link><p>Owned and operated by PepScriptRX.</p><div><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link><Link to="/pettides#interest">Contact</Link></div></footer></div>;
}
