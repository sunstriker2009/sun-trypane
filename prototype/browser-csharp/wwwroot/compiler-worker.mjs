self.onmessage = async ({ data: source }) => {
  try {
    const { dotnet } = await import('./_framework/dotnet.js');
    const { getAssemblyExports, getConfig } = await dotnet.create();
    const { SnippetCompiler } = await getAssemblyExports(getConfig().mainAssemblyName);
    self.postMessage({ result: JSON.parse(SnippetCompiler.Check(source)) });
  } catch (error) {
    console.error(error);
    self.postMessage({ error: 'The browser compiler could not complete the check.' });
  }
};
