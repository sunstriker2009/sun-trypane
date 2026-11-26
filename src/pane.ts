import { RunController } from "./runner.js";
import type { RunOutput, RunState, RunnerAdapter } from "./runner.js";

export type { RunContext, RunOutput, RunnerAdapter } from "./runner.js";

export type TryPaneMount = (() => void) & { reset(): void };

export interface TryPaneOptions<Input, Result> {
  /** Return a snapshot of the current host input. */
  readInput(): Input;
  adapter: RunnerAdapter<Input, Result>;
  renderResult(result: Result, target: HTMLElement): void;
  describeResult?(result: Result): string;
  showOutput?: boolean;
}

export function mountTryPane<Input, Result>(
  target: HTMLElement,
  options: TryPaneOptions<Input, Result>,
): TryPaneMount {
  const document = target.ownerDocument;
  const section = document.createElement("section");
  section.className = "try-pane";
  section.setAttribute("aria-label", "Try It");

  const controls = document.createElement("div");
  controls.className = "try-pane__controls";
  const run = document.createElement("button");
  run.type = "button";
  run.textContent = "Run";
  const cancel = document.createElement("button");
  cancel.type = "button";
  cancel.textContent = "Cancel";
  controls.append(run, cancel);

  const status = document.createElement("p");
  status.className = "try-pane__status";
  status.setAttribute("role", "status");
  const result = document.createElement("div");
  result.className = "try-pane__result";
  section.append(controls, status);

  let output: HTMLElement | undefined;
  const entries = document.createElement("ol");
  const limitNotice = document.createElement("p");
  if (options.showOutput) {
    output = document.createElement("div");
    output.className = "try-pane__output";
    output.hidden = true;
    const heading = document.createElement("h2");
    heading.textContent = "Run output";
    limitNotice.textContent = "Output truncated.";
    limitNotice.hidden = true;
    output.append(heading, entries, limitNotice);
    section.append(output);
  }
  section.append(result);

  let outputRunId: number | undefined;
  function renderOutput(entry: RunOutput): void {
    if (!output) return;
    output.hidden = false;
    if (entries.childElementCount >= 100) {
      limitNotice.hidden = false;
      return;
    }
    const line = document.createElement("li");
    const label = entry.kind === "diagnostic" ? "Diagnostic: " : "Progress: ";
    line.textContent = label + entry.text.slice(0, 512);
    if (entry.text.length > 512) {
      line.append("…");
      limitNotice.hidden = false;
    }
    entries.append(line);
  }

  const labels = {
    idle: "Ready",
    loading: "Loading runner…",
    running: "Running…",
    cancelled: "Cancelled",
    succeeded: "Run complete",
    failed: "Run failed",
  };

  function render(state: RunState<Result>): void {
    const runId = state.status === "idle" ? undefined : state.runId;
    if (output && (state.status === "idle" || outputRunId !== runId)) {
      outputRunId = runId;
      output.hidden = true;
      entries.replaceChildren();
      limitNotice.hidden = true;
    }
    const busy = state.status === "loading" || state.status === "running";
    // Preserve keyboard focus as a run changes state.
    run.setAttribute("aria-disabled", String(busy));
    cancel.setAttribute("aria-disabled", String(!busy));
    status.textContent = labels[state.status];
    result.replaceChildren();

    if (state.status === "failed") {
      status.textContent = `Run failed. ${state.message}`;
    }
    if (state.status === "succeeded") {
      try {
        options.renderResult(state.result, result);
        status.textContent = options.describeResult?.(state.result) ?? labels.succeeded;
      } catch {
        result.replaceChildren();
        status.textContent = "The run completed, but the result could not be displayed.";
      }
    }
  }

  const controller = new RunController(options.adapter, render, renderOutput);
  run.addEventListener("click", () => { void controller.start(() => options.readInput()); });
  cancel.addEventListener("click", () => controller.cancel());
  render({ status: "idle" });
  target.append(section);

  const unmount = (() => {
    controller.dispose();
    section.remove();
  }) as TryPaneMount;
  unmount.reset = () => {
    controller.cancel();
    render({ status: "idle" });
  };
  return unmount;
}
