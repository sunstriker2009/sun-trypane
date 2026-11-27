import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { chromium } from 'playwright';

async function listen(host, handler) {
  const server = createServer(handler);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, host, resolve);
  });
  return { server, url: 'http://' + host + ':' + server.address().port };
}

const editable = process.env.TRYPANE_EDITABLE_REHEARSAL === '1';
const staging = resolve(editable ? 'dist/editable-rehearsal' : 'dist/execution-preview');
const hostRoot = resolve(staging, 'host');
const hostHtml = await readFile(resolve(hostRoot, 'index.html'), 'utf8');
assert.ok(hostHtml.includes('__TRYPANE_RUNNER_FRAME_URL__'));
let appRequests = 0;
let frameUrl;
const hostAssets = new Map([
  [editable ? '/dist/demo/editable-preview.js' : '/dist/demo/execution-probe.js', 'text/javascript'],
  ['/dist/src/pane.js', 'text/javascript'],
  ['/dist/src/runner.js', 'text/javascript'],
  ['/demo.css', 'text/css'],
]);
const app = await listen('127.0.0.1', async (request, response) => {
  if (request.url === '/boundary-probe') {
    appRequests++;
    response.writeHead(200, { 'Access-Control-Allow-Origin': '*' }).end('test marker');
    return;
  }
  if (request.method === 'GET' && hostAssets.has(request.url)) {
    const source = await readFile(resolve(hostRoot, '.' + request.url));
    response.writeHead(200, { 'Content-Type': hostAssets.get(request.url) }).end(source);
    return;
  }
  if (request.method !== 'GET' || request.url !== '/') {
    response.writeHead(404).end();
    return;
  }
  const html = hostHtml.replace('__TRYPANE_RUNNER_FRAME_URL__', frameUrl);
  response.writeHead(200, { 'Content-Type': 'text/html' }).end(html);
});

const runtimePath = '/dist/compiler/wwwroot/';
const root = resolve(staging, 'runner/runtime');
async function checkLinearMemory() {
  const framework = resolve(root, '_framework');
  const files = (await readdir(framework)).filter(name => /^dotnet\.native(?:\.[^.]+)?\.wasm$/.test(name));
  assert.equal(files.length, 1, 'Expected one native WebAssembly runtime');
  const binary = await readFile(resolve(framework, files[0]));
  assert.deepEqual([...binary.subarray(0, 8)], [0, 97, 115, 109, 1, 0, 0, 0]);
  let offset = 8;
  function readU32() {
    let value = 0;
    for (let shift = 0; shift <= 28; shift += 7) {
      const byte = binary.readUInt8(offset++);
      value += (byte & 127) * 2 ** shift;
      if ((byte & 128) === 0) return value;
    }
    throw new Error('Invalid WebAssembly unsigned integer');
  }
  while (offset < binary.length) {
    const id = binary.readUInt8(offset++);
    const length = readU32();
    if (id !== 5) {
      offset += length;
      continue;
    }
    // Section 5 declares module-owned memory. Each WebAssembly page holds 64 KiB.
    assert.equal(readU32(), 1, 'Expected one declared linear memory');
    assert.equal(readU32(), 1, 'Memory must declare an explicit 32-bit maximum');
    const initialPages = readU32();
    const maximumPages = readU32();
    assert.ok(initialPages > 0 && initialPages <= maximumPages);
    assert.equal(maximumPages, 4096, 'Expected a 256 MiB maximum');
    console.log(`Published WebAssembly memory: ${initialPages} initial pages, ${maximumPages} maximum pages.`);
    return files[0];
  }
  assert.fail('The runtime did not declare its linear memory');
}

