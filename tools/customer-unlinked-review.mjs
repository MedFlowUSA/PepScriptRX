import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const OUT_DIR = resolve('qa-artifacts/customer-unlinked-review');
const REDACTED_PATH = resolve(OUT_DIR, 'summary.redacted.json');
const DETAIL_PATH = resolve(OUT_DIR, 'detail.local.json');
const CSV_PATH = resolve(OUT_DIR, 'manual-review.csv');
const REVIEW_SQL_PATH = resolve(OUT_DIR, 'manual-review-status-dry-run.local.sql');
const DEDUPE_SUMMARY_PATH = resolve('qa-artifacts/customer-dedupe-audit/summary.json');
const CUSTOMER_ROLES = new Set(['customer', 'patient', 'client']);
const STAFF_ROLES = new Set(['admin', 'rep', 'physician', 'fulfillment', 'rx_plus_admin', 'platform_admin', 'super_admin']);
const PAGE_SIZE = 1000;

mkdirSync(OUT_DIR, { recursive: true });

const env = loadEnv();
const supabaseUrl = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_KEY ||
  env.SUPABASE_SERVICE_ROLE_KEY ||
  env.SUPABASE_SERVICE_KEY;

const review = serviceKey
  ? await buildFromSupabase()
  : buildFromDedupeArtifact();

writeFileSync(REDACTED_PATH, JSON.stringify(review.redactedSummary, null, 2));
writeFileSync(DETAIL_PATH, JSON.stringify(review.localDetail, null, 2));
writeFileSync(CSV_PATH, toCsv(review.localDetail.records));
writeFileSync(REVIEW_SQL_PATH, toReviewSql(review.localDetail.records));

console.log(JSON.stringify({
  generatedAt: review.redactedSummary.generatedAt,
  mode: review.redactedSummary.mode,
  safety: review.redactedSummary.safety,
  artifacts: {
    redactedSummary: relativePath(REDACTED_PATH),
    localDetail: relativePath(DETAIL_PATH),
    manualReviewCsv: relativePath(CSV_PATH),
    manualReviewStatusDryRunSql: relativePath(REVIEW_SQL_PATH),
  },
  limitations: review.redactedSummary.limitations,
  counts: review.redactedSummary.counts,
  categoryCounts: review.redactedSummary.categoryCounts,
}, null, 2));

async function buildFromSupabase() {
  if (!supabaseUrl) throw new Error('Missing VITE_SUPABASE_URL.');
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tableErrors = [];
  const [profiles, submissions, reps, commissionLedger] = await Promise.all([
    fetchAllRows(supabase, 'profiles', tableErrors),
    fetchAllRows(supabase, 'patient_submissions', tableErrors),
    fetchAllRows(supabase, 'reps', tableErrors),
    fetchAllRows(supabase, 'commission_ledger', tableErrors),
  ]);
  const authUsers = await fetchAuthUsers(supabase, tableErrors);

  const repsById = new Map(reps.map((rep) => [rep.id, rep]));
  const ledgerBySubmissionId = groupBy(commissionLedger.filter((row) => row.submission_id), (row) => row.submission_id);
  const unlinked = submissions.filter((submission) => !submission.patient_profile_id);

  const records = unlinked.map((submission) => classifyRecord({
    submission,
    repsById,
    ledgerBySubmissionId,
    profiles,
    authUsers,
    sourceMode: 'service_role_read_only',
  }));

  return buildOutputs({
    mode: 'service_role_read_only',
    source: 'supabase-live-read-only',
    records,
    limitations: [],
    tableErrors,
  });
}

function buildFromDedupeArtifact() {
  const source = readJson(DEDUPE_SUMMARY_PATH);
  const records = (source.unattachedSubmissions ?? []).map((row) => classifyRecord({
    submission: row.submission,
    attribution: row.submission?.attribution,
    riskReasons: row.riskReasons ?? [],
    riskLevel: row.riskLevel ?? 'manual',
    possibleProfiles: [],
    possibleAuthUsers: [],
    sourceMode: 'dedupe_artifact_local',
  }));

  return buildOutputs({
    mode: 'dedupe_artifact_local',
    source: relativePath(DEDUPE_SUMMARY_PATH),
    records,
    limitations: [
      'SUPABASE_SERVICE_ROLE_KEY was not provided. Report was generated from the existing local dedupe artifact, not fresh production reads.',
      'Possible customer profile/auth matches are limited in artifact mode. Rerun after service-role key rotation for full profile/auth match analysis.',
    ],
    tableErrors: [],
    sourceGeneratedAt: source.generatedAt ?? null,
  });
}

