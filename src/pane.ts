import { RunController } from "./runner.js";
import type { RunState, RunnerAdapter } from "./runner.js";

export type { RunContext, RunnerAdapter } from "./runner.js";

export type TryPaneMount = (() => void) & { reset(): void };

export interface TryPaneOptions<Input, Result> {
  /** Return a snapshot of the current host input. */
  readInput(): Input;
  adapter: RunnerAdapter<Input, Result>;
  renderResult(result: Result, target: HTMLElement): void;
  describeResult?(result: Result): string;
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
  section.append(controls, status, result);

  const labels = {
    idle: "Ready",
    loading: "Loading runner…",
    running: "Running…",
    cancelled: "Cancelled",
    succeeded: "Run complete",
    failed: "Run failed",
  };

  function render(state: RunState<Result>): void {
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

  const controller = new RunController(options.adapter, render);
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
