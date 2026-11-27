#!/usr/bin/env bash
set -euo pipefail

host_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo_root=$(cd -- "$host_dir/../../.." && pwd)
output=${1:?Pass a fresh output directory}
source_commit=${2:?Pass the source commit SHA}
runtime_dir=${3:-"$repo_root/dist/compiler"}
variant=${4:-fixed}
[[ "$variant" == fixed || "$variant" == editable ]]
[[ "$source_commit" =~ ^[0-9a-f]{40}$ ]]

mkdir -- "$output"
mkdir -p -- "$output/host/dist/demo" "$output/host/dist/src" "$output/runner"
case "$variant" in
  fixed)
    page=preview
    controller=execution-probe
    frame=frame
    worker=probe-worker
    manifest_variant=fixed-csharp-preview
    ;;
  editable)
    page=editable-preview
    controller=editable-preview
    frame=editable-frame
    worker=editable-worker
    manifest_variant=editable-csharp-rehearsal
    ;;
esac
cp -- "$host_dir/$page.html" "$output/host/index.html"
cp -- "$repo_root/demo/demo.css" "$output/host/"
cp -- "$repo_root/dist/demo/$controller.js" "$output/host/dist/demo/"
cp -- "$repo_root/dist/src/"{pane.js,runner.js} "$output/host/dist/src/"
cp -- "$host_dir/"{Dockerfile,frame.html.template,runner.conf.template} "$output/runner/"
cp -- "$host_dir/$frame.mjs" "$output/runner/frame.mjs"
cp -R -- "$runtime_dir/wwwroot" "$output/runner/runtime"
test -s "$output/runner/runtime/$worker.mjs"
test -s "$output/runner/runtime/_framework/dotnet.js"
cp -- "$host_dir/README.md" "$output/README.md"
printf '{"sourceCommit":"%s","variant":"%s"}\n' "$source_commit" "$manifest_variant" > "$output/manifest.json"
