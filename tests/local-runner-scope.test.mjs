import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { detectRunners, selectRunners } from '../.github/scripts/local-runner-scope.mjs';

const all = { csharp: true, go: true };
const csharp = { csharp: true, go: false };
const go = { csharp: false, go: true };
const event = { event: 'pull_request', base: 'a'.repeat(40), head: 'b'.repeat(40) };

test('language-specific changes select only that Docker runner', () => {
  assert.deepEqual(selectRunners(['prototype/csharp/run.mjs']), csharp);
  assert.deepEqual(selectRunners(['prototype/go/editor.ts']), go);
  assert.deepEqual(selectRunners(['prototype/csharp/run.mjs', 'prototype/go/run.mjs']), all);
});

test('shared code, CI, dependencies and unknown inputs run both suites', () => {
  for (const path of ['src/pane.ts', 'prototype/container-runner.mjs', 'prototype/snippet-limits.mjs',
    'prototype/local-editor-smoke.mjs', 'demo/demo.css', 'tsconfig.json', 'package-lock.json',
    '.github/workflows/local-runners.yml', '.github/scripts/local-runner-scope.mjs', 'new-build-input.json']) {
    assert.deepEqual(selectRunners([path]), all, path);
  }
});

test('documentation accompanying a language change does not enable the other runner', () => {
  assert.deepEqual(selectRunners(['prototype/csharp/execute.sh', 'README.md', 'docs/CI.md']), csharp);
});

test('empty or unexpected documentation-only dispatch does not silently skip all tests', () => {
  assert.deepEqual(selectRunners([]), all);
  assert.deepEqual(selectRunners(['README.md']), all);
});

test('manual dispatch supports all runners and either language', () => {
  assert.deepEqual(detectRunners({ event: 'workflow_dispatch' }), all);
  assert.deepEqual(detectRunners({ event: 'workflow_dispatch', language: 'csharp' }), csharp);
  assert.deepEqual(detectRunners({ event: 'workflow_dispatch', language: 'go' }), go);
  assert.throws(() => detectRunners({ event: 'workflow_dispatch', language: 'unknown' }));
});

test('missing, zero or invalid revisions fall back to both suites', () => {
  for (const base of ['', '0'.repeat(40), 'not-a-sha']) {
    assert.deepEqual(detectRunners({ ...event, base }, () => { throw new Error('must not diff'); }), all);
  }
});

test('failed Git diff falls back to both suites', () => {
  assert.deepEqual(detectRunners(event, () => { throw new Error('unavailable revision'); }), all);
});

test('a rename between language directories covers both old and new paths', () => {
  assert.deepEqual(detectRunners(event, () => ['prototype/csharp/old.ts', 'prototype/go/new.ts']), all);
});

test('real Git diff includes deleted paths and handles spaces without shell evaluation', () => {
  const root = mkdtempSync(join(tmpdir(), 'trypane-ci-'));
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' }).trim();
  try {
    git('init', '-q');
    git('config', 'user.name', 'CI test');
    git('config', 'user.email', 'ci@example.invalid');
    mkdirSync(join(root, 'prototype/csharp'), { recursive: true });
    const source = join(root, 'prototype/csharp/file with spaces.ts');
    writeFileSync(source, 'old');
    git('add', '.'); git('commit', '-qm', 'base');
    const base = git('rev-parse', 'HEAD');
    unlinkSync(source);
    mkdirSync(join(root, 'prototype/go'), { recursive: true });
    writeFileSync(join(root, 'prototype/go/file.ts'), 'new');
    git('add', '-A'); git('commit', '-qm', 'head');
    const head = git('rev-parse', 'HEAD');
    const helper = fileURLToPath(new URL('../.github/scripts/local-runner-scope.mjs', import.meta.url));
    const output = execFileSync(process.execPath, [helper], { cwd: root, encoding: 'utf8',
      env: { ...process.env, EVENT_NAME: 'pull_request', BASE_SHA: base, HEAD_SHA: head, GITHUB_OUTPUT: '' } });
    assert.match(output, /csharp=true/);
    assert.match(output, /go=true/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
