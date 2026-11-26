#!/bin/sh
set -eu

cp /opt/trypane/Snippet.csproj /opt/trypane/NuGet.Config .
head -c "$1" > Program.cs
cat > stdin.txt
if ! dotnet restore --configfile NuGet.Config --disable-build-servers > restore.log 2>&1; then
  cat restore.log >&2
  exit 65
fi
if ! dotnet build --no-restore --disable-build-servers --nologo -o out > build.log 2>&1; then
  cat build.log >&2
  exit 65
fi
grep 'warning ' build.log >&2 || true
exec dotnet out/Snippet.dll < stdin.txt
