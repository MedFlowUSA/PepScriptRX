import type { Profile, Role } from '../types';

const MAIN_ADMIN_ROLES: Role[] = ['admin', 'owner', 'platform_admin', 'super_admin', 'master_admin'];

export function isProductIntelligenceAdmin(profile?: Profile | null): boolean {
  const role = String(profile?.role ?? '').toLowerCase() as Role;
  return (
    MAIN_ADMIN_ROLES.includes(role)
    && !profile?.admin_scope
    && !profile?.store_slug
    && !profile?.owner_email
  );
}
