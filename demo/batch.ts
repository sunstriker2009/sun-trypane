import { mountTryPane } from "../src/pane.js";
import type { RunnerAdapter } from "../src/pane.js";

interface BatchSummary {
  accepted: number;
  skipped: number;
}

const batchRunner: RunnerAdapter<string, BatchSummary> = {
  async load() {},
  async run(input, { signal, emit }) {
    let accepted = 0;
    let skipped = 0;
    const lines = input.split(/\r?\n/);
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index].trim();
      if (line) {
        let valid = false;
        try {
          const record: unknown = JSON.parse(line);
          valid = record !== null && typeof record === "object" && "name" in record
            && typeof record.name === "string" && record.name.trim().length > 0;
        } catch {
          // Malformed JSON is reported alongside other skipped lines.
        }
        if (valid) {
          accepted++;
        } else {
          skipped++;
          emit({ kind: "diagnostic", text: `Line ${index + 1} needs a JSON object with a nonempty name.` });
        }
      }
      if ((index + 1) % 2 === 0 || index === lines.length - 1) {
        emit({ kind: "progress", text: `Processed ${index + 1} of ${lines.length} lines.` });
        signal.throwIfAborted();
        // Yield between batches so the demo makes progress and cancellation visible.
        await new Promise<void>(resolve => setTimeout(resolve, index < 4 ? 250 : 0));
        signal.throwIfAborted();
      }
    }
    return { accepted, skipped };
  },
};

const input = document.querySelector<HTMLTextAreaElement>("#batch");
const target = document.querySelector<HTMLElement>("#try-it");
const reset = document.querySelector<HTMLButtonElement>("#reset");
if (!input || !target || !reset) throw new Error("The batch demo is missing its controls.");

const pane = mountTryPane(target, {
  adapter: batchRunner,
  showOutput: true,
  readInput: () => input.value,
  renderResult({ accepted, skipped }, target) {
    const heading = document.createElement("h2");
    heading.textContent = "Summary";
    const counts = document.createElement("p");
    counts.textContent = `Accepted: ${accepted}. Skipped: ${skipped}.`;
    target.append(heading, counts);
  },
});
reset.addEventListener("click", () => pane.reset());
input.addEventListener("input", () => pane.reset());
