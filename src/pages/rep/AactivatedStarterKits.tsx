import { useState } from 'react';
import { Link } from 'react-router-dom';
import DashLayout from '../../components/layout/DashLayout';
import { StarterKitForm } from './AactivatedOnboarding';

const NAV = [
  { label: 'My Dashboard', path: '/rep', icon: 'DB' },
  { label: 'Starter Kits', path: '/rep/starter-kits', icon: 'KIT' },
];

export default function AactivatedStarterKits() {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  return <DashLayout title="AACTIVATEDRX Starter Kits" navItems={NAV}>
    <div className="card" style={{maxWidth:820}}>
      <div className="card-header"><div><div className="card-title">Representative Starter Kits</div><div className="card-subtitle">Purchase a starter kit now or return here whenever you are ready.</div></div></div>
      <div className="card-body" style={{display:'grid',gap:16}}>
        {message&&<div className="alert alert-success">{message}</div>}
        <p>This page remains available after activation. Purchases use secure checkout and confirmed orders are linked to your representative account.</p>
        <div style={{display:'flex',gap:10,flexWrap:'wrap'}}>
          <button className="btn btn-primary" onClick={()=>setOpen(true)}>View and purchase starter kits</button>
          <Link className="btn btn-secondary" to="/rep">Return to dashboard</Link>
        </div>
      </div>
    </div>
    {open&&<StarterKitForm close={()=>setOpen(false)} attested={()=>{setOpen(false);setMessage('Your starter-kit purchase attestation was saved.');}}/>}
  </DashLayout>;
}
