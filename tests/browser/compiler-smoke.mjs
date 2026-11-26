import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { chromium } from 'playwright';

export async function checkCompiler(browser, origin) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(50_000);
  page.on('pageerror', error => console.error(error));
  page.on('console', message => {
    if (message.type() === 'error') console.error('Browser:', message.text());
  });
  const submittedSource = 'Console.WriteLine(Enumerable.Range(1, 5).Sum());';
  const requests = [];
  const bytes = new Map();
  page.on('request', request => requests.push({ method: request.method(), url: request.url() }));
  page.on('response', response => {
    if (response.url().includes('/dist/compiler/wwwroot/')) {
      bytes.set(response.url(), Number(response.headers()['content-length'] ?? 0));
    }
  });
  await page.goto(new URL('demo/csharp-check.html', origin).href);
  const source = page.getByRole('textbox', { name: 'C# source' });
  const check = page.getByRole('button', { name: 'Check', exact: true });
  const status = page.getByRole('status');
  const result = page.locator('.try-pane__result');

  assert.equal(await source.inputValue(), submittedSource);
  const started = performance.now();
  await check.click();
  await status.getByText(/Compilation (passed|failed)\.|Run failed/).waitFor();
  assert.equal(await status.textContent(), 'Compilation passed.', await result.textContent());
  const coldMs = Math.round(performance.now() - started);
  const runtimeBytes = [...bytes.values()].reduce((sum, size) => sum + size, 0);
  assert.ok(runtimeBytes > 0 && runtimeBytes <= 30_000_000,
    `Expected at most 30 MB of compiler assets, received ${runtimeBytes} bytes`);

  await source.fill('// First line\nConsole.WriteLine(MissingValue);');
  await check.click();
  await status.getByText('Compilation failed.').waitFor();
  assert.match(await result.textContent(), /Line 2, column 19 · error CS0103/);
  assert.match(await result.textContent(), /MissingValue/);

  const blocked = Promise.withResolvers();
  await page.route('**/compiler-worker.mjs', async route => {
    await blocked.promise;
    await route.abort().catch(() => {});
  });
  await check.click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await status.getByText('Cancelled', { exact: true }).waitFor();
  blocked.resolve();
  await page.unroute('**/compiler-worker.mjs');
  assert.match(await source.inputValue(), /MissingValue/);
  await source.fill('#warning Browser test\nthrow new Exception("Compilation does not execute this.");');
  await check.click();
  await status.getByText('Compilation passed.').waitFor();
  assert.match(await result.textContent(), /warning CS1030.*Browser test/);
  assert.ok(requests.every(request => request.method === 'GET' && new URL(request.url).origin === new URL(origin).origin));
  assert.ok(requests.every(request => !request.url.includes('MissingValue')));
  assert.match(await result.textContent(), /Check time: [0-9.]+ s/);

  const report = { browser: await browser.version(), coldMs, runtimeBytes, runtimeRequests: bytes.size };
  await writeFile('dist/compiler-measurements.json', JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report));
  await page.close();
}

if (import.meta.main) {
  const origin = process.argv[2];
  if (!origin) throw new Error('Pass the local static server URL.');
  const browser = await chromium.launch(process.env.TRYPANE_CHROME_PATH
    ? { executablePath: process.env.TRYPANE_CHROME_PATH, args: ['--no-sandbox'] }
    : { args: ['--no-sandbox'] });
  try {
    await checkCompiler(browser, origin);
  } finally {
    await browser.close();
  }
}
