#!/bin/sh
set -eu

cp /opt/trypane/Snippet.csproj /opt/trypane/NuGet.Config .
cat > Program.cs
if ! dotnet restore --configfile NuGet.Config --disable-build-servers > restore.log 2>&1; then
  cat restore.log >&2
  exit 65
fi
if ! dotnet build --no-restore --disable-build-servers --nologo -o out > build.log 2>&1; then
  cat build.log >&2
  exit 65
fi
grep 'warning ' build.log >&2 || true
exec dotnet out/Snippet.dll
