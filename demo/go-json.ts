import { mountTryPane } from "../src/pane.js";
import { createGoDemoAdapter } from "./go-adapter.js";

type JsonResult = { output: string } | { error: string };

const adapter = createGoDemoAdapter<JsonResult>("compact", 32 * 1024, "Use at most 32 KiB of JSON.", (data, input) => {
  if (typeof data.output === "string" && data.output.length <= input.length) return { output: data.output };
  if (typeof data.error === "string") return { error: data.error };
});

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