function classifyRecord({
  submission,
  attribution,
  riskReasons = [],
  riskLevel,
  repsById = new Map(),
  ledgerBySubmissionId = new Map(),
  profiles = [],
  authUsers = [],
  sourceMode,
}) {
  const normalizedEmail = normalizeEmail(submission.email);
  const validEmail = isValidEmail(normalizedEmail);
  const normalizedPhone = normalizePhone(submission.phone);
  const normalizedName = normalizeName(submission.full_name);
  const exactProfiles = validEmail
    ? profiles.filter((profile) => normalizeEmail(profile.email) === normalizedEmail)
    : [];
  const exactAuthUsers = validEmail
    ? authUsers.filter((user) => normalizeEmail(user.email) === normalizedEmail)
    : [];
  const phoneProfiles = normalizedPhone
    ? profiles.filter((profile) => normalizePhone(profile.phone) === normalizedPhone)
    : [];
  const nameProfiles = normalizedName
    ? profiles.filter((profile) => normalizeName(profile.full_name) === normalizedName)
    : [];
  const customerExactProfiles = exactProfiles.filter((profile) => isCustomerRole(profile.role));
  const staffExactProfiles = exactProfiles.filter((profile) => isStaffRole(profile.role));
  const possibleProfiles = uniqueById([
    ...customerExactProfiles,
    ...phoneProfiles.filter((profile) => isCustomerRole(profile.role)),
    ...nameProfiles.filter((profile) => isCustomerRole(profile.role)),
  ]);
  const possibleAuthUsers = exactAuthUsers;
  const rowAttribution = attribution ?? attributionSummary(submission, repsById);
  const hasAttribution = Boolean(
    rowAttribution.rep_id ||
    rowAttribution.rep_slug ||
    rowAttribution.store_slug ||
    rowAttribution.source_portal ||
    rowAttribution.source_store ||
    rowAttribution.source_rep ||
    rowAttribution.checkout_scope_code ||
    rowAttribution.discount_code,
  );
  const paymentStatus = submission.payment_status || 'unknown';
  const orderStatus = submission.status || 'unknown';
  const paymentOrderSensitive = ['payment_pending', 'paid', 'payment_exception'].includes(paymentStatus)
    || ['payment_sent', 'paid', 'fulfilled'].includes(orderStatus);
  const hasPromo = Boolean(submission.discount_code || submission.promo_rep_slug || rowAttribution.discount_code);
  const ledgerIds = submission.commissionLedgerIds ?? (ledgerBySubmissionId.get(submission.id) ?? []).map((row) => row.id);
  const reasons = [...riskReasons];

  let category = 'manual_only_review';
  if (!validEmail) {
    category = 'email_missing_invalid';
    reasons.push('missing or invalid customer email');
  } else if (staffExactProfiles.length > 0 || exactProfiles.length > 1 || exactAuthUsers.length > 1) {
    category = 'attribution_conflict';
    reasons.push('same email has staff or multiple profile/auth ownership signals');
  } else if (customerExactProfiles.length === 1 || exactAuthUsers.length === 1) {
    category = 'likely_customer_match';
    reasons.push('single exact email customer/auth match requires human approval because it was excluded from safe-link cleanup');
  } else if (phoneProfiles.length > 0 || nameProfiles.length > 0) {
    category = 'possible_customer_match';
    reasons.push('possible profile match by phone or name, not exact email');
  } else if (paymentOrderSensitive) {
    category = 'payment_order_mismatch';
    reasons.push('order has payment/order activity but no customer profile link');
  } else if (!hasAttribution) {
    category = 'no_customer_match';
    reasons.push('no customer profile, auth user, or attribution signal found');
  } else {
    category = 'manual_only_review';
    reasons.push('store/rep/promo attribution exists and no exact customer profile match was found');
  }

  const legalManualJudgment = category !== 'likely_customer_match'
    || paymentOrderSensitive
    || hasAttribution
    || hasPromo
    || ledgerIds.length > 0;
  const mayBeSafeAfterApproval = ['likely_customer_match', 'possible_customer_match'].includes(category)
    && !staffExactProfiles.length
    && !ledgerIds.length;
  const shouldRemainUnlinked = ['email_missing_invalid', 'no_customer_match'].includes(category)
    || (category === 'payment_order_mismatch' && possibleProfiles.length === 0 && possibleAuthUsers.length === 0);
  const manualReviewStatus = inferManualReviewStatus({
    category,
    normalizedEmail,
    paymentStatus,
    orderStatus,
    staffExactProfiles,
    possibleProfiles,
    possibleAuthUsers,
  });

  return {
    checkout_submission_id: submission.id,
    normalized_email: normalizedEmail,
    email_hash: hashValue(normalizedEmail),
    possible_customer_profile_ids: possibleProfiles.map((profile) => profile.id),
    possible_auth_user_ids: possibleAuthUsers.map((user) => user.id),
    possible_match_count: possibleProfiles.length + possibleAuthUsers.length,
    store_scope: rowAttribution.store_slug || rowAttribution.source_store || rowAttribution.source_portal || 'unknown',
    rep_or_admin_attribution: rowAttribution.rep_slug || rowAttribution.source_rep || rowAttribution.checkout_scope_code || 'none',
    promo_code: submission.discount_code || rowAttribution.discount_code || null,
    payment_status: paymentStatus,
    order_status: orderStatus,
    created_at: submission.created_at ?? null,
    risk_level: riskLevel ?? riskFromCategory(category),
    category,
    manual_review_recommended_status: manualReviewStatus,
    flags: {
      validEmail,
      hasAttribution,
      hasPromo,
      paymentOrderSensitive,
      hasCommissionLedger: ledgerIds.length > 0,
      sourceMode,
    },
    reason_not_safely_linked: uniqueStrings(reasons),
    recommended_manual_action: recommendationFor({
      category,
      mayBeSafeAfterApproval,
      shouldRemainUnlinked,
      paymentOrderSensitive,
      hasAttribution,
    }),
  };
}

