import { mountTryPane } from '../src/pane.js';
import type { RunnerAdapter } from '../src/pane.js';

interface Snippet {
  source: string;
  input: string;
}

interface EditableResult {
  compilation: {
    success: boolean;
    diagnostics: { id: string; message: string; line: number | null }[];
    truncated: boolean;
  };
  execution: { exitCode: number; stdout: string; stderr: string; truncated: boolean } | null;
  error: string | null;
}

function isEditableResult(value: unknown): value is EditableResult {
  if (!value || typeof value !== 'object') return false;
  const { compilation, execution, error } = value as Partial<EditableResult>;
  if (!compilation || typeof compilation.success !== 'boolean' || typeof compilation.truncated !== 'boolean' ||
      !Array.isArray(compilation.diagnostics) || compilation.diagnostics.length > 50 ||
      !compilation.diagnostics.every(item => item && typeof item.id === 'string' &&
        typeof item.message === 'string' && (item.line === null || Number.isInteger(item.line)))) return false;
  if (!compilation.success) return execution === null && error === null;
  if (typeof error === 'string') return error.length <= 200 && execution === null;
  return error === null && !!execution && Number.isInteger(execution.exitCode) &&
    typeof execution.stdout === 'string' && execution.stdout.length <= 4096 &&
    typeof execution.stderr === 'string' && execution.stderr.length <= 4096 &&
    typeof execution.truncated === 'boolean';
}

const config = document.querySelector<HTMLMetaElement>('meta[name="trypane-runner-frame"]')!;
const frameUrl = new URL(config.content);
if (frameUrl.origin === location.origin) throw new Error('Use a separate runner origin.');
const sourceField = document.querySelector<HTMLTextAreaElement>('#source')!;
const inputField = document.querySelector<HTMLTextAreaElement>('#input')!;
const pane = document.querySelector<HTMLElement>('#try-it')!;

const adapter: RunnerAdapter<Snippet, EditableResult> = {
  async load() {},
  run(snippet, { signal, emit }) {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
      const frame = document.createElement('iframe');
      frame.title = 'Isolated C# runner';
      frame.hidden = true;
      frame.sandbox.add('allow-scripts', 'allow-same-origin');
      frame.src = frameUrl.href;

      const { port1, port2 } = new MessageChannel();
      const deadline = setTimeout(() => fail('The runner did not respond.'), 60_000);
      function cleanup() {
        clearTimeout(deadline);
        signal.removeEventListener('abort', abort);
        port1.close();
        frame.remove();
      }
      function fail(message: string) {
        cleanup();
        reject(new Error(message));
      }
      function abort() {
        port1.postMessage({ kind: 'cancel' });
        cleanup();
        reject(signal.reason);
      }
      signal.addEventListener('abort', abort, { once: true });
      frame.addEventListener('load', () => {
        frame.contentWindow?.postMessage({ type: 'trypane-editable-v1', ...snippet }, frameUrl.origin, [port2]);
      }, { once: true });
      port1.onmessage = ({ data }) => {
        if (data?.kind === 'entered') {
          emit({ kind: 'progress', text: 'Execution started.' });
        } else if (data?.kind === 'error' && typeof data.message === 'string' && data.message.length <= 200) {
          fail(data.message);
        } else if (data?.kind === 'result' && isEditableResult(data.result)) {
          cleanup();
          resolve(data.result);
        } else {
          fail('Invalid response from the isolated runner.');
        }
      };
      document.body.append(frame);
    });
  },
};

mountTryPane(pane, {
  adapter,
  showOutput: true,
  readInput: () => ({ source: sourceField.value, input: inputField.value }),
  describeResult(result) {
    if (!result.compilation.success) return 'Compilation failed';
    if (result.error) return 'Execution failed';
    return 'Run complete';
  },
  renderResult({ compilation, execution, error }, target) {
    if (compilation.diagnostics.length) {
      const list = document.createElement('ul');
      for (const { id, message, line } of compilation.diagnostics) {
        const item = document.createElement('li');
        item.textContent = `${line === null ? '' : `Line ${line}: `}${id} ${message}`;
        list.append(item);
      }
      target.append(list);
    }
    if (compilation.truncated) target.append('More compiler diagnostics were omitted.');
    if (error) target.append(error);
    if (!execution) return;
    const summary = document.createElement('p');
    summary.textContent = `Exit code: ${execution.exitCode}${execution.truncated ? ' · Output truncated.' : ''}`;
    target.append(summary);
    for (const stream of ['stdout', 'stderr'] as const) {
      const heading = document.createElement('h2');
      heading.textContent = stream;
      const output = document.createElement('pre');
      output.dataset.stream = stream;
      output.textContent = execution[stream];
      target.append(heading, output);
    }
  },
});
