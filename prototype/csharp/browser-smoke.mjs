import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const server = spawn(process.execPath, [fileURLToPath(new URL('./serve.mjs', import.meta.url)), '0']);
server.stderr.pipe(process.stderr);
const closed = once(server, 'close');
let browser;
try {
  const origin = await Promise.race([
    (async () => {
      let output = '';
      for await (const chunk of server.stdout) {
        output += chunk;
        const match = output.match(/http:\/\/127\.0\.0\.1:\d+/);
        if (match) return match[0];
      }
      throw new Error('The editor did not start.');
    })(),
    delay(5000, undefined, { ref: false }).then(() => { throw new Error('Editor startup timed out.'); }),
  ]);

  const post = (headers, input = { source: 'Console.WriteLine("probe");', stdin: '' }) => fetch(origin + '/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(input),
  });
  assert.equal((await post({ Origin: 'https://example.test' })).status, 403);
  assert.equal((await post({})).status, 403);
  assert.equal((await post({ Origin: origin }, { source: 'x'.repeat(32769), stdin: '' })).status, 413);
  assert.equal((await post({ Origin: origin }, { source: '', stdin: 'é'.repeat(16385) })).status, 413);
  assert.equal((await post({ Origin: origin }, { source: '', stdin: 123 })).status, 400);

  browser = await chromium.launch(process.env.TRYPANE_CHROME_PATH
    ? { executablePath: process.env.TRYPANE_CHROME_PATH, args: ['--no-sandbox'] }
    : { args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(35_000);
  await page.goto(origin);
  const code = page.getByRole('textbox', { name: 'C# source' });
  const stdin = page.getByRole('textbox', { name: 'Standard input (optional)', exact: true });
  const run = page.getByRole('button', { name: 'Run', exact: true });
  const status = page.getByRole('status');
  const output = page.locator('.try-pane__output');
  await run.click();
  await status.getByText('Run complete').waitFor();
  assert.match(await output.textContent(), /Sum: 15/);

  await code.fill('Console.WriteLine(MissingValue);');
  await run.click();
  await status.getByText('Run failed. See diagnostics.').waitFor();
  assert.match(await output.textContent(), /error CS0103/);

  const loop = 'Console.WriteLine(Console.ReadLine()); while (true) { Thread.Sleep(50); }';
  await stdin.fill('Still running');
  await code.fill(loop);
  await run.click();
  await output.getByText('Still running', { exact: false }).waitFor();
  await status.getByText('Running…', { exact: true }).waitFor();
  const concurrent = await post({ Origin: origin });
  assert.equal(concurrent.status, 409);
  await concurrent.text();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await status.getByText('Cancelled').waitFor();
  assert.equal(await code.inputValue(), loop);
  assert.equal(await stdin.inputValue(), 'Still running');
  assert.match(await output.textContent(), /Still running/);

  await stdin.fill('élan\n東京');
  await code.fill('Console.WriteLine(Console.ReadLine() + " / " + Console.ReadLine()); Console.WriteLine(Console.ReadLine() is null ? "EOF" : "Unexpected input");');
  for (let attempt = 0; attempt < 20; attempt++) {
    const response = page.waitForResponse(result => result.url() === origin + '/run');
    await run.click();
    if ((await response).status() === 200) break;
    await status.getByText('A run is still active or stopping.', { exact: false }).waitFor();
    await delay(250);
  }
  await status.getByText('Run complete').waitFor();
  assert.match(await output.textContent(), /élan \/ 東京/);
  assert.match(await output.textContent(), /EOF/);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
} finally {
  await browser?.close();
  server.kill('SIGTERM');
  await closed;
}
