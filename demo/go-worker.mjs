import '../dist/browser-go/wasm_exec.js';

self.addEventListener('message', async ({ data }) => {
  try {
    const go = new self.Go();
    const response = await fetch(new URL('../dist/browser-go/json-compact.wasm', import.meta.url));
    if (!response.ok) throw new Error('Could not load WebAssembly.');

    self.trypaneInput = data;
    const { instance } = await WebAssembly.instantiateStreaming(response, go.importObject);
    await go.run(instance);
    self.postMessage(self.trypaneResult);
  } catch {
    self.postMessage({ failure: 'The Go runtime could not complete the run. Try again.' });
  }
}, { once: true });
