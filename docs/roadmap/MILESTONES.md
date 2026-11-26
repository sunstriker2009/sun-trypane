# TryPane milestones

**Status** · M0 through M4 are complete. The first release is available as [TryPane 0.1.0](https://github.com/sunstriker2009/sun-trypane/releases/tag/v0.1.0). The owner accepted the manual CodeFolio preview and waived formal iPhone Safari acceptance.

**Tweak. Test. Repeat.** TryPane is an embeddable **Try It** pane for running a built-in operation or editor-supplied code and inspecting the result alongside the input. The host supplies the input and available runners and owns theme, persistence, and execution permissions. TryPane owns the run controls, status, and result display. A runner adapter owns runtime loading, execution, and cancellation.

Build the TryPane component and runner adapter in this repository, using [CodeFolio’s Try It experience](https://github.com/sunstriker2009/sun-codefolio/blob/main/docs/ROADMAP.md) as the starting point. The first real adapter runs CodeFolio’s precompiled C# Regex operation in a browser worker. Reuse the existing Regex implementation where practical so the first integration can check behavior against the current CodeFolio page.

## Delivery sequence

| Milestone | Deliverable | Exit criteria | State |
| --- | --- | --- | --- |
| M0 · Component foundation | Set up a minimal TypeScript browser component, a small host harness, and a fake adapter. Define the host and adapter contracts for run identity, status, cancellation, and structured results. Keep input host-owned and the pane independent of a particular editor. | The host passes its current input when the user selects Run. A fixture demonstrates loading, running, success, failure, and cancellation. Cancel preserves input, stale results cannot replace a newer run, and the core tests run in CI. | Implemented |
| M1 · C# Regex adapter | Build the TryPane adapter around the existing C# Regex worker and embed it in a small reference-style host. Use a host result renderer for highlights and captures. Pin the .NET WebAssembly assets with the preview host and load them on first use. | Valid input matches CodeFolio’s first-match and all-matches behavior, including match ranges and numbered and named captures. Invalid patterns and timeouts surface actionable errors. Repeated successful runs reuse the worker, and a subdirectory deployment loads the runtime assets. | Implemented in PR #8 |
| M2 · Runtime and browser acceptance | Validate the first adapter in Chromium at a mobile viewport. Exercise worker lifecycle, keyboard controls, and failure recovery. | Verify cold start, warm rerun, cancellation, timeout, rerun after cancellation, and teardown with input intact. Verify focus, status announcements, bounded output, mobile layout, and error recovery. Record the browser, deployment path, runtime transfer size, and cold and warm timings for the CI run. | Accepted with iPhone Safari waived |
| M3 · CodeFolio integration preview | Package a versioned pane and runtime bundle. Document embedding, host input and theme, worker asset paths, result rendering, errors, and browser support. Trial the pinned build in a CodeFolio Regex preview with host approval. | A host can embed a pinned build from the guide. The preview preserves current Regex behavior and host-owned inputs and saved test cases. Verify the preview can revert to its previous runner. | Deployed and accepted |
| M4 · First release | Release the embeddable pane and C# Regex adapter under the SUN workflow. | Record the validation evidence, supported browsers, runtime limits, changelog, known limitations, and rollback procedure. Publish the verified bundle from an annotated tag on main. | [Published as v0.1.0](https://github.com/sunstriker2009/sun-trypane/releases/tag/v0.1.0) |
| M5 · Incremental output | Prototype progress and diagnostics for a built-in operation. | Verify bounded output before completion, cancellation and stale output handling, and existing Regex compatibility. | Implemented in the batch demo |
| M6 · Editable C# feasibility | Run a single C# console source file in a local container. | Verify compilation, diagnostics, output limits, cancellation and a fresh rerun. | CLI prototype |
| M7 · Local C# editor | Connect the browser pane to the local container runner over loopback. | Edit a snippet, inspect streamed output and diagnostics, cancel and rerun, and reject requests from other origins. | Local browser prototype |
| M8 · Preset C# standard input | Accept input for console snippets in the local editor and CLI. | Verify input reads, UTF-8, end of file, size limits, and preservation across cancellation. | Implemented |
| M9 · Browser C# compilation | Check a single editable C# source file in a browser worker. | Verify real compiler diagnostics, cancellation, and runtime transfer size on a static origin before considering public execution. | Compile-only Pages preview |

## M1 verification

[TryPane PR #8](https://github.com/sunstriker2009/sun-trypane/pull/8) builds the .NET 10 WebAssembly bundle and uploads a preview artifact from CI. Its published output was served under `/nested/trypane/` and exercised in Chromium at 390 px. First match, find all, named captures, invalid patterns, no match, the 100-match display limit, a timed-out match and recovery, and runtime asset loading passed. Nine component and adapter tests passed. The C# operation was copied from CodeFolio at the pinned source commit recorded in `runtime/README.md`. See M2 for the later browser evidence and acceptance decision.

## M2 acceptance

The [M2 validation guide](../operations/M2-VALIDATION.md) records Chromium timing and worker lifecycle checks. The owner reported that the manual CodeFolio run looked good and waived formal iPhone Safari acceptance. CI stores `dist/m2-browser-measurements.json` alongside the bundle.

## M3 integration

[TryPane #10](https://github.com/sunstriker2009/sun-trypane/pull/10) added the preview bundle. [CodeFolio #78](https://github.com/sunstriker2009/sun-codefolio/pull/78) embedded it behind `?trypane=1`, and [CodeFolio #79](https://github.com/sunstriker2009/sun-codefolio/pull/79) corrected the source pin and passed the Chromium integration suite. Removing the query parameter restores CodeFolio’s usual runner.

## M4 release

GitHub Releases distributes the compiled pane, C# Regex worker, and runtime as `trypane-regex-0.1.0.tar.gz`. The annotated `v0.1.0` tag points to commit `4ffc24684219a4f5bd36a366f4a78529e4011139`, verified by [main CI](https://github.com/sunstriker2009/sun-trypane/actions/runs/45736156458).

## Validation

- Verify the deployed subdirectory uses pinned, worker-relative assets. Measure transfer size and click-to-result latency for cold and warm runs. Record cache, network, and device conditions when reporting performance measurements.
- End the active worker on cancel or timeout and recreate it on the next run. Check that cancelled or disposed workers cannot publish results, and that closing or unmounting the pane cleans up active work.

## Follow-up exploration

The [runner comparison](RUNNER-COMPARISON.md) compares TryPane with Runno and Pyodide and describes the incremental output prototype. Interactive stdin, multiple files, and general script execution need a concrete host use case.

## M0 foundation

The [local demo](../../README.md#run-the-demo-locally) shows the host passing edited input to the pane, cancelling, rerunning, and recovering from an error. The [runner tests](../../tests/runner.test.mjs) cover input snapshots, cancellation during loading and execution, late results and errors, retry, and teardown.

Follow the [SUN Git workflow](https://github.com/sunstriker2009/sun-ecosystem/blob/main/docs/governance/GIT-WORKFLOW.md).
