import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { performance } from 'node:perf_hooks';
import { chromium } from 'playwright';
import { checkCompiler } from './compiler-smoke.mjs';

const siteRoot = process.env.TRYPANE_SITE_ROOT;
const root = resolve(siteRoot ?? process.cwd());
const prefix = '/nested/trypane/';
const mime = {
  '.css': 'text/css',
  '.dat': 'application/octet-stream',
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.mjs': 'text/javascript',
  '.wasm': 'application/wasm',
};
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://localhost').pathname;
  if (!pathname.startsWith(prefix)) {
    response.writeHead(404).end();
    return;
  }
  const relativePath = siteRoot && pathname === prefix ? 'index.html' : pathname.slice(prefix.length);
  const file = resolve(root, relativePath);
  if (!file.startsWith(root + sep)) {
    response.writeHead(403).end();
    return;
  }
  try {
    const body = await readFile(file);
    response.writeHead(200, {
      'Content-Type': mime[extname(file)] ?? 'application/octet-stream',
      'Content-Length': body.length,
    }).end(body);
  } catch {
    response.writeHead(404).end();
  }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));

const browser = await chromium.launch(process.env.TRYPANE_CHROME_PATH
  ? { executablePath: process.env.TRYPANE_CHROME_PATH, args: ['--no-sandbox'] }
  : { args: ['--no-sandbox'] });

