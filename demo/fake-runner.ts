import type { RunnerAdapter } from "../src/pane.js";

export interface DemoInput {
  text: string;
  fail: boolean;
}

export interface DemoResult {
  text: string;
  characterCount: number;
}

function delay(duration: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    signal.throwIfAborted();
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", abort);
      resolve();
    }, duration);

    function abort(): void {
      clearTimeout(timer);
      reject(signal.reason);
    }

    signal.addEventListener("abort", abort, { once: true });
  });
}

export const fakeRunner: RunnerAdapter<DemoInput, DemoResult> = {
  async load({ signal }) {
    await delay(450, signal);
  },
  async run(input, { signal }) {
    await delay(1050, signal);
    if (input.fail) throw new Error("Clear Simulate failure and run again.");
    return { text: input.text, characterCount: [...input.text].length };
  },
};
