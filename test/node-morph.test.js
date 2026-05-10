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

  test("unwraps matching root with surrounding whitespace", () => {
    const target = makeTarget("ul", "<li>a</li>");
    Fez.nodeMorph(target, "\n  <ul><li>x</li></ul>\n");
    expect(target.innerHTML).toBe("<li>x</li>");
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

describe("Fez.nodeMorph - sibling fez components", () => {
  test("preserves all sibling fez components in a loop (regression)", () => {
    // Register a fake fez component tag so fezDescribeNew recognizes it.
    Fez.index.ensure("test-img");

    const target = makeTarget("div", "");

    // Three mounted siblings, each with unique UID + auto-injected key.
    for (let i = 0; i < 3; i++) {
      const el = document.createElement("test-img");
      el.classList.add("fez", "fez-test-img");
      el.setAttribute("key", `0-0-${i}`);
      el.setAttribute("src", `img-${i}.jpg`);
      el.fez = { UID: 1000 + i, _destroyed: false, props: {}, onRefresh: () => {} };
      el._marker = `M${i}`;
      target.appendChild(el);
    }

    // New template renders the same three siblings (different src).
    Fez.nodeMorph(
      target,
      '<test-img class="fez-test-img" key="0-0-0" src="new-0.jpg"></test-img>' +
        '<test-img class="fez-test-img" key="0-0-1" src="new-1.jpg"></test-img>' +
        '<test-img class="fez-test-img" key="0-0-2" src="new-2.jpg"></test-img>',
    );

    expect(target.children.length).toBe(3);
    expect(target.children[0]._marker).toBe("M0");
    expect(target.children[1]._marker).toBe("M1");
    expect(target.children[2]._marker).toBe("M2");

    target.remove();
  });
});

describe("Fez.nodeMorph - unkeyed sibling fez components", () => {
  test("pjax-style: 1 mounted + N new siblings without key=", () => {
    // Pjax payload renders raw <my-comp> tags with no key=. Without the
    // duplicate-claim guard in Pass 1a, all N new placeholders collapse onto
    // the single old mounted instance and the rest get inserted but the user
    // observes "only one element present" because old is matched + preserved
    // and new ones never get to claim it.
    Fez.index.ensure("test-card");

    const target = makeTarget("div", "");
    const old = document.createElement("test-card");
    old.classList.add("fez", "fez-test-card");
    old.setAttribute("ref", "old-ref");
    old.fez = { UID: 9000, _destroyed: false, props: {}, onRefresh: () => {} };
    old._marker = "OLD";
    target.appendChild(old);

    const html = Array.from({ length: 5 }, (_, i) =>
      `<test-card ref="r-${i}"></test-card>`,
    ).join("");
    Fez.nodeMorph(target, html);

    expect(target.children.length).toBe(5);
    target.remove();
  });

  test("preserves repeated old siblings through shared class alias", () => {
    Fez.index.ensure("test-card-alias");

    const target = makeTarget("div", "");
    for (let i = 0; i < 3; i++) {
      const old = document.createElement("test-card-alias");
      old.classList.add("fez", "fez-test-card-alias");
      old.fez = { UID: 9100 + i, _destroyed: false, props: {}, onRefresh: () => {} };
      old._marker = `OLD-${i}`;
      target.appendChild(old);
    }

    Fez.nodeMorph(
      target,
      "<test-card-alias></test-card-alias>" +
        "<test-card-alias></test-card-alias>" +
        "<test-card-alias></test-card-alias>",
    );

    expect(target.children[0]._marker).toBe("OLD-0");
    expect(target.children[1]._marker).toBe("OLD-1");
    expect(target.children[2]._marker).toBe("OLD-2");
    target.remove();
  });

  test("does not preserve unkeyed component when slot content changes", () => {
    Fez.index.ensure("test-slot-card");

    const target = makeTarget("div", "");
    const old = document.createElement("test-slot-card");
    old.classList.add("fez", "fez-test-slot-card");
    old._marker = "OLD";

    let destroyed = false;
    old.fez = {
      UID: 9300,
      _destroyed: false,
      _fezSlotSignature: "<span>Old</span>",
      props: {},
      onRefresh: () => {},
      fezOnDestroy: () => {
        destroyed = true;
        old.fez._destroyed = true;
      },
    };
    old._fezSlotSignature = "<span>Old</span>";
    target.appendChild(old);

    Fez.nodeMorph(target, "<test-slot-card><span>New</span></test-slot-card>");

    expect(target.children.length).toBe(1);
    expect(target.firstElementChild).not.toBe(old);
    expect(target.firstElementChild.textContent).toBe("New");
    expect(destroyed).toBe(true);
    target.remove();
  });

  test("preserves unkeyed component when slot content is unchanged", () => {
    Fez.index.ensure("test-slot-card-same");

    const target = makeTarget("div", "");
    const old = document.createElement("test-slot-card-same");
    old.classList.add("fez", "fez-test-slot-card-same");
    old._marker = "OLD";
    old.fez = {
      UID: 9301,
      _destroyed: false,
      _fezSlotSignature: "<span>Same</span>",
      props: {},
      onRefresh: () => {},
    };
    old._fezSlotSignature = "<span>Same</span>";
    target.appendChild(old);

    Fez.nodeMorph(
      target,
      "<test-slot-card-same><span>Same</span></test-slot-card-same>",
    );

    expect(target.children.length).toBe(1);
    expect(target.firstElementChild).toBe(old);
    expect(target.firstElementChild._marker).toBe("OLD");
    target.remove();
  });

  test("keyed component identity overrides slot content signature", () => {
    Fez.index.ensure("test-slot-card-keyed");

    const target = makeTarget("div", "");
    const old = document.createElement("test-slot-card-keyed");
    old.classList.add("fez", "fez-test-slot-card-keyed");
    old.setAttribute("key", "stable");
    old._marker = "OLD";
    old.fez = {
      UID: 9302,
      _destroyed: false,
      _fezSlotSignature: "<span>Old</span>",
      props: {},
      onRefresh: () => {},
    };
    old._fezSlotSignature = "<span>Old</span>";
    target.appendChild(old);

    Fez.nodeMorph(
      target,
      '<test-slot-card-keyed key="stable"><span>New</span></test-slot-card-keyed>',
    );

    expect(target.children.length).toBe(1);
    expect(target.firstElementChild).toBe(old);
    expect(target.firstElementChild._marker).toBe("OLD");
    target.remove();
  });
});

describe("Fez.morphdom - preserved component props", () => {
  test("preserved keyed component receives next props", () => {
    Fez.index.ensure("test-preserved-child");

    const target = makeTarget("div", "");
    const old = document.createElement("test-preserved-child");
    old.classList.add("fez", "fez-test-preserved-child");
    old.setAttribute("key", "0");

    const changes = [];
    old.fez = {
      UID: 9200,
      _destroyed: false,
      props: { value: "a", removed: "yes" },
      class: {
        getProps(node) {
          const props = {};
          for (const attr of node.attributes) props[attr.name] = attr.value;
          return props;
        },
      },
      onPropsChange: (name, value) => changes.push([name, value]),
      onRefresh: (props) => {
        old._refreshProps = props;
      },
      refresh: () => {
        old._refreshCalled = true;
      },
    };
    target.appendChild(old);

    Fez.nodeMorph(
      target,
      '<test-preserved-child key="0" value="b"></test-preserved-child>',
    );

    expect(target.firstElementChild).toBe(old);
    expect(old.fez.props.value).toBe("b");
    expect(old.fez.props.removed).toBeUndefined();
    expect(old._refreshCalled).toBe(true);
    expect(old._refreshProps.value).toBe("b");
    expect(changes).toContainEqual(["value", "b"]);
    expect(changes).toContainEqual(["removed", null]);
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
