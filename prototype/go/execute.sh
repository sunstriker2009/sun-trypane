#!/bin/sh
set -eu

head -c "$1" > main.go
cat > stdin.txt
if ! go build -trimpath -o /snippet/main main.go >&2; then
  exit 65
fi
exec /snippet/main < stdin.txt
