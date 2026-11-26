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

## Scope

Use this prototype with local, trusted snippets. The fixed project restores offline, so it supports the SDK's reference assemblies without custom NuGet packages. Each container runs as a nonroot user with network disabled, no host mounts, a read-only root, temporary write space, and CPU, memory and process limits. Docker containers share the host kernel. A hosted runner for untrusted code needs a separately reviewed isolation design and abuse limits.

The CLI is a feasibility prototype. An editor integration needs a transport and an adapter that forwards diagnostics, output and cancellation. TryPane's static browser demos use their existing adapters.
