import { runSnippetCli } from '../container-runner.mjs';

await runSnippetCli({
  language: 'csharp',
  sourceLabel: 'C# source',
  usage: 'Usage: node prototype/csharp/run.mjs PATH_TO_CS_FILE [STDIN_FILE]',
  image: 'trypane-csharp-prototype:local-v2',
  timeoutMs: 30_000,
  mounts: [
    '/work:rw,nosuid,nodev,noexec,size=64m,mode=1777',
    '/tmp:rw,nosuid,nodev,noexec,size=32m,mode=1777',
  ],
});
