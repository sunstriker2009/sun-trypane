import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';

import { maxSourceBytes, maxStdinBytes } from './snippet-limits.mjs';
const maxOutputBytes = 64 * 1024;

async function readInput(path, maxBytes, label) {
  const file = await open(path, constants.O_RDONLY | constants.O_NONBLOCK);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > maxBytes) {
      throw new Error(`Use a regular ${label} file up to 32 KiB.`);
    }
    const buffer = Buffer.alloc(maxBytes + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await file.read(buffer, length, buffer.length - length);
      if (bytesRead === 0) return buffer.subarray(0, length);
      length += bytesRead;
    }
    throw new Error(`Use a ${label} file up to 32 KiB.`);
  } finally {
    await file.close();
  }
}

function docker(args) {
  return spawnSync('docker', args, { encoding: 'utf8', timeout: 8_000 });
}

async function run(source, stdin, { language, image, timeoutMs, mounts }) {
  const name = 'trypane-' + language + '-' + randomUUID();
  let stopped;
  let stopMessage;
  let child;

  const stop = (code, message) => {
    if (stopped !== undefined) return;
    stopped = code;
    stopMessage = message;
    child?.kill('SIGKILL');
  };
  const interrupt = () => stop(130, 'Cancelled.');
  const terminate = () => stop(143, 'Terminated.');
  process.on('SIGINT', interrupt);
  process.on('SIGTERM', terminate);
  const created = docker([
    'create', '--name', name, '--pull=never', '--interactive',
    '--network=none', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges',
    '--user=65532:65532', '--pids-limit=96', '--memory=768m', '--memory-swap=768m',
    '--cpus=1', '--ulimit=core=0', '--log-driver=none',
    ...mounts.map(mount => '--tmpfs=' + mount),
    image, String(source.length),
  ]);
  child = created.status === 0
    ? spawn('docker', ['start', '--attach', '--interactive', name])
    : undefined;
  const timer = setTimeout(() => stop(124, 'Run timed out.'), timeoutMs);

  try {
    if (!child) throw new Error(created.stderr?.trim() || created.error?.message || 'Docker could not create the container.');
    let outputBytes = 0;
    const forward = (stream, chunk) => {
      if (stopped !== undefined) return;
      const remaining = maxOutputBytes - outputBytes;
      stream.write(chunk.subarray(0, remaining));
      outputBytes += Math.min(chunk.length, remaining);
      if (chunk.length > remaining) stop(125, 'Output limit reached.');
    };
    child.stdout.on('data', chunk => forward(process.stdout, chunk));
    child.stderr.on('data', chunk => forward(process.stderr, chunk));
    // The container can exit before it finishes reading the source.
    child.stdin.on('error', error => {
      if (error.code !== 'EPIPE') stop(125, error.message);
    });
    const exit = new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', code => resolve(code ?? 125));
    });
    child.stdin.end(Buffer.concat([source, stdin]));
    const code = await exit;
    if (stopMessage) console.error(stopMessage);
    return stopped ?? code;
  } finally {
    clearTimeout(timer);
    const cleanup = docker(['rm', '--force', name]);
    process.off('SIGINT', interrupt);
    process.off('SIGTERM', terminate);
    if (created.status === 0 && cleanup.status !== 0) {
      throw new Error('Docker could not remove ' + name + ': ' + (cleanup.stderr?.trim() || cleanup.error?.message));
    }
  }
}


export async function runSnippetCli(options) {
  try {
    const [sourcePath, stdinPath, ...extra] = process.argv.slice(2);
    if (!sourcePath || extra.length) throw new Error(options.usage);
    const source = await readInput(sourcePath, maxSourceBytes, options.sourceLabel);
    const stdin = stdinPath ? await readInput(stdinPath, maxStdinBytes, 'standard input') : Buffer.alloc(0);
    process.exitCode = await run(source, stdin, options);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 125;
  }
}
