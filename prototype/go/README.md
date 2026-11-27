# Run a Go console snippet locally

Use Node.js 24 and Docker Engine with Linux containers. From the repository root:

```sh
docker build -t trypane-go-prototype:local-v1 prototype/go
cat > /tmp/trypane-example.go <<'GO'
package main

import (
    "fmt"
    "io"
    "os"
)

func main() {
    name, err := io.ReadAll(os.Stdin)
    if err != nil {
        panic(err)
    }
    fmt.Printf("Hello, %s!\n", name)
}
GO
printf '%s' 'Ada' > /tmp/trypane-stdin.txt
node prototype/go/run.mjs /tmp/trypane-example.go /tmp/trypane-stdin.txt
```

The example prints `Hello, Ada!`. Pass a single `package main` source file using the Go standard library and, optionally, a file for standard input. The program reaches EOF after those bytes. Compiler diagnostics go to stderr and return status 65. When compilation succeeds, the runner preserves the program's output and exit status.

Use Ctrl+C to cancel. Compilation and execution share a 45-second deadline. Source and preset input are each capped at 32 KiB. Combined stdout and stderr are capped at 64 KiB. The container runs as a nonroot user with network disabled, temporary write space, and CPU, memory, and process limits. Use it for trusted local snippets.

Run the smoke checks with `node --test prototype/go/smoke.mjs` after building the image.

## Local browser editor

Build the Docker image above, then run these commands from the repository root:

```sh
npm ci
npm run build
node prototype/go/serve.mjs
```

Open <http://127.0.0.1:8002/> on the same machine. Edit the Go source and optional standard input, then select **Run**. Output and diagnostics stream into the pane. Select a compiler location to jump to the source line. **Cancel** stops the run and leaves both fields and the output visible. Retry after the container finishes cleanup.

The editor listens on IPv4 loopback and accepts one run at a time from its own origin. Closing the browser connection cancels an active run.
