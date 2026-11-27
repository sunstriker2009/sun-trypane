# Browser C# compilation prototype

Open the [C# compiler preview](https://sunstriker2009.github.io/sun-trypane/demo/csharp-check.html) to check one C# console source file against .NET 10 reference assemblies in a WebAssembly worker. The compiler emits into temporary memory and reports errors and warnings with line and column. The page never loads the emitted assembly. Source stays in the browser. Cancel terminates the worker. Each check starts a fresh worker and accepts up to 8,192 UTF-16 code units.

From the repository root, with Node.js 24, the .NET 10 SDK and Python 3:

```sh
npm ci
npm run build
dotnet workload install wasm-tools --skip-manifest-update
dotnet publish prototype/browser-csharp/TryPane.Compiler.csproj -c Release -o dist/compiler
python3 -m http.server 8000 --bind 127.0.0.1
```

Open <http://127.0.0.1:8000/demo/csharp-check.html>. Edit the snippet and select **Check**.

The compiler references `System.Runtime`, `System.Console`, `System.Linq`, and `System.Collections` from the pinned .NET 10 targeting pack. The workflow checks that the uncompressed runtime responses total at most 30 MB. The original untrimmed prototype served 40.4 MB on the same Chromium CI test.

Main CI checks the preview in Chromium from the same staged files that GitHub Pages serves. The page shows elapsed time for each check, including worker startup. To compare phone timings, record the browser and connection, then check once with a fresh cache and once again in the same tab. The manual Browser C# compiler workflow also produces a ZIP for offline hosting. Serve the extracted artifact root over HTTP and open `demo/csharp-check.html`.

Public execution is a separate milestone. Before loading any emitted assembly, establish what the execution environment can access and test the limits for memory, time, output, and cleanup. The [local Docker editor](../csharp/README.md) is available for running trusted snippets today.

## Fixed execution probe

The owner reported good perceived performance after trying the hosted compiler preview on a phone. No device timings were provided.

The Browser C# compiler pull request workflow builds an optional execution probe and runs it in Chromium. It compiles built-in snippets and tests preset input, end of file, output, diagnostics, and exit code. The exported probe accepts a fixed case name. Both the probe assembly code and its worker are excluded from the public preview build.

The Chromium harness serves the frame and worker from a separate loopback origin using the [runner host configuration](runner-host/). It verifies that the frame cannot read the app DOM and that the worker's response policy blocks requests to the app. It also checks termination by Cancel or deadline, a fresh rerun, and a 4,096-character capture limit per console stream. The deadline starts at invocation and a separate timer covers startup.

The execution probe links a 256 MiB maximum into the WebAssembly module. CI checks the published binary and verifies that a fixed allocation case receives an out-of-memory error, followed by a successful run in a fresh worker. The cap applies to the module's linear memory. Browser engine memory, JavaScript allocations and worker overhead are outside that cap.

These tests exercise known probes. The [hosting guide](runner-host/README.md) records the tested setup and what remains before any public execution deployment.
