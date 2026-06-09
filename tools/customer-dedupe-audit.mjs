import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const OUT_DIR = resolve('qa-artifacts/customer-dedupe-audit');
const SUMMARY_PATH = resolve(OUT_DIR, 'summary.json');
const DRY_RUN_SQL_PATH = resolve(OUT_DIR, 'dry-run-repair-plan.sql');
const CUSTOMER_ROLES = new Set(['customer', 'patient', 'client']);
const STAFF_ROLES = new Set(['admin', 'rep', 'physician', 'fulfillment']);
const PAGE_SIZE = 1000;

mkdirSync(OUT_DIR, { recursive: true });

const env = loadEnv();
const supabaseUrl = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  env.SUPABASE_SERVICE_ROLE_KEY ||
  env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || (!serviceKey && !anonKey)) {
  throw new Error('Missing VITE_SUPABASE_URL and Supabase key. Provide SUPABASE_SERVICE_ROLE_KEY for full audit coverage.');
}

const key = serviceKey || anonKey;
const mode = serviceKey ? 'service_role_read_only' : 'anon_limited_read_only';
const supabase = createClient(supabaseUrl, key, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const audit = {
  auditName: 'customer-dedupe-audit',
  generatedAt: new Date().toISOString(),
  mode,
  safety: {
    readOnly: true,
    destructiveCleanupPerformed: false,
    repairSqlExecuted: false,
    secretValuesWritten: false,
  },
  limitations: [],
  tableErrors: [],
  counts: {
    totalCustomerProfiles: 0,
    totalAuthUsersWithCustomerRole: null,
    duplicateEmailGroups: 0,
    profilesWithoutAuthUser: 0,
    authUsersWithoutProfile: null,
    checkoutSubmissionsWithoutCustomerProfileLink: 0,
    checkoutSubmissionsSafelyLinkableByEmail: 0,
    recordsRequiringManualReview: 0,
  },
  duplicateGroups: [],
  unattachedSubmissions: [],
  ownershipMismatches: [],
  profilesWithoutAuthUser: [],
  authUsersWithoutProfile: [],
  highRiskScenarios: [],
  dryRunRepairPlan: {
    attachSubmissionsToCanonicalProfile: [],
    duplicateProfilesToReviewForMergedInactiveStatus: [],
    preserveFields: [
      'patient_submissions.rep_id',
      'patient_submissions.store_slug',
      'patient_submissions.source_portal',
      'patient_submissions.source_store',
      'patient_submissions.source_rep',
      'patient_submissions.checkout_scope_code',
      'patient_submissions.discount_code',
      'patient_submissions.discount_amount',
      'patient_submissions.promo_rep_slug',
      'patient_submissions.commission_basis_amount',
      'commission_ledger.*',
    ],
  },
};

if (!serviceKey) {
  audit.limitations.push(
    'SUPABASE_SERVICE_ROLE_KEY was not provided. Auth user inventory is skipped and table reads may be limited by RLS.',
  );
}

const [profiles, submissions, reps, commissionLedger] = await Promise.all([
  fetchAllRows('profiles'),
  fetchAllRows('patient_submissions'),
  fetchAllRows('reps'),
  fetchAllRows('commission_ledger'),
]);

const authUsers = serviceKey ? await fetchAuthUsers() : [];
const repsById = new Map(reps.map((rep) => [rep.id, rep]));
const profilesById = new Map(profiles.map((profile) => [profile.id, profile]));
const profilesByAuthId = groupBy(profiles.filter((profile) => profile.auth_user_id), (profile) => profile.auth_user_id);
const authUsersById = new Map(authUsers.map((user) => [user.id, user]));
const submissionsByProfileId = groupBy(
  submissions.filter((submission) => submission.patient_profile_id),
  (submission) => submission.patient_profile_id,
);
const ledgerBySubmissionId = groupBy(
  commissionLedger.filter((row) => row.submission_id),
  (row) => row.submission_id,
);

const customerProfiles = profiles.filter((profile) => isCustomerRole(profile.role));
const customerProfilesByEmail = groupBy(customerProfiles.filter((profile) => normalizeEmail(profile.email)), (profile) =>
  normalizeEmail(profile.email),
);
const allProfilesByEmail = groupBy(profiles.filter((profile) => normalizeEmail(profile.email)), (profile) =>
  normalizeEmail(profile.email),
);
const submissionsByEmail = groupBy(submissions.filter((submission) => normalizeEmail(submission.email)), (submission) =>
  normalizeEmail(submission.email),
);
const authUsersByEmail = groupBy(authUsers.filter((user) => normalizeEmail(user.email)), (user) => normalizeEmail(user.email));

audit.counts.totalCustomerProfiles = customerProfiles.length;

if (serviceKey) {
  const authUserIdsWithCustomerProfile = new Set(customerProfiles.map((profile) => profile.auth_user_id).filter(Boolean));
  const authUsersWithCustomerMetadata = authUsers.filter((user) => isCustomerRole(getAuthRole(user)));
  const authCustomerIds = new Set([
    ...authUsersWithCustomerMetadata.map((user) => user.id),
    ...[...authUserIdsWithCustomerProfile],
  ]);
  audit.counts.totalAuthUsersWithCustomerRole = authCustomerIds.size;
}

audit.profilesWithoutAuthUser = customerProfiles
  .filter((profile) => !profile.auth_user_id || (serviceKey && !authUsersById.has(profile.auth_user_id)))
  .map((profile) => profileSummary(profile, submissionsByProfileId, serviceKey ? authUsersById : null));
audit.counts.profilesWithoutAuthUser = audit.profilesWithoutAuthUser.length;

if (serviceKey) {
  const customerAuthUsers = authUsers.filter((user) => {
    const linkedProfiles = profilesByAuthId.get(user.id) ?? [];
    return isCustomerRole(getAuthRole(user)) || linkedProfiles.some((profile) => isCustomerRole(profile.role));
  });

  audit.authUsersWithoutProfile = customerAuthUsers
    .filter((user) => !(profilesByAuthId.get(user.id) ?? []).some((profile) => isCustomerRole(profile.role)))
    .map((user) => authUserSummary(user));
  audit.counts.authUsersWithoutProfile = audit.authUsersWithoutProfile.length;
}

const emailKeys = new Set([
  ...customerProfilesByEmail.keys(),
  ...authUsersByEmail.keys(),
  ...submissionsByEmail.keys(),
]);

for (const email of [...emailKeys].sort()) {
  const emailCustomerProfiles = customerProfilesByEmail.get(email) ?? [];
  const emailAllProfiles = allProfilesByEmail.get(email) ?? [];
  const emailAuthUsers = authUsersByEmail.get(email) ?? [];
  const emailSubmissions = submissionsByEmail.get(email) ?? [];
  const unattached = emailSubmissions.filter((submission) => !submission.patient_profile_id);
  const linkedProfileIds = new Set(emailSubmissions.map((submission) => submission.patient_profile_id).filter(Boolean));
  const canonical = chooseCanonicalProfile(emailCustomerProfiles, emailAuthUsers, submissionsByProfileId);
  const duplicateProfileIds = emailCustomerProfiles
    .filter((profile) => canonical && profile.id !== canonical.id)
    .map((profile) => profile.id);
  const risk = assessRisk({
    customerProfiles: emailCustomerProfiles,
    allProfiles: emailAllProfiles,
    authUsers: emailAuthUsers,
    submissions: emailSubmissions,
    linkedProfileIds,
    canonical,
  });
  const hasDuplicateSignal =
    emailCustomerProfiles.length > 1 ||
    emailAuthUsers.length > 1 ||
    linkedProfileIds.size > 1 ||
    duplicateProfileIds.length > 0;

  if (hasDuplicateSignal) {
    audit.duplicateGroups.push({
      normalizedEmail: email,
      riskLevel: risk.level,
      riskReasons: risk.reasons,
      recommendedCanonicalProfileId: canonical?.id ?? null,
      relatedAuthUserIds: emailAuthUsers.map((user) => user.id),
      relatedCustomerProfileIds: emailCustomerProfiles.map((profile) => profile.id),
      relatedNonCustomerProfileIds: emailAllProfiles
        .filter((profile) => !isCustomerRole(profile.role))
        .map((profile) => profile.id),
      relatedSubmissionIds: emailSubmissions.map((submission) => submission.id),
      duplicateProfileIdsToReview: duplicateProfileIds,
      profiles: emailAllProfiles.map((profile) => profileSummary(profile, submissionsByProfileId, serviceKey ? authUsersById : null)),
      authUsers: emailAuthUsers.map((user) => authUserSummary(user)),
      submissions: emailSubmissions.map((submission) => submissionSummary(submission, repsById, ledgerBySubmissionId)),
    });
  }

  for (const submission of unattached) {
    const linkable =
      canonical &&
      emailCustomerProfiles.length === 1 &&
      risk.level === 'low' &&
      !emailAllProfiles.some((profile) => STAFF_ROLES.has(String(profile.role ?? '').toLowerCase()));
    const record = {
      submission: submissionSummary(submission, repsById, ledgerBySubmissionId),
      normalizedEmail: email,
      recommendedCanonicalProfileId: canonical?.id ?? null,
      safelyLinkableByEmail: Boolean(linkable),
      riskLevel: linkable ? 'low' : risk.level,
      riskReasons: linkable ? ['single customer profile match by normalized email'] : risk.reasons,
    };
    audit.unattachedSubmissions.push(record);
    if (linkable) {
      audit.dryRunRepairPlan.attachSubmissionsToCanonicalProfile.push({
        submissionId: submission.id,
        canonicalProfileId: canonical.id,
        normalizedEmail: email,
        preserveAttribution: attributionSummary(submission, repsById),
      });
    }
  }

  if (canonical && duplicateProfileIds.length > 0) {
    audit.dryRunRepairPlan.duplicateProfilesToReviewForMergedInactiveStatus.push({
      normalizedEmail: email,
      canonicalProfileId: canonical.id,
      duplicateProfileIds,
      riskLevel: risk.level,
      note: 'Review before any mutation. Prefer merged/inactive marker over deletion when a compatible column exists.',
    });
  }
}

for (const submission of submissions.filter((row) => row.patient_profile_id)) {
  const profile = profilesById.get(submission.patient_profile_id);
  if (!profile) {
    audit.ownershipMismatches.push({
      type: 'submission_profile_missing',
      submission: submissionSummary(submission, repsById, ledgerBySubmissionId),
      currentPatientProfileId: submission.patient_profile_id,
      riskLevel: 'high',
      reason: 'submission references a profile id not returned by the audit',
    });
    continue;
  }
  const submissionEmail = normalizeEmail(submission.email);
  const profileEmail = normalizeEmail(profile.email);
  if (submissionEmail && profileEmail && submissionEmail !== profileEmail) {
    audit.ownershipMismatches.push({
      type: 'submission_email_profile_email_mismatch',
      submission: submissionSummary(submission, repsById, ledgerBySubmissionId),
      linkedProfile: profileSummary(profile, submissionsByProfileId, serviceKey ? authUsersById : null),
      riskLevel: 'high',
      reason: 'submission email does not match linked customer profile email',
    });
  }
}

audit.counts.duplicateEmailGroups = audit.duplicateGroups.length;
audit.counts.checkoutSubmissionsWithoutCustomerProfileLink = audit.unattachedSubmissions.length;
audit.counts.checkoutSubmissionsSafelyLinkableByEmail = audit.unattachedSubmissions.filter(
  (row) => row.safelyLinkableByEmail,
).length;
audit.counts.recordsRequiringManualReview =
  audit.duplicateGroups.filter((group) => group.riskLevel !== 'low').length +
  audit.unattachedSubmissions.filter((row) => !row.safelyLinkableByEmail).length +
  audit.ownershipMismatches.length +
  audit.profilesWithoutAuthUser.length +
  audit.authUsersWithoutProfile.length;

audit.highRiskScenarios = [
  ...audit.duplicateGroups
    .filter((group) => group.riskLevel === 'high')
    .map((group) => ({
      type: 'duplicate_email_group',
      normalizedEmail: group.normalizedEmail,
      reasons: group.riskReasons,
      relatedCustomerProfileIds: group.relatedCustomerProfileIds,
      relatedAuthUserIds: group.relatedAuthUserIds,
      relatedSubmissionIds: group.relatedSubmissionIds,
    })),
  ...audit.ownershipMismatches.map((row) => ({
    type: row.type,
    submissionId: row.submission.id,
    reasons: [row.reason],
  })),
];

writeFileSync(SUMMARY_PATH, JSON.stringify(audit, null, 2));
writeFileSync(DRY_RUN_SQL_PATH, buildDryRunSql(audit));

console.log(
  JSON.stringify(
    {
      generatedAt: audit.generatedAt,
      mode: audit.mode,
      summaryPath: relativePath(SUMMARY_PATH),
      dryRunSqlPath: relativePath(DRY_RUN_SQL_PATH),
      safety: audit.safety,
      limitations: audit.limitations,
      tableErrors: audit.tableErrors,
      counts: audit.counts,
      highRiskScenarioCount: audit.highRiskScenarios.length,
    },
    null,
    2,
  ),
);

function loadEnv() {
  try {
    return Object.fromEntries(
      readFileSync('.env', 'utf8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const index = line.indexOf('=');
          return [line.slice(0, index), line.slice(index + 1)];
        }),
    );
  } catch {
    return {};
  }
}

