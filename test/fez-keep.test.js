import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Window } from "happy-dom";
import { Idiomorph } from "../src/fez/vendor/idiomorph.js";

// Setup happy-dom globals, saving originals to restore later
let window, document;
let savedGlobals = {};

beforeAll(() => {
  savedGlobals = {
    window: global.window,
    document: global.document,
    Document: global.Document,
    Node: global.Node,
    Element: global.Element,
    HTMLElement: global.HTMLElement,
    HTMLHeadElement: global.HTMLHeadElement,
    HTMLInputElement: global.HTMLInputElement,
    HTMLTextAreaElement: global.HTMLTextAreaElement,
    HTMLSelectElement: global.HTMLSelectElement,
    HTMLOptionElement: global.HTMLOptionElement,
    DocumentFragment: global.DocumentFragment,
    MutationObserver: global.MutationObserver,
    customElements: global.customElements,
    queueMicrotask: global.queueMicrotask,
  };

  window = new Window();
  document = window.document;
  global.window = window;
  global.document = document;
  global.Document = window.Document;
  global.Node = window.Node;
  global.Element = window.Element;
  global.HTMLElement = window.HTMLElement;
  global.HTMLHeadElement = window.HTMLHeadElement;
  global.HTMLInputElement = window.HTMLInputElement;
  global.HTMLTextAreaElement = window.HTMLTextAreaElement;
  global.HTMLSelectElement = window.HTMLSelectElement;
  global.HTMLOptionElement = window.HTMLOptionElement;
  global.DocumentFragment = window.DocumentFragment;
  global.MutationObserver = window.MutationObserver;
  global.customElements = window.customElements;
  global.queueMicrotask = (fn) => setTimeout(fn, 0);
});

afterAll(() => {
  Object.entries(savedGlobals).forEach(([key, value]) => {
    if (value !== undefined) {
      global[key] = value;
    }
  });
});

/**
 * Simulates fezKeepNode() - swap matching fez-keep elements from old to new DOM
 */
function fezKeepNode(oldNode, newNode) {
  newNode.querySelectorAll("[fez-keep]").forEach((newEl) => {
    const key = newEl.getAttribute("fez-keep");
    const oldEl = oldNode.querySelector(`[fez-keep="${key}"]`);
    if (oldEl) {
      newEl.parentNode.replaceChild(oldEl, newEl);
    }
  });
}

function fezMorph(container, newContainer) {
  const newNode = newContainer.cloneNode(true);
  fezKeepNode(container, newNode);
  Idiomorph.morph(container, newNode, { morphStyle: "innerHTML" });
}

