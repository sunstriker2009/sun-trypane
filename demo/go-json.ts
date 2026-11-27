import { mountTryPane } from "../src/pane.js";
import type { RunnerAdapter } from "../src/pane.js";

type JsonResult = { output: string } | { error: string };

const adapter: RunnerAdapter<string, JsonResult> = {
  async load() {},
  run(input, { signal }) {
    signal.throwIfAborted();
    if (new TextEncoder().encode(input).length > 32 * 1024) {
      throw new Error("Use at most 32 KiB of JSON.");
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
        } else if (typeof data?.output === "string" && data.output.length <= input.length) {
          cleanup();
          resolve({ output: data.output });
        } else if (typeof data?.error === "string") {
          cleanup();
          resolve({ error: data.error });
        } else {
          fail("The Go runtime returned an invalid result.");
        }
      };
      worker.postMessage(input);
    });
  },
};

const source = document.querySelector<HTMLTextAreaElement>("#json");
const target = document.querySelector<HTMLElement>("#try-it");
if (!source || !target) throw new Error("The Go demo is missing its controls.");

mountTryPane(target, {
  adapter,
  readInput: () => source.value,
  describeResult: result => "error" in result ? "Invalid JSON" : "JSON compacted",
  renderResult(result, container) {
    if ("error" in result) {
      const diagnostic = document.createElement("p");
      diagnostic.textContent = result.error;
      container.append(diagnostic);
      return;
    }
    const output = document.createElement("pre");
    output.textContent = result.output;
    container.append(output);
  },
});
