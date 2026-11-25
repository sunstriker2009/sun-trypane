import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RegexAdapter } from '../dist/src/adapters/regex.js';

class FakeWorker extends EventTarget {
  messages = [];
  terminated = false;
  postMessage(message) { this.messages.push(message); }
  terminate() { this.terminated = true; }
  respond(data) { this.dispatchEvent(new MessageEvent('message', { data })); }
}

const input = { pattern: '(?<word>\\w+)', text: 'Hello, world!', mode: 'all' };

function setup() {
  const workers = [];
  const adapter = new RegexAdapter(new URL('https://example.test/regex-worker.mjs'), () => {
    const worker = new FakeWorker();
    workers.push(worker);
    return worker;
  });
  return { adapter, workers };
}

test('passes the submitted C# regex operation and reuses the ready worker', async () => {
  const { adapter, workers } = setup();
  const first = { id: 11, signal: new AbortController().signal };
  const loading = adapter.load(first);
  workers[0].respond({ status: 'ready' });
  await loading;
  const execution = adapter.run(input, first);
  assert.deepEqual(workers[0].messages, [{ id: 11, ...input }]);
  const result = { status: 'match', matches: [{ text: 'Hello', index: 0, groups: ['Hello'], named: [{ name: 'word', value: 'Hello' }] }], groupNumbers: [1] };
  workers[0].respond({ id: 11, result });
  assert.deepEqual(await execution, result);
  await adapter.load({ id: 12, signal: new AbortController().signal });
  assert.equal(workers.length, 1);
  adapter.dispose();
  assert.equal(workers[0].terminated, true);
});

test('cancellation during loading terminates the worker and permits retry', async () => {
  const { adapter, workers } = setup();
  const controller = new AbortController();
  const loading = adapter.load({ id: 1, signal: controller.signal });
  controller.abort();
  await assert.rejects(loading, /cancelled/);
  assert.equal(workers[0].terminated, true);
  const retry = adapter.load({ id: 2, signal: new AbortController().signal });
  workers[1].respond({ status: 'ready' });
  await retry;
  adapter.dispose();
});

test('cancellation during a run discards the old worker and result', async () => {
  const { adapter, workers } = setup();
  const controller = new AbortController();
  const context = { id: 1, signal: controller.signal };
  const loading = adapter.load(context);
  workers[0].respond({ status: 'ready' });
  await loading;
  const execution = adapter.run(input, context);
  controller.abort();
  await assert.rejects(execution, /cancelled/);
  assert.equal(workers[0].terminated, true);
  workers[0].respond({ id: 1, result: { status: 'match', matches: [], groupNumbers: [] } });
  const retry = adapter.load({ id: 2, signal: new AbortController().signal });
  workers[1].respond({ status: 'ready' });
  await retry;
  adapter.dispose();
});
