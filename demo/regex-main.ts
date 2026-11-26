import { mountTryPane } from '../src/pane.js';
import { RegexAdapter } from '../src/adapters/regex.js';
import type { RegexInput, RegexMatch, RegexResult } from '../src/adapters/regex.js';

const pattern = document.querySelector<HTMLInputElement>('#pattern');
const input = document.querySelector<HTMLTextAreaElement>('#text');
const mode = document.querySelector<HTMLSelectElement>('#mode');
const target = document.querySelector<HTMLElement>('#try-it');
if (!pattern || !input || !mode || !target) throw new Error('The Regex host is missing its controls.');

const adapter = new RegexAdapter(new URL('../runtime/wwwroot/regex-worker.mjs', import.meta.url));

function renderResult(result: RegexResult, target: HTMLElement, snapshot: RegexInput): void {
  const document = target.ownerDocument;
  if (result.status !== 'match') return;
  const matches = result;
  const count = matches.matches.length;

  const highlighted = document.createElement('p');
  highlighted.className = 'highlighted-input';
  highlighted.setAttribute('aria-label', 'Highlighted input');
  let cursor = 0;
  for (const match of matches.matches) {
    const end = match.index + match.text.length;
    if (match.index < cursor || end > snapshot.text.length || snapshot.text.slice(match.index, end) !== match.text) continue;
    highlighted.append(snapshot.text.slice(cursor, match.index));
    const mark = document.createElement('mark');
    mark.textContent = match.text || '∅';
    if (!match.text) mark.setAttribute('aria-label', `Empty match at index ${match.index}`);
    highlighted.append(mark);
    cursor = end;
  }
  highlighted.append(snapshot.text.slice(cursor));
  target.append(highlighted);

  const picker = document.createElement('select');
  picker.setAttribute('aria-label', 'Inspect match');
  for (const [index, match] of matches.matches.entries()) {
    picker.add(new Option(`Match ${index + 1} · index ${match.index}`, String(index)));
  }
  if (count > 1) target.append(picker);
  const details = document.createElement('pre');
  target.append(details);
  function inspect(match: RegexMatch): void {
    const describe = (value: string | null) => value === null ? 'unmatched' : JSON.stringify(value);
    details.textContent = [
      `Matched ${JSON.stringify(match.text)} at index ${match.index}`,
      ...match.groups.map((value, index) => `Group ${matches.groupNumbers[index]} · ${describe(value)}`),
      ...match.named.map(({ name, value }) => `Name ${name} · ${describe(value)}`),
    ].join('\n');
  }
  picker.addEventListener('change', () => inspect(matches.matches[Number(picker.value)]));
  inspect(matches.matches[0]);
}

let submitted: RegexInput;
mountTryPane(target, {
  adapter,
  readInput() {
    submitted = { pattern: pattern.value, text: input.value, mode: mode.value as RegexInput['mode'] };
    return submitted;
  },
  renderResult(result, target) {
    renderResult(result, target, submitted);
  },
  describeResult(result) {
    if (result.status === 'invalid') return result.message;
    if (result.status === 'no-match') return 'No match.';
    if (result.status === 'timeout') return 'The match timed out. Try shorter text.';
    if (result.status !== 'match') return 'The Regex runner could not complete the test.';
    const count = result.matches.length;
    return result.truncated ? `Showing the first ${count} matches.`
      : `${count} ${count === 1 ? 'match' : 'matches'}.`;
  },
});
