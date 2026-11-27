const appOrigin = document.querySelector('meta[name="trypane-app-origin"]').content;
const cases = new Map([
  ['console', ['console', 2000]],
  ['timeout', ['loop', 250]],
  ['cancel', ['loop', 10000]],
  ['memory', ['memory', 8000]],
  ['output', ['output', 2000]],
]);

function connect(event) {
  if (window.parent === window || event.source !== window.parent || event.origin !== appOrigin ||
      event.data?.type !== 'trypane-probe-v1' || event.ports.length !== 1) return;
  const port = event.ports[0];
  window.removeEventListener('message', connect);
  const chosen = cases.get(event.data.caseName);
  if (!chosen) {
    port.postMessage({ kind: 'error', message: 'Unknown probe.' });
    port.close();
    return;
  }

  const [scenario, deadlineMs] = chosen;
  const worker = new Worker('/dist/compiler/wwwroot/probe-worker.mjs', { type: 'module' });
  let blocked;
  let deadline;
  const startup = setTimeout(() => finish({ kind: 'error', message: 'Runner startup timed out.' }), 45_000);
  function stop() {
    clearTimeout(startup);
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
  worker.onmessage = ({ data }) => {
    if (data.ready) {
      worker.postMessage({ scenario, boundaryUrl: appOrigin + '/boundary-probe' });
    } else if (typeof data.blocked === 'boolean') {
      blocked = data.blocked;
    } else if (data.entered) {
      clearTimeout(startup);
      port.postMessage({ kind: 'entered' });
      deadline = setTimeout(() => finish({ kind: 'timeout', blocked }), deadlineMs);
    } else if (data.error) {
      console.error(data.error);
      finish({ kind: 'error', message: 'The execution probe failed.' });
    } else if (data.result) {
      finish({ kind: 'result', blocked, result: data.result });
    }
  };
  worker.onerror = () => finish({ kind: 'error', message: 'The execution worker failed to start.' });
}
window.addEventListener('message', connect);
