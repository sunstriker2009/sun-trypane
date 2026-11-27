<!-- SUN BRANDING START -->
# TryPane by Sun

![TryPane by Sun](branding/assets/readme-banner.png)
<!-- SUN BRANDING END -->

TryPane is an embeddable **Try It** pane for testing code and inspecting results alongside a host editor or reference tool.

[Development milestones](docs/roadmap/MILESTONES.md) · [Runner playbook](docs/operations/RUNNER-PLAYBOOK.md)

## Examples by use case

| Use case | Example | Where it runs |
| --- | --- | --- |
| Embed TryPane in a host | [C# Regex](https://sunstriker2009.github.io/sun-trypane/demo/regex.html) and [CodeFolio integration](https://sunstriker2009.github.io/sun-codefolio/regex/?trypane=1) | Browser |
| Show live progress and diagnostics | [Live batch output](https://sunstriker2009.github.io/sun-trypane/demo/batch.html) | Browser |
| Check editable C# and see compiler diagnostics | [C# compiler preview](https://sunstriker2009.github.io/sun-trypane/demo/csharp-check.html) | Browser, compilation only |
| Start a run from host code without mounting a pane | [Programmatic Regex](https://sunstriker2009.github.io/sun-trypane/demo/programmatic.html) and [source](demo/programmatic.ts) | Browser |
| Run editable C# through an editor or script | [Local C# editor and CLI](prototype/csharp/README.md) | Local Docker |
| Compact JSON with Go on a static site | [Go JSON compactor](https://sunstriker2009.github.io/sun-trypane/demo/go-json.html) | Browser |
| Run a Go console snippet through an editor or script | [Local Go editor and CLI](prototype/go/README.md) | Local Docker |
| Verify the isolated browser runner | [Fixed C# execution probes](prototype/browser-csharp/runner-host/README.md) | GitHub Actions |

The [demo site](https://sunstriker2009.github.io/sun-trypane/) groups the public examples. CI tests the staged site before publishing it to GitHub Pages.

## Run the demo locally

Use Node.js 24 and Python 3. From the repository root:

```sh
npm ci
npm test
python3 -m http.server 8000 --bind 127.0.0.1
```

Open <http://127.0.0.1:8000/demo/>. Edit the sample, select **Run**, then try cancelling and running again. Use **Simulate failure** to check error recovery. The demo uses a fake runner that echoes the submitted text and counts its characters.

Open <http://127.0.0.1:8000/demo/batch.html> for incremental output from a built-in text batch operation. Try cancelling, resetting or editing the input while it runs.

## Embed the pane

Import `mountTryPane` from the compiled `dist/src/pane.js` module. Pass a host element and options with `readInput`, a runner adapter, and `renderResult`. `readInput` returns a snapshot when the user selects **Run**. The adapter receives the same run ID and abort signal for both `load` and `run`. Use the cleanup function returned by `mountTryPane` when removing the pane.

For incremental output, set `showOutput: true` and call `context.emit({ kind, text })` with `progress` or `diagnostic`. The pane displays entries in arrival order as plain text, with a limit of 100 entries and 512 UTF-16 code units per entry. Output remains visible after Cancel, and clears on the next Run or Reset. The adapter still returns a final result. Output from a completed, cancelled or disposed run is ignored.

## Start a run programmatically

In a browser host, import `RunController` from the compiled `dist/src/runner.js`. Give it an adapter and a state callback. The host can start runs from a keyboard shortcut, another event or application code.

```js
const controller = new RunController(adapter, state => {
  if (state.status === "succeeded") renderResult(state.result);
  if (state.status === "failed") showError(state.message);
});

await controller.start(() => ({ pattern: "[0-9]+", text: "Room 42", mode: "first" }));
```

Handle `cancel()` and `dispose()` from the host lifecycle. The [complete Regex example](demo/programmatic.ts) shows imports, the worker URL and state handling. The Regex adapter still needs browser worker support and static runtime assets. For trusted C# console snippets outside the browser, call the [local runner CLI](prototype/csharp/README.md) with a C# source file and an optional input file.

## C# Regex preview

Build the pane with Node.js 24 and the local Regex runtime with the .NET 10 SDK and WebAssembly workload:

```sh
npm ci
npm test
dotnet workload install wasm-tools
bash tools-build-runtime.sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open <http://127.0.0.1:8000/demo/regex.html>. Select **First match** or **Find all** to inspect highlighted text and captures. The first run downloads a .NET WebAssembly bundle. The adapter keeps a healthy worker for repeat runs and replaces it after cancellation or timeout. Each PR's CI uploads a preview artifact containing the compiled pane, demo and runtime assets. Serve the artifact root over HTTP to inspect it.

[Embed the versioned Regex bundle](docs/INTEGRATION.md) · [Changelog](CHANGELOG.md) · [Release procedure](docs/operations/RELEASE.md)