async function checkEditable(page) {
  const run = page.getByRole('button', { name: 'Run', exact: true });
  const cancel = page.getByRole('button', { name: 'Cancel', exact: true });
  const source = page.getByLabel('C# source');
  const input = page.getByLabel('Preset input');
  const status = page.getByRole('status');
  const result = page.locator('.try-pane__result');
  const stdout = result.locator('[data-stream="stdout"]');
  const frame = page.locator('iframe[title="Isolated C# runner"]');

  await source.fill('Console.WriteLine(Console.ReadLine()?.ToUpperInvariant()); return 12;');
  await input.fill('TryPane');
  await run.click();
  await status.getByText('Run complete', { exact: true }).waitFor({ timeout: 55_000 });
  assert.match(await result.textContent(), /Exit code: 12/);
  assert.equal(await stdout.textContent(), 'TRYPANE\n');
  assert.equal(await frame.count(), 0);

  await source.fill('Console.WriteLine(unknown);');
  await run.click();
  await status.getByText('Compilation failed', { exact: true }).waitFor();
  assert.match(await result.textContent(), /Line 1: CS0103/);
  assert.equal(await stdout.count(), 0);
  assert.equal(await frame.count(), 0);

  // Bypass the form's maxlength to verify the frame enforces the same limits.
  await source.evaluate(field => { field.value = ' '.repeat(8193); });
  await run.click();
  await status.getByText('Run failed. Use at most 8,192 source and 4,096 input characters.', { exact: true }).waitFor();
  await source.fill('Console.WriteLine(Console.ReadLine());');
  await input.evaluate(field => { field.value = 'a'.repeat(4097); });
  await run.click();
  await status.getByText('Run failed. Use at most 8,192 source and 4,096 input characters.', { exact: true }).waitFor();
  await input.fill('TryPane');

  await source.fill('throw new InvalidOperationException("test");');
  await run.click();
  await status.getByText('Execution failed', { exact: true }).waitFor();
  assert.equal(await result.textContent(), 'The snippet threw an exception.');

  await source.fill('while (true) { }');
  await run.click();
  await status.getByText('Run failed. Execution timed out.', { exact: true }).waitFor();
  assert.equal(await frame.count(), 0);

  await run.click();
  await page.getByText('Progress: Execution started.', { exact: true }).waitFor();
  await cancel.click();
  await status.getByText('Cancelled', { exact: true }).waitFor();
  assert.equal(await frame.count(), 0);
  assert.equal(await source.inputValue(), 'while (true) { }');
  assert.equal(await input.inputValue(), 'TryPane');

  await source.fill("Console.Write(new string('z', 5000));");
  await run.click();
  await status.getByText('Run complete', { exact: true }).waitFor();
  assert.match(await result.textContent(), /Exit code: 0 · Output truncated/);
  assert.equal(await stdout.textContent(), 'z'.repeat(4096));
  assert.equal(await frame.count(), 0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  console.log('Editable C# pane passed: source, preset input, diagnostics, bounds, deadline, cancellation, and rerun.');
}

const container = 'trypane-runner-host-' + randomUUID();
function docker(args) {
  return execFileSync('docker', args, { encoding: 'utf8', timeout: 20_000 }).trim();
}

let browser;
let started = false;
try {
  const wasm = await checkLinearMemory();
  docker([
    'run', '--detach', '--rm', '--name', container,
    '--publish', '127.0.0.2::8080',
    '--env', 'TRYPANE_APP_ORIGIN=' + app.url,
    '--env', 'NGINX_ENVSUBST_FILTER=^TRYPANE_APP_ORIGIN$',
    'trypane-runner-host:ci',
  ]);
  started = true;
  const runnerUrl = 'http://' + docker(['port', container, '8080/tcp']);
  assert.notEqual(new URL(runnerUrl).hostname, new URL(app.url).hostname);
  frameUrl = runnerUrl + '/frame';
  let frameResponse;
  for (let attempt = 0; attempt < 30; attempt++) {
    frameResponse = await fetch(frameUrl).catch(() => undefined);
    if (frameResponse?.ok) break;
    await delay(200);
  }
  assert.equal(frameResponse?.status, 200, 'Runner host did not become ready');
  assert.equal(frameResponse.headers.get('content-security-policy'),
    `default-src 'none'; script-src 'self'; worker-src 'self'; frame-ancestors ${app.url}`);
  await frameResponse.text();
  const workerUrl = runnerUrl + runtimePath + (editable ? 'editable-worker.mjs' : 'probe-worker.mjs');
  const otherWorker = editable ? 'probe-worker.mjs' : 'editable-worker.mjs';
  assert.equal((await fetch(runnerUrl + runtimePath + otherWorker)).status, 404);
  const workerHeaders = await fetch(workerUrl, { method: 'HEAD' });
  assert.equal(workerHeaders.status, 200);
  assert.equal(workerHeaders.headers.get('content-type'), 'text/javascript');
  const workerPolicy = "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; worker-src 'none'";
  assert.equal(workerHeaders.headers.get('content-security-policy'), workerPolicy);
  assert.equal(workerHeaders.headers.get('x-content-type-options'), 'nosniff');
  const wasmHeaders = await fetch(runnerUrl + runtimePath + '_framework/' + wasm, { method: 'HEAD' });
  assert.equal(wasmHeaders.status, 200);
  assert.equal(wasmHeaders.headers.get('content-type'), 'application/wasm');
  assert.equal((await fetch(runnerUrl + '/run', { method: 'HEAD' })).status, 404);
  assert.equal((await fetch(workerUrl, { method: 'POST', body: 'test' })).status, 403);
  browser = await chromium.launch(process.env.TRYPANE_CHROME_PATH
    ? { executablePath: process.env.TRYPANE_CHROME_PATH, args: ['--no-sandbox'] }
    : { args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await page.goto(app.url);
  if (editable) {
    await checkEditable(page);
  } else {
    await checkFixed(page);
  }
} finally {
  await browser?.close();
  try {
    if (started) docker(['rm', '--force', container]);
  } finally {
    await new Promise(resolve => app.server.close(resolve));
  }
}

async function checkFixed(page) {
  const runButton = page.getByRole('button', { name: 'Run', exact: true });
  const probe = page.getByLabel('Fixed probe');
  const status = page.getByRole('status');
  const result = page.locator('.try-pane__result');
  const runnerFrame = page.locator('iframe[title="Isolated C# runner"]');
  page.on('console', message => {
    if (message.type() === 'error') console.error(message.text());
  });

  async function run(name) {
    await probe.selectOption(name);
    await runButton.click();
  }

  const loaded = page.waitForEvent('framenavigated', frame => frame.url() === frameUrl);
  await run('console');
  const frame = await loaded;
  assert.equal(await frame.evaluate(() => {
    try {
      return window.parent.document.title;
    } catch (error) {
      return error.name;
    }
  }), 'SecurityError');
  await status.getByText('Run complete', { exact: true }).waitFor();
  assert.match(await result.textContent(), /Exit code: 7/);
  assert.equal(await result.locator('[data-stream="stdout"]').textContent(), 'Hello, Ada. Sum: 15.\n');
  assert.equal(await result.locator('[data-stream="stderr"]').textContent(), 'Probe diagnostic.\n');
  assert.equal(await runnerFrame.count(), 0);

  await run('timeout');
  await status.getByText('Run failed. Execution timed out.', { exact: true }).waitFor();
  assert.equal(await runnerFrame.count(), 0);

  await run('cancel');
  await page.getByText('Progress: Execution started.', { exact: true }).waitFor();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await status.getByText('Cancelled', { exact: true }).waitFor();
  assert.equal(await runnerFrame.count(), 0);
  assert.equal(await result.textContent(), '');

  await run('memory');
  // Window messages, including late results, cannot enter the private channel.
  await page.evaluate(() => window.postMessage({
    kind: 'result', blocked: true,
    result: { exitCode: 99, stdout: 'Stale result', stderr: '', truncated: false },
  }, location.origin));
  await status.getByText('Run complete', { exact: true }).waitFor();
  assert.match(await result.textContent(), /Exit code: 8/);
  assert.equal(await result.locator('[data-stream="stdout"]').textContent(), 'Allocation stopped at the memory limit.\n');

  await run('output');
  await status.getByText('Run complete', { exact: true }).waitFor();
  assert.match(await result.textContent(), /Exit code: 0 · Output truncated\./);
  assert.equal(await result.locator('[data-stream="stdout"]').textContent(), 'x'.repeat(4096));
  assert.equal(await result.locator('[data-stream="stderr"]').textContent(), 'y'.repeat(4096));
  assert.equal(await runnerFrame.count(), 0);
  assert.equal(appRequests, 0, 'The runner worker must not reach the app origin');
  console.log('Browser execution probe passed: origin separation, request blocking, stdout/stderr caps, timeout, cancellation, memory cap and rerun.');
}