function buildOutputs({ mode, source, records, limitations, tableErrors, sourceGeneratedAt = null }) {
  const generatedAt = new Date().toISOString();
  const categoryCounts = countBy(records, (record) => record.category);
  const counts = {
    totalRemainingUnlinkedSubmissions: records.length,
    withPromoCode: records.filter((record) => Boolean(record.promo_code)).length,
    withRepOrAdminAttribution: records.filter((record) => record.rep_or_admin_attribution !== 'none').length,
    possibleMatchingCustomerProfiles: records.filter((record) => record.possible_customer_profile_ids.length > 0).length,
    possibleMatchingAuthUsers: records.filter((record) => record.possible_auth_user_ids.length > 0).length,
    requiringLegalManualJudgment: records.filter((record) => record.flags.paymentOrderSensitive || record.flags.hasAttribution || record.risk_level !== 'low').length,
    shouldRemainUnlinked: records.filter((record) => ['email_missing_invalid', 'no_customer_match'].includes(record.category)).length,
    mayBeSafeAfterHumanApproval: records.filter((record) => ['likely_customer_match', 'possible_customer_match'].includes(record.category)).length,
  };
  const redactedSummary = {
    auditName: 'customer-unlinked-review',
    generatedAt,
    source,
    sourceGeneratedAt,
    mode,
    safety: {
      readOnly: true,
      productionDataMutated: false,
      secretsPrinted: false,
      localDetailContainsSensitiveData: true,
    },
    limitations,
    tableErrors,
    counts,
    categoryCounts,
    byStoreOrDistributor: countBy(records, (record) => record.store_scope || 'unknown'),
    byRepOrAdminAttribution: countBy(records, (record) => record.rep_or_admin_attribution || 'none'),
    byPromoCodePresence: countBy(records, (record) => record.promo_code ? 'has_promo_code' : 'no_promo_code'),
    byPaymentStatus: countBy(records, (record) => record.payment_status || 'unknown'),
    byOrderStatus: countBy(records, (record) => record.order_status || 'unknown'),
    byManualReviewRecommendation: countBy(records, (record) => record.manual_review_recommended_status || 'unknown'),
    byEmailMatchQuality: categoryCounts,
    nextStep: records.some((record) => ['likely_customer_match', 'possible_customer_match'].includes(record.category))
      ? 'Human review can approve individual likely/possible matches before a reversible repair migration is written.'
      : 'Most remaining records should stay manual-only unless customer identity is confirmed outside the system.',
  };
  const localDetail = {
    ...redactedSummary,
    records,
  };
  return { redactedSummary, localDetail };
}

