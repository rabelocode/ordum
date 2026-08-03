import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' }).split(/\r?\n/).filter(Boolean);
const patterns = [
  { label: 'Supabase secret key', value: /sb_secret_[A-Za-z0-9_-]{16,}/g },
  { label: 'Supabase service-role JWT', value: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g },
  { label: 'Sentry auth token', value: /sntrys_[A-Za-z0-9_-]{16,}/g },
  { label: 'live payment key', value: /(?:sk|rk)_live_[A-Za-z0-9_-]{12,}/g },
];
const findings = [];

for (const file of files) {
  if (/\.(?:png|jpe?g|gif|ico|woff2?|pdf|lock)$/i.test(file) || file === 'package-lock.json') continue;
  let source;
  try { source = await readFile(file, 'utf8'); } catch { continue; }
  for (const pattern of patterns) if (pattern.value.test(source)) findings.push(`${file}: ${pattern.label}`);
}

if (findings.length) {
  console.error(`Secret scan failed (${findings.length}). Values were intentionally omitted.\n${findings.join('\n')}`);
  process.exit(1);
}
console.log(`Secret scan passed: ${files.length} tracked file(s) inspected.`);
