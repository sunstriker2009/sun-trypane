# Run an editable C# snippet locally

This command line prototype runs one C# console source file using .NET 10. It accepts top-level statements or a conventional C# entry point. The project enables the standard console SDK imports. Each invocation builds a fresh project and exits when the program finishes.

Use Node.js 24 and a local Docker Engine running Linux containers. From the repository root:

```sh
docker build -t trypane-csharp-prototype:local prototype/csharp
printf '%s\n' 'Console.WriteLine(Enumerable.Range(1, 5).Sum());' > /tmp/trypane-example.cs
node prototype/csharp/run.mjs /tmp/trypane-example.cs
```

The example prints `15`. Compiler diagnostics and program errors go to stderr. Use Ctrl+C to cancel. Each invocation accepts up to 32 KiB of source, stops when output exceeds 64 KiB across stdout and stderr, and allows 30 seconds after container creation for compilation and execution. The runner removes the container before returning. The source file supplies the container's stdin during setup. The compiled program sees end of file on stdin.

Run the Docker smoke checks with `node --test prototype/csharp/smoke.mjs`.


## Open the local browser editor

Build the image above, then start the editor from the repository root:

```sh
npm ci
npm run build
node prototype/csharp/serve.mjs
```

Open <http://127.0.0.1:8001/> on the same machine. Edit the C# source and choose **Run**. Output and diagnostics arrive while the run is active, and the editor shows the exit code afterwards. Choose **Cancel** to stop a run. The editor retains your source and any output already shown. A new run may have to wait briefly for Docker to finish cleanup.

The listener binds to IPv4 loopback, serves a fixed set of editor assets, and accepts one run at a time from its own browser origin. The server cancels active runs when their browser connection closes. Keep the listener local to your machine. It assumes you trust other software and users with access to that machine.

## Scope

Use this prototype with local, trusted snippets. The fixed project restores offline, so it supports the SDK's reference assemblies without custom NuGet packages. Each container runs as a nonroot user with network disabled, no host mounts, a read-only root, temporary write space, and CPU, memory and process limits. Docker containers share the host kernel. A hosted runner for untrusted code needs a separately reviewed isolation design and abuse limits.

The CLI and local editor are feasibility prototypes. TryPane's static browser demos use their existing adapters.
