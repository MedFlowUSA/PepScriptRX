import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getPartnerTenant, isPlatformAdmin } from '../../lib/partnerTenant';
import DashLayout from '../../components/layout/DashLayout';
import PureCollectionManager from '../../components/PureCollectionManager';
export default function AdminPureCollections(){
  const {profile}=useAuth();
  if(!isPlatformAdmin(profile)&&getPartnerTenant(profile)?.brandId!=='purepeptidelabs')return <Navigate to="/admin" replace/>;
  return <DashLayout title="Pure Peptide Labs Collections" navItems={[{label:'Dashboard',path:'/admin',icon:'01'},{label:'Pure Collections',path:'/admin/pure-collections',icon:'02'}]}><PureCollectionManager/></DashLayout>;
}