try {
  const address = server.address();
  const url = `http://127.0.0.1:${address.port}${prefix}demo/regex.html`;
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(45000);
  const errors = [];
  const assets = new Map();
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.url().includes('/dist/runtime/wwwroot/')) {
      assets.set(response.url(), Number(response.headers()['content-length'] ?? 0));
    }
  });
  if (siteRoot) {
    await page.goto(new URL("../", url).href);
    await page.getByRole('link', { name: 'C# Regex', exact: true }).click();
    assert.equal(page.url(), url);
    await page.goBack();
    assert.equal(await page.getByRole('link', { name: 'Live batch output' }).getAttribute('href'), 'demo/batch.html');
    assert.equal(await page.getByRole('link', { name: 'C# compiler preview' }).getAttribute('href'), 'demo/csharp-check.html');
  }
  await page.goto(url);

  const status = page.getByRole('status');
  const run = page.getByRole('button', { name: 'Run', exact: true });
  const cancel = page.getByRole('button', { name: 'Cancel', exact: true });
  const input = page.getByRole('textbox', { name: 'Test text' });
  const pattern = page.getByRole('textbox', { name: 'C# pattern' });
  const mode = page.getByRole('combobox', { name: 'Match mode' });
  const result = page.locator('.try-pane__result');

  // A real runtime load is required for the first successful result.
  const coldStart = performance.now();
  await run.focus();
  await page.keyboard.press('Enter');
  await status.getByText('1 match.').waitFor();
  const coldMs = Math.round(performance.now() - coldStart);
  assert.equal(await run.evaluate(element => document.activeElement === element), true);
  assert.match(await result.textContent(), /Name word · "Hello"/);
  const runtimeBytes = [...assets.values()].reduce((sum, bytes) => sum + bytes, 0);
  assert.ok(runtimeBytes > 0, 'the browser loaded the runtime from the nested path');
  const assetCount = assets.size;

  const warmStart = performance.now();
  await run.click();
  await status.getByText('1 match.').waitFor();
  const warmMs = Math.round(performance.now() - warmStart);
  assert.equal(assets.size, assetCount, 'the warm run reused the runtime');

  await mode.selectOption('all');
  await run.click();
  await status.getByText('2 matches.').waitFor();
  await page.getByRole('combobox', { name: 'Inspect match' }).selectOption('1');
  assert.match(await result.textContent(), /Name word · "world"/);

  await pattern.fill('a');
  await input.fill('a'.repeat(125));
  await run.click();
  await status.getByText('Showing the first 100 matches.').waitFor();
  assert.equal(await result.locator('mark').count(), 100);

  await pattern.fill('(a+)+$');
  await input.fill('a'.repeat(7000) + 'X');
  await run.click();
  await status.getByText('The match timed out. Try shorter text.').waitFor();

  await pattern.fill('\\d+');
  await input.fill('42');
  await run.click();
  await status.getByText('1 match.').waitFor();
  assert.equal(await input.inputValue(), '42');
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);

  // Cancellation during a pending load must keep host input and permit a fresh worker.
  const cancelPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await cancelPage.route('**/_framework/dotnet.js', async route => {
    await new Promise(resolve => setTimeout(resolve, 1200));
    await route.continue().catch(() => {});
  });
  await cancelPage.goto(url);
  const cancelInput = cancelPage.getByRole('textbox', { name: 'Test text' });
  await cancelInput.fill('Keep this input');
  await cancelPage.getByRole('button', { name: 'Run', exact: true }).click();
  await cancelPage.getByRole('status').getByText('Loading runner…').waitFor();
  await cancelPage.getByRole('button', { name: 'Cancel', exact: true }).click();
  await cancelPage.getByRole('status').getByText('Cancelled').waitFor();
  assert.equal(await cancelInput.inputValue(), 'Keep this input');
  await cancelPage.unroute('**/_framework/dotnet.js');
  await cancelPage.getByRole('button', { name: 'Run', exact: true }).click();
  await cancelPage.getByRole('status').getByText('1 match.').waitFor();
  assert.equal(await cancelInput.inputValue(), 'Keep this input');

  const batchPage = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const clockStart = new Date('2026-01-01T00:00:00Z');
  await batchPage.clock.install({ time: clockStart });
  await batchPage.goto(new URL('batch.html', url).href);
  await batchPage.clock.pauseAt(new Date(clockStart.getTime() + 60_000));
  const batchInput = batchPage.getByRole('textbox');
  const batchRun = batchPage.getByRole('button', { name: 'Run', exact: true });
  const batchStatus = batchPage.getByRole('status');
  const output = batchPage.locator('.try-pane__output');
  const summary = batchPage.getByRole('heading', { name: 'Summary' });

  await batchRun.press('Enter');
  assert.match(await output.textContent(), /Progress: Processed 2 of 5 lines/);
  assert.equal(await summary.count(), 0);
  assert.equal(await batchStatus.textContent(), 'Running…');
  await batchPage.getByRole('button', { name: 'Cancel', exact: true }).press('Enter');
  await batchPage.clock.runFor(1000);
  assert.equal(await batchStatus.textContent(), 'Cancelled');
  assert.equal(await output.locator('li').count(), 1);
  assert.equal(await summary.count(), 0);
  assert.match(await batchInput.inputValue(), /missing name/);

  await batchRun.press('Enter');
  await batchPage.clock.runFor(1000);
  assert.deepEqual(await output.locator('li').allTextContents(), [
    'Progress: Processed 2 of 5 lines.',
    'Diagnostic: Line 3 needs a JSON object with a nonempty name.',
    'Progress: Processed 4 of 5 lines.',
    'Progress: Processed 5 of 5 lines.',
  ]);
  assert.equal(await batchStatus.textContent(), 'Run complete');
  assert.match(await batchPage.locator('.try-pane__result').textContent(), /Accepted: 4. Skipped: 1./);

  await batchInput.fill(Array(75).fill('invalid').join('\n'));
  await batchRun.press('Enter');
  await batchPage.clock.runFor(1000);
  assert.equal(await output.locator('li').count(), 100);
  assert.equal(await output.getByText('Output truncated.').isVisible(), true);
  assert.equal(await batchPage.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);

  await batchRun.press('Enter');
  await batchPage.getByRole('button', { name: 'Reset run' }).press('Enter');
  await batchPage.clock.runFor(1000);
  assert.equal(await output.isVisible(), false);
  assert.equal(await summary.count(), 0);
  assert.equal(await batchStatus.textContent(), 'Ready');

  const report = {
    browser: await browser.version(),
    viewport: '390x844 Chromium',
    deployment: prefix,
    coldMs,
    warmMs,
    runtimeBytes,
    runtimeRequests: assetCount,
    checked: ['keyboard', 'status', 'capture inspection', 'bounded output', 'timeout recovery', 'cancel during load', 'input preservation', 'nested asset paths'],
  };
  await writeFile('dist/m2-browser-measurements.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  if (siteRoot) {
    const base = new URL("../", url).href;
    const programmatic = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await programmatic.goto(base);
    await programmatic.getByRole('link', { name: 'Programmatic Regex', exact: true }).click();
    await programmatic.getByRole('status').getByText('Run complete.', { exact: true }).waitFor({ timeout: 45000 });
    const result = JSON.parse(await programmatic.locator('#result').textContent());
    assert.equal(result.status, 'match');
    assert.deepEqual(result.matches.map(match => match.text), ['Tweak', 'Test', 'Repeat']);
    assert.equal(await programmatic.locator('.try-pane').count(), 0);
    await programmatic.close();
    const bridge = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const bridgeUrl = new URL('demo/runner-bridge.html', base);
    const bridgeRun = bridge.getByRole('button', { name: 'Run', exact: true });
    await bridge.goto(bridgeUrl.href);
    await bridge.getByRole('status').getByText('Open this page with a private runner link.').waitFor();
    assert.equal(await bridgeRun.count(), 0);

    bridgeUrl.hash = new URLSearchParams({ runner: 'https://wrong.example/frame' }).toString();
    await bridge.goto(bridgeUrl.href);
    await bridge.reload();
    await bridge.getByRole('status').getByText('Open this page with a private runner link.').waitFor();
    assert.equal(await bridgeRun.count(), 0);

    const frameUrl = 'https://runner-test.chatgpt.site/frame';
    await bridge.route(frameUrl, route => route.fulfill({
      contentType: 'text/html',
      body: `<script>
        addEventListener('message', event => {
          if (event.source !== parent || event.origin !== ${JSON.stringify(bridgeUrl.origin)} ||
              event.data?.type !== 'trypane-probe-v1' || event.data.caseName !== 'console' ||
              event.ports.length !== 1) return;
          event.ports[0].postMessage({
            kind: 'result',
            blocked: true,
            result: { exitCode: 7, stdout: 'Bridge connected.', stderr: '', truncated: false },
          });
        });
      </script>`,
    }));
    bridgeUrl.hash = new URLSearchParams({ runner: frameUrl }).toString();
    await bridge.goto(bridgeUrl.href);
    await bridge.reload();
    const signIn = bridge.getByRole('link', { name: 'Open the private runner and sign in' });
    assert.equal(new URL(await signIn.getAttribute('href')).origin, new URL(frameUrl).origin);
    assert.equal(await bridge.locator('iframe').count(), 0);
    await bridgeRun.click();
    await bridge.getByRole('status').getByText('Run complete', { exact: true }).waitFor({ timeout: 15000 });
    assert.equal(await bridge.locator('[data-stream="stdout"]').textContent(), 'Bridge connected.');
    assert.equal(await bridge.locator('iframe').count(), 0);
    await bridge.close();

    await checkGoDemo(browser, base);
    await checkGoSource(browser, base);
    await checkCompiler(browser, base);
  }
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}