async function fetchAllRows(supabase, table, tableErrors) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase.from(table).select('*').range(from, from + PAGE_SIZE - 1);
    if (error) {
      tableErrors.push({ table, message: error.message });
      return rows;
    }
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

async function fetchAuthUsers(supabase, tableErrors) {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: PAGE_SIZE });
    if (error) {
      tableErrors.push({ table: 'auth.users', message: error.message });
      return users;
    }
    users.push(...(data?.users ?? []));
    if (!data?.users || data.users.length < PAGE_SIZE) return users.map((user) => ({
      id: user.id,
      email: user.email ?? null,
      app_metadata: {
        role: user.app_metadata?.role ?? null,
      },
      user_metadata: {
        role: user.user_metadata?.role ?? null,
      },
      created_at: user.created_at ?? null,
    }));
  }
}

function attributionSummary(submission, repsById) {
  const rep = submission.rep_id ? repsById.get(submission.rep_id) : null;
  return {
    rep_id: submission.rep_id ?? null,
    rep_slug: rep?.rep_slug ?? submission.source_rep ?? submission.promo_rep_slug ?? null,
    source_rep: submission.source_rep ?? null,
    source_store: submission.source_store ?? null,
    source_portal: submission.source_portal ?? null,
    store_slug: submission.store_slug ?? null,
    checkout_scope_code: submission.checkout_scope_code ?? null,
    discount_code: submission.discount_code ?? null,
  };
}

function recommendationFor({ category, mayBeSafeAfterApproval, shouldRemainUnlinked, paymentOrderSensitive, hasAttribution }) {
  if (shouldRemainUnlinked) return 'Leave unlinked unless customer identity is confirmed manually.';
  if (category === 'email_missing_invalid') return 'Do not link. Correct email only if verified from source documents/customer contact.';
  if (category === 'attribution_conflict') return 'Manual owner review required before any profile attachment.';
  if (category === 'payment_order_mismatch') return 'Review payment/order history and customer identity before attaching.';
  if (mayBeSafeAfterApproval) return 'Human may approve a one-off reversible link migration after confirming identity.';
  if (hasAttribution || paymentOrderSensitive) return 'Manual-only review; preserve all attribution and payment history.';
  return 'Review manually; do not auto-link.';
}

function inferManualReviewStatus({
  category,
  normalizedEmail,
  paymentStatus,
  orderStatus,
  staffExactProfiles,
  possibleProfiles,
  possibleAuthUsers,
}) {
  if (looksLikeTestEmail(normalizedEmail)) return 'test_record';
  if (staffExactProfiles.length > 0 || looksLikeInternalEmail(normalizedEmail)) return 'staff_internal';
  if (orderStatus === 'cancelled_refunded' || paymentStatus === 'refunded' || paymentStatus === 'cancelled') {
    return 'cancelled_refunded_preserve';
  }
  if (['payment_pending', 'paid', 'payment_exception'].includes(paymentStatus)
    || ['payment_sent', 'paid', 'fulfilled'].includes(orderStatus)) {
    return 'payment_mismatch_review';
  }
  if (category === 'likely_customer_match' && (possibleProfiles.length === 1 || possibleAuthUsers.length === 1)) {
    return 'customer_confirmed_attach_later';
  }
  if (category === 'possible_customer_match') return 'needs_customer_confirmation';
  if (category === 'no_customer_match' || category === 'email_missing_invalid') return 'leave_unlinked';
  return 'needs_customer_confirmation';
}

