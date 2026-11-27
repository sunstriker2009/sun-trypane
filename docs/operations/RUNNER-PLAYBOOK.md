# Add a runner to TryPane

Start with the operation the host needs. A built-in operation can go straight to a browser worker. An editable console runner starts with a local execution proof. A browser compiler and a browser executor each need their own proof. Pick the smallest path that answers the host’s use case.

| Goal | Start here | Repository example |
| --- | --- | --- |
| Run a built-in operation in the browser | Precompile the operation and pass user data to it through a worker. | [C# Regex](../../runtime/README.md), [Go JSON compactor](../../prototype/browser-go/README.md) |
| Run editable code locally | Compile and run one console file through the local CLI, then add the loopback editor if useful. | [C# local runner](../../prototype/csharp/README.md), [Go local runner](../../prototype/go/README.md) |
| Check editable code in the browser | Build a compiler worker that returns diagnostics without loading its output. | [C# compiler preview](../../prototype/browser-csharp/README.md) |
| Execute editable code in the browser | Prove fixed execution in isolation, then test the editable worker and pane before preparing a hosting candidate. | [C# execution rehearsal and hosting candidate](../../prototype/browser-csharp/runner-host/EDITABLE-PREVIEW.md) |

## 1. Define the first use case

- Identify the host, whether it calls the runner through TryPane controls or from code, and which environments it needs.
- Write down what the user can edit, the toolchain version and supported APIs, and what a run returns. For a console prototype, start with one source file, standard libraries, optional preset stdin, stdout, stderr, diagnostics, and an exit code.
- Choose limits for source, stdin, output, runtime, and memory. Specify their units, what happens at each limit, and when the clock starts. Record anything still unknown in the [milestones](../roadmap/MILESTONES.md).

## 2. Prove editable execution locally

For a Docker CLI, use the [shared container runner](../../prototype/container-runner.mjs) and [snippet limits](../../prototype/snippet-limits.mjs). Keep the image, entry point, compiler flags, and source-file format in the language’s prototype directory. The C# and Go prototypes compile without network access and start a fresh nonroot container with bounded temporary storage and no host mounts. Keep this path for trusted local snippets.

**Exit check.** Run valid and invalid source. Verify source locations for diagnostics, preset UTF-8 stdin and EOF, separate output streams, and program exit codes. Exercise source and output limits. Cancel or time out an active run and verify cleanup and a fresh run. Add language smoke tests and rerun both suites when touching the shared container code.

## 3. Connect the host

Reuse the [TryPane adapter contract](../../src/runner.ts). The host owns the editor and captures input once per run. The adapter owns runtime loading, cancellation, and result normalization. Mount the pane with [`mountTryPane`](../../src/pane.ts), or use [`RunController` from application code](../../demo/programmatic.ts). Keep language-specific diagnostics and result rendering close to the adapter.

For a local editor, reuse the [loopback server](../../prototype/local-editor-server.mjs), [editor](../../prototype/local-editor.ts), and [Chromium harness](../../prototype/local-editor-smoke.mjs). Translate compiler positions into the editor’s position units. Go reports UTF-8 byte columns and the textarea uses UTF-16 offsets.

**Exit check.** Verify streamed output, a diagnostic jump after non-ASCII text where applicable, cancel with input retained, and rerun after cleanup. Verify request limits, exact request origin, one active run per listener, and cancellation when the browser disconnects. Keep the local endpoint on loopback.

## 4. Prove browser feasibility

- **Fixed operation.** Compile a small useful program, bundle the matching runtime assets, and run it in a worker. Pass typed data to it. The Go compactor shows that precompiled Go runs in the browser. It leaves editable Go compilation and execution to the local runner.
- **Editable compile-only.** Compile in a disposable worker. Return structured diagnostics, including their positions and count limits. Record compiler transfer size and startup time on a cold run, then measure a repeat run. Check cancellation during loading and compilation.
- **Editable execution.** Start with fixed cases on a dedicated runner origin. Verify the frame and worker policies, permitted origins, one message port per run, and worker shutdown on cancel, timeout, or page close. Test runtime and output limits and prove a clean rerun. Verify the published memory limit and document its scope. C# limits WebAssembly linear memory, which covers only part of browser memory. Once those checks pass, exercise one editable file in a separate CI build variant and review capabilities before hosting.

**Exit check.** Stage exactly what will be served. Verify nested paths, MIME types, a mobile viewport, failure recovery, and that the intended build contains only its corresponding worker and entry point. Keep fixed and compile-only variants independently testable.

## 5. Package, publish, and record evidence

1. **Static demo.** Register the example in the [demo index](../../site/index.html) and the [public README](../../README.md). Update [Pages staging](../../tools-stage-site.sh) and [browser smoke coverage](../../tests/browser/regex-smoke.mjs). Verify the deployed page and asset URLs before sharing a live link.
2. **Hosted editable candidate.** Package separate editor and runner directories, identify the source commit, and verify the exact package in CI. Document a separate credential-free HTTPS runner origin, configuration and rollback. Treat a signed-in fixed-probe bridge as evidence for that bridge only. Review the execution boundary and obtain deployment approval before connecting a hosted editor. Record the actual hosted browser result separately from CI.
3. **Handoff.** Link the examples and current limitations from the [milestones](../roadmap/MILESTONES.md). Provide runnable setup commands, the artifact or live URL when available, and a CI link. Keep deferred deployment, unsupported environments, and unverified measurements visible.

## Copy into a runner milestone

- [ ] Host and use case named. Entry point and supported inputs documented.
- [ ] Runtime and dependency versions recorded. Resource limits and cancellation behavior defined.
- [ ] CLI or worker validated with real code and representative failure cases.
- [ ] Host integration verified through its normal entry point. Shared regression tests passed.
- [ ] Applicable package and deployment checks passed. Live and CI results recorded separately.
- [ ] Demo, README, and milestone links updated. Deferred work recorded.
