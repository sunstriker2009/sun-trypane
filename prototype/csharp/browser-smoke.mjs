import { checkLocalEditor } from '../local-editor-smoke.mjs';

await checkLocalEditor({
  serve: './csharp/serve.mjs',
  sourceLabel: 'C# source',
  invalidSource: '// C# snippet\nConsole.WriteLine(MissingValue);',
  invalidToken: 'MissingValue',
  diagnostic: /error CS0103/,
  diagnosticButton: 'Line 2, column 19 · error CS0103',
  loop: 'Console.WriteLine(Console.ReadLine()); while (true) { Thread.Sleep(50); }',
  readInput: 'Console.WriteLine(Console.ReadLine() + " / " + Console.ReadLine()); Console.WriteLine(Console.ReadLine() is null ? "EOF" : "Unexpected input");',
});
