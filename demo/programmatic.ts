import { RegexAdapter } from '../src/adapters/regex.js';
import type { RegexInput } from '../src/adapters/regex.js';
import { RunController } from '../src/runner.js';

const source = document.querySelector<HTMLElement>('#source');
const status = document.querySelector<HTMLElement>('#status');
const result = document.querySelector<HTMLElement>('#result');
if (!source || !status || !result) throw new Error('Missing programmatic demo fields.');

const input: RegexInput = { pattern: '(?<word>[A-Za-z]+)', text: 'Tweak. Test. Repeat.', mode: 'all' };
source.textContent = JSON.stringify(input, null, 2);

const workerUrl = new URL('../runtime/wwwroot/regex-worker.mjs', import.meta.url);
const controller = new RunController(new RegexAdapter(workerUrl), state => {
  if (state.status === 'loading') status.textContent = 'Loading the Regex runner…';
  if (state.status === 'running') status.textContent = 'Checking the example…';
  if (state.status === 'succeeded') {
    status.textContent = 'Run complete.';
    result.textContent = JSON.stringify(state.result, null, 2);
  }
  if (state.status === 'failed') status.textContent = state.message;
  if (state.status === 'cancelled') status.textContent = 'Cancelled.';
});

void controller.start(() => input);
window.addEventListener('pagehide', () => controller.dispose(), { once: true });
