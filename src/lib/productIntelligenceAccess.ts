import type { Profile, Role } from '../types';
import { isAactivatedPartnerAdmin } from './aactivatedScope';

const MAIN_ADMIN_ROLES: Role[] = ['admin', 'owner', 'platform_admin', 'super_admin', 'master_admin'];

export function isMainProductIntelligenceAdmin(profile?: Profile | null): boolean {
  const role = String(profile?.role ?? '').toLowerCase() as Role;
  if (role === 'master_admin' || role === 'super_admin') return true;
  return (
    MAIN_ADMIN_ROLES.includes(role)
    && !profile?.admin_scope
    && !profile?.store_slug
    && !profile?.owner_email
  );
}

export function isAactivatedProductIntelligenceAdmin(profile?: Profile | null): boolean {
  return isAactivatedPartnerAdmin(profile);
}

export function isProductIntelligenceAdmin(profile?: Profile | null): boolean {
  return isMainProductIntelligenceAdmin(profile) || isAactivatedProductIntelligenceAdmin(profile);
}
