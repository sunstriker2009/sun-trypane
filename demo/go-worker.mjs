import '../dist/browser-go/wasm_exec.js';

const modules = new Map([
  ['compact', '../dist/browser-go/json-compact.wasm'],
  ['check', '../dist/browser-go/source-check.wasm'],
]);

self.addEventListener('message', async ({ data }) => {
  try {
    const path = modules.get(data?.operation);
    if (!path || typeof data.input !== 'string') throw new Error('Unknown Go operation.');
    const go = new self.Go();
    const response = await fetch(new URL(path, import.meta.url));
    if (!response.ok) throw new Error('Could not load WebAssembly.');

    self.trypaneInput = data.input;
    const { instance } = await WebAssembly.instantiateStreaming(response, go.importObject);
    await go.run(instance);
    self.postMessage(self.trypaneResult);
  } catch {
    self.postMessage({ failure: 'The Go runtime could not complete the run. Try again.' });
  }
}, { once: true });
