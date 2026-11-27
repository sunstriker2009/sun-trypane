const appOrigin = document.querySelector('meta[name="trypane-app-origin"]').content;

function connect(event) {
  const request = event.data;
  if (parent === window || event.source !== parent || event.origin !== appOrigin ||
      request?.type !== 'trypane-editable-v1' || event.ports.length !== 1) return;

  window.removeEventListener('message', connect);
  const port = event.ports[0];
  const { source, input } = request;
  if (typeof source !== 'string' || source.length > 8192 ||
      typeof input !== 'string' || input.length > 4096) {
    port.postMessage({ kind: 'error', message: 'Use at most 8,192 source and 4,096 input characters.' });
    port.close();
    return;
  }

  const worker = new Worker('/dist/compiler/wwwroot/editable-worker.mjs', { type: 'module' });
  let deadline = setTimeout(() => finish({
    kind: 'error', message: 'The runner did not finish loading or compiling.',
  }), 45_000);

  function stop() {
    clearTimeout(deadline);
    worker.terminate();
    port.close();
  }

  function finish(message) {
    port.postMessage(message);
    stop();
  }

  port.onmessage = ({ data }) => {
    if (data?.kind === 'cancel') stop();
  };
  window.addEventListener('pagehide', stop, { once: true });
  worker.onerror = () => finish({ kind: 'error', message: 'The runner worker could not start.' });
  worker.onmessage = ({ data }) => {
    if (data?.kind === 'ready') {
      worker.postMessage({ source, input });
    } else if (data?.kind === 'entered') {
      clearTimeout(deadline);
      deadline = setTimeout(() => finish({ kind: 'error', message: 'Execution timed out.' }), 2000);
      port.postMessage({ kind: 'entered' });
    } else {
      finish(data);
    }
  };
}

window.addEventListener('message', connect);
