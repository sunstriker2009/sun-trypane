# TryPane milestones

**Status** · The M0 component and fake-runner demo are implemented. M1 brings in the C# Regex adapter. Real-runtime browser acceptance remains in M2.

**Tweak. Test. Repeat.** TryPane is an embeddable **Try It** pane for running a built-in operation or editor-supplied code and inspecting the result alongside the input. The host supplies the input and available runners and owns theme, persistence, and execution permissions. TryPane owns the run controls, status, and result display. A runner adapter owns runtime loading, execution, and cancellation.

Build the TryPane component and runner adapter in this repository, using [CodeFolio’s Try It experience](https://github.com/sunstriker2009/sun-codefolio/blob/main/docs/ROADMAP.md) as the starting point. The first real adapter runs CodeFolio’s precompiled C# Regex operation in a browser worker. Reuse the existing Regex implementation where practical so the first integration can check behavior against the current CodeFolio page.

## Delivery sequence

| Milestone | Deliverable | Exit criteria | State |
| --- | --- | --- | --- |
| M0 · Component foundation | Set up a minimal TypeScript browser component, a small host harness, and a fake adapter. Define the host and adapter contracts for run identity, status, cancellation, and structured results. Keep input host-owned and the pane independent of a particular editor. | The host passes its current input when the user selects Run. A fixture demonstrates loading, running, success, failure, and cancellation. Cancel preserves input, stale results cannot replace a newer run, and the core tests run in CI. | Implemented |
| M1 · C# Regex adapter | Build the TryPane adapter around the existing C# Regex worker and embed it in a small reference-style host. Use a host result renderer for highlights and captures. Pin the .NET WebAssembly assets with the preview host and load them on first use. | Valid input matches CodeFolio’s first-match and all-matches behavior, including match ranges and numbered and named captures. Invalid patterns and timeouts surface actionable errors. Repeated successful runs reuse the worker, and a subdirectory deployment loads the runtime assets. | Planned |
| M2 · Runtime and browser acceptance | Validate the first adapter on desktop Chromium and iPhone Safari. Exercise worker lifecycle, keyboard controls, and failure recovery. Record mobile performance against the current CodeFolio experience. | Verify cold start, warm rerun, cancellation, timeout, rerun after cancellation, and teardown with input intact. Verify focus, status announcements, bounded output, mobile layout, and error recovery. Record device, browser, deployment, runtime transfer size, and cold and warm timings. | Planned |
| M3 · CodeFolio integration preview | Package a versioned pane and runtime bundle. Document embedding, host input and theme, worker asset paths, result rendering, errors, and browser support. Trial the pinned build in a CodeFolio Regex preview with host approval. | A host can embed a pinned build from the guide. The preview preserves current Regex behavior and host-owned inputs and saved test cases. Verify the preview can revert to its previous runner. | Planned |
| M4 · First release | Release the embeddable pane and C# Regex adapter under the SUN workflow. | The owner accepts the preview evidence, mobile performance thresholds, supported browsers, runtime limits, integration guide, and release method. Record the changelog, known limitations, and rollback procedure. | Planned |

## Validation

- Verify the deployed subdirectory uses pinned, worker-relative assets. Measure transfer size and click-to-result latency for cold and warm runs. Record cache and network conditions, and agree on mobile thresholds before the integration preview. Record iPhone Safari as pending until it has been checked on a device.
- End the active worker on cancel or timeout and recreate it on the next run. Check that cancelled or disposed workers cannot publish results, and that closing or unmounting the pane cleans up active work.

## Follow-up exploration

Once the CodeFolio-based runner has a measured baseline, compare it with Runno and similar tools. Use concrete gaps to guide which ideas to adapt, such as live output, stdin, or multi-file examples. Use a separate milestone for any additional language or editor-supplied script runner. The first release scope is the precompiled C# Regex operation.

## M0 foundation

The [local demo](../../README.md#run-the-demo-locally) shows the host passing edited input to the pane, cancelling, rerunning, and recovering from an error. The [runner tests](../../tests/runner.test.mjs) cover input snapshots, cancellation during loading and execution, late results and errors, retry, and teardown.

Follow the [SUN Git workflow](https://github.com/sunstriker2009/sun-ecosystem/blob/main/docs/governance/GIT-WORKFLOW.md).
