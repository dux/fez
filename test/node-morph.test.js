import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Window } from "happy-dom";

// Use the Fez instance loaded by test/setup.js. Only override `document`
// so Fez's runtime resolves a real DOM at call time. Do NOT replace
// `global.window` - other test files read `globalThis.window.Fez` from setup.js.
let document;
let Fez;
let originalDocument;

beforeAll(() => {
  originalDocument = global.document;
  const happyWindow = new Window();
  document = happyWindow.document;
  global.document = document;
  // Use globalThis.window.Fez - some tests clobber globalThis.Fez directly,
  // but globalThis.window.Fez is the canonical reference set by setup.js.
  Fez = globalThis.window.Fez;
});

afterAll(() => {
  global.document = originalDocument;
});

function makeTarget(tag, html) {
  const el = document.createElement(tag);
  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

describe("Fez.nodeMorph - HTML string input", () => {
  test("morphs children when src has matching root tag", () => {
    const target = makeTarget("ul", "<li>a</li><li>b</li>");
    Fez.nodeMorph(target, "<ul><li>x</li><li>y</li></ul>");
    expect(target.innerHTML).toBe("<li>x</li><li>y</li>");
    target.remove();
  });

  test("treats src as children when root tag does not match", () => {
    const target = makeTarget("ul", "<li>a</li>");
    Fez.nodeMorph(target, "<li>x</li><li>y</li>");
    expect(target.innerHTML).toBe("<li>x</li><li>y</li>");
    target.remove();
  });

  test("preserves child element identity across morph", () => {
    const target = makeTarget("ul", "<li>a</li><li>b</li>");
    const liA = target.children[0];
    liA._marker = "A";
    Fez.nodeMorph(target, "<li>A-new</li><li>B-new</li>");
    expect(target.children[0]._marker).toBe("A");
    expect(target.children[0].textContent).toBe("A-new");
    target.remove();
  });

  test("does not touch target's own attributes", () => {
    const target = makeTarget("div", "<p>hi</p>");
    target.setAttribute("data-keep", "yes");
    target.className = "outer";
    Fez.nodeMorph(target, "<p>bye</p>");
    expect(target.getAttribute("data-keep")).toBe("yes");
    expect(target.className).toBe("outer");
    expect(target.innerHTML).toBe("<p>bye</p>");
    target.remove();
  });

  test("fez-keep works through public API", () => {
    const target = makeTarget(
      "div",
      '<div fez-keep="k">orig</div><span>tail</span>',
    );
    target.querySelector("[fez-keep]")._marker = "kept";
    Fez.nodeMorph(target, '<span>new-tail</span><div fez-keep="k">new</div>');
    const kept = target.querySelector("[fez-keep]");
    expect(kept._marker).toBe("kept");
    expect(kept.textContent).toBe("orig");
    target.remove();
  });
});

describe("Fez.nodeMorph - Element input", () => {
  test("uses element directly when tag matches", () => {
    const target = makeTarget("ul", "<li>a</li>");
    const src = document.createElement("ul");
    src.innerHTML = "<li>x</li><li>y</li>";
    Fez.nodeMorph(target, src);
    expect(target.innerHTML).toBe("<li>x</li><li>y</li>");
    target.remove();
  });

  test("wraps element when tag does not match", () => {
    const target = makeTarget("ul", "<li>a</li>");
    const src = document.createElement("li");
    src.textContent = "only";
    Fez.nodeMorph(target, src);
    expect(target.innerHTML).toBe("<li>only</li>");
    target.remove();
  });
});

describe("Fez.nodeMorph - DocumentFragment input", () => {
  test("treats fragment children as new children of target", () => {
    const target = makeTarget("ul", "<li>a</li>");
    const frag = document.createDocumentFragment();
    const li1 = document.createElement("li");
    li1.textContent = "x";
    const li2 = document.createElement("li");
    li2.textContent = "y";
    frag.appendChild(li1);
    frag.appendChild(li2);
    Fez.nodeMorph(target, frag);
    expect(target.innerHTML).toBe("<li>x</li><li>y</li>");
    target.remove();
  });
});

describe("Fez.nodeMorph - validation", () => {
  test("errors on non-Element target", () => {
    let captured = null;
    const orig = Fez.onError;
    Fez.onError = (kind, msg) => {
      captured = { kind, msg };
    };
    Fez.nodeMorph(null, "<p>x</p>");
    Fez.onError = orig;
    expect(captured?.kind).toBe("nodeMorph");
  });

  test("errors on invalid src type", () => {
    const target = makeTarget("div", "");
    let captured = null;
    const orig = Fez.onError;
    Fez.onError = (kind, msg) => {
      captured = { kind, msg };
    };
    Fez.nodeMorph(target, 42);
    Fez.onError = orig;
    expect(captured?.kind).toBe("nodeMorph");
    target.remove();
  });
});
