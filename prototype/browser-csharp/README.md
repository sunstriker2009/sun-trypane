# Browser C# compilation prototype

Check one C# console source file against .NET 10 reference assemblies in a WebAssembly worker. The compiler emits into temporary memory and reports errors and warnings with line and column. The page never loads the emitted assembly. Source stays in the browser. Cancel terminates the worker. Each check starts a fresh worker and accepts up to 8,192 UTF-16 code units.

From the repository root, with Node.js 24, the .NET 10 SDK and Python 3:

```sh
npm ci
npm run build
dotnet workload install wasm-tools --skip-manifest-update
dotnet publish prototype/browser-csharp/TryPane.Compiler.csproj -c Release -o dist/compiler
python3 -m http.server 8000 --bind 127.0.0.1
```

Open <http://127.0.0.1:8000/demo/csharp-check.html>. Edit the snippet and select **Check**.

The separate Browser C# compiler workflow verifies the prototype in Chromium and records first check time and runtime bytes served. Its artifact contains the compiled demo. Serve the extracted artifact root over HTTP and navigate to `demo/csharp-check.html`. This experiment stays outside the standalone Pages site until its runtime cost and mobile behavior have been assessed.

Public execution is a separate milestone. Before loading any emitted assembly, establish what the execution environment can access and test the limits for memory, time, output, and cleanup. The [local Docker editor](../csharp/README.md) is available for running trusted snippets today.
