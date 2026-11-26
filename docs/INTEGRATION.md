# TryPane Regex integration

Version `0.1.0` is a source-pinned browser bundle. Build from a specific TryPane commit with Node.js 24, the .NET 10 SDK and its `wasm-tools` workload. GitHub Actions stores the bundle inside the `trypane-regex-preview` artifact.

```sh
npm ci
npm test
dotnet workload install wasm-tools
bash tools-build-runtime.sh
bash tools-package-preview.sh "$(git rev-parse HEAD)"
```

Extract `dist/package/trypane-regex-0.1.0.tar.gz` into the host's static directory. Keep the `runtime/wwwroot/_framework` directory beside `runtime/wwwroot/regex-worker.mjs`. Load `src/pane.js` and `src/adapters/regex.js` from the versioned directory. Construct `RegexAdapter` with an absolute URL derived from the same directory. The host supplies `readInput`, `renderResult`, and `describeResult`, and calls the cleanup function returned by `mountTryPane` when replacing the pane. Call its `reset()` method when the host edits the pattern or input to clear an old result while keeping a healthy worker warm. `readInput` returns `{ pattern, text, mode }`, where mode is `first` or `all`. Keep the host's editor, test cases, and persistence in the host.

On Cancel, an active worker terminates. A new Run starts a new worker. A healthy worker remains warm between runs. The adapter enforces a two-second execution limit after loading and a 30-second initial load limit. The built-in C# Regex operation enforces its own 250 ms matching timeout. Only serve the worker and its assets from a host that can serve `.wasm` as `application/wasm`.

Chromium is the verified browser. The CI smoke test covers a mobile viewport. The owner accepted the CodeFolio preview after a manual run and waived formal iPhone Safari acceptance. There is no measured iPhone Safari performance baseline.

TryPane's demo is `demo/regex.html`. Keep an existing host version pinned when upgrading so you can restore it if needed. For CodeFolio, remove `trypane=1` from the URL to return to its usual runner.
