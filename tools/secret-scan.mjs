import { execFileSync } from 'node:child_process';

const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
const secretPatterns = [
  /^\s*SUPABASE_SERVICE_ROLE_KEY\s*=\s*[^\s<]+/i,
  /^\s*(?:PAYPAL|STRIPE|WOOCOMMERCE)[A-Z_]*(?:SECRET|KEY)\s*=\s*[^\s<]+/i,
  /\beyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\b/,
];
const allowed = /(?:example|template|placeholder|your-|DO_NOT_PRINT_THIS_SECRET)/i;
const findings = [];
for (const file of tracked) {
  if (/^(?:package-lock\.json|public\/)/.test(file)) continue;
  let text;
  try { text = await import('node:fs/promises').then(({ readFile }) => readFile(file, 'utf8')); } catch { continue; }
  text.split(/\r?\n/).forEach((line, index) => {
    if (!allowed.test(line) && secretPatterns.some((pattern) => pattern.test(line))) findings.push(`${file}:${index + 1}`);
  });
}
if (findings.length) {
  console.error(`Potential committed secrets found at:\n${findings.join('\n')}`);
  process.exit(1);
}
console.log(`Secret scan passed (${tracked.length} tracked files checked; values not printed).`);
