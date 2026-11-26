FROM mcr.microsoft.com/dotnet/sdk:10.0-noble

ENV DOTNET_CLI_HOME=/work HOME=/work DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_NOLOGO=1 DOTNET_EnableDiagnostics=0 NUGET_PACKAGES=/work/packages

COPY Snippet.csproj NuGet.Config execute.sh /opt/trypane/
WORKDIR /work
USER 65532:65532
ENTRYPOINT ["/bin/sh", "/opt/trypane/execute.sh"]