async function fetchAllRows(table) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase.from(table).select('*').range(from, to);
    if (error) {
      audit.tableErrors.push({ table, message: error.message });
      return rows;
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function fetchAuthUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) {
      audit.tableErrors.push({ table: 'auth.users', message: error.message });
      return users;
    }
    users.push(...(data?.users ?? []));
    if (!data?.users || data.users.length < PAGE_SIZE) return users.map((user) => ({
      id: user.id,
      email: user.email ?? null,
      created_at: user.created_at ?? null,
      last_sign_in_at: user.last_sign_in_at ?? null,
      app_metadata: {
        role: user.app_metadata?.role ?? null,
        portal: user.app_metadata?.portal ?? null,
      },
      user_metadata: {
        role: user.user_metadata?.role ?? null,
        portal: user.user_metadata?.portal ?? null,
      },
    }));
  }
}

function chooseCanonicalProfile(customerProfiles, authUsers, groupedSubmissions) {
  if (customerProfiles.length === 0) return null;
  const authIds = new Set(authUsers.map((user) => user.id));
  return [...customerProfiles].sort((left, right) => {
    const leftAuth = left.auth_user_id && authIds.has(left.auth_user_id) ? 1 : 0;
    const rightAuth = right.auth_user_id && authIds.has(right.auth_user_id) ? 1 : 0;
    if (leftAuth !== rightAuth) return rightAuth - leftAuth;

    const leftSubmissionCount = (groupedSubmissions.get(left.id) ?? []).length;
    const rightSubmissionCount = (groupedSubmissions.get(right.id) ?? []).length;
    if (leftSubmissionCount !== rightSubmissionCount) return rightSubmissionCount - leftSubmissionCount;

    return Date.parse(left.created_at ?? '9999-12-31') - Date.parse(right.created_at ?? '9999-12-31');
  })[0];
}

