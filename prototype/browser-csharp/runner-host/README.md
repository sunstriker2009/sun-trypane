# Separate runner origin

The Browser C# compiler pull request workflow builds this NGINX image and serves the fixed probe runtime from a second loopback address. The Chromium test verifies the deployed response headers and MIME types, then repeats the origin, time, output and memory probes. The container is removed at the end of the test. The image supplies a static frame and file server. It has no endpoint that accepts or runs C#.

The workflow builds the compiler with `EnableExecutionProbe=true` and copies the fixed probe worker into the generated `wwwroot`. The browser test mounts only that directory as read-only at `/srv/runner/dist/compiler/wwwroot`. Set `TRYPANE_APP_ORIGIN` to the exact origin that may embed the frame, and set `NGINX_ENVSUBST_FILTER=^TRYPANE_APP_ORIGIN$` so NGINX can expand its own variables normally.

## Public deployment requirements

- Serve a dedicated HTTPS origin with a separate hostname from the app. The runner origin should carry no user sessions, credentials, APIs or uploads.
- Preserve the worker's HTTP Content Security Policy and JavaScript and WebAssembly MIME types through any reverse proxy. Bind the embedding policy to the intended app origin.
- Verify the same tests against the final origin and a supported phone browser. The loopback rehearsal does not measure browser compatibility on a deployed host.
- Use a reviewed message channel for start, cancel and results before allowing editor source to reach a worker. The current test drives the isolated frame with Chromium automation.

The public TryPane Pages site serves the compile-only checker. This repository does not deploy the runner host publicly.
