import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Window } from "happy-dom";
import FezBase, { PROPS_ATTR, formatPropsAttr } from "../src/fez/instance.js";

// fez-props: the wrapper attribute that mirrors this.props for the DOM inspector

let window, document;
let savedGlobals = {};

beforeAll(() => {
  savedGlobals = {
    window: global.window,
    document: global.document,
    Node: global.Node,
    DocumentFragment: global.DocumentFragment,
    Fez: global.Fez,
  };
  window = new Window();
  document = window.document;
  global.window = window;
  global.document = document;
  global.Node = window.Node;
  global.DocumentFragment = window.DocumentFragment;
  global.Fez = {
    ...(global.Fez || {}),
    onError: () => {},
    state: { createProxy: () => ({}) },
    globalCss: () => {},
  };
});

afterAll(() => {
  global.window = savedGlobals.window;
  global.document = savedGlobals.document;
  global.Node = savedGlobals.Node;
  global.DocumentFragment = savedGlobals.DocumentFragment;
  global.Fez = savedGlobals.Fez;
});

// minimal mounted component: root + registered state, no template
function mount(props) {
  const K = class extends FezBase {};
  const fez = new K();
  fez.root = document.createElement("div");
  fez.class = K;
  fez.fezName = "ui-test";
  fez.props = props;
  return fez;
}

describe("formatPropsAttr", () => {
  test("primitives print their value, CSS declaration style", () => {
    expect(formatPropsAttr({ count: 3, label: "Hits", open: true })).toBe(
      "count: 3; label: Hits; open: true",
    );
  });

  test("structured values are only typed", () => {
    expect(
      formatPropsAttr({
        user: { id: 1 },
        items: [1, 2, 3],
        on_pick: () => {},
        since: new Date(0),
        none: null,
        missing: undefined,
      }),
    ).toBe("user: {}; items: []; on_pick: ()=>{}; since: {}; none: null; missing: undefined");
  });

  test("long strings are truncated and whitespace collapsed", () => {
    const text = formatPropsAttr({ body: "a\n  b " + "x".repeat(100) });
    expect(text.startsWith("body: a b xxx")).toBe(true);
    expect(text.endsWith("…")).toBe(true);
    expect(text.length).toBeLessThan(80);
  });

  test("empty props give an empty string", () => {
    expect(formatPropsAttr({})).toBe("");
    expect(formatPropsAttr(null)).toBe("");
  });
});

describe("fez-props on the root", () => {
  test("written when props are assigned", () => {
    const fez = mount({ count: 3, label: "Hits" });
    expect(fez.root.getAttribute(PROPS_ATTR)).toBe("count: 3; label: Hits");
  });

  test("updated on this.props.x writes", () => {
    const fez = mount({ count: 3 });
    fez.props.count = 4;
    expect(fez.root.getAttribute(PROPS_ATTR)).toBe("count: 4");
  });

  test("updated on a whole props replacement (keyed refresh)", () => {
    const fez = mount({ count: 3 });
    fez.props = { count: 5, user: { id: 1 } };
    expect(fez.root.getAttribute(PROPS_ATTR)).toBe("count: 5; user: {}");
  });

  test("removed when props become empty", () => {
    const fez = mount({ count: 3 });
    fez.props = {};
    expect(fez.root.hasAttribute(PROPS_ATTR)).toBe(false);
  });

  test("survives a render: the morph never touches root attributes", () => {
    const fez = mount({ count: 3 });
    fez.fezRegister();
    fez.root.innerHTML = "<p>old</p>";
    globalThis.Fez.morphdom = (target, newNode) => {
      target.innerHTML = newNode.innerHTML;
    };
    globalThis.Fez.fnv1 = (s) => s;
    fez.fezRender("<p>new {props.count}</p>");
    expect(fez.root.innerHTML).toBe("<p>new 3</p>");
    expect(fez.root.getAttribute(PROPS_ATTR)).toBe("count: 3");
  });

  test("no root: nothing happens", () => {
    const K = class extends FezBase {};
    const fez = new K();
    expect(() => (fez.props = { a: 1 })).not.toThrow();
  });
});
