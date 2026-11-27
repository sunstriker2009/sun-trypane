import { runSnippetCli } from '../container-runner.mjs';

await runSnippetCli({
  language: 'go',
  sourceLabel: 'Go source',
  usage: 'Usage: node prototype/go/run.mjs PATH_TO_GO_FILE [STDIN_FILE]',
  image: 'trypane-go-prototype:local-v1',
  timeoutMs: 45_000,
  mounts: [
    '/work:rw,nosuid,nodev,noexec,size=192m,mode=1777',
    '/tmp:rw,nosuid,nodev,noexec,size=32m,mode=1777',
    '/snippet:rw,nosuid,nodev,exec,size=32m,mode=1777',
  ],
});
