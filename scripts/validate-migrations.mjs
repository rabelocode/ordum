import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const directory = path.resolve('supabase/migrations');
const files = (await readdir(directory)).filter((file) => file.endsWith('.sql')).sort();
const versions = new Set();
const errors = [];
const forbidden = [
  /\bdrop\s+(?:table|schema|database)\b/i,
  /\btruncate\b/i,
  /\bdisable\s+row\s+level\s+security\b/i,
  /\bgrant\s+all\b/i,
  /sb_secret_[A-Za-z0-9_-]+/,
];

for (const file of files) {
  const match = /^(\d{14})_[a-z0-9_]+\.sql$/.exec(file);
  if (!match) {
    errors.push(`${file}: nome inválido`);
    continue;
  }
  if (versions.has(match[1])) errors.push(`${file}: versão duplicada`);
  versions.add(match[1]);
  const sql = await readFile(path.join(directory, file), 'utf8');
  if (!sql.trim()) errors.push(`${file}: arquivo vazio`);
  for (const pattern of forbidden) if (pattern.test(sql)) errors.push(`${file}: operação proibida (${pattern.source})`);
}

if (errors.length) {
  console.error(`Migration validation failed (${errors.length}):\n${errors.join('\n')}`);
  process.exit(1);
}
console.log(`Migration validation passed: ${files.length} ordered migration(s).`);