function assessRisk({ customerProfiles, allProfiles, authUsers, submissions, linkedProfileIds, canonical }) {
  const reasons = [];
  if (authUsers.length > 1) reasons.push('multiple auth users share this normalized email');
  if (customerProfiles.length > 1) reasons.push('multiple customer profiles share this normalized email');
  if (linkedProfileIds.size > 1) reasons.push('orders/submissions are linked across multiple profile ids');
  if (allProfiles.some((profile) => STAFF_ROLES.has(String(profile.role ?? '').toLowerCase()))) {
    reasons.push('email is also used by a staff/rep/admin profile');
  }
  if (submissions.some((submission) => submission.patient_profile_id && canonical && submission.patient_profile_id !== canonical.id)) {
    reasons.push('one or more submissions are linked to a non-canonical profile');
  }
  if (submissions.some((submission) => submission.rep_id || submission.discount_code || submission.checkout_scope_code || submission.store_slug)) {
    reasons.push('submissions include store/rep/promo/commission attribution that must be preserved');
  }
  if (customerProfiles.length === 0 && submissions.length > 0) reasons.push('submissions have no matching customer profile');

  let level = 'low';
  if (
    authUsers.length > 1 ||
    linkedProfileIds.size > 1 ||
    allProfiles.some((profile) => STAFF_ROLES.has(String(profile.role ?? '').toLowerCase())) ||
    customerProfiles.length === 0
  ) {
    level = 'high';
  } else if (customerProfiles.length > 1 || reasons.length > 1) {
    level = 'medium';
  }

  return { level, reasons: reasons.length ? reasons : ['single normalized email group with no conflicting ownership signals'] };
}

