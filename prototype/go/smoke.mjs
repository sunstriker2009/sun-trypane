import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const runner = fileURLToPath(new URL('./run.mjs', import.meta.url));

async function runSnippet(source, { stdin, cancel = false } = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'trypane-go-smoke-'));
  try {
    const sourcePath = join(directory, 'main.go');
    await writeFile(sourcePath, source);
    const args = [runner, sourcePath];
    if (stdin !== undefined) {
      const inputPath = join(directory, 'stdin.txt');
      await writeFile(inputPath, stdin);
      args.push(inputPath);
    }
    const child = spawn(process.execPath, args);
    let stdout = '';
    let stderr = '';
    child.stdout.setEncoding('utf8').on('data', chunk => {
      stdout += chunk;
      if (cancel && stdout.includes('Running')) child.kill('SIGINT');
    });
    child.stderr.setEncoding('utf8').on('data', chunk => { stderr += chunk; });
    const status = await new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('close', resolve);
    });
    return { status, stdout, stderr };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

test('compiles and runs using UTF-8 preset input, EOF, stderr, and exit status', async () => {
  const run = await runSnippet(`
package main
import ("fmt"; "io"; "os")
func main() {
    data, err := io.ReadAll(os.Stdin)
    if err != nil { panic(err) }
    fmt.Printf("Hello, %s!\\n", data)
    fmt.Fprintln(os.Stderr, "Done")
    os.Exit(7)
}
`, { stdin: '東京' });
  assert.equal(run.status, 7, run.stderr);
  assert.equal(run.stdout, 'Hello, 東京!\n');
  assert.equal(run.stderr, 'Done\n');
});

test('returns a source diagnostic for invalid Go', async () => {
  const run = await runSnippet('package main\nfunc main() { missing() }\n');
  assert.equal(run.status, 65, run.stderr);
  assert.match(run.stderr, /main\.go:2:\d+: undefined: missing/);
  assert.equal(run.stdout, '');
});

test('cancels a snippet and allows a fresh run', async () => {
  const interrupted = await runSnippet(`
package main
import ("fmt"; "time")
func main() { fmt.Println("Running"); time.Sleep(time.Hour) }
`, { cancel: true });
  assert.equal(interrupted.status, 130, interrupted.stderr);
  assert.match(interrupted.stderr, /Cancelled/);

  const retry = await runSnippet('package main\nimport "fmt"\nfunc main() { fmt.Println("Ready") }');
  assert.equal(retry.status, 0, retry.stderr);
  assert.equal(retry.stdout, 'Ready\n');
});

test('caps combined output', async () => {
  const run = await runSnippet(`
package main
import ("fmt"; "strings")
func main() { fmt.Print(strings.Repeat("x", 100_000)) }
`);
  assert.equal(run.status, 125, run.stderr);
  assert.equal(Buffer.byteLength(run.stdout), 64 * 1024);
  assert.match(run.stderr, /Output limit reached/);
});
