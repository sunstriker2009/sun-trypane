import { mountTryPane } from '../src/pane.js';
import type { RunnerAdapter } from '../src/pane.js';

type CheckResult = {
  success: boolean;
  truncated: boolean;
  diagnostics: { id: string; severity: string; message: string; line: number | null; column: number | null }[];
};

const adapter: RunnerAdapter<string, CheckResult> = {
  async load() {},
  run(source, { signal }) {
    return new Promise((resolve, reject) => {
      signal.throwIfAborted();
      const worker = new Worker(
        new URL('../compiler/wwwroot/compiler-worker.mjs', import.meta.url),
        { type: 'module' },
      );
      const abort = () => finish(() => reject(signal.reason));
      let ready = false;
      const deadline = setTimeout(() => fail(ready
        ? 'The compiler check timed out.'
        : 'The browser compiler took too long to start.'), 45_000);
      function finish(complete: () => void): void {
        clearTimeout(deadline);
        signal.removeEventListener('abort', abort);
        worker.terminate();
        complete();
      }
      function fail(message: string): void {
        finish(() => reject(new Error(message)));
      }
      signal.addEventListener('abort', abort, { once: true });
      worker.onmessage = ({ data }) => {
        if (data.ready) {
          ready = true;
          worker.postMessage(source);
        } else if (data.error) fail(data.error);
        else finish(() => resolve(data.result));
      };
      worker.onerror = () => fail('The compiler worker could not load.');
    });
  },
};

const input = document.querySelector<HTMLTextAreaElement>('#source');
const target = document.querySelector<HTMLElement>('#try-it');
if (!input || !target) throw new Error('The compiler demo is missing its controls.');

const pane = mountTryPane(target, {
  runLabel: "Check",
  adapter,
  readInput: () => input.value,
  describeResult: result => result.success ? 'Compilation passed.' : 'Compilation failed.',
  renderResult(result, target) {
    if (!result.diagnostics.length) return;
    const list = document.createElement('ul');
    for (const diagnostic of result.diagnostics) {
      const item = document.createElement('li');
      const location = diagnostic.line === null ? '' : `Line ${diagnostic.line}, column ${diagnostic.column} · `;
      item.textContent = `${location}${diagnostic.severity} ${diagnostic.id}: ${diagnostic.message}`;
      list.append(item);
    }
    target.append(list);
    if (result.truncated) target.append('Additional diagnostics were omitted.');
  },
});

input.addEventListener("input", () => pane.reset());
