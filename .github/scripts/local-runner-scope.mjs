import { execFileSync } from 'node:child_process';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const both = () => ({ csharp: true, go: true });

export function selectRunners(paths) {
  const selected = { csharp: false, go: false };
  for (const path of paths) {
    if (path.startsWith('prototype/csharp/')) selected.csharp = true;
    else if (path.startsWith('prototype/go/')) selected.go = true;
    else if (path === 'README.md' || (path.startsWith('docs/') && path.endsWith('.md'))) continue;
    else return both(); // Shared or unfamiliar inputs receive both runner suites.
  }
  return selected.csharp || selected.go ? selected : both();
}

export function detectRunners({ event, language = 'all', base = '', head = '' }, diff = changedFiles) {
  if (event === 'workflow_dispatch') {
    if (!['all', 'csharp', 'go'].includes(language)) throw new Error('Unknown runner selection');
    return { csharp: language !== 'go', go: language !== 'csharp' };
  }
  const valid = sha => /^(?:[a-f\d]{40}|[a-f\d]{64})$/i.test(sha) && !/^0+$/.test(sha);
  if (!valid(base) || !valid(head)) return both();
  try {
    return selectRunners(diff(base, head));
  } catch {
    console.warn('Changed inputs unavailable; checking both local runners.');
    return both();
  }
}

function changedFiles(base, head) {
  return execFileSync('git', ['diff', '--name-only', '--no-renames', '-z', base, head],
    { encoding: 'utf8', timeout: 30000 }).split('\0').filter(Boolean);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const selected = detectRunners({ event: process.env.EVENT_NAME, language: process.env.RUNNER_LANGUAGE || 'all',
    base: process.env.BASE_SHA, head: process.env.HEAD_SHA });
  const output = Object.entries(selected).map(([key, value]) => `${key}=${value}\n`).join('');
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, output);
  process.stdout.write(output);
}
