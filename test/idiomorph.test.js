/**
 * Tests for fez-morph functions previously tested via vendored Idiomorph.
 * These test the syncClassList and ignoreActiveValue behaviors that were
 * patched in the old Idiomorph and are now built into morph.js natively.
 */
import { describe, test, expect, beforeAll } from "bun:test";
import { Window } from "happy-dom";
import { syncClassList, isFormInput, fezMorph } from "../src/fez/lib/morph.js";

// Setup happy-dom globals
let document;

beforeAll(() => {
  const window = new Window();
  document = window.document;
  global.document = document;
});

describe("syncClassList", () => {
  test("adds new class", () => {
    const target = document.createElement("div");
    const source = document.createElement("div");
    target.className = "box";
    source.className = "box active";

    syncClassList(target, source);

    expect(target.classList.contains("box")).toBe(true);
    expect(target.classList.contains("active")).toBe(true);
  });

  test("removes class", () => {
    const target = document.createElement("div");
    const source = document.createElement("div");
    target.className = "box active";
    source.className = "box";

    syncClassList(target, source);

    expect(target.classList.contains("box")).toBe(true);
    expect(target.classList.contains("active")).toBe(false);
  });

  test("handles multiple changes", () => {
    const target = document.createElement("div");
    const source = document.createElement("div");
    target.className = "a b c";
    source.className = "b d e";

    syncClassList(target, source);

    expect(target.classList.contains("a")).toBe(false); // removed
    expect(target.classList.contains("b")).toBe(true); // kept
    expect(target.classList.contains("c")).toBe(false); // removed
    expect(target.classList.contains("d")).toBe(true); // added
    expect(target.classList.contains("e")).toBe(true); // added
  });

  test("uses classList.add instead of setAttribute", () => {
    const target = document.createElement("div");
    const source = document.createElement("div");
    target.className = "box";
    source.className = "box active";

    let addCalled = false;
    const originalAdd = target.classList.add.bind(target.classList);
    target.classList.add = (...args) => {
      addCalled = true;
      return originalAdd(...args);
    };

    syncClassList(target, source);

    expect(addCalled).toBe(true);
  });

  test("uses classList.remove instead of setAttribute", () => {
    const target = document.createElement("div");
    const source = document.createElement("div");
    target.className = "box active";
    source.className = "box";

    let removeCalled = false;
    const originalRemove = target.classList.remove.bind(target.classList);
    target.classList.remove = (...args) => {
      removeCalled = true;
      return originalRemove(...args);
    };

    syncClassList(target, source);

    expect(removeCalled).toBe(true);
  });

  test("handles empty class", () => {
    const target = document.createElement("div");
    const source = document.createElement("div");
    target.className = "active";
    source.className = "";

    syncClassList(target, source);

    expect(target.classList.contains("active")).toBe(false);
  });

  test("handles extra whitespace", () => {
    const target = document.createElement("div");
    const source = document.createElement("div");
    target.className = "box";
    source.className = "  box   active  ";

    syncClassList(target, source);

    expect(target.classList.contains("box")).toBe(true);
    expect(target.classList.contains("active")).toBe(true);
  });
});

describe("ignoreValueOfActiveElement (via fezMorph)", () => {
  test("skips value update on focused INPUT", () => {
    const container = document.createElement("div");
    container.innerHTML = '<input value="old" />';
    document.body.appendChild(container);

    const input = container.querySelector("input");
    input.focus();

    const newNode = document.createElement("div");
    newNode.innerHTML = '<input value="new" />';

    fezMorph(container, newNode);

    expect(container.querySelector("input").getAttribute("value")).toBe("old");

    container.remove();
  });

  test("skips value update on focused TEXTAREA", () => {
    const container = document.createElement("div");
    container.innerHTML = "<textarea>old</textarea>";
    document.body.appendChild(container);

    const textarea = container.querySelector("textarea");
    textarea.setAttribute("value", "old");
    textarea.focus();

    const newNode = document.createElement("div");
    newNode.innerHTML = "<textarea>new</textarea>";
    newNode.querySelector("textarea").setAttribute("value", "new");

    fezMorph(container, newNode);

    // Value attribute should be preserved on focused textarea
    expect(container.querySelector("textarea").getAttribute("value")).toBe(
      "old",
    );

    container.remove();
  });

  test("updates value on non-focused input", () => {
    const container = document.createElement("div");
    container.innerHTML = '<input value="old" />';
    document.body.appendChild(container);

    const newNode = document.createElement("div");
    newNode.innerHTML = '<input value="new" />';

    fezMorph(container, newNode);

    expect(container.querySelector("input").getAttribute("value")).toBe("new");

    container.remove();
  });

  test("does NOT skip morph for focused DIV with tabindex (non-form element)", () => {
    const container = document.createElement("div");
    container.innerHTML = '<div tabindex="-1" class="old">Old</div>';
    document.body.appendChild(container);

    const div = container.querySelector("div");
    div.focus();

    const newNode = document.createElement("div");
    newNode.innerHTML = '<div tabindex="-1" class="new">New</div>';

    fezMorph(container, newNode);

    // DIV should be morphed normally (not a form input)
    expect(container.querySelector("div").className).toBe("new");
    expect(container.querySelector("div").textContent).toBe("New");

    container.remove();
  });
});

describe("isFormInput", () => {
  test("INPUT is form input", () => {
    expect(isFormInput(document.createElement("input"))).toBe(true);
  });

  test("TEXTAREA is form input", () => {
    expect(isFormInput(document.createElement("textarea"))).toBe(true);
  });

  test("SELECT is form input", () => {
    expect(isFormInput(document.createElement("select"))).toBe(true);
  });

  test("DIV is not form input", () => {
    expect(isFormInput(document.createElement("div"))).toBe(false);
  });

  test("BUTTON is not form input", () => {
    expect(isFormInput(document.createElement("button"))).toBe(false);
  });
});
