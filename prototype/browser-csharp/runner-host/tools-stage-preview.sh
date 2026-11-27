#!/usr/bin/env bash
set -euo pipefail

host_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
repo_root=$(cd -- "$host_dir/../../.." && pwd)
output=${1:?Pass a fresh output directory}
source_commit=${2:?Pass the source commit SHA}
[[ "$source_commit" =~ ^[0-9a-f]{40}$ ]]

mkdir -- "$output"
mkdir -p -- "$output/host/dist/demo" "$output/host/dist/src" "$output/runner"
cp -- "$host_dir/preview.html" "$output/host/index.html"
cp -- "$repo_root/demo/demo.css" "$output/host/"
cp -- "$repo_root/dist/demo/execution-probe.js" "$output/host/dist/demo/"
cp -- "$repo_root/dist/src/"{pane.js,runner.js} "$output/host/dist/src/"
cp -- "$host_dir/"{Dockerfile,frame.html.template,frame.mjs,runner.conf.template} "$output/runner/"
cp -R -- "$repo_root/dist/compiler/wwwroot" "$output/runner/runtime"
test -s "$output/runner/runtime/probe-worker.mjs"
test -s "$output/runner/runtime/_framework/dotnet.js"
cp -- "$host_dir/README.md" "$output/README.md"
printf '{"sourceCommit":"%s","variant":"fixed-csharp-preview"}\n' "$source_commit" > "$output/manifest.json"