describe("fez-keep", () => {
  test("same fez-keep value preserves element", () => {
    const container = document.createElement("div");
    container.innerHTML = '<div fez-keep="child-1"><span>Original</span></div>';
    document.body.appendChild(container);

    container.querySelector('[fez-keep="child-1"]')._marker = "original";

    const newContainer = document.createElement("div");
    newContainer.innerHTML =
      '<div fez-keep="child-1"><span>Updated</span></div>';

    fezMorph(container, newContainer);

    const el = container.querySelector('[fez-keep="child-1"]');
    expect(el._marker).toBe("original");
    expect(el.querySelector("span").textContent).toBe("Original");

    container.remove();
  });

  test("different fez-keep value replaces element", () => {
    const container = document.createElement("div");
    container.innerHTML = '<div fez-keep="child-1"><span>Original</span></div>';
    document.body.appendChild(container);

    container.querySelector('[fez-keep="child-1"]')._marker = "original";

    const newContainer = document.createElement("div");
    newContainer.innerHTML = '<div fez-keep="child-2"><span>New</span></div>';

    fezMorph(container, newContainer);

    expect(container.querySelector('[fez-keep="child-1"]')).toBeNull();
    expect(
      container.querySelector('[fez-keep="child-2"]')._marker,
    ).toBeUndefined();

    container.remove();
  });

  test("preserves element when siblings change", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <div class="before">Before</div>
      <div fez-keep="kept">Kept</div>
      <div class="after">After</div>
    `;
    document.body.appendChild(container);

    container.querySelector('[fez-keep="kept"]')._marker = "survived";

    const newContainer = document.createElement("div");
    newContainer.innerHTML = `
      <div class="new-before">New Before</div>
      <div fez-keep="kept">Kept</div>
      <div class="new-after">New After</div>
    `;

    fezMorph(container, newContainer);

    expect(container.querySelector('[fez-keep="kept"]')._marker).toBe(
      "survived",
    );
    expect(container.querySelector(".before")).toBeNull();
    expect(container.querySelector(".new-before")).not.toBeNull();

    container.remove();
  });

  test("multiple fez-keep elements with reorder", () => {
    const container = document.createElement("div");
    container.innerHTML = `
      <div fez-keep="a">A</div>
      <div fez-keep="b">B</div>
      <div fez-keep="c">C</div>
    `;
    document.body.appendChild(container);

    container.querySelector('[fez-keep="a"]')._m = "A";
    container.querySelector('[fez-keep="b"]')._m = "B";
    container.querySelector('[fez-keep="c"]')._m = "C";

    const newContainer = document.createElement("div");
    newContainer.innerHTML = `
      <div fez-keep="c">C</div>
      <div fez-keep="a">A</div>
      <div fez-keep="d">D</div>
    `;

    fezMorph(container, newContainer);

    expect(container.querySelector('[fez-keep="a"]')._m).toBe("A");
    expect(container.querySelector('[fez-keep="c"]')._m).toBe("C");
    expect(container.querySelector('[fez-keep="b"]')).toBeNull();
    expect(container.querySelector('[fez-keep="d"]')._m).toBeUndefined();

    container.remove();
  });

  test("state preserved when fez-keep unchanged", () => {
    const container = document.createElement("div");
    container.innerHTML = '<div fez-keep="child-1" class="child"></div>';
    document.body.appendChild(container);

    container.querySelector(".child")._state = { counter: 42 };

    const same = document.createElement("div");
    same.innerHTML = '<div fez-keep="child-1" class="child"></div>';
    fezMorph(container, same);
    expect(container.querySelector(".child")._state.counter).toBe(42);

    container.remove();
  });

  test("state lost when fez-keep changes", () => {
    const container = document.createElement("div");
    container.innerHTML = '<div fez-keep="child-1" class="child"></div>';
    document.body.appendChild(container);

    container.querySelector(".child")._state = { counter: 42 };

    const diff = document.createElement("div");
    diff.innerHTML = '<div fez-keep="child-2" class="child"></div>';
    fezMorph(container, diff);

    // Old key gone, new element has no state
    expect(container.querySelector('[fez-keep="child-1"]')).toBeNull();
    expect(
      container.querySelector('[fez-keep="child-2"]')._state,
    ).toBeUndefined();

    container.remove();
  });
});

describe("fez-this auto-ID (Idiomorph outerHTML)", () => {
  test("node with same ID is preserved across morph", () => {
    const container = document.createElement("div");
    container.id = "fez-c-42";
    container.innerHTML =
      '<input fez-this="name" id="fez-42-name" /><span>v1</span>';
    document.body.appendChild(container);

    const input = container.querySelector("input");
    input._marker = "original";

    const newContainer = document.createElement("div");
    newContainer.id = "fez-c-42";
    newContainer.innerHTML =
      '<input fez-this="name" id="fez-42-name" /><span>v2</span>';

    Idiomorph.morph(container, newContainer, {
      morphStyle: "outerHTML",
      ignoreActiveValue: true,
    });

    const current = document.querySelector("#fez-42-name");
    expect(current._marker).toBe("original");
    expect(current === input).toBe(true);

    container.remove();
  });

  test("multiple fez-this inputs preserve references", () => {
    const container = document.createElement("div");
    container.id = "fez-c-42";
    container.innerHTML = `
      <input id="fez-42-first" />
      <input id="fez-42-last" />
    `;
    document.body.appendChild(container);

    const first = container.querySelector("#fez-42-first");
    const last = container.querySelector("#fez-42-last");
    first._m = "first";
    last._m = "last";

    const newContainer = document.createElement("div");
    newContainer.id = "fez-c-42";
    newContainer.innerHTML = `
      <input id="fez-42-first" />
      <input id="fez-42-last" />
    `;

    Idiomorph.morph(container, newContainer, {
      morphStyle: "outerHTML",
      ignoreActiveValue: true,
    });

    expect(document.querySelector("#fez-42-first")._m).toBe("first");
    expect(document.querySelector("#fez-42-last")._m).toBe("last");
    expect(document.querySelector("#fez-42-first") === first).toBe(true);
    expect(document.querySelector("#fez-42-last") === last).toBe(true);

    container.remove();
  });
});
