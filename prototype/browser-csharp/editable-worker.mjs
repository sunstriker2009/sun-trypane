// This entry point is copied only into the disposable CI rehearsal.
try {
  const { dotnet } = await import('./_framework/dotnet.js');
  const { getAssemblyExports, getConfig, setModuleImports } = await dotnet.create();
  setModuleImports('execution-probe', { entered: () => self.postMessage({ kind: 'entered' }) });
  const { SnippetCompiler } = await getAssemblyExports(getConfig().mainAssemblyName);

  self.addEventListener('message', ({ data }) => {
    const { source, input } = data ?? {};
    if (typeof source !== 'string' || source.length > 8192 ||
        typeof input !== 'string' || input.length > 4096) {
      self.postMessage({ kind: 'error', message: 'The source or input exceeds the rehearsal limit.' });
      return;
    }
    try {
      const result = JSON.parse(SnippetCompiler.RunEditableRehearsal(source, input));
      self.postMessage({ kind: 'result', result });
    } catch {
      self.postMessage({ kind: 'error', message: 'The rehearsal could not run the snippet.' });
    }
  }, { once: true });
  self.postMessage({ kind: 'ready' });
} catch {
  self.postMessage({ kind: 'error', message: 'The rehearsal runtime could not start.' });
}
