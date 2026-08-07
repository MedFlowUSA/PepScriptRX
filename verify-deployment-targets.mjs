import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const targets = JSON.parse(readFileSync(resolve(root, 'config/deployment-targets.json'), 'utf8'));
const localEnv = readEnvFile(resolve(root, '.env'));
const env = { ...localEnv, ...process.env };
const failures = [];

const vercelEnv = clean(env.VERCEL_ENV);
const appEnv = clean(env.APP_ENV);
const clientAppEnv = clean(env.VITE_APP_ENV);
const appProject = clean(env.APP_PROJECT);
const clientAppProject = clean(env.VITE_APP_PROJECT);
const clientUrl = normalizeUrl(env.VITE_SUPABASE_URL);
const serverUrl = normalizeUrl(env.SUPABASE_URL);
const vercelProjectId = String(env.VERCEL_PROJECT_ID ?? '').trim();
const vercelProjectUrl = hostname(env.VERCEL_PROJECT_PRODUCTION_URL);
const publicSiteUrl = hostname(env.VITE_PUBLIC_SITE_URL);
const knownVercelProject = Object.values(targets).find((entry) => entry && typeof entry === 'object' && !Array.isArray(entry) && entry.vercelProjectId === vercelProjectId);

if (vercelEnv && !['production', 'preview', 'development'].includes(vercelEnv)) {
  failures.push('VERCEL_ENV must be production, preview, development, or unset for local use.');
}
if (!appEnv) failures.push('APP_ENV is required and must explicitly identify production or staging.');
if (!clientAppEnv) failures.push('VITE_APP_ENV is required and must agree with APP_ENV.');
if (!appProject) failures.push('APP_PROJECT is required and must explicitly identify the application project.');
if (!clientAppProject) failures.push('VITE_APP_PROJECT is required and must agree with APP_PROJECT.');
if (appEnv && !['production', 'staging'].includes(appEnv)) failures.push('APP_ENV must be production or staging.');
if (clientAppEnv && clientAppEnv !== appEnv) failures.push('Client and server application environment identities disagree.');
if (clientAppProject && clientAppProject !== appProject) failures.push('Client and server application project identities disagree.');
if (vercelEnv === 'preview' && appEnv !== 'staging') {
  failures.push('Vercel preview builds require explicit APP_ENV=staging and may not target production.');
}

const target = targets[appEnv];
if (appEnv && target) {
  if (appProject !== target.applicationProject) failures.push(`Application project identity conflicts with APP_ENV=${appEnv}.`);
  if (vercelProjectId && knownVercelProject && knownVercelProject.applicationProject !== target.applicationProject) failures.push('Known Vercel project identity belongs to a different application environment.');
  if (vercelProjectId && target.vercelProjectId && vercelProjectId !== target.vercelProjectId) failures.push('Vercel project identity conflicts with the declared application environment.');
  if (vercelProjectUrl && !vercelProjectUrl.startsWith(`${target.applicationProject}.`)) failures.push('Vercel project production URL conflicts with the declared application project.');
  const expectedUrl = normalizeUrl(target.supabaseUrl);
  if (!clientUrl) failures.push('VITE_SUPABASE_URL is required.');
  else if (clientUrl !== expectedUrl) failures.push(`Client Supabase target is ${projectRef(clientUrl) || 'unknown'}; expected ${target.supabaseProjectRef}.`);
  if (!serverUrl) failures.push('SUPABASE_URL is required.');
  else if (serverUrl !== expectedUrl) failures.push(`Server Supabase target is ${projectRef(serverUrl) || 'unknown'}; expected ${target.supabaseProjectRef}.`);
  if (clientUrl && serverUrl && clientUrl !== serverUrl) failures.push('Client and server Supabase references disagree.');
  if (appEnv === 'staging') {
    const forbiddenDomains = new Set(targets.productionDomains.map((domain) => clean(domain)));
    if (publicSiteUrl && forbiddenDomains.has(publicSiteUrl)) failures.push('Staging may not use a production customer-facing domain.');
    if (vercelProjectUrl && forbiddenDomains.has(vercelProjectUrl)) failures.push('Staging Vercel project may not use the production project domain.');
  }
}

if (failures.length) {
  console.error(`Deployment target verification failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(JSON.stringify({
  ok: true,
  vercelEnvironment: vercelEnv || 'local',
  applicationEnvironment: appEnv,
  applicationProject: appProject,
  supabaseProjectRef: target.supabaseProjectRef,
}, null, 2));

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  return Object.fromEntries(readFileSync(path, 'utf8').split(/\r?\n/).flatMap((line) => {
    const match = line.match(/^\s*([^#=\s]+)\s*=\s*(.*)\s*$/);
    return match ? [[match[1], match[2].replace(/^['"]|['"]$/g, '')]] : [];
  }));
}
function normalizeUrl(value) { return clean(value).replace(/\/+$/, ''); }
function projectRef(value) { try { return new URL(value).hostname.split('.')[0]; } catch { return ''; } }
function hostname(value) { try { return new URL(value.includes('://') ? value : `https://${value}`).hostname.toLowerCase(); } catch { return ''; } }
function clean(value) { return String(value ?? '').trim().toLowerCase(); }
