try {
  const { dotnet } = await import('./_framework/dotnet.js');
  const { getAssemblyExports, getConfig } = await dotnet.create();
  const { SnippetCompiler } = await getAssemblyExports(getConfig().mainAssemblyName);
  self.addEventListener('message', ({ data: source }) => {
    try {
      self.postMessage({ result: JSON.parse(SnippetCompiler.Check(source)) });
    } catch (error) {
      console.error(error);
      self.postMessage({ error: 'The browser compiler could not complete the check.' });
    }
  }, { once: true });
  self.postMessage({ ready: true });
} catch (error) {
  console.error(error);
  self.postMessage({ error: 'The browser compiler could not start.' });
}
