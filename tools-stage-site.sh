#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
site_dir=${1:?Pass a fresh output directory for the demo site}
compiler_dir=${2:?Pass the browser compiler publish directory}
mkdir -- "$site_dir"
mkdir -p -- "$site_dir/demo" "$site_dir/dist/demo" "$site_dir/dist/src/adapters" "$site_dir/dist/runtime" "$site_dir/dist/compiler"
cp -- "$repo_root/site/index.html" "$site_dir/"
cp -- "$repo_root/demo/"{regex.html,batch.html,csharp-check.html,programmatic.html,demo.css} "$site_dir/demo/"
cp -- "$repo_root/dist/demo/"{regex-main.js,batch.js,csharp-check.js,programmatic.js} "$site_dir/dist/demo/"
cp -- "$repo_root/dist/src/"{pane.js,runner.js} "$site_dir/dist/src/"
cp -- "$repo_root/dist/src/adapters/regex.js" "$site_dir/dist/src/adapters/"
cp -R -- "$repo_root/dist/runtime/wwwroot" "$site_dir/dist/runtime/"
test -s "$site_dir/dist/runtime/wwwroot/_framework/dotnet.js"
test -s "$site_dir/dist/runtime/wwwroot/regex-worker.mjs"
cp -R -- "$compiler_dir/wwwroot" "$site_dir/dist/compiler/"
test -s "$site_dir/dist/compiler/wwwroot/_framework/dotnet.js"
test -s "$site_dir/dist/compiler/wwwroot/compiler-worker.mjs"
