import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const OUT = resolve('qa-artifacts');
mkdirSync(OUT, { recursive: true });

const env = Object.fromEntries(
  readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#') && line.includes('='))
    .map((line) => {
      const index = line.indexOf('=');
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);

const supabaseUrl = process.env.VITE_SUPABASE_URL || env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const wantedReps = ['Wendy Myers', 'Kaylee Poway', 'Juwan', 'Billy'];
const result = {
  checkedAt: new Date().toISOString(),
  reps: {},
  intakeStatuses: {},
  notificationEvents: [
    'rep_application_submitted',
    'rep_approved',
    'rep_rejected',
    'customer_account_created',
    'order_received',
    'order_shipped',
    'tracking_available',
    'admin_new_rep_request',
    'admin_new_order',
  ],
  errors: [],
};

for (const name of wantedReps) {
  const { data, error } = await supabase
    .from('reps')
    .select('id, rep_name, handle, rep_slug, active, rep_tier, parent_rep_id, brand_name')
    .or(`rep_name.ilike.%${name}%,handle.ilike.%${name}%,brand_name.ilike.%${name}%`)
    .limit(10);
  if (error) result.errors.push({ table: 'reps', name, message: error.message });
  result.reps[name] = data ?? [];
}

const { data: intakeRows, error: intakeError } = await supabase
  .from('rep_store_intake_submissions')
  .select('id, full_name, email, store_brand_name, status, source_portal, source_route, review_queue, review_admin_code, review_admin_name, created_at')
  .order('created_at', { ascending: false })
  .limit(50);

if (intakeError) {
  result.errors.push({ table: 'rep_store_intake_submissions', message: intakeError.message });
} else {
  result.intakeStatuses = (intakeRows ?? []).reduce((acc, row) => {
    acc[row.status] = (acc[row.status] ?? 0) + 1;
    return acc;
  }, {});
  result.intakeSample = intakeRows;
}

writeFileSync(resolve(OUT, 'live-data-audit.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
