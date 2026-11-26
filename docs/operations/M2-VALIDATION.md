# M2 browser and device validation

The CI job builds the .NET 10 WebAssembly bundle and runs `tests/browser/regex-smoke.mjs` in Chromium. The smoke test serves the preview below `/nested/trypane/` at a 390 × 844 viewport. It checks keyboard Run, announced status, named captures, selecting matches, the 100-match display limit, a timed-out match and recovery, cancellation during load, preserved host input, and worker asset paths. The browser script writes `dist/m2-browser-measurements.json` into the downloadable CI artifact with the browser version, measured cold and warm click-to-result times, and runtime bytes served during the first run.

The first passing run was [CI #20](https://github.com/sunstriker2009/sun-trypane/actions/runs/45731101309), using Chromium 157.0.8103.78 at 390 × 844. It reported 843 ms from Run to first result and 49 ms for a warm rerun. The 16 runtime requests served 5,619,473 bytes. It also passed cancellation during loading and a subsequent run, the 100-match limit, timeout recovery, and keyboard focus. These values are one CI observation, with no bandwidth throttling or repeat distribution.

## Acceptance decision

The owner reported that the manual CodeFolio preview run looked good and waived formal iPhone Safari acceptance. Chromium CI and the manual preview run are the acceptance evidence for the first release. The reported timings describe the CI runner and its local static server. Device timings and mobile performance thresholds were not established.
