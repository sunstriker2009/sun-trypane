# TryPane milestones

**Status** · Proposed delivery plan for TryPane by Sun (SUN-P004). M0 is next. The product repository has been provisioned and branded. Implementation and runtime acceptance are pending.

**Tweak. Test. Repeat.** TryPane is an embeddable **Try It** pane for running a built-in operation or editor-supplied code and inspecting the result alongside the input. The host supplies the input and available runners and owns theme, persistence, and execution permissions. TryPane owns the run controls, status, and result display. A runner adapter owns runtime loading, execution, and cancellation.

This roadmap records the planned implementation and release criteria for TryPane.

## Delivery sequence

| Milestone | Deliverable | Exit criteria | State |
| --- | --- | --- | --- |
| M0 · Component foundation | Set up a minimal TypeScript browser component, a small host harness, and a fake adapter in `sun-trypane`. Define the host and adapter contracts, including run identity, cancellation, status, and support for structured results and script output. Use host-owned input and keep the component independent of a particular editor. | The host passes its current input when the user selects Run. A fixture demonstrates loading, running, success, failure, and cancellation. Cancel preserves input, stale results cannot replace a newer run, and the core tests run in CI. | Planned |
| M1 · Built-in operation proof | Embed TryPane in a small reference-style host and adapt the existing CodeFolio C# Regex worker. Render match ranges and captures through a host result renderer. Ship the pinned .NET WebAssembly assets with the preview host and load them on first use. | Valid input produces the same matches and captures as the existing worker. Invalid patterns and timeouts surface actionable errors. Repeated successful runs reuse the worker. A subdirectory deployment loads its runtime assets successfully. | Planned |
| M2 · Editor-supplied code proof | Embed the same component in a second host with a minimal editor. Use Runno Python to execute an edited script and render stdout, stderr, and execution errors. Use a single-threaded runtime where supported and keep interactive stdin outside the initial proof. | Both hosts run with the same pane and adapter contract. On desktop Chromium and an actual iPhone running Safari, verify first run, warm rerun, cancel, timeout, and rerun after cancellation, with input intact. Record runtime bytes, cold and warm timings, browser/device and deployment details, and a decision on Runno or its fallback. | Planned |
| M3 · Integration preview | Package a versioned component and runtime bundles. Document embedding, host input and theming, asset paths, the result renderer, error handling, and supported browsers. Trial the package in a CodeFolio Regex preview, subject to M2 findings and host approval. | A host can embed a pinned build from the guide. Keyboard controls, visible focus, announced status, mobile layout, bounded output, worker cleanup, and failure recovery pass. The host preview matches current Regex behavior and can revert to its previous runner. | Planned |
| M4 · First release | Confirm supported adapters and browsers, settle the distribution and hosting approach, and publish a versioned release under the SUN workflow. | The owner accepts the preview evidence, mobile performance thresholds, runtime permissions and limits, integration guide, and release method. Record the changelog, known limitations, and rollback procedure. | Planned |

## Decisions at the proof-of-concept gate

- Validate the intended subdirectory host with pinned, worker-relative assets. The [Runno runtime documentation](https://runno.dev/docs/runtime/) calls for cross-origin isolation headers for shared-memory stdin. Verify the exact Python execution path and deployment on both target browsers. If the host cannot support it, compare a header-capable preview, a runner iframe, or another Python adapter before choosing a release path.
- Measure transfer size, click-to-result latency on a cold run, and click-to-result latency on a warm run for each adapter. Record cache and network conditions and agree on mobile thresholds before the integration preview. Record iPhone Safari as pending until it has been checked on a device.
- End the active worker on cancel or timeout and recreate it on the next run. Check that cancelled or disposed workers cannot publish output, and that closing or unmounting the pane cleans up active work.
- Decide which adapter ships from the proof evidence. C# Regex exercises a precompiled operation. Arbitrary C# scripts, additional runtimes, server execution, and production connections are outside this plan.

## First implementation PR

Create the M0 harness, component shell, and fake adapter in this repository. Demonstrate passing edited input, running, cancelling, and running again with the same input. Keep the first PR independently testable with no runtime downloads. Track milestone progress here and link the implementation PRs, CI runs, and browser evidence as they become available.

Follow the [SUN Git workflow](https://github.com/sunstriker2009/sun-ecosystem/blob/main/docs/governance/GIT-WORKFLOW.md).
