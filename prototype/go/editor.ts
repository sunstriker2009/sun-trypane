import { mountLocalEditor } from "../local-editor.js";
import type { CompilerLocation } from "../local-editor.js";

function compilerLocations(stderr: string, source: string): CompilerLocation[] {
  const lines = source.split("\n");
  const locations = new Map<string, CompilerLocation>();
  const encoder = new TextEncoder();
  for (const text of stderr.split(/\r?\n/)) {
    const match = /^(?:\.\/)?main\.go:(\d+):(\d+): (.+)$/.exec(text);
    if (!match) continue;
    const [, line, byteColumn, message] = match;
    const sourceLine = lines[Number(line) - 1];
    if (sourceLine === undefined) continue;

    // Go reports UTF-8 byte columns. Textarea offsets use UTF-16 code units.
    let bytes = Number(byteColumn) - 1;
    let column = 1;
    for (const character of sourceLine) {
      if (bytes <= 0) break;
      bytes -= encoder.encode(character).length;
      column += character.length;
    }
    if (bytes !== 0) continue;
    const label = `Line ${line}, column ${column} · ${message}`;
    locations.set(label, { line: Number(line), column, label });
  }
  return [...locations.values()];
}

mountLocalEditor(compilerLocations);
