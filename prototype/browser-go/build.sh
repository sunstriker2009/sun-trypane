#!/usr/bin/env bash
set -euo pipefail

repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/../.." && pwd)
output="$repo_root/dist/browser-go"
mkdir -p -- "$output"
export GOENV=off GOTOOLCHAIN=local GO111MODULE=off GOPROXY=off GOSUMDB=off
export GOOS=js GOARCH=wasm CGO_ENABLED=0
go build -trimpath -ldflags="-s -w" -o "$output/json-compact.wasm" "$repo_root/prototype/browser-go/main.go"
go build -trimpath -ldflags="-s -w" -o "$output/source-check.wasm" "$repo_root/prototype/browser-go/check.go"
cp -- "$(go env GOROOT)/lib/wasm/wasm_exec.js" "$output/wasm_exec.js"
