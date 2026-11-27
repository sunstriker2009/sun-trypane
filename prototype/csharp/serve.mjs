import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { maxSourceBytes, maxStdinBytes } from '../snippet-limits.mjs';

const host = '127.0.0.1';
const port = Number(process.argv[2] ?? 8001);
const root = new URL('../../', import.meta.url);
const runner = fileURLToPath(new URL('./run.mjs', import.meta.url));
// A JSON escape can expand one input byte to six bytes.
const maxBodyBytes = 6 * (maxSourceBytes + maxStdinBytes) + 128;
const assets = new Map([
  ['/', ['prototype/csharp/editor.html', 'text/html']],
  ['/demo/demo.css', ['demo/demo.css', 'text/css']],
  ['/dist/prototype/csharp/editor.js', ['dist/prototype/csharp/editor.js', 'text/javascript']],
  ['/dist/src/pane.js', ['dist/src/pane.js', 'text/javascript']],
  ['/dist/src/runner.js', ['dist/src/runner.js', 'text/javascript']],
]);
let active = false;

function reply(response, status, text) {
  response.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' }).end(text);
}

async function run(request, response) {
  if (active) return reply(response, 409, 'A run is still active or stopping. Try again shortly.');
  const length = Number(request.headers['content-length']);
  if (!Number.isInteger(length)) return reply(response, 411, 'Source length is required.');
  if (length > maxBodyBytes) return reply(response, 413, 'The run request is too large.');

  active = true;
  let directory;
  let exitCode;
  try {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    if (response.destroyed) return;
    let input;
    try {
      input = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks)));
    } catch {
      return reply(response, 400, 'Send valid UTF-8 JSON.');
    }
    if (typeof input?.source !== 'string' || typeof input?.stdin !== 'string') {
      return reply(response, 400, 'Provide C# source and standard input as text.');
    }
    if (Buffer.byteLength(input.source) > maxSourceBytes || Buffer.byteLength(input.stdin) > maxStdinBytes) {
      return reply(response, 413, 'C# source and standard input each allow up to 32 KiB.');
    }
    directory = await mkdtemp(join(tmpdir(), 'trypane-csharp-editor-'));
    const path = join(directory, 'Snippet.cs');
    const stdinPath = join(directory, 'stdin.txt');
    await writeFile(path, input.source);
    await writeFile(stdinPath, input.stdin);
    if (response.destroyed) return;

    const child = spawn(process.execPath, [runner, path, stdinPath], { stdio: ['ignore', 'pipe', 'pipe'] });
    const cancel = () => child.kill('SIGINT');
    response.once('close', cancel);
    try {
      response.writeHead(200, { 'Content-Type': 'application/x-ndjson; charset=utf-8' });
      response.flushHeaders();
      const send = message => {
        if (!response.destroyed) response.write(JSON.stringify(message) + '\n');
      };
      child.stdout.setEncoding('utf8').on('data', text => send({ kind: 'progress', text }));
      child.stderr.setEncoding('utf8').on('data', text => send({ kind: 'diagnostic', text }));
      let startupError;
      child.once('error', error => { startupError = error; });
      const code = await new Promise(resolve => child.once('close', resolve));
      if (startupError) send({ kind: 'diagnostic', text: 'Could not start the local C# runner.' });
      exitCode = code ?? 125;
    } finally {
      response.off('close', cancel);
    }
  } finally {
    try {
      if (directory) await rm(directory, { recursive: true, force: true });
    } finally {
      active = false;
    }
  }
  if (!response.destroyed) response.end(JSON.stringify({ kind: 'exit', code: exitCode }) + '\n');
}

const server = createServer({ requestTimeout: 10_000, headersTimeout: 5_000, connectionsCheckingInterval: 1000 }, async (request, response) => {
  const authority = host + ':' + server.address().port;
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Content-Security-Policy', "default-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  if (request.headers.host !== authority) return reply(response, 403, 'Use the local editor URL.');
  try {
    if (request.method === 'POST' && request.url === '/run') {
      if (request.headers.origin !== 'http://' + authority) return reply(response, 403, 'Use the local editor to run a snippet.');
      if (request.headers['content-type'] !== 'application/json') {
        return reply(response, 415, 'Send C# source and standard input as JSON.');
      }
      if (request.headers['transfer-encoding']) return reply(response, 400, 'Use a fixed source length.');
      return await run(request, response);
    }
    const asset = request.method === 'GET' && assets.get(request.url);
    if (!asset) return reply(response, 404, 'Not found.');
    const [path, contentType] = asset;
    const content = await readFile(new URL(path, root));
    response.writeHead(200, { 'Content-Type': contentType + '; charset=utf-8' }).end(content);
  } catch (error) {
    console.error(error.message);
    if (!response.headersSent) reply(response, 500, 'The editor could not complete this request. Run npm run build and check the server log.');
    else response.destroy();
  }
});
server.listen(port, host, () => console.log('TryPane C# editor: http://' + host + ':' + server.address().port));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    server.close();
    server.closeAllConnections();
  });
}
