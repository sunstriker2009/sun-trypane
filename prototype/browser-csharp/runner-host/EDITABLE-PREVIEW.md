# Editable C# hosting candidate

Open the **Browser C# compiler** workflow in Actions and select **Run workflow** with **editable_preview** checked. After Chromium passes, download **trypane-editable-csharp-preview** from the run summary. The artifact expires after seven days. Its `manifest.json` records the commit used to build and test the package.

| Directory | Purpose |
| --- | --- |
| `host/` | Static editor and Run and Cancel controls |
| `runner/` | NGINX build context, runner frame, and browser WebAssembly runtime |

The workflow uses separate loopback origins. It checks HTTP response policy, Wasm MIME type, refusal of writes, the memory limit, and the editable pane at a 390 px viewport. The runner is a static asset host. The browser sends the source and preset input to the runner frame over a message port, and a WebAssembly worker compiles and runs the file on the device.

## HTTPS setup

1. Use a separate HTTPS runner origin serving only this package. It must carry no login session, cookies, private data, or write endpoints. The existing signed-in Site is for fixed probes. The NGINX image below is the reference for any static hosting provider.
2. Build `docker build -t trypane-editable-preview runner`. Run the image behind HTTPS with port 8080 as the upstream. Set `TRYPANE_APP_ORIGIN` to the editor's exact origin, for example `https://sunstriker2009.github.io`, and `NGINX_ENVSUBST_FILTER=^TRYPANE_APP_ORIGIN$`. The allowlist applies to the origin, including other projects on that hostname.
3. Set the runner URL in `host/index.html` by replacing `__TRYPANE_RUNNER_FRAME_URL__` with the separate runner's HTTPS URL ending in `/frame`. Put `host/` at the desired path on the editor's static site. Keep the relative asset paths.
4. Verify that the deployed runner serves the same CSP and MIME types as the reference configuration. Check that the preview frame loads only under the configured editor origin, that the runner issues no cookies, and that the worker assets can be fetched without a login.
5. On the phone, edit the default snippet and preset input and select **Run**. Check that the output reflects both edits. Introduce a compiler error and verify the line number. Replace the source with `while (true) { }`, select **Run** and then **Cancel**. Restore a working snippet and check a fresh run.

Browser execution uses capped source, preset input, output, a startup timeout, an invocation deadline, and a 256 MiB WebAssembly linear memory cap. The cap covers Wasm linear memory. The host may rate-limit requests for assets to control traffic. Browser worker executions do not consume a server-side run quota.

To roll back, remove the editor page and stop serving the candidate runner assets. The packaged build is tested on loopback. HTTPS behavior and the phone run are separate acceptance checks.
