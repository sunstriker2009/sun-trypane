import { spawn, spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';

const image = 'trypane-csharp-prototype:local';
const maxSourceBytes = 32 * 1024;
const maxOutputBytes = 64 * 1024;
const runTimeoutMs = 30_000;

async function readSource(path) {
  const file = await open(path, constants.O_RDONLY | constants.O_NONBLOCK);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.size > maxSourceBytes) {
      throw new Error('Use a regular C# file up to 32 KiB.');
    }
    const buffer = Buffer.alloc(maxSourceBytes + 1);
    let length = 0;
    while (length < buffer.length) {
      const { bytesRead } = await file.read(buffer, length, buffer.length - length);
      if (bytesRead === 0) return buffer.subarray(0, length);
      length += bytesRead;
    }
    throw new Error('Use a C# file up to 32 KiB.');
  } finally {
    await file.close();
  }
}

function docker(args) {
  return spawnSync('docker', args, { encoding: 'utf8', timeout: 8_000 });
}

async function run(source) {
  const name = 'trypane-csharp-' + randomUUID();
  const created = docker([
    'create', '--name', name, '--pull=never', '--interactive',
    '--network=none', '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges',
    '--user=65532:65532', '--pids-limit=96', '--memory=768m', '--memory-swap=768m',
    '--cpus=1', '--ulimit=core=0', '--log-driver=none',
    '--tmpfs=/work:rw,nosuid,nodev,noexec,size=64m,mode=1777',
    '--tmpfs=/tmp:rw,nosuid,nodev,noexec,size=32m,mode=1777',
    image,
  ]);
  let stopped;
  let stopMessage;
  const child = created.status === 0
    ? spawn('docker', ['start', '--attach', '--interactive', name])
    : undefined;

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
  const timer = setTimeout(() => stop(124, 'Run timed out.'), runTimeoutMs);

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
    child.stdin.end(source);
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

try {
  if (process.argv.length !== 3) throw new Error('Usage: node prototype/csharp/run.mjs PATH_TO_CS_FILE');
  process.exitCode = await run(await readSource(process.argv[2]));
} catch (error) {
  console.error(error.message);
  process.exitCode = 125;
}
