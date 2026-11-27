import { mountTryPane } from '../src/pane.js';
import type { RunnerAdapter } from '../src/pane.js';

interface ProbeResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  truncated: boolean;
}

function hostedFrameUrl(): URL | undefined {
  const value = new URLSearchParams(location.hash.slice(1)).get('runner');
  if (!value) return;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return;
  }
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.chatgpt.site') ||
      url.port || url.username || url.password || url.pathname !== '/frame' || url.search || url.hash) return;
  return url;
}

const config = document.querySelector<HTMLMetaElement>('meta[name="trypane-runner-frame"]');
const frameUrl = config ? new URL(config.content) : hostedFrameUrl();
const choice = document.querySelector<HTMLSelectElement>('#probe');
const target = document.querySelector<HTMLElement>('#try-it');
if (frameUrl && choice && target) {
  if (frameUrl.origin === location.origin) throw new Error('Use a separate runner origin.');
  const setup = document.querySelector<HTMLElement>('#bridge-setup');
  const signIn = document.querySelector<HTMLAnchorElement>('#runner-sign-in');
  const controls = document.querySelector<HTMLElement>('#probe-controls');
  if (setup && signIn && controls) {
    setup.hidden = true;
    signIn.href = frameUrl.origin;
    signIn.hidden = false;
    controls.hidden = false;
  }
  mountProbe(frameUrl, choice, target, !!config);
}

function isProbeResult(value: unknown): value is ProbeResult {
  if (typeof value !== 'object' || value === null) return false;
  const result = value as Partial<ProbeResult>;
  return Number.isInteger(result.exitCode) &&
    typeof result.stdout === 'string' && result.stdout.length <= 4096 &&
    typeof result.stderr === 'string' && result.stderr.length <= 4096 &&
    typeof result.truncated === 'boolean';
}

function mountProbe(frameUrl: URL, choice: HTMLSelectElement, target: HTMLElement, localRehearsal: boolean): void {
  const adapter: RunnerAdapter<string, ProbeResult> = {
    async load() {},
    run(caseName, { signal, emit }) {
      signal.throwIfAborted();
      return new Promise((resolve, reject) => {
        const frame = document.createElement('iframe');
        frame.title = 'Isolated C# runner';
        frame.hidden = true;
        frame.sandbox.add('allow-scripts', 'allow-same-origin');
        frame.src = frameUrl.href;

        const channel = new MessageChannel();
        const deadline = setTimeout(() => fail(localRehearsal
          ? 'The runner did not respond.'
          : 'The private runner did not respond. Open it in its own tab, sign in, and retry. Your browser may block sign-in inside the frame.'), 60_000);
        const abort = () => {
          channel.port1.postMessage({ kind: 'cancel' });
          finish(() => reject(signal.reason));
        };
        function finish(complete: () => void) {
          clearTimeout(deadline);
          signal.removeEventListener('abort', abort);
          channel.port1.close();
          frame.remove();
          complete();
        }
        function fail(message: string) {
          finish(() => reject(new Error(message)));
        }
        signal.addEventListener('abort', abort, { once: true });
        frame.addEventListener('load', () => {
          frame.contentWindow?.postMessage({ type: 'trypane-probe-v1', caseName }, frameUrl.origin, [channel.port2]);
        }, { once: true });
        channel.port1.onmessage = ({ data }) => {
          if (data?.kind === 'entered') {
            emit({ kind: 'progress', text: 'Execution started.' });
          } else if (data?.kind === 'timeout' && data.blocked === true) {
            fail('Execution timed out.');
          } else if (data?.kind === 'error' && typeof data.message === 'string' && data.message.length <= 200) {
            fail(data.message);
          } else if (data?.kind === 'result' && data.blocked === true && isProbeResult(data.result)) {
            finish(() => resolve(data.result));
          } else {
            fail('Invalid response from the isolated runner.');
          }
        };
        document.body.append(frame);
      });
    },
  };

  mountTryPane(target, {
    adapter,
    showOutput: true,
    readInput: () => choice.value,
    renderResult(result, target) {
      const summary = document.createElement('p');
      summary.textContent = `Exit code: ${result.exitCode}${result.truncated ? ' · Output truncated.' : ''}`;
      target.append(summary);
      for (const stream of ['stdout', 'stderr'] as const) {
        const label = document.createElement('h2');
        label.textContent = stream;
        const text = document.createElement('pre');
        text.dataset.stream = stream;
        text.textContent = result[stream];
        target.append(label, text);
      }
    },
  });
}
