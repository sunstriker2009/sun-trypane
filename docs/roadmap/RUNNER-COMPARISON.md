# Runner comparison and next milestone

TryPane 0.1.0 embeds a precompiled C# Regex operation. The host supplies the input and renders structured results such as match ranges and named captures. The pane manages Run, Cancel, and status. Its current adapter returns one final result per run. CodeFolio uses this model to keep its pattern library, examples, and saved cases in the host.

## Browser runner comparison

| Capability | TryPane 0.1.0 | Runno | Pyodide |
| --- | --- | --- | --- |
| Inputs | The host passes a Regex pattern, text, and match mode. | The browser components can include an editor and terminal. The headless API accepts source or a file set and entry point. | A Python runtime that a host can drive from a worker with its own interface. |
| Outputs | One structured result, rendered by the host. | WASI exposes stdout and stderr. The browser components include a terminal. | The stream API supplies separate stdout and stderr handlers. |
| Standard input | The host snapshots all input on Run. | The browser runtime documents cross-origin isolation headers for its SharedArrayBuffer-based stdin. | The runtime accepts a host-provided stdin handler. |
| Files | The adapter receives text through the host. | A virtual filesystem can supply multiple files. | Runtime choice for Python. File handling needs its own host design and is outside this comparison. |

Sources: [TryPane 0.1.0](https://github.com/sunstriker2009/sun-trypane/tree/v0.1.0), [Runno browser runtime](https://runno.dev/docs/runtime/), [Runno WASI](https://runno.dev/docs/wasi/), [Pyodide worker guide](https://pyodide.org/en/stable/usage/webworker.html), and [Pyodide stream guide](https://pyodide.org/en/stable/usage/streams.html).

This is a documentation comparison. TryPane's existing CI observed 843 ms from Run to first result, 49 ms for a warm rerun, and 5,619,473 runtime bytes served against a local server. Those figures describe the Regex demo in one Chromium CI run. There are no equivalent Runno or Pyodide timings in this comparison. See the [M2 validation record](../operations/M2-VALIDATION.md).

## M5 proposal · Incremental output for built-in examples

Borrow the distinction between stdout and stderr and keep TryPane's structured final result. Prototype it in the TryPane demo with a built-in operation that summarizes a text batch one line at a time. The host supplies the batch. The operation emits a plain-text progress entry per processed batch of lines, reports malformed lines as diagnostics, and returns a summary at completion. Use a controlled fixture to verify that output can arrive before the final result.

| Acceptance area | Evidence |
| --- | --- |
| Adapter compatibility | The Regex adapter continues to emit only its structured result and passes its existing tests and browser smoke check. |
| Output | The demo shows progress and diagnostics in arrival order, makes them distinguishable, and visibly marks truncation when the documented cap is reached. |
| Run lifecycle | Cancel, Reset, retry, and unmount discard late output from previous runs. Output accumulated during a cancelled run stays distinguishable from a successful summary until the next run or reset. |
| Browser experience | Chromium verifies output before completion, responsive controls during processing, and usable output at a 390 px viewport. Status announcements remain focused on run state. |

The prototype uses the existing TryPane demo and a built-in operation. Prioritize it if live progress helps a real host example. Revisit preset stdin when a host needs a command-style example. Consider interactive stdin, multi-file work, and user-supplied scripts as separate milestones tied to a named host use case. Evaluate Runno's deployment requirements with that host if it needs a general browser runner.
