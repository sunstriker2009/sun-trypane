import assert from "node:assert/strict";
import { test } from "node:test";
import { RunController } from "../dist/src/runner.js";

function setup(adapter) {
  const states = [];
  const runner = new RunController(adapter, (state) => states.push(state));
  return { runner, states };
}

test("captures host input before loading and ignores a duplicate Run", async () => {
  const load = Promise.withResolvers();
  const { runner, states } = setup({
    load: () => load.promise,
    run: async (input, context) => ({ input, id: context.id }),
  });
  let text = "first";
  const running = runner.start(() => text);
  text = "next";
  await runner.start(() => assert.fail("Duplicate Run read host input"));
  load.resolve();
  await running;
  assert.deepEqual(states, [
    { status: "loading", runId: 1 },
    { status: "running", runId: 1 },
    { status: "succeeded", runId: 1, result: { input: "first", id: 1 } },
  ]);
});

test("cancel during loading aborts and skips execution", async () => {
  const load = Promise.withResolvers();
  let signal;
  const { runner, states } = setup({
    load: (context) => {
      signal = context.signal;
      return load.promise;
    },
    run: () => assert.fail("Cancelled load started execution"),
  });
  const running = runner.start(() => "text");
  runner.cancel();
  assert.equal(signal.aborted, true);
  load.resolve();
  await running;
  assert.deepEqual(states.map(({ status }) => status), ["loading", "cancelled"]);
});

for (const lateOutcome of ["result", "error"]) {
  test(`cancel and rerun suppresses the previous run's late ${lateOutcome}`, async () => {
    const started = Promise.withResolvers();
    const oldRun = Promise.withResolvers();
    const { runner, states } = setup({
      load: async () => {},
      run: async (input, { id, signal }) => {
        if (id === 1) {
          started.resolve(signal);
          return oldRun.promise;
        }
        return input;
      },
    });

    const input = "keep this text";
    const previous = runner.start(() => input);
    const signal = await started.promise;
    runner.cancel();
    assert.equal(signal.aborted, true);
    await runner.start(() => input);

    if (lateOutcome === "result") {
      oldRun.resolve("old text");
    } else {
      oldRun.reject(new Error("old error"));
    }
    await previous;
    assert.deepEqual(states.map(({ status }) => status), [
      "loading", "running", "cancelled", "loading", "running", "succeeded",
    ]);
    assert.deepEqual(states.at(-1), { status: "succeeded", runId: 2, result: input });
  });
}

test("reports input, loading and execution errors and can retry", async () => {
  const { runner, states } = setup({
    load: async ({ id }) => {
      if (id === 2) throw new Error("Load failed");
    },
    run: async (input, { id }) => {
      if (id === 3) throw new Error("Execution failed");
      return input;
    },
  });

  await runner.start(() => { throw new Error("Input unavailable"); });
  for (let run = 0; run < 3; run++) await runner.start(() => "ready");

  assert.deepEqual(
    states.filter(({ status }) => status === "failed").map(({ message }) => message),
    ["Input unavailable", "Load failed", "Execution failed"],
  );
  assert.deepEqual(states.at(-1), { status: "succeeded", runId: 4, result: "ready" });
});

test("dispose aborts active work, suppresses its output and prevents further runs", async () => {
  const started = Promise.withResolvers();
  const execution = Promise.withResolvers();
  const { runner, states } = setup({
    load: async () => {},
    run: (input, { signal }) => {
      started.resolve(signal);
      return execution.promise;
    },
  });
  const running = runner.start(() => "text");
  const signal = await started.promise;
  runner.dispose();
  assert.equal(signal.aborted, true);
  execution.resolve("stale output");
  await running;
  await runner.start(() => assert.fail("Disposed pane read host input"));
  assert.deepEqual(states.map(({ status }) => status), ["loading", "running"]);
});
