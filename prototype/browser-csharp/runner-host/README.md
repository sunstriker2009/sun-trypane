# Fixed C# execution preview

The **Browser C# compiler** workflow stages and tests two pieces. Select **execution_preview** when running the workflow manually to download the package from a chosen commit. The ZIP includes a manifest identifying the commit and these directories:

| Directory | Contents |
| --- | --- |
| `host/` | Static demo page, styles, and compiled TryPane controller |
| `runner/` | NGINX build context with the frame, worker, and bounded .NET WebAssembly runtime |

The workflow serves the host and runner from separate loopback hostnames. Chromium checks response headers and MIME types, rejects writes, and drives the packaged demo through Run, Cancel, and rerun. The runner accepts fixed case names through its browser message channel. It serves static files and has no run API.

## Deploy a reviewed package

Choose a dedicated HTTPS hostname for the runner. Give it no user sessions, credentials, or upload endpoints.

1. From the extracted package, build the runner image with `docker build -t trypane-fixed-runner:preview runner`.
2. Serve that container behind HTTPS on port 8080. Set `TRYPANE_APP_ORIGIN` to the exact app origin, such as `https://sunstriker2009.github.io`, and `NGINX_ENVSUBST_FILTER=^TRYPANE_APP_ORIGIN$`. An origin allowlist applies to the entire hostname, including other projects on that hostname.
3. Replace `__TRYPANE_RUNNER_FRAME_URL__` in `host/index.html` with the runner’s HTTPS URL ending in `/frame`. Publish the configured `host/` directory under one app path. Keep its relative asset paths intact.
4. Check that the proxy preserves the frame and worker Content Security Policy and the JavaScript and WebAssembly MIME types. Open the app in Chromium and on a supported phone. Run the console case, cancel the long-running case, then rerun the console case.
5. To roll back, remove the preview page from the app and stop serving the runner container.

The existing Pages build serves the compile-only checker. The fixed execution package is separate and contains no editor for submitted source.

## Private Sites bridge check

The owner verified the fixed runner from its private Site page. The next check is whether a signed-in phone browser lets the public Pages demo reach that private Site in a frame.

Open the private Site directly and sign in first. Use the Pages bridge at `demo/runner-bridge.html` with a URL fragment of the form `#runner=https%3A%2F%2F<site-host>.chatgpt.site%2Fframe`. The page recognizes only HTTPS Sites frame URLs. Browsers omit the fragment from the HTTP request. Run the console example. Then start the long-running example, cancel it, and rerun the console example.

Chromium CI checks the staged bridge against a simulated Sites frame. The separate NGINX rehearsal exercises the same channel with the real fixed runtime. Neither test establishes whether a signed-in phone allows session access in the embedded private Site. Record the result before considering public execution.
