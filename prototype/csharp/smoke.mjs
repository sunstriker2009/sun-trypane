import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const runner = fileURLToPath(new URL('./run.mjs', import.meta.url));

async function runSnippet(source, { cancel = false } = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'trypane-csharp-smoke-'));
  try {
    const path = join(dir, 'Demo.cs');
    await writeFile(path, source);
    const child = spawn(process.execPath, [runner, path]);
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', chunk => {
      stdout += chunk;
      if (cancel && stdout.includes('Running')) child.kill('SIGINT');
    });
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
    const status = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });
    return { status, stdout, stderr };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('compiles a console snippet and forwards stdout and stderr', async () => {
  const run = await runSnippet('Console.WriteLine(Enumerable.Range(1, 5).Sum()); Console.Error.WriteLine("Note");');
  assert.equal(run.status, 0, run.stderr);
  assert.equal(run.stdout.trim(), '15');
  assert.equal(run.stderr.trim(), 'Note');
});

test('returns a compiler diagnostic for invalid source', async () => {
  const run = await runSnippet('Console.WriteLine(MissingValue);');
  assert.equal(run.status, 65, run.stderr);
  assert.match(run.stderr, /error CS0103/);
  assert.equal(run.stdout, '');
});

test('cancels a running snippet and permits a fresh run', async () => {
  const run = await runSnippet('Console.WriteLine("Running"); while (true) { Thread.Sleep(50); }', { cancel: true });
  assert.equal(run.status, 130, run.stderr);
  assert.match(run.stdout, /Running/);
  assert.match(run.stderr, /Cancelled/);
  const retry = await runSnippet('Console.WriteLine("Ready");');
  assert.equal(retry.status, 0, retry.stderr);
  assert.equal(retry.stdout.trim(), 'Ready');
});

test('stops a snippet at the output cap', async () => {
  const run = await runSnippet('Console.Write(new string(\'x\', 100_000));');
  assert.equal(run.status, 125, run.stderr);
  assert.equal(Buffer.byteLength(run.stdout), 64 * 1024);
  assert.match(run.stderr, /Output limit reached/);
});
