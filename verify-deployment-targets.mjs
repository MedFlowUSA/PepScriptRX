import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = import.meta.dirname;
const targets = JSON.parse(readFileSync(resolve(root, 'config/deployment-targets.json'), 'utf8'));
const localEnv = readEnvFile(resolve(root, '.env'));
const configuredUrl = clean(process.env.VITE_SUPABASE_URL || localEnv.VITE_SUPABASE_URL);
const expectedUrl = clean(targets.productionSupabaseUrl).replace(/\/+$/, '');
const requireLink = process.argv.includes('--require-link');
const linkPaths = [resolve(root, 'supabase/.temp/project-ref'), resolve(root, '.supabase/.temp/project-ref')];
const linkPath = linkPaths.find(existsSync);
const linkedRef = linkPath ? clean(readFileSync(linkPath, 'utf8')) : '';
const failures = [];

if (!configuredUrl) failures.push('VITE_SUPABASE_URL is not configured.');
else if (configuredUrl.replace(/\/+$/, '') !== expectedUrl) failures.push(`Frontend Supabase URL targets ${projectRef(configuredUrl) || configuredUrl}; expected ${targets.productionSupabaseProjectRef}.`);
if (linkedRef && linkedRef !== targets.productionSupabaseProjectRef) failures.push(`Supabase CLI is linked to ${linkedRef}; expected ${targets.productionSupabaseProjectRef}.`);
else if (requireLink && !linkedRef) failures.push('Supabase CLI project link is missing. Run: supabase link --project-ref ubfruugzofftwlomkqcl');

if (failures.length) {
  console.error(`Deployment target verification failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, supabaseProjectRef: targets.productionSupabaseProjectRef, frontendTargetVerified: true, cliLinkVerified: Boolean(linkedRef), productionSiteUrl: targets.productionSiteUrl }, null, 2));

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(readFileSync(path, 'utf8').split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
    return match ? [[match[1], match[2].replace(/^['"]|['"]$/g, '')]] : [];
  }));
}
function projectRef(value) { try { return new URL(value).hostname.split('.')[0]; } catch { return ''; } }
function clean(value) { return String(value ?? '').trim(); }
