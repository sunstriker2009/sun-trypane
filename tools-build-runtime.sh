#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
dotnet publish "$repo_root/runtime/TryPane.Regex.csproj" --configuration Release --output "$repo_root/dist/runtime"
test -s "$repo_root/dist/runtime/wwwroot/_framework/dotnet.js"
test -s "$repo_root/dist/runtime/wwwroot/regex-worker.mjs"
