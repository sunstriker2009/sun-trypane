import { mountLocalEditor } from "../local-editor.js";
import type { CompilerLocation } from "../local-editor.js";

function compilerLocations(stderr: string): CompilerLocation[] {
  const locations = new Map<string, CompilerLocation>();
  for (const text of stderr.split(/\r?\n/)) {
    const match = /^\/work\/Program\.cs\((\d+),(\d+)\): (error|warning) (CS\d+):/.exec(text);
    if (!match) continue;
    const [, line, column, severity, code] = match;
    const label = `Line ${line}, column ${column} · ${severity} ${code}`;
    locations.set(label, { line: Number(line), column: Number(column), label });
  }
  return [...locations.values()];
}

mountLocalEditor(compilerLocations);
