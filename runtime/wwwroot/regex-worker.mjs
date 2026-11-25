// Keep the worker and its published _framework directory together.
try {
  const { dotnet } = await import('./_framework/dotnet.js');
  const { getAssemblyExports, getConfig } = await dotnet.create();
  const { RegexRunner } = await getAssemblyExports(getConfig().mainAssemblyName);

  self.addEventListener('message', ({ data }) => {
    try {
      const limit = data.mode === 'all' ? 101 : 1;
      const result = JSON.parse(RegexRunner.Test(data.pattern, data.text, limit));
      if (result.matches?.length > 100) {
        result.matches.pop();
        result.truncated = true;
      }
      self.postMessage({ id: data.id, result });
    } catch {
      self.postMessage({ id: data.id, result: { status: 'error' } });
    }
  });
  self.postMessage({ status: 'ready' });
} catch {
  self.postMessage({ status: 'load-error' });
}
