export interface RunContext {
  readonly id: number;
  readonly signal: AbortSignal;
}

export interface RunnerAdapter<Input, Result> {
  load(context: RunContext): Promise<void>;
  run(input: Input, context: RunContext): Promise<Result>;
  dispose?(): void;
}

export type RunState<Result> =
  | { status: "idle" }
  | { status: "loading" | "running" | "cancelled"; runId: number }
  | { status: "succeeded"; runId: number; result: Result }
  | { status: "failed"; runId: number; message: string };

export class RunController<Input, Result> {
  private nextId = 0;
  private active?: { id: number; controller: AbortController };
  private disposed = false;

  constructor(
    private readonly adapter: RunnerAdapter<Input, Result>,
    private readonly onState: (state: RunState<Result>) => void,
  ) {}

  async start(readInput: () => Input): Promise<void> {
    if (this.active || this.disposed) return;

    const id = ++this.nextId;
    const controller = new AbortController();
    this.active = { id, controller };
    const context: RunContext = { id, signal: controller.signal };
    let outcome: RunState<Result>;

    try {
      // Capture the current host input before the first asynchronous operation.
      const input = readInput();
      if (this.active?.id !== id) return;
      this.onState({ status: "loading", runId: id });
      if (controller.signal.aborted) return;
      await this.adapter.load(context);
      if (controller.signal.aborted) return;

      this.onState({ status: "running", runId: id });
      if (controller.signal.aborted) return;
      const result = await this.adapter.run(input, context);
      outcome = { status: "succeeded", runId: id, result };
    } catch (error) {
      const message = error instanceof Error && error.message
        ? error.message
        : "The run failed. Try again.";
      outcome = { status: "failed", runId: id, message };
    }

    if (this.active?.id !== id) return;
    this.active = undefined;
    this.onState(outcome);
  }

  cancel(): void {
    const run = this.active;
    if (!run) return;
    this.active = undefined;
    // Publish before abort listeners can synchronously start another run.
    this.onState({ status: "cancelled", runId: run.id });
    run.controller.abort();
  }

  dispose(): void {
    this.disposed = true;
    const run = this.active;
    this.active = undefined;
    run?.controller.abort();
    this.adapter.dispose?.();
  }
}
