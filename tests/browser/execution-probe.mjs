import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const origin = process.argv[2];
if (!origin) throw new Error('Pass the local static server URL.');
const browser = await chromium.launch(process.env.TRYPANE_CHROME_PATH
  ? { executablePath: process.env.TRYPANE_CHROME_PATH, args: ['--no-sandbox'] }
  : { args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.goto(new URL('demo/csharp-check.html', origin).href);
  const result = await page.evaluate(() => new Promise((resolve, reject) => {
    const worker = new Worker('../dist/compiler/wwwroot/probe-worker.mjs', { type: 'module' });
    const timeout = setTimeout(() => finish(() => reject(new Error('The execution probe timed out.'))), 45_000);
    function finish(complete) {
      clearTimeout(timeout);
      worker.terminate();
      complete();
    }
    worker.onmessage = ({ data }) => finish(() => data.error ? reject(new Error(data.error)) : resolve(data.result));
    worker.onerror = error => finish(() => reject(new Error(error.message || 'Could not start the probe worker.')));
  }));
  assert.deepEqual(result, {
    exitCode: 7,
    stdout: 'Hello, Ada. Sum: 15.\n',
    stderr: 'Probe diagnostic.\n',
  });
  console.log('Browser execution probe passed: preset stdin and EOF, stdout, stderr, exit code.');
} finally {
  await browser.close();
}
