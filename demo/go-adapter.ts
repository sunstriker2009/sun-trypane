import type { RunnerAdapter } from "../src/pane.js";

export function createGoDemoAdapter<Result>(
  operation: "compact" | "check",
  maxBytes: number,
  limitMessage: string,
  decode: (data: Record<string, unknown>, input: string) => Result | undefined,
): RunnerAdapter<string, Result> {
  return {
    async load() {},
    run(input, { signal }) {
      signal.throwIfAborted();
      if (new TextEncoder().encode(input).length > maxBytes) {
        throw new Error(limitMessage);
      }

      return new Promise((resolve, reject) => {
        const worker = new Worker(new URL("../../demo/go-worker.mjs", import.meta.url), { type: "module" });
        const deadline = setTimeout(() => fail("The Go runtime timed out."), 20_000);
        function cleanup() {
          clearTimeout(deadline);
          signal.removeEventListener("abort", abort);
          worker.terminate();
        }
        function fail(message: string) {
          cleanup();
          reject(new Error(message));
        }
        function abort() {
          cleanup();
          reject(signal.reason);
        }

        signal.addEventListener("abort", abort, { once: true });
        worker.onerror = () => fail("The Go runtime could not start. Try again.");
        worker.onmessage = ({ data }) => {
          if (typeof data?.failure === "string") {
            fail(data.failure);
          } else {
            const result = data && typeof data === "object" ? decode(data, input) : undefined;
            if (result === undefined) {
              fail("The Go runtime returned an invalid result.");
            } else {
              cleanup();
              resolve(result);
            }
          }
        };
        worker.postMessage({ operation, input });
      });
    },
  };
}
