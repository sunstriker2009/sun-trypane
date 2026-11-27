import { mountTryPane } from "../src/pane.js";
import type { RunnerAdapter } from "../src/pane.js";

type RunMessage =
  | { kind: "progress" | "diagnostic"; text: string }
  | { kind: "exit"; code: number };

export interface CompilerLocation {
  line: number;
  column: number;
  label: string;
}

interface EditorResult {
  code: number;
  source: string;
  locations: CompilerLocation[];
}

export function mountLocalEditor(compilerLocations: (stderr: string, source: string) => CompilerLocation[]): void {
  const runner: RunnerAdapter<{ source: string; stdin: string }, EditorResult> = {
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
      let stderr = "";
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) throw new Error("The local runner closed before reporting a result.");
          pending += value;
          let newline = pending.indexOf("\n");
          while (newline !== -1) {
            const message = JSON.parse(pending.slice(0, newline)) as RunMessage;
            pending = pending.slice(newline + 1);
            if (message.kind === "exit") {
              return { code: message.code, source: input.source, locations: compilerLocations(stderr, input.source) };
            }
            if (message.kind === "diagnostic") stderr += message.text;
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
    renderResult({ code, source, locations }, target) {
      const result = document.createElement("p");
      result.textContent = `Exit code: ${code}`;
      target.append(result);
      if (source !== input.value) return;

      const lines = source.split("\n");
      const starts: number[] = [];
      let offset = 0;
      for (const line of lines) {
        starts.push(offset);
        offset += line.length + 1;
      }
      const jumps = document.createElement("ul");
      jumps.className = "compiler-diagnostic-locations";
      jumps.setAttribute("aria-label", "Compiler locations");
      for (const { line, column, label } of locations) {
        const sourceLine = lines[line - 1];
        if (sourceLine === undefined || column < 1 || column > sourceLine.length + 1) continue;
        const start = starts[line - 1] + column - 1;
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.addEventListener("click", () => {
          if (input.value !== source) return;
          input.focus();
          input.setSelectionRange(start, start);
        });
        item.append(button);
        jumps.append(item);
      }
      if (jumps.childElementCount) target.append(jumps);
    },
    describeResult: ({ code }) => code === 0 ? "Run complete" : "Run failed. See diagnostics.",
  });

  input.addEventListener("input", () => {
    target.querySelector(".compiler-diagnostic-locations")?.remove();
  });
}
