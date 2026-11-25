import type { RunnerAdapter, RunContext } from '../runner.js';

export interface RegexInput {
  pattern: string;
  text: string;
  mode: 'first' | 'all';
}

export interface RegexMatch {
  text: string;
  index: number;
  groups: (string | null)[];
  named: { name: string; value: string | null }[];
}

export type RegexResult =
  | { status: 'match'; matches: RegexMatch[]; groupNumbers: number[]; truncated?: boolean }
  | { status: 'no-match' | 'timeout' | 'error' }
  | { status: 'invalid'; message: string };

type WorkerMessage =
  | { status: 'ready' | 'load-error' }
  | { id: number; result: RegexResult };

/** Reuse a healthy worker. Discard it after cancellation, failure, or a run timeout. */
export class RegexAdapter implements RunnerAdapter<RegexInput, RegexResult> {
  private worker?: Worker;
  private ready = false;

  constructor(
    private readonly workerUrl: URL,
    private readonly createWorker: (url: URL) => Worker = url => new Worker(url, { type: 'module' }),
  ) {}

  load({ signal }: RunContext): Promise<void> {
    signal.throwIfAborted();
    if (this.worker && this.ready) return Promise.resolve();
    if (this.worker) return Promise.reject(new Error('The Regex runner is busy.'));

    return new Promise<void>((resolve, reject) => {
      let worker: Worker;
      try {
        worker = this.createWorker(this.workerUrl);
      } catch {
        reject(new Error('The Regex runner could not load. Try again.'));
        return;
      }
      this.worker = worker;
      const cleanup = () => {
        clearTimeout(timer);
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
        signal.removeEventListener('abort', onAbort);
      };
      const fail = (message: string) => {
        cleanup();
        this.reset();
        reject(new Error(message));
      };
      const onAbort = () => fail('The run was cancelled.');
      const onError = () => fail('The Regex runner could not load. Try again.');
      const onMessage = (event: MessageEvent<WorkerMessage>) => {
        if (this.worker !== worker || !('status' in event.data)) return;
        if (event.data.status !== 'ready') {
          onError();
          return;
        }
        cleanup();
        this.ready = true;
        resolve();
      };
      const timer = setTimeout(() => fail('The Regex runner took too long to load. Try again.'), 30_000);
      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
      signal.addEventListener('abort', onAbort, { once: true });
      if (signal.aborted) onAbort();
    });
  }

  run(input: RegexInput, { id, signal }: RunContext): Promise<RegexResult> {
    signal.throwIfAborted();
    const worker = this.worker;
    if (!worker || !this.ready) return Promise.reject(new Error('The Regex runner is unavailable. Try again.'));

    return new Promise<RegexResult>((resolve, reject) => {
      const cleanup = () => {
        clearTimeout(timer);
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
        signal.removeEventListener('abort', onAbort);
      };
      const onAbort = () => {
        cleanup();
        this.reset();
        reject(new Error('The run was cancelled.'));
      };
      const onError = () => {
        cleanup();
        this.reset();
        reject(new Error('The Regex runner stopped. Try again.'));
      };
      const onMessage = (event: MessageEvent<WorkerMessage>) => {
        if (!('id' in event.data) || event.data.id !== id || this.worker !== worker) return;
        cleanup();
        resolve(event.data.result);
      };
      const timer = setTimeout(() => {
        cleanup();
        this.reset();
        resolve({ status: 'timeout' });
      }, 2_000);
      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
      signal.addEventListener('abort', onAbort, { once: true });
      if (signal.aborted) {
        onAbort();
        return;
      }
      try {
        worker.postMessage({ id, pattern: input.pattern, text: input.text, mode: input.mode });
      } catch {
        onError();
      }
    });
  }

  dispose(): void {
    this.reset();
  }

  private reset(): void {
    this.worker?.terminate();
    this.worker = undefined;
    this.ready = false;
  }
}