function riskFromCategory(category) {
  if (category === 'likely_customer_match') return 'medium';
  if (category === 'possible_customer_match') return 'medium';
  if (category === 'no_customer_match') return 'low';
  return 'high';
}

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

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function toCsv(records) {
  const headers = [
    'checkout_submission_id',
    'normalized_email',
    'possible_customer_profile_ids',
    'possible_auth_user_ids',
    'store_scope',
    'rep_or_admin_attribution',
    'promo_code',
    'payment_status',
    'order_status',
    'created_at',
    'category',
    'manual_review_recommended_status',
    'risk_level',
    'reason_not_safely_linked',
    'recommended_manual_action',
  ];
  return `${headers.join(',')}\n${records.map((record) => headers.map((key) => csvCell(Array.isArray(record[key]) ? record[key].join(';') : record[key])).join(',')).join('\n')}\n`;
}

function toReviewSql(records) {
  const lines = [
    '-- Dry-run manual review classification draft.',
    '-- Generated by tools/customer-unlinked-review.mjs.',
    '-- This file is local-only and intentionally does not link, merge, delete, or deactivate records.',
    '-- Review each row before copying any statement into a production migration.',
    '',
    'begin;',
    '',
  ];

  for (const record of records) {
    const notes = [
      `Category: ${record.category}`,
      `Reasons: ${record.reason_not_safely_linked.join('; ')}`,
    ].join('\n');
    lines.push(`-- ${record.checkout_submission_id} ${record.email_hash ?? 'no-email-hash'}`);
    lines.push('update public.patient_submissions');
    lines.push('set');
    lines.push(`  manual_review_status = '${sqlString(record.manual_review_recommended_status)}',`);
    lines.push(`  manual_review_notes = ${sqlNullable(notes)},`);
    lines.push(`  recommended_action = ${sqlNullable(record.recommended_manual_action)},`);
    lines.push(`  manual_review_risk_level = ${sqlNullable(record.risk_level)},`);
    lines.push("  manual_review_source = 'customer-unlinked-review',");
    lines.push('  reviewed_at = now(),');
    lines.push('  updated_at = now()');
    lines.push(`where id = '${sqlString(record.checkout_submission_id)}'::uuid`);
    lines.push('  and patient_profile_id is null;');
    lines.push('');
  }

  lines.push('-- rollback; -- keep dry-run by default');
  lines.push('rollback;');
  lines.push('');
  return lines.join('\n');
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function sqlNullable(value) {
  if (value == null || value === '') return 'null';
  return `'${sqlString(value)}'`;
}

function sqlString(value) {
  return String(value ?? '').replaceAll("'", "''");
}

function looksLikeTestEmail(email) {
  return Boolean(email) && (
    email.endsWith('@example.com')
    || email.endsWith('@example.invalid')
    || email.endsWith('@test.com')
    || email.includes('codex')
    || email.includes('zelle-root-test')
    || email.includes('zelle-partner-test')
    || email.includes('+test')
    || email.startsWith('test+')
  );
}

function looksLikeInternalEmail(email) {
  return Boolean(email) && (
    email.endsWith('@medflowusa.com')
    || email.endsWith('@aactivated.com')
    || email.endsWith('@pepscriptrx.com')
  );
}

function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

function normalizePhone(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  return digits.length >= 10 ? digits.slice(-10) : '';
}

function normalizeName(name) {
  return String(name ?? '').trim().toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\s+/g, ' ');
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isCustomerRole(role) {
  return CUSTOMER_ROLES.has(String(role ?? '').toLowerCase());
}

function isStaffRole(role) {
  return STAFF_ROLES.has(String(role ?? '').toLowerCase());
}

function uniqueById(rows) {
  return [...new Map(rows.filter((row) => row?.id).map((row) => [row.id, row])).values()];
}

function uniqueStrings(values) {
  return [...new Set(values.filter(Boolean).map(String))];
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

function countBy(rows, keyFn) {
  return rows.reduce((acc, row) => {
    const key = keyFn(row) || 'unknown';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function hashValue(value) {
  return value ? createHash('sha256').update(value).digest('hex').slice(0, 16) : null;
}

function relativePath(path) {
  return path.replace(`${process.cwd()}\\`, '').replace(`${process.cwd()}/`, '').replaceAll('\\', '/');
}
