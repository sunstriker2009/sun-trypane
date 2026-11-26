// CI copies this worker into the test build only.
try {
  const { dotnet } = await import('./_framework/dotnet.js');
  const { getAssemblyExports, getConfig, setModuleImports } = await dotnet.create();
  setModuleImports('execution-probe', { entered: () => self.postMessage({ entered: true }) });
  const { SnippetCompiler } = await getAssemblyExports(getConfig().mainAssemblyName);
  self.addEventListener('message', async ({ data: { scenario, boundaryUrl } }) => {
    let blocked = false;
    try {
      await fetch(boundaryUrl);
    } catch {
      blocked = true;
    }
    self.postMessage({ blocked });
    try {
      self.postMessage({ result: JSON.parse(SnippetCompiler.RunFixedProbe(scenario)) });
    } catch (error) {
      self.postMessage({ error: String(error?.stack ?? error) });
    }
  }, { once: true });
  self.postMessage({ ready: true });
} catch (error) {
  self.postMessage({ error: String(error?.stack ?? error) });
}