function profileSummary(profile, groupedSubmissions, authMap) {
  const linkedAuth = profile.auth_user_id && authMap ? authMap.get(profile.auth_user_id) : null;
  return {
    id: profile.id,
    auth_user_id: profile.auth_user_id ?? null,
    auth_user_exists: authMap ? Boolean(linkedAuth) : null,
    email: profile.email ?? null,
    normalizedEmail: normalizeEmail(profile.email),
    full_name: profile.full_name ?? null,
    role: profile.role ?? null,
    phone: profile.phone ?? null,
    store_slug: profile.store_slug ?? null,
    custom_store_slug: profile.custom_store_slug ?? null,
    admin_scope: profile.admin_scope ?? null,
    created_at: profile.created_at ?? null,
    updated_at: profile.updated_at ?? null,
    linkedSubmissionCount: (groupedSubmissions.get(profile.id) ?? []).length,
  };
}

function authUserSummary(user) {
  return {
    id: user.id,
    email: user.email ?? null,
    normalizedEmail: normalizeEmail(user.email),
    role: getAuthRole(user),
    portal: user.app_metadata?.portal ?? user.user_metadata?.portal ?? null,
    created_at: user.created_at ?? null,
    last_sign_in_at: user.last_sign_in_at ?? null,
  };
}

