export type LoginPortalType = 'patient' | 'rep' | 'admin';

const ROLE_GROUPS: Record<LoginPortalType, string[]> = {
  patient: ['customer', 'patient', 'client'],
  rep: ['rep', 'representative', 'affiliate', 'rep_applicant'],
  admin: ['admin', 'distributor', 'owner', 'platform_admin', 'master_admin', 'super_admin', 'rx_plus_admin', 'partner_admin_full', 'partner_admin_limited'],
};

const ROLE_LABELS: Record<LoginPortalType, string> = {
  patient: 'Customer',
  rep: 'Rep',
  admin: 'Admin',
};

export function normalizeRole(role?: string | null): string {
  return String(role ?? '').trim().toLowerCase();
}

export function getRolePortalType(role?: string | null): LoginPortalType | null {
  const normalized = normalizeRole(role);
  if (!normalized) return null;

  if (ROLE_GROUPS.patient.includes(normalized)) return 'patient';
  if (ROLE_GROUPS.rep.includes(normalized)) return 'rep';
  if (ROLE_GROUPS.admin.includes(normalized)) return 'admin';

  return null;
}

export function roleMatchesPortal(role: string | null | undefined, portal: LoginPortalType): boolean {
  return getRolePortalType(role) === portal;
}

export function roleMatchesAllowedRoles(role: string | null | undefined, allowedRoles: string[]): boolean {
  const normalizedRole = normalizeRole(role);
  if (!normalizedRole) return false;

  return allowedRoles.some((allowedRole) => {
    const normalizedAllowed = normalizeRole(allowedRole);
    if (normalizedRole === normalizedAllowed) return true;
    // Applicants use the rep login screen, but never inherit representative routes.
    if (normalizedRole === 'rep_applicant' || normalizedAllowed === 'rep_applicant') return false;

    const allowedPortal = getRolePortalType(normalizedAllowed);
    return Boolean(allowedPortal && getRolePortalType(normalizedRole) === allowedPortal);
  });
}

export function rolePortalLabel(role?: string | null): string {
  const portal = getRolePortalType(role);
  return portal ? ROLE_LABELS[portal] : 'Unknown';
}

export function portalLabel(portal: LoginPortalType): string {
  return ROLE_LABELS[portal];
}

export function dashboardPathForRole(role?: string | null): string {
  if (role === 'rep_applicant') return '/applicant';
  switch (getRolePortalType(role)) {
    case 'admin':
      return '/admin';
    case 'rep':
      return '/rep';
    case 'patient':
      return '/patient';
    default:
      return '/login';
  }
}

export function loginPathForRole(role?: string | null): string {
  const portal = getRolePortalType(role) ?? 'patient';
  return `/login?portal=${portal}`;
}
