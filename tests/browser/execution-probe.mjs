import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

async function listen(host, handler) {
  const server = createServer(handler);
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, host, resolve);
  });
  return { server, url: 'http://' + host + ':' + server.address().port };
}

let appRequests = 0;
const app = await listen('127.0.0.1', (request, response) => {
  if (request.url === '/boundary-probe') {
    appRequests++;
    response.writeHead(200, { 'Access-Control-Allow-Origin': '*' }).end('test marker');
    return;
  }
  response.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><title>Execution probe host</title>');
});

const runtimePath = '/dist/compiler/wwwroot/';
const root = resolve('dist/compiler/wwwroot');
const mime = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.wasm': 'application/wasm', '.json': 'application/json' };
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
    return;
  }
  assert.fail('The runtime did not declare its linear memory');
}

const runner = await listen('127.0.0.2', async (request, response) => {
  const path = new URL(request.url, 'http://localhost').pathname;
  if (request.method === 'GET' && path === '/frame') {
    response.writeHead(200, {
      'Content-Type': 'text/html',
      'Content-Security-Policy': `default-src 'none'; worker-src 'self'; frame-ancestors ${app.url}`,
    }).end('<!doctype html><title>Execution probe frame</title>');
    return;
  }
  if (request.method !== 'GET' || !path.startsWith(runtimePath)) {
    response.writeHead(404).end();
    return;
  }
  const file = resolve(root, path.slice(runtimePath.length));
  if (!file.startsWith(root + sep)) {
    response.writeHead(404).end();
    return;
  }
  try {
    const bytes = await readFile(file);
    response.writeHead(200, {
      'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
      'Content-Security-Policy': "default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; connect-src 'self'; worker-src 'none'",
      'X-Content-Type-Options': 'nosniff',
    }).end(bytes);
  } catch {
    response.writeHead(404).end();
  }
});

let browser;
try {
  await checkLinearMemory();
  browser = await chromium.launch(process.env.TRYPANE_CHROME_PATH
    ? { executablePath: process.env.TRYPANE_CHROME_PATH, args: ['--no-sandbox'] }
    : { args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.goto(app.url);
  const frameUrl = runner.url + '/frame';
  const loaded = page.waitForEvent('framenavigated', frame => frame.url() === frameUrl);
  await page.evaluate(src => {
    const frame = document.createElement('iframe');
    frame.sandbox.add('allow-scripts', 'allow-same-origin');
    frame.src = src;
    document.body.append(frame);
  }, frameUrl);
  const frame = await loaded;
  assert.equal(await frame.evaluate(() => {
    try {
      return window.parent.document.title;
    } catch (error) {
      return error.name;
    }
  }), 'SecurityError');

  const run = (scenario, deadlineMs) => frame.evaluate(({ workerPath, scenario, boundaryUrl, deadlineMs }) => {
    window.probeEntered = false;
    return new Promise((resolve, reject) => {
      const worker = new Worker(workerPath, { type: 'module' });
      const startup = setTimeout(() => finish(() => reject(new Error('Probe startup timed out.'))), 45_000);
      let deadline;
      let blocked;
      function finish(complete) {
        clearTimeout(startup);
        clearTimeout(deadline);
        worker.terminate();
        window.cancelProbe = undefined;
        complete();
      }
      window.cancelProbe = () => finish(() => resolve({ outcome: 'cancelled', blocked }));
      worker.onmessage = ({ data }) => {
        if (data.ready) worker.postMessage({ scenario, boundaryUrl });
        else if ('blocked' in data) blocked = data.blocked;
        else if (data.entered) {
          clearTimeout(startup);
          window.probeEntered = true;
          deadline = setTimeout(() => finish(() => resolve({ outcome: 'timeout', blocked })), deadlineMs);
        } else if (data.error) finish(() => reject(new Error(data.error)));
        else finish(() => resolve({ outcome: 'completed', blocked, result: data.result }));
      };
      worker.onerror = error => finish(() => reject(new Error(error.message || 'Could not start the probe worker.')));
    });
  }, { workerPath: runtimePath + 'probe-worker.mjs', scenario, deadlineMs, boundaryUrl: app.url + '/boundary-probe' });

  assert.deepEqual(await run('console', 2000), {
    outcome: 'completed',
    blocked: true,
    result: { exitCode: 7, stdout: 'Hello, Ada. Sum: 15.\n', stderr: 'Probe diagnostic.\n', truncated: false },
  });
  assert.deepEqual(await run('loop', 250), { outcome: 'timeout', blocked: true });

  const active = run('loop', 10000);
  await frame.waitForFunction(() => window.probeEntered, null, { timeout: 45_000 });
  await frame.evaluate(() => window.cancelProbe());
  assert.deepEqual(await active, { outcome: 'cancelled', blocked: true });

  assert.deepEqual(await run('memory', 8000), {
    outcome: 'completed',
    blocked: true,
    result: { exitCode: 8, stdout: 'Allocation stopped at the memory limit.\n', stderr: '', truncated: false },
  });

  assert.deepEqual(await run('output', 2000), {
    outcome: 'completed',
    blocked: true,
    result: { exitCode: 0, stdout: 'x'.repeat(4096), stderr: 'y'.repeat(4096), truncated: true },
  });
  assert.equal(appRequests, 0, 'The runner worker must not reach the app origin');
  console.log('Browser execution probe passed: origin separation, request blocking, stdout/stderr caps, timeout, cancellation, memory cap and rerun.');
} finally {
  await browser?.close();
  await Promise.all([app.server, runner.server].map(server => new Promise(resolve => server.close(resolve))));
}