function submissionSummary(submission, repsById, ledgerBySubmissionId) {
  return {
    id: submission.id,
    patient_profile_id: submission.patient_profile_id ?? null,
    email: submission.email ?? null,
    normalizedEmail: normalizeEmail(submission.email),
    full_name: submission.full_name ?? null,
    phone: submission.phone ?? null,
    medication: submission.medication ?? null,
    current_dose: submission.current_dose ?? null,
    status: submission.status ?? null,
    payment_status: submission.payment_status ?? null,
    order_type: submission.order_type ?? null,
    created_at: submission.created_at ?? null,
    updated_at: submission.updated_at ?? null,
    quoted_price: submission.quoted_price ?? null,
    order_total: submission.order_total ?? null,
    final_customer_paid_amount: submission.final_customer_paid_amount ?? null,
    discount_code: submission.discount_code ?? null,
    discount_amount: submission.discount_amount ?? null,
    promo_discount_percent: submission.promo_discount_percent ?? null,
    promo_rep_slug: submission.promo_rep_slug ?? null,
    commission_basis_amount: submission.commission_basis_amount ?? null,
    attribution: attributionSummary(submission, repsById),
    commissionLedgerIds: (ledgerBySubmissionId.get(submission.id) ?? []).map((row) => row.id),
  };
}

