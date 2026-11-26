// CI copies this worker into the test build only.
try {
  const { dotnet } = await import('./_framework/dotnet.js');
  const { getAssemblyExports, getConfig } = await dotnet.create();
  const { SnippetCompiler } = await getAssemblyExports(getConfig().mainAssemblyName);
  self.postMessage({ result: JSON.parse(SnippetCompiler.RunFixedProbe()) });
} catch (error) {
  self.postMessage({ error: String(error?.stack ?? error) });
}
