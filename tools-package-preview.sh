#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
version=$(node -p 'require(process.argv[1]).version' "$repo_root/package.json")
source_sha=${1:?Pass the pinned source commit SHA}
bundle="$repo_root/dist/package/trypane-regex-$version"

mkdir -p "$bundle/runtime"
cp -R "$repo_root/dist/src" "$bundle/src"
cp -R "$repo_root/dist/runtime/wwwroot" "$bundle/runtime/wwwroot"
cp "$repo_root/docs/INTEGRATION.md" "$bundle/INTEGRATION.md"
printf '{"name":"sun-trypane","version":"%s","sourceCommit":"%s"}\n' "$version" "$source_sha" > "$bundle/manifest.json"
test -s "$bundle/src/pane.js"
test -s "$bundle/src/adapters/regex.js"
test -s "$bundle/runtime/wwwroot/regex-worker.mjs"
test -s "$bundle/runtime/wwwroot/_framework/dotnet.js"
tar -czf "$repo_root/dist/package/trypane-regex-$version.tar.gz" -C "$repo_root/dist/package" "trypane-regex-$version"
