import { describe, test, expect, beforeAll } from "bun:test";
import { Window } from "happy-dom";
import { fezMorph, syncClassList, isFormInput } from "../src/fez/morph.js";

let document;

beforeAll(() => {
  const window = new Window();
  document = window.document;
  global.document = document;
});

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function morph(oldHtml, newHtml, opts = {}) {
  const container = document.createElement("div");
  container.innerHTML = oldHtml;
  document.body.appendChild(container);

  const newNode = document.createElement("div");
  newNode.innerHTML = newHtml;

  fezMorph(container, newNode, opts);

  const result = container.innerHTML;
  container.remove();
  return result;
}

function morphEl(oldHtml, newHtml, opts = {}) {
  const container = document.createElement("div");
  container.innerHTML = oldHtml;
  document.body.appendChild(container);

  const newNode = document.createElement("div");
  newNode.innerHTML = newHtml;

  fezMorph(container, newNode, opts);
  return container;
}

// ---------------------------------------------------------------------------
// syncClassList
// ---------------------------------------------------------------------------

describe("syncClassList", () => {
  test("adds new class", () => {
    const from = document.createElement("div");
    const to = document.createElement("div");
    from.className = "box active";
    to.className = "box";

    // syncClassList syncs `from` classes onto `to`
    // but actually our API: syncClassList(oldNode, newNode) syncs newNode's classes onto oldNode
    // Let me re-read the function...
    // Actually syncClassList(oldNode, newNode) makes oldNode match newNode
    syncClassList(to, from);

    expect(to.classList.contains("box")).toBe(true);
    expect(to.classList.contains("active")).toBe(true);
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

// ---------------------------------------------------------------------------
// isFormInput
// ---------------------------------------------------------------------------

describe("isFormInput", () => {
  test("returns true for INPUT", () => {
    expect(isFormInput(document.createElement("input"))).toBe(true);
  });

  test("returns true for TEXTAREA", () => {
    expect(isFormInput(document.createElement("textarea"))).toBe(true);
  });

  test("returns true for SELECT", () => {
    expect(isFormInput(document.createElement("select"))).toBe(true);
  });

  test("returns false for DIV", () => {
    expect(isFormInput(document.createElement("div"))).toBe(false);
  });

  test("returns false for BUTTON", () => {
    expect(isFormInput(document.createElement("button"))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Basic morphing
// ---------------------------------------------------------------------------

describe("fezMorph basics", () => {
  test("updates text content", () => {
    expect(morph("<p>old</p>", "<p>new</p>")).toBe("<p>new</p>");
  });

  test("adds new element", () => {
    expect(morph("<p>keep</p>", "<p>keep</p><span>added</span>")).toBe(
      "<p>keep</p><span>added</span>",
    );
  });

  test("removes element", () => {
    expect(morph("<p>keep</p><span>gone</span>", "<p>keep</p>")).toBe(
      "<p>keep</p>",
    );
  });

  test("replaces element with different tag", () => {
    expect(morph("<p>old</p>", "<span>new</span>")).toBe("<span>new</span>");
  });

  test("updates attributes", () => {
    expect(morph('<div class="a"></div>', '<div class="b"></div>')).toBe(
      '<div class="b"></div>',
    );
  });

  test("adds attribute", () => {
    expect(morph("<div></div>", '<div title="hi"></div>')).toBe(
      '<div title="hi"></div>',
    );
  });

  test("removes attribute", () => {
    expect(morph('<div title="hi"></div>', "<div></div>")).toBe("<div></div>");
  });

  test("handles empty old tree", () => {
    expect(morph("", "<p>new</p>")).toBe("<p>new</p>");
  });

  test("handles empty new tree", () => {
    expect(morph("<p>old</p>", "")).toBe("");
  });

  test("handles multiple children", () => {
    const result = morph(
      "<p>1</p><p>2</p><p>3</p>",
      "<p>a</p><p>b</p><p>c</p>",
    );
    expect(result).toBe("<p>a</p><p>b</p><p>c</p>");
  });

  test("preserves element identity when tag matches", () => {
    const container = document.createElement("div");
    container.innerHTML = '<p class="x">old</p>';
    document.body.appendChild(container);

    const p = container.querySelector("p");
    p._marker = "original";

    const newNode = document.createElement("div");
    newNode.innerHTML = '<p class="y">new</p>';

    fezMorph(container, newNode);

    const current = container.querySelector("p");
    expect(current._marker).toBe("original"); // same element, morphed in place
    expect(current.textContent).toBe("new");
    expect(current.className).toBe("y");

    container.remove();
  });
});

// ---------------------------------------------------------------------------
// Attribute sync
// ---------------------------------------------------------------------------

describe("attribute sync", () => {
  test("preserves root element attributes (root is component wrapper)", () => {
    const container = document.createElement("div");
    container.setAttribute("class", "fez fez-my-comp go123");
    container.setAttribute("data-x", "1");
    document.body.appendChild(container);

    const newNode = document.createElement("div");
    // Template newNode has no class - root classes should be preserved
    newNode.setAttribute("data-y", "2");

    fezMorph(container, newNode);

    // Root attributes are NOT synced - they belong to Fez, not the template
    expect(container.getAttribute("class")).toBe("fez fez-my-comp go123");
    expect(container.getAttribute("data-x")).toBe("1");

    container.remove();
  });

  test("skips value on focused input", () => {
    const container = document.createElement("div");
    container.innerHTML = '<input value="old" />';
    document.body.appendChild(container);

    const input = container.querySelector("input");
    input.focus(); // make it active element

    const newNode = document.createElement("div");
    newNode.innerHTML = '<input value="new" />';

    fezMorph(container, newNode);

    // Value should NOT be updated because input is focused
    const current = container.querySelector("input");
    expect(current.getAttribute("value")).toBe("old");

    container.remove();
  });

  test("updates value on non-focused input", () => {
    const container = document.createElement("div");
    container.innerHTML = '<input value="old" />';
    document.body.appendChild(container);

    // Don't focus - leave body as active element

    const newNode = document.createElement("div");
    newNode.innerHTML = '<input value="new" />';

    fezMorph(container, newNode);

    const current = container.querySelector("input");
    expect(current.getAttribute("value")).toBe("new");

    container.remove();
  });

  test("class sync uses classList (animation-safe)", () => {
    const container = document.createElement("div");
    container.innerHTML = '<div class="a b"></div>';
    document.body.appendChild(container);

    const el = container.querySelector("div");
    let addCalled = false;
    const origAdd = el.classList.add.bind(el.classList);
    el.classList.add = (...args) => {
      addCalled = true;
      return origAdd(...args);
    };

    const newNode = document.createElement("div");
    newNode.innerHTML = '<div class="a b c"></div>';

    fezMorph(container, newNode);

    expect(addCalled).toBe(true);
    expect(el.classList.contains("c")).toBe(true);

    container.remove();
  });
});

// ---------------------------------------------------------------------------
// fez-keep
// ---------------------------------------------------------------------------

describe("fez-keep", () => {
  test("same fez-keep value preserves element", () => {
    const container = document.createElement("div");
    container.innerHTML = '<div fez-keep="child-1"><span>Original</span></div>';
    document.body.appendChild(container);

    container.querySelector('[fez-keep="child-1"]')._marker = "original";

    const newNode = document.createElement("div");
    newNode.innerHTML = '<div fez-keep="child-1"><span>Updated</span></div>';

    fezMorph(container, newNode);

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

    const newNode = document.createElement("div");
    newNode.innerHTML = '<div fez-keep="child-2"><span>New</span></div>';

    fezMorph(container, newNode);

    expect(container.querySelector('[fez-keep="child-1"]')).toBeNull();
    expect(
      container.querySelector('[fez-keep="child-2"]')._marker,
    ).toBeUndefined();

    container.remove();
  });

  test("preserves element when siblings change", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<div class="before">Before</div><div fez-keep="kept">Kept</div><div class="after">After</div>';
    document.body.appendChild(container);

    container.querySelector('[fez-keep="kept"]')._marker = "survived";

    const newNode = document.createElement("div");
    newNode.innerHTML =
      '<div class="new-before">New Before</div><div fez-keep="kept">Kept</div><div class="new-after">New After</div>';

    fezMorph(container, newNode);

    expect(container.querySelector('[fez-keep="kept"]')._marker).toBe(
      "survived",
    );
    expect(container.querySelector(".before")).toBeNull();
    expect(container.querySelector(".new-before")).not.toBeNull();

    container.remove();
  });

  test("multiple fez-keep elements with reorder", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<div fez-keep="a">A</div><div fez-keep="b">B</div><div fez-keep="c">C</div>';
    document.body.appendChild(container);

    container.querySelector('[fez-keep="a"]')._m = "A";
    container.querySelector('[fez-keep="b"]')._m = "B";
    container.querySelector('[fez-keep="c"]')._m = "C";

    const newNode = document.createElement("div");
    newNode.innerHTML =
      '<div fez-keep="c">C</div><div fez-keep="a">A</div><div fez-keep="d">D</div>';

    fezMorph(container, newNode);

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

    const newNode = document.createElement("div");
    newNode.innerHTML = '<div fez-keep="child-1" class="child"></div>';

    fezMorph(container, newNode);

    expect(container.querySelector(".child")._state.counter).toBe(42);

    container.remove();
  });

  test("state lost when fez-keep changes", () => {
    const container = document.createElement("div");
    container.innerHTML = '<div fez-keep="child-1" class="child"></div>';
    document.body.appendChild(container);

    container.querySelector(".child")._state = { counter: 42 };

    const newNode = document.createElement("div");
    newNode.innerHTML = '<div fez-keep="child-2" class="child"></div>';

    fezMorph(container, newNode);

    expect(container.querySelector('[fez-keep="child-1"]')).toBeNull();
    expect(
      container.querySelector('[fez-keep="child-2"]')._state,
    ).toBeUndefined();

    container.remove();
  });
});

// ---------------------------------------------------------------------------
// ID-based matching (fez-this auto-ID)
// ---------------------------------------------------------------------------

describe("id-based preservation", () => {
  test("node with same ID is preserved across morph", () => {
    const container = document.createElement("div");
    container.id = "fez-c-42";
    container.innerHTML = '<input id="fez-42-name" /><span>v1</span>';
    document.body.appendChild(container);

    const input = container.querySelector("input");
    input._marker = "original";

    const newNode = document.createElement("div");
    newNode.id = "fez-c-42";
    newNode.innerHTML = '<input id="fez-42-name" /><span>v2</span>';

    fezMorph(container, newNode);

    const current = container.querySelector("#fez-42-name");
    expect(current._marker).toBe("original");
    expect(current === input).toBe(true);

    container.remove();
  });

  test("multiple id-matched inputs preserve references", () => {
    const container = document.createElement("div");
    container.id = "fez-c-42";
    container.innerHTML =
      '<input id="fez-42-first" /><input id="fez-42-last" />';
    document.body.appendChild(container);

    const first = container.querySelector("#fez-42-first");
    const last = container.querySelector("#fez-42-last");
    first._m = "first";
    last._m = "last";

    const newNode = document.createElement("div");
    newNode.id = "fez-c-42";
    newNode.innerHTML = '<input id="fez-42-first" /><input id="fez-42-last" />';

    fezMorph(container, newNode);

    expect(container.querySelector("#fez-42-first")._m).toBe("first");
    expect(container.querySelector("#fez-42-last")._m).toBe("last");
    expect(container.querySelector("#fez-42-first") === first).toBe(true);
    expect(container.querySelector("#fez-42-last") === last).toBe(true);

    container.remove();
  });
});

// ---------------------------------------------------------------------------
// Fez component preservation (skipNode)
// ---------------------------------------------------------------------------

describe("fez component preservation", () => {
  test("skipNode prevents morphing of child components", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<div class="fez fez-my-comp"><span>Original</span></div>';
    document.body.appendChild(container);

    const comp = container.querySelector(".fez");
    comp.fez = { UID: 1, _destroyed: false };
    comp._marker = "preserved";

    const newNode = document.createElement("div");
    newNode.innerHTML =
      '<div class="fez fez-my-comp"><span>Changed</span></div>';

    fezMorph(container, newNode, {
      skipNode: (node) =>
        node.classList?.contains("fez") && node.fez && !node.fez._destroyed,
    });

    const current = container.querySelector(".fez");
    expect(current._marker).toBe("preserved");
    expect(current.querySelector("span").textContent).toBe("Original");

    container.remove();
  });

  test("beforeRemove called on removed fez components", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<div class="fez fez-comp"><span>Comp</span></div><p>Keep</p>';
    document.body.appendChild(container);

    const comp = container.querySelector(".fez");
    comp.fez = { UID: 1, _destroyed: false };

    let removedNode = null;

    const newNode = document.createElement("div");
    newNode.innerHTML = "<p>Keep</p>";

    fezMorph(container, newNode, {
      skipNode: (node) =>
        node.classList?.contains("fez") && node.fez && !node.fez._destroyed,
      beforeRemove: (node) => {
        if (node.classList?.contains("fez") && node.fez) {
          removedNode = node;
        }
      },
    });

    expect(removedNode).toBe(comp);
    expect(container.querySelector(".fez")).toBeNull();

    container.remove();
  });

  test("fez component matched by UID when reordered", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<p>text</p><div class="fez fez-a" id="comp-1">A</div><div class="fez fez-b" id="comp-2">B</div>';
    document.body.appendChild(container);

    const compA = container.querySelector("#comp-1");
    const compB = container.querySelector("#comp-2");
    compA.fez = { UID: 1, _destroyed: false, fezName: "a" };
    compB.fez = { UID: 2, _destroyed: false, fezName: "b" };
    compA._m = "A";
    compB._m = "B";

    const newNode = document.createElement("div");
    newNode.innerHTML =
      '<div class="fez fez-b" id="comp-2">B-new</div><p>text</p><div class="fez fez-a" id="comp-1">A-new</div>';

    fezMorph(container, newNode, {
      skipNode: (node) =>
        node.classList?.contains("fez") && node.fez && !node.fez._destroyed,
    });

    // Components should be preserved by identity
    expect(container.querySelector("#comp-1")._m).toBe("A");
    expect(container.querySelector("#comp-2")._m).toBe("B");

    container.remove();
  });
});

// ---------------------------------------------------------------------------
// Nested elements
// ---------------------------------------------------------------------------

describe("nested morphing", () => {
  test("updates deeply nested text", () => {
    const result = morph(
      "<div><ul><li>old</li></ul></div>",
      "<div><ul><li>new</li></ul></div>",
    );
    expect(result).toBe("<div><ul><li>new</li></ul></div>");
  });

  test("adds nested element", () => {
    const result = morph(
      "<div><ul><li>1</li></ul></div>",
      "<div><ul><li>1</li><li>2</li></ul></div>",
    );
    expect(result).toBe("<div><ul><li>1</li><li>2</li></ul></div>");
  });

  test("removes nested element", () => {
    const result = morph(
      "<div><ul><li>1</li><li>2</li></ul></div>",
      "<div><ul><li>1</li></ul></div>",
    );
    expect(result).toBe("<div><ul><li>1</li></ul></div>");
  });
});

// ---------------------------------------------------------------------------
// DOM node identity preservation (proves nodes are reused, not recreated)
// ---------------------------------------------------------------------------

describe("node identity preservation", () => {
  test("preserves child element identity when content is unchanged", () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>hello</p><span>world</span>";
    document.body.appendChild(container);

    // Tag child nodes with random markers to detect recreation
    const marker1 = "rnd-" + Math.random().toString(36).slice(2);
    const marker2 = "rnd-" + Math.random().toString(36).slice(2);
    container.children[0]._marker = marker1;
    container.children[1]._marker = marker2;

    // Morph with identical content
    const newNode = document.createElement("div");
    newNode.innerHTML = "<p>hello</p><span>world</span>";
    fezMorph(container, newNode);

    // Same DOM nodes should be reused - markers still present
    expect(container.children[0]._marker).toBe(marker1);
    expect(container.children[1]._marker).toBe(marker2);
    expect(container.innerHTML).toBe("<p>hello</p><span>world</span>");

    container.remove();
  });

  test("preserves unchanged siblings when one sibling changes", () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>keep</p><p>old</p><p>keep-too</p>";
    document.body.appendChild(container);

    const marker1 = "rnd-" + Math.random().toString(36).slice(2);
    const marker3 = "rnd-" + Math.random().toString(36).slice(2);
    container.children[0]._marker = marker1;
    container.children[2]._marker = marker3;

    const newNode = document.createElement("div");
    newNode.innerHTML = "<p>keep</p><p>changed</p><p>keep-too</p>";
    fezMorph(container, newNode);

    // First and third nodes preserved (same tag, soft-matched)
    expect(container.children[0]._marker).toBe(marker1);
    expect(container.children[2]._marker).toBe(marker3);
    // Second node updated in-place
    expect(container.children[1].textContent).toBe("changed");

    container.remove();
  });

  test("preserves deeply nested node identity on unchanged subtree", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<div class="a"><ul><li>one</li><li>two</li></ul></div>';
    document.body.appendChild(container);

    const deepLi = container.querySelector("li");
    const marker = "rnd-" + Math.random().toString(36).slice(2);
    deepLi._marker = marker;

    // Morph with identical structure
    const newNode = document.createElement("div");
    newNode.innerHTML =
      '<div class="a"><ul><li>one</li><li>two</li></ul></div>';
    fezMorph(container, newNode);

    // Deep node should be the same object
    expect(container.querySelector("li")._marker).toBe(marker);

    container.remove();
  });

  test("recreates node when tag changes (marker lost)", () => {
    const container = document.createElement("div");
    container.innerHTML = "<p>text</p>";
    document.body.appendChild(container);

    const marker = "rnd-" + Math.random().toString(36).slice(2);
    container.children[0]._marker = marker;

    // Change tag from p to span
    const newNode = document.createElement("div");
    newNode.innerHTML = "<span>text</span>";
    fezMorph(container, newNode);

    // Different tag - node was replaced, marker is gone
    expect(container.children[0]._marker).toBeUndefined();
    expect(container.children[0].tagName).toBe("SPAN");

    container.remove();
  });

  test("preserves keyed elements across reorder", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<div fez-keep="a">A</div><div fez-keep="b">B</div><div fez-keep="c">C</div>';
    document.body.appendChild(container);

    const markerA = "rnd-" + Math.random().toString(36).slice(2);
    const markerB = "rnd-" + Math.random().toString(36).slice(2);
    const markerC = "rnd-" + Math.random().toString(36).slice(2);
    container.children[0]._marker = markerA;
    container.children[1]._marker = markerB;
    container.children[2]._marker = markerC;

    // Reorder: C, A, B
    const newNode = document.createElement("div");
    newNode.innerHTML =
      '<div fez-keep="c">C</div><div fez-keep="a">A</div><div fez-keep="b">B</div>';
    fezMorph(container, newNode);

    // All three nodes should be the same objects, just reordered
    expect(container.children[0]._marker).toBe(markerC);
    expect(container.children[1]._marker).toBe(markerA);
    expect(container.children[2]._marker).toBe(markerB);

    container.remove();
  });

  test("fez component nodes are preserved and never morphed", () => {
    const container = document.createElement("div");
    container.innerHTML =
      '<p>before</p><div class="fez fez-my-comp">internal content</div><p>after</p>';
    document.body.appendChild(container);

    // Simulate a fez component instance on the node
    const compNode = container.children[1];
    compNode.fez = { UID: 42, fezName: "my-comp", _destroyed: false };

    const marker = "rnd-" + Math.random().toString(36).slice(2);
    compNode._marker = marker;
    // Add internal state that should survive
    compNode.innerHTML = "modified by component";

    const newNode = document.createElement("div");
    newNode.innerHTML =
      '<p>before</p><div class="fez fez-my-comp">template placeholder</div><p>after</p>';
    fezMorph(container, newNode, {
      skipNode: (node) =>
        node.classList?.contains("fez") && node.fez && !node.fez._destroyed,
    });

    // Component node preserved, internal content unchanged
    expect(container.children[1]._marker).toBe(marker);
    expect(container.children[1].innerHTML).toBe("modified by component");
    // Surrounding nodes updated normally
    expect(container.children[0].textContent).toBe("before");
    expect(container.children[2].textContent).toBe("after");

    container.remove();
  });
});
