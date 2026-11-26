import { mountTryPane } from "../../src/pane.js";
import type { RunnerAdapter } from "../../src/pane.js";

type RunMessage =
  | { kind: "progress" | "diagnostic"; text: string }
  | { kind: "exit"; code: number };

const runner: RunnerAdapter<{ source: string; stdin: string }, number> = {
  async load() {},
  async run(input, { signal, emit }) {
    const response = await fetch("/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
      signal,
    });
    if (!response.ok) throw new Error(await response.text());
    if (!response.body) throw new Error("The local runner sent no response.");

    const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
    let pending = "";
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) throw new Error("The local runner closed before reporting a result.");
        pending += value;
        let newline = pending.indexOf("\n");
        while (newline !== -1) {
          const message = JSON.parse(pending.slice(0, newline)) as RunMessage;
          pending = pending.slice(newline + 1);
          if (message.kind === "exit") return message.code;
          emit(message);
          newline = pending.indexOf("\n");
        }
      }
    } finally {
      await reader.cancel().catch(() => {});
      reader.releaseLock();
    }
  },
};

const input = document.querySelector<HTMLTextAreaElement>("#source");
const stdin = document.querySelector<HTMLTextAreaElement>("#stdin");
const target = document.querySelector<HTMLElement>("#try-it");
if (!input || !stdin || !target) throw new Error("The editor is missing its controls.");

mountTryPane(target, {
  adapter: runner,
  showOutput: true,
  readInput: () => ({ source: input.value, stdin: stdin.value }),
  renderResult(code, target) {
    const result = document.createElement("p");
    result.textContent = `Exit code: ${code}`;
    target.append(result);
  },
  describeResult: code => code === 0 ? "Run complete" : "Run failed. See diagnostics.",
});
