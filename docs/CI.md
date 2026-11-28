# Runtime validation and workflow maintenance

TryPane supports several distinct runtime paths. Their builds are intentional coverage:

| Path | Validation |
| --- | --- |
| Public browser Regex, compilation-only C# and Go demos | Required `repository-validation` job builds and tests the staged site, then main can publish Pages. |
| Fixed browser C# execution and editable hosting candidate | `browser-csharp.yml` builds the distinct execution-probe/editable feature modes and verifies their hosting behavior. |
| Local Docker C# and Go runners | `local-runners.yml` builds the selected image(s), runs the unchanged CLI smoke suites and checks the browser editors. |

The browser and Docker compiler paths are supported use cases with different execution/isolation models. Neither is retired by the local workflow consolidation.

## Shared local-runner validation

`local-runners.yml` replaces `csharp-prototype.yml` and `go-prototype.yml`. For a PR that affects shared inputs, both languages share one runner, Node/npm setup, TypeScript build and Chromium setup. Each language retains its image tag, Docker build command, CLI assertions and browser-editor smoke script. Each browser script closes its browser/server before the next runs.

A change only under `prototype/csharp/` or `prototype/go/` selects that language. Shared or unfamiliar inputs select both; missing revisions, failed/empty diffs and unexpected unmatched changes also run both. Git rename detection is disabled so old and new paths both influence scope. Dependencies and the selection helper/tests are included in the workflow's triggers. Known Markdown documentation accompanying a language change does not activate the other language.

PR-only automatic validation is retained; no new main/push run is added. Manual dispatch offers `all`, `csharp` or `go` in the `language` field. Use this form instead of the retired workflow filenames. Shared changes use sequential tests and a 15-minute job timeout instead of two independent eight-minute jobs. Passing runs execute all selected CLI and browser assertions; a failure stops later work.

## Required checks and validation

The live ruleset requires `repository-validation`, which is unchanged. The old standalone `smoke` checks were not required. Before merging the consolidation, require both the existing main CI check and `local-runners` to succeed, including both languages on this CI-edit PR; do not auto-merge on the main check alone.

Nine selection regression tests cover language-only/mixed inputs, shared or unknown files, manual selection, unavailable diffs and cross-language renames. A real temporary Git repository verifies deletion and filenames with spaces. The core `npm test` command discovers these tests too. No production runtime, sandbox limits, compiler mode, package version, Pages workflow or repository setting is changed.

For changes shared by both local languages, this removes one runner and one duplicate editor/dependency/browser setup. Language-only changes still build/test that language. Savings depend on runner rounding and execution duration; longer sequential wall time is an expected tradeoff. Do not launch extra manual runs just to measure savings.

To roll back, revert the consolidation PR so both old workflow files return together. Existing runtime/browser test scripts remain available at their original paths.