async function checkGoDemo(browser, base) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const wasmUrl = new URL('dist/browser-go/json-compact.wasm', base).href;
  let wasmRequests = 0;
  page.on('request', request => {
    if (request.url() === wasmUrl) wasmRequests++;
  });
  const waiting = Promise.withResolvers();
  const release = Promise.withResolvers();
  const delayWasm = async route => {
    waiting.resolve();
    await release.promise;
    await route.abort().catch(() => {});
  };

  try {
    await page.goto(base);
    await page.getByRole('link', { name: 'Go JSON compactor', exact: true }).click();
    const run = page.getByRole('button', { name: 'Run', exact: true });
    const status = page.getByRole('status');
    const source = page.getByRole('textbox', { name: 'JSON input' });
    const result = page.locator('.try-pane__result');
    const original = await source.inputValue();
    assert.equal(wasmRequests, 0, 'Opening the demo must not load WebAssembly');

    await page.route(wasmUrl, delayWasm);
    await run.click();
    await Promise.race([
      waiting.promise,
      status.getByText('Run failed', { exact: false }).waitFor().then(async () => {
        throw new Error(await status.textContent());
      }),
    ]);
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    await status.getByText('Cancelled', { exact: true }).waitFor();
    assert.equal(await source.inputValue(), original);
    release.resolve();
    await page.unroute(wasmUrl, delayWasm);

    await source.fill('{ "message": "東京", "values": [1, 2] }');
    await run.click();
    await status.getByText('JSON compacted', { exact: true }).waitFor();
    assert.equal(await result.locator('pre').textContent(), '{"message":"東京","values":[1,2]}');

    await source.fill('{"key": }');
    await run.click();
    await status.getByText('Invalid JSON', { exact: true }).waitFor();
    assert.match(await result.textContent(), /invalid character/);

    await source.fill('é'.repeat(16385));
    await run.click();
    await status.getByText('Run failed. Use at most 32 KiB of JSON.', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  } finally {
    release.resolve();
    await page.close();
  }
}

async function checkGoSource(browser, base) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  try {
    await page.goto(base);
    await page.getByRole('link', { name: 'Go source checker', exact: true }).click();
    const check = page.getByRole('button', { name: 'Check', exact: true });
    const status = page.getByRole('status');
    const source = page.getByRole('textbox', { name: 'Go source' });
    const result = page.locator('.try-pane__result');

    await check.click();
    await status.getByText('Syntax valid', { exact: true }).waitFor();
    assert.match(await result.locator('pre').textContent(), /func main\(\) \{ fmt\.Println\("Hello, Go!"\) \}/);
    assert.match(await source.inputValue(), /func main\(\)\{/);

    await source.fill('package main\n//line other.go:99\nfunc main() { = }');
    await check.click();
    await status.getByText('Syntax errors found', { exact: true }).waitFor();
    assert.match(await result.textContent(), /Line 3, byte column 15/);
    assert.equal(await result.locator('pre').count(), 0);

    // Undefined names are a type-checking concern and do not invalidate syntax.
    await source.fill('package main\nfunc main() { missing() }');
    await check.click();
    await status.getByText('Syntax valid', { exact: true }).waitFor();
    assert.match(await result.locator('pre').textContent(), /missing\(\)/);

    await source.fill('é'.repeat(4097));
    await check.click();
    await status.getByText('Run failed. Use at most 8 KiB of Go source.', { exact: true }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  } finally {
    await page.close();
  }
}
