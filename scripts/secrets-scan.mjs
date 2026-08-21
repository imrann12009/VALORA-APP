#!/usr/bin/env node

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

const allowedEnvFiles = new Set(['.env.example', '.env.template']);
const trackedFiles = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);

const findings = [];
const secretFilePattern = /(^|\/)\.env(?:\.[^/]+)?$/;
const secretPatterns = [
  { name: 'private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { name: 'GitHub token', pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/ },
  { name: 'AWS access key', pattern: /\bAKIA[0-9A-Z]{16}\b/ },
  { name: 'generic secret assignment', pattern: /\b(?:api[_-]?key|client[_-]?secret|auth[_-]?token|access[_-]?token|private[_-]?key|password)\s*[:=]\s*["']?(?!your[-_ ]|change[-_ ]|replace[-_ ]|example|placeholder|<)[^\s"']{12,}/i }
];

for (const file of trackedFiles) {
  const fileName = basename(file);
  if (secretFilePattern.test(file) && !allowedEnvFiles.has(fileName)) {
    findings.push(`${file}: tracked environment file must not be committed`);
    continue;
  }

  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    continue;
  }

  if (allowedEnvFiles.has(fileName)) continue;

  for (const { name, pattern } of secretPatterns) {
    if (pattern.test(content)) findings.push(`${file}: possible ${name}`);
  }
}

if (findings.length > 0) {
  console.error('Secrets scan failed:');
  for (const finding of findings) console.error(`- ${finding}`);
  process.exit(1);
}

console.log(`Secrets scan passed: ${trackedFiles.length} tracked files checked.`);