function attributionSummary(submission, repsById) {
  const rep = submission.rep_id ? repsById.get(submission.rep_id) : null;
  return {
    rep_id: submission.rep_id ?? null,
    rep_slug: rep?.rep_slug ?? submission.source_rep ?? submission.promo_rep_slug ?? null,
    rep_name: rep?.rep_name ?? null,
    store_slug: submission.store_slug ?? null,
    store_name: submission.store_name ?? null,
    source_portal: submission.source_portal ?? null,
    source_store: submission.source_store ?? null,
    source_rep: submission.source_rep ?? null,
    checkout_scope_code: submission.checkout_scope_code ?? null,
    discount_code: submission.discount_code ?? null,
  };
}

function getAuthRole(user) {
  return user.app_metadata?.role ?? user.user_metadata?.role ?? null;
}

function isCustomerRole(role) {
  return CUSTOMER_ROLES.has(String(role ?? '').toLowerCase());
}

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

function groupBy(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    if (!key) continue;
    const bucket = map.get(key) ?? [];
    bucket.push(row);
    map.set(key, bucket);
  }
  return map;
}

function sqlString(value) {
  return String(value ?? '').replaceAll("'", "''");
}

function buildDryRunSql(data) {
  const lines = [
    '-- Customer dedupe dry-run repair plan.',
    '-- Generated by tools/customer-dedupe-audit.mjs.',
    '-- READ-ONLY: this file intentionally contains SELECT previews and commented DML only.',
    '-- Do not run cleanup until this plan is reviewed and backed by a reversible migration.',
    '',
  ];

  if (data.dryRunRepairPlan.attachSubmissionsToCanonicalProfile.length === 0) {
    lines.push('-- No safely linkable submissions were identified in this audit run.', '');
  } else {
    for (const item of data.dryRunRepairPlan.attachSubmissionsToCanonicalProfile) {
      lines.push(`-- Link submission ${item.submissionId} to canonical profile ${item.canonicalProfileId}`);
      lines.push(`select * from public.patient_submissions where id = '${sqlString(item.submissionId)}';`);
      lines.push(`select * from public.profiles where id = '${sqlString(item.canonicalProfileId)}';`);
      lines.push(`-- update public.patient_submissions`);
      lines.push(`-- set patient_profile_id = '${sqlString(item.canonicalProfileId)}'`);
      lines.push(`-- where id = '${sqlString(item.submissionId)}' and patient_profile_id is null;`);
      lines.push('');
    }
  }

  if (data.dryRunRepairPlan.duplicateProfilesToReviewForMergedInactiveStatus.length === 0) {
    lines.push('-- No duplicate customer profiles were recommended for merged/inactive review.', '');
  } else {
    for (const item of data.dryRunRepairPlan.duplicateProfilesToReviewForMergedInactiveStatus) {
      lines.push(`-- Review duplicate profiles for ${item.normalizedEmail}; canonical profile: ${item.canonicalProfileId}; risk: ${item.riskLevel}`);
      lines.push(`select * from public.profiles where id in ('${[item.canonicalProfileId, ...item.duplicateProfileIds].map(sqlString).join("','")}');`);
      lines.push('-- Suggested future approach: add/verify merged_into_profile_id + inactive/archived marker, then update duplicate profiles.');
      lines.push('-- No DML is included here because the current schema may not have a universal merged/inactive column.');
      lines.push('');
    }
  }

  lines.push('-- Attribution fields to preserve:');
  for (const field of data.dryRunRepairPlan.preserveFields) lines.push(`-- - ${field}`);
  lines.push('');
  return `${lines.join('\n')}\n`;
}

function relativePath(path) {
  return path.replace(`${process.cwd()}\\`, '').replace(`${process.cwd()}/`, '').replaceAll('\\', '/');
}
