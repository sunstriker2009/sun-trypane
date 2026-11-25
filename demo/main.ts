import { mountTryPane } from "../src/pane.js";
import { fakeRunner } from "./fake-runner.js";

const input = document.querySelector<HTMLTextAreaElement>("#sample");
const fail = document.querySelector<HTMLInputElement>("#fail");
const target = document.querySelector<HTMLElement>("#try-it");

if (!input || !fail || !target) throw new Error("The demo host is missing its controls.");

mountTryPane(target, {
  adapter: fakeRunner,
  readInput: () => ({ text: input.value, fail: fail.checked }),
  renderResult(result, target) {
    const heading = document.createElement("h2");
    heading.textContent = "Result";
    const count = document.createElement("p");
    count.textContent = `Characters: ${result.characterCount}`;
    const text = document.createElement("pre");
    text.textContent = result.text;
    target.append(heading, count, text);
  },
});
