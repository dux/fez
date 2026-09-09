import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Window } from "happy-dom";
import FezBase from "../src/fez/instance.js";

// fezSaveInputValues / fezRestoreInputValues: what a user typed into a
// fez:this input survives the morph, but a value the template itself changed
// (value={state.value}) must not be rolled back to the previous render.

let savedGlobals = {};

beforeAll(() => {
  savedGlobals = { window: global.window, document: global.document };
  const window = new Window();
  global.window = window;
  global.document = window.document;
});

afterAll(() => {
  global.window = savedGlobals.window;
  global.document = savedGlobals.document;
});

function mount(html) {
  const fez = new FezBase();
  fez.root = document.createElement("div");
  fez.root.innerHTML = html;
  for (const el of fez.root.querySelectorAll("[data-ref]")) {
    el._fezThisName = el.getAttribute("data-ref");
  }
  return fez;
}

// what the differ does to a non-focused input: attribute and property follow the template
function morphValue(el, value) {
  el.setAttribute("value", value);
  el.value = value;
}

describe("input values across a render", () => {
  test("a typed value is restored when the template value is unchanged", () => {
    const fez = mount('<input data-ref="name" value="">');
    const input = fez.root.querySelector("input");
    input.value = "typed";
    const saved = fez.fezSaveInputValues();
    morphValue(input, "");
    fez.fezRestoreInputValues(saved);
    expect(input.value).toBe("typed");
  });

  test("a value the template changed wins over the previous live value", () => {
    const fez = mount('<input data-ref="toggle" type="hidden" value="0">');
    const input = fez.root.querySelector("input");
    const saved = fez.fezSaveInputValues();
    morphValue(input, "1");
    fez.fezRestoreInputValues(saved);
    expect(input.value).toBe("1");
  });

  test("checked follows the same rule", () => {
    const fez = mount('<input data-ref="flag" type="checkbox">');
    const input = fez.root.querySelector("input");
    input.checked = true; // user clicked
    let saved = fez.fezSaveInputValues();
    input.checked = false; // differ synced the unchecked template
    fez.fezRestoreInputValues(saved);
    expect(input.checked).toBe(true);

    input.checked = false; // user unchecked it again
    saved = fez.fezSaveInputValues();
    input.setAttribute("checked", "checked"); // template now renders it checked
    input.defaultChecked = true;
    input.checked = true;
    fez.fezRestoreInputValues(saved);
    expect(input.checked).toBe(true); // template wins, the stale false is not restored
  });
});
