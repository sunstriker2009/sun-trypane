# M2 browser and device validation

The CI job builds the .NET 10 WebAssembly bundle and runs `tests/browser/regex-smoke.mjs` in Chromium. The smoke test serves the preview below `/nested/trypane/` at a 390 × 844 viewport. It checks keyboard Run, announced status, named captures, selecting matches, the 100-match display limit, a timed-out match and recovery, cancellation during load, preserved host input, and worker asset paths. The browser script writes `dist/m2-browser-measurements.json` into the downloadable CI artifact with the browser version, measured cold and warm click-to-result times, and runtime bytes served during the first run.

The first passing run was [CI #20](https://github.com/sunstriker2009/sun-trypane/actions/runs/45731101309), using Chromium 157.0.8103.78 at 390 × 844. It reported 843 ms from Run to first result and 49 ms for a warm rerun. The 16 runtime requests served 5,619,473 bytes. It also passed cancellation during loading and a subsequent run, the 100-match limit, timeout recovery, and keyboard focus. These values are one CI observation, with no bandwidth throttling or repeat distribution.

These timings describe the CI runner and its local static server. Record a comparison on the same device and connection before choosing mobile thresholds. Device checks below remain open until they are performed in Safari on an iPhone.

## iPhone Safari acceptance

Use the compiled preview from a reachable HTTPS host with the runtime files alongside the worker. Record the device model, iOS and Safari version, host URL/path, network type, cache state, and the cold and warm Run timings. Test these actions:

1. Run the default pattern, then rerun and confirm both match and named capture.
2. Select Find all and inspect the second match. Check that no horizontal scrolling is needed.
3. Enter an invalid pattern, then repair it and run again. Check that the status message can be read with VoiceOver.
4. Cancel during loading and during an active run. Confirm the text remains and that a later Run succeeds.
5. Leave and reopen the page. Confirm the worker stops with the page and no old result appears.

Compare first run, warm run, and downloaded runtime bytes with CodeFolio's C# Regex Try It under equivalent conditions. Record any performance limit agreed for the integration preview in the roadmap.
