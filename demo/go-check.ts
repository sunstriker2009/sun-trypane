import { mountTryPane } from "../src/pane.js";
import { createGoDemoAdapter } from "./go-adapter.js";

interface Diagnostic {
  line: number;
  column: number;
  message: string;
}

type CheckResult =
  | { output: string }
  | { previewOmitted: true }
  | { diagnostics: Diagnostic[]; truncated: boolean };

const adapter = createGoDemoAdapter<CheckResult>("check", 8 * 1024, "Use at most 8 KiB of Go source.", data => {
  if (typeof data.output === "string" && data.output.length <= 64 * 1024) return { output: data.output };
  if (data.previewOmitted === true) return { previewOmitted: true };
  if (Array.isArray(data.diagnostics) && data.diagnostics.length <= 20 &&
      data.diagnostics.every(item => Number.isInteger(item?.line) && Number.isInteger(item?.column) &&
        typeof item?.message === "string") && typeof data.truncated === "boolean") {
    return { diagnostics: data.diagnostics, truncated: data.truncated };
  }
});

const source = document.querySelector<HTMLTextAreaElement>("#source");
const target = document.querySelector<HTMLElement>("#try-it");
if (!source || !target) throw new Error("The Go source checker is missing its controls.");

mountTryPane(target, {
  adapter,
  runLabel: "Check",
  readInput: () => source.value,
  describeResult: result => "diagnostics" in result ? "Syntax errors found" : "Syntax valid",
  renderResult(result, container) {
    if ("diagnostics" in result) {
      const list = document.createElement("ul");
      for (const issue of result.diagnostics) {
        const item = document.createElement("li");
        item.textContent = `Line ${issue.line}, byte column ${issue.column} · ${issue.message}`;
        list.append(item);
      }
      container.append(list);
      if (result.truncated) container.append("More syntax errors were omitted.");
    } else if ("previewOmitted" in result) {
      container.append("The formatted preview exceeds 64 KiB.");
    } else {
      const output = document.createElement("pre");
      output.setAttribute("aria-label", "Formatted Go");
      output.textContent = result.output;
      container.append(output);
    }
  },
});
