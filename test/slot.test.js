import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Window } from "happy-dom";
import { Idiomorph } from "../src/fez/vendor/idiomorph.js";

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

// happy-dom does not support :scope > so we polyfill direct-child queries
function directChild(parent, selector) {
  return (
    Array.from(parent.querySelectorAll(selector)).find(
      (el) => el.parentNode === parent,
    ) || null
  );
}

function directChildren(parent, selector) {
  return Array.from(parent.querySelectorAll(selector)).filter(
    (el) => el.parentNode === parent,
  );
}

/**
 * Simulates fezKeepNode behavior (mirrors src/fez/instance.js):
 *  - First render: move _fezChildNodes (or root.childNodes) into .fez-slot
 *  - fez-keep: swap matching direct-child elements from old DOM into new DOM
 *  - Uses direct-child matching to avoid nested component slots/keeps
 */
function fezKeepNode(root, newNode, _fezChildNodes) {
  // First render: move captured children into slot container
  const newSlot = directChild(newNode, ".fez-slot");
  if (newSlot && !directChild(root, ".fez-slot")) {
    const children = _fezChildNodes || Array.from(root.childNodes);
    children.forEach((child) => {
      newSlot.appendChild(child);
    });
  }

  // Swap matching fez-keep elements (includes slot on re-render)
  directChildren(newNode, "[fez-keep]").forEach((newEl) => {
    const key = newEl.getAttribute("fez-keep");
    const oldEl = directChild(root, `[fez-keep="${key}"]`);
    if (oldEl) {
      newEl.parentNode.replaceChild(oldEl, newEl);
    }
  });
}

/**
 * Simulates childNodes() behavior (mirrors src/fez/instance.js):
 * If a direct-child .fez-slot exists, return its children.
 * Otherwise return _fezChildNodes or root.children.
 */
function childNodes(root, _fezChildNodes) {
  const slot = directChild(root, ".fez-slot");
  return slot
    ? Array.from(slot.children)
    : _fezChildNodes || Array.from(root.children);
}

function morphdom(target, newNode) {
  Array.from(target.attributes).forEach((attr) => {
    newNode.setAttribute(attr.name, attr.value);
  });
  Idiomorph.morph(target, newNode, {
    morphStyle: "outerHTML",
    ignoreActiveValue: true,
    callbacks: {
      beforeNodeMorphed: (oldNode, newNode) => {
        if (
          oldNode !== target &&
          oldNode.classList?.contains("fez") &&
          oldNode.fez &&
          !oldNode.fez._destroyed
        ) {
          return false;
        }
        return true;
      },
      beforeNodeRemoved: (node) => {
        if (node.classList?.contains("fez") && node.fez) {
          node.fez._destroyed = true;
        }
        return true;
      },
    },
  });
}

/**
 * Simulate a full fez render cycle:
 * 1. Generate new DOM from template
 * 2. Run fezKeepNode (slot + fez-keep)
 * 3. Morph
 */
function fezRender(root, templateHtml, _fezChildNodes) {
  const newNode = document.createElement("div");
  newNode.innerHTML = templateHtml;
  fezKeepNode(root, newNode, _fezChildNodes);
  morphdom(root, newNode);
}

describe("slot behavior", () => {
  describe("first render - children moved into slot", () => {
    test("children from root are moved into .fez-slot container", () => {
      const root = document.createElement("div");
      root.id = "comp-1";
      root.classList.add("fez", "fez-ui-tabs");
      root.innerHTML = "<div>Tab 1</div><div>Tab 2</div>";
      document.body.appendChild(root);

      fezRender(
        root,
        '<div class="header"><span>Tab 1</span></div>' +
          '<div class="fez-slot" fez-keep="default-slot"></div>',
      );

      const slot = root.querySelector(".fez-slot");
      expect(slot).not.toBeNull();
      expect(slot.tagName).toBe("DIV");
      expect(slot.children.length).toBe(2);
      expect(slot.children[0].textContent).toBe("Tab 1");
      expect(slot.children[1].textContent).toBe("Tab 2");

      root.remove();
    });

    test("slot container is a div with fez-keep=default-slot", () => {
      const root = document.createElement("div");
      root.id = "comp-2";
      root.classList.add("fez");
      root.innerHTML = "<p>Content</p>";
      document.body.appendChild(root);

      fezRender(root, '<div class="fez-slot" fez-keep="default-slot"></div>');

      const slot = root.querySelector(".fez-slot");
      expect(slot).not.toBeNull();
      expect(slot.tagName).toBe("DIV");
      expect(slot.getAttribute("fez-keep")).toBe("default-slot");
      expect(slot.children.length).toBe(1);
      expect(slot.children[0].textContent).toBe("Content");

      root.remove();
    });

    test("empty component - slot container stays empty", () => {
      const root = document.createElement("div");
      root.id = "comp-3";
      root.classList.add("fez");
      document.body.appendChild(root);

      fezRender(root, '<div class="fez-slot" fez-keep="default-slot"></div>');

      const slot = root.querySelector(".fez-slot");
      expect(slot).not.toBeNull();
      expect(slot.children.length).toBe(0);

      root.remove();
    });
  });

  describe("re-render - slot content preserved", () => {
    test("slot content survives parent re-render", () => {
      const root = document.createElement("div");
      root.id = "comp-4";
      root.classList.add("fez");
      root.innerHTML =
        '<div class="header"><span>Tab 1</span></div>' +
        '<div class="fez-slot" fez-keep="default-slot">' +
        "<div>Tab 1 Content</div><div>Tab 2 Content</div>" +
        "</div>";
      document.body.appendChild(root);

      const slotChildren = root.querySelector(".fez-slot").children;
      slotChildren[0]._marker = "tab1";
      slotChildren[1]._marker = "tab2";

      fezRender(
        root,
        '<div class="header"><span>Tab 1</span><span>Tab 2</span></div>' +
          '<div class="fez-slot" fez-keep="default-slot"></div>',
      );

      const slot = root.querySelector(".fez-slot");
      expect(slot.children.length).toBe(2);
      expect(slot.children[0]._marker).toBe("tab1");
      expect(slot.children[1]._marker).toBe("tab2");

      const headerSpans = root.querySelectorAll(".header span");
      expect(headerSpans.length).toBe(2);

      root.remove();
    });

    test("slot content preserved through multiple re-renders", () => {
      const root = document.createElement("div");
      root.id = "comp-5";
      root.classList.add("fez");
      root.innerHTML =
        '<span class="count">1</span>' +
        '<div class="fez-slot" fez-keep="default-slot"><p>Slot content</p></div>';
      document.body.appendChild(root);

      root.querySelector(".fez-slot p")._marker = "original";

      for (let i = 2; i <= 4; i++) {
        fezRender(
          root,
          `<span class="count">${i}</span>` +
            '<div class="fez-slot" fez-keep="default-slot"></div>',
        );
      }

      expect(root.querySelector(".count").textContent).toBe("4");
      expect(root.querySelector(".fez-slot p")._marker).toBe("original");

      root.remove();
    });

    test("DOM state inside slot survives re-render", () => {
      const root = document.createElement("div");
      root.id = "comp-6";
      root.classList.add("fez");
      root.innerHTML =
        '<div class="fez-slot" fez-keep="default-slot">' +
        '<input type="text" />' +
        "</div>";
      document.body.appendChild(root);

      const input = root.querySelector("input");
      input.value = "user typed this";
      input._customProp = "should-survive";

      fezRender(
        root,
        "<span>Updated</span>" +
          '<div class="fez-slot" fez-keep="default-slot"></div>',
      );

      const currentInput = root.querySelector(".fez-slot input");
      expect(currentInput).not.toBeNull();
      expect(currentInput._customProp).toBe("should-survive");
      expect(currentInput.value).toBe("user typed this");

      root.remove();
    });
  });

  describe("slot with nested fez components", () => {
    test("nested fez components inside slot are preserved", () => {
      const root = document.createElement("div");
      root.id = "comp-7";
      root.classList.add("fez");
      root.innerHTML =
        '<div class="header"><span>Tab 1</span></div>' +
        '<div class="fez-slot" fez-keep="default-slot">' +
        '<div class="fez fez-ui-clock"></div>' +
        "<div>Static content</div>" +
        "</div>";
      document.body.appendChild(root);

      const clock = root.querySelector(".fez-ui-clock");
      clock.fez = { fezName: "ui-clock", UID: 99, _destroyed: false };
      clock._marker = "clock-component";

      fezRender(
        root,
        '<div class="header"><span>Tab 1</span></div>' +
          '<div class="fez-slot" fez-keep="default-slot"></div>',
      );

      const slot = root.querySelector(".fez-slot");
      const preservedClock = slot.querySelector(".fez-ui-clock");
      expect(preservedClock).not.toBeNull();
      expect(preservedClock._marker).toBe("clock-component");
      expect(preservedClock.fez.UID).toBe(99);

      root.remove();
    });
  });

  describe("no slot in template", () => {
    test("component without slot works normally", () => {
      const root = document.createElement("div");
      root.id = "comp-8";
      root.classList.add("fez");
      root.innerHTML = "<span>Count: 1</span>";
      document.body.appendChild(root);

      fezRender(root, "<span>Count: 2</span>");

      expect(root.querySelector("span").textContent).toBe("Count: 2");
      expect(root.querySelector(".fez-slot")).toBeNull();

      root.remove();
    });
  });

  describe("slot + fez-keep combined", () => {
    test("fez-keep elements outside slot are preserved while slot is preserved", () => {
      const root = document.createElement("div");
      root.id = "comp-9";
      root.classList.add("fez");
      root.innerHTML =
        '<div fez-keep="random">Random: 0.123</div>' +
        '<div class="fez-slot" fez-keep="default-slot"><p>Slot content</p></div>';
      document.body.appendChild(root);

      root.querySelector('[fez-keep="random"]')._marker = "kept";
      root.querySelector(".fez-slot p")._marker = "slot-child";

      fezRender(
        root,
        '<div fez-keep="random">Random: 0.456</div>' +
          '<div class="fez-slot" fez-keep="default-slot"></div>',
      );

      expect(root.querySelector('[fez-keep="random"]')._marker).toBe("kept");
      expect(root.querySelector('[fez-keep="random"]').textContent).toBe(
        "Random: 0.123",
      );
      expect(root.querySelector(".fez-slot p")._marker).toBe("slot-child");

      root.remove();
    });
  });

  describe("nested slots - direct-child matching prevents leaking into inner components", () => {
    test("outer slot is populated even when children contain nested .fez-slot", () => {
      // Outer ui-tabs with 3 children. First child contains a nested component
      // that already rendered with its own .fez-slot inside it.
      const root = document.createElement("div");
      root.id = "outer-tabs";
      root.classList.add("fez", "fez-ui-tabs");
      document.body.appendChild(root);

      // Build children as they look after nested components already initialized
      const tab1 = document.createElement("div");
      tab1.setAttribute("title", "Tab1");
      const nestedComp = document.createElement("div");
      nestedComp.className = "fez fez-inner-tabs";
      nestedComp.innerHTML =
        '<div class="header"><span>Nested1</span></div>' +
        '<div class="fez-slot" fez-keep="default-slot">' +
        "<div>Nested content</div>" +
        "</div>";
      nestedComp.fez = { fezName: "inner-tabs", UID: 50, _destroyed: false };
      tab1.appendChild(nestedComp);

      const tab2 = document.createElement("div");
      tab2.setAttribute("title", "Tab2");
      tab2.textContent = "Second tab";

      const tab3 = document.createElement("div");
      tab3.setAttribute("title", "Tab3");
      tab3.textContent = "Third tab";

      root.appendChild(tab1);
      root.appendChild(tab2);
      root.appendChild(tab3);

      // Capture children before render (like connect.js does)
      const captured = Array.from(root.children);

      // Render outer template with slot
      fezRender(
        root,
        '<div class="header"><span>Tab1</span><span>Tab2</span><span>Tab3</span></div>' +
          '<div class="fez-slot" fez-keep="default-slot"></div>',
        captured,
      );

      // Outer slot should have all 3 children
      const outerSlot = directChild(root, ".fez-slot");
      expect(outerSlot).not.toBeNull();
      expect(outerSlot.children.length).toBe(3);
      expect(outerSlot.children[0].getAttribute("title")).toBe("Tab1");
      expect(outerSlot.children[1].getAttribute("title")).toBe("Tab2");
      expect(outerSlot.children[2].getAttribute("title")).toBe("Tab3");

      // Nested component's slot should be intact inside tab1
      const nestedSlot = outerSlot.children[0].querySelector(".fez-slot");
      expect(nestedSlot).not.toBeNull();
      expect(nestedSlot.textContent).toContain("Nested content");

      root.remove();
    });

    test("fez-keep swap only matches direct children, not nested keeps", () => {
      const root = document.createElement("div");
      root.id = "outer-keep";
      root.classList.add("fez");
      document.body.appendChild(root);

      root.innerHTML =
        '<div fez-keep="my-widget">Old widget</div>' +
        '<div class="fez-slot" fez-keep="default-slot">' +
        '<div class="fez fez-child">' +
        '<div fez-keep="my-widget">Nested widget - should NOT be swapped</div>' +
        "</div>" +
        "</div>";

      // Mark outer and nested elements
      directChild(root, '[fez-keep="my-widget"]')._marker = "outer-widget";
      root
        .querySelector(".fez-child")
        .querySelector('[fez-keep="my-widget"]')._marker = "nested-widget";

      fezRender(
        root,
        '<div fez-keep="my-widget">New widget</div>' +
          '<div class="fez-slot" fez-keep="default-slot"></div>',
      );

      // Outer fez-keep was swapped (preserved old content)
      const outerWidget = directChild(root, '[fez-keep="my-widget"]');
      expect(outerWidget._marker).toBe("outer-widget");
      expect(outerWidget.textContent).toBe("Old widget");

      // Nested widget inside slot is untouched
      const nestedWidget = root
        .querySelector(".fez-slot .fez-child")
        .querySelector('[fez-keep="my-widget"]');
      expect(nestedWidget._marker).toBe("nested-widget");

      root.remove();
    });

    test("re-render preserves outer slot even when children have nested slots", () => {
      const root = document.createElement("div");
      root.id = "outer-rerender";
      root.classList.add("fez");
      document.body.appendChild(root);

      // Already rendered: header + slot with children containing nested slots
      root.innerHTML =
        '<div class="header"><span>Tab1</span></div>' +
        '<div class="fez-slot" fez-keep="default-slot">' +
        '<div title="Tab1">' +
        '<div class="fez fez-nested">' +
        '<div class="fez-slot" fez-keep="default-slot"><p>Deep content</p></div>' +
        "</div>" +
        "</div>" +
        '<div title="Tab2">Simple tab</div>' +
        "</div>";

      const outerSlot = directChild(root, ".fez-slot");
      outerSlot.children[0]._marker = "tab1-original";
      outerSlot.children[1]._marker = "tab2-original";

      // Re-render (header changes, slot preserved via fez-keep)
      fezRender(
        root,
        '<div class="header"><span>Tab1</span><span>Tab2</span></div>' +
          '<div class="fez-slot" fez-keep="default-slot"></div>',
      );

      const slot = directChild(root, ".fez-slot");
      expect(slot.children.length).toBe(2);
      expect(slot.children[0]._marker).toBe("tab1-original");
      expect(slot.children[1]._marker).toBe("tab2-original");

      // Nested slot inside tab1 is still intact
      const deepContent = slot.children[0].querySelector(
        ".fez-nested .fez-slot p",
      );
      expect(deepContent).not.toBeNull();
      expect(deepContent.textContent).toBe("Deep content");

      root.remove();
    });
  });

  describe("childNodes() behavior", () => {
    test("before render (onInit) - returns _fezChildNodes", () => {
      // Before first render, no slot exists. childNodes() returns captured children.
      const root = document.createElement("div");
      root.id = "cn-1";
      root.classList.add("fez");
      document.body.appendChild(root);

      root.innerHTML =
        '<div title="Tab1">First</div>' +
        '<div title="Tab2">Second</div>' +
        '<div title="Tab3">Third</div>';

      const captured = Array.from(root.children);

      // onInit: no slot rendered yet
      const nodes = childNodes(root, captured);
      expect(nodes.length).toBe(3);
      expect(nodes[0].getAttribute("title")).toBe("Tab1");
      expect(nodes[1].getAttribute("title")).toBe("Tab2");
      expect(nodes[2].getAttribute("title")).toBe("Tab3");

      root.remove();
    });

    test("after render (onMount) - returns slot children", () => {
      // After first render, children moved into .fez-slot.
      // childNodes() should return slot children.
      const root = document.createElement("div");
      root.id = "cn-2";
      root.classList.add("fez");
      document.body.appendChild(root);

      root.innerHTML =
        '<div title="Tab1">First</div>' + '<div title="Tab2">Second</div>';

      const captured = Array.from(root.children);

      // Render moves children into slot
      fezRender(
        root,
        '<div class="header"><span>H1</span></div>' +
          '<div class="fez-slot" fez-keep="default-slot"></div>',
        captured,
      );

      // onMount: slot exists
      const nodes = childNodes(root);
      expect(nodes.length).toBe(2);
      expect(nodes[0].getAttribute("title")).toBe("Tab1");
      expect(nodes[1].getAttribute("title")).toBe("Tab2");

      root.remove();
    });

    test("after render without slot - returns root children", () => {
      const root = document.createElement("div");
      root.id = "cn-3";
      root.classList.add("fez");
      document.body.appendChild(root);

      fezRender(root, "<span>One</span><span>Two</span>");

      const nodes = childNodes(root);
      expect(nodes.length).toBe(2);
      expect(nodes[0].textContent).toBe("One");
      expect(nodes[1].textContent).toBe("Two");

      root.remove();
    });

    test("after re-render - still returns slot children", () => {
      const root = document.createElement("div");
      root.id = "cn-4";
      root.classList.add("fez");
      document.body.appendChild(root);

      root.innerHTML = '<div title="A">A</div><div title="B">B</div>';
      const captured = Array.from(root.children);

      fezRender(
        root,
        '<span class="count">1</span>' +
          '<div class="fez-slot" fez-keep="default-slot"></div>',
        captured,
      );

      // Re-render
      fezRender(
        root,
        '<span class="count">2</span>' +
          '<div class="fez-slot" fez-keep="default-slot"></div>',
      );

      const nodes = childNodes(root);
      expect(nodes.length).toBe(2);
      expect(nodes[0].getAttribute("title")).toBe("A");
      expect(nodes[1].getAttribute("title")).toBe("B");

      root.remove();
    });

    test("childNodes does not return nested component slot children", () => {
      // Outer has a slot with 2 children. One contains a nested component
      // with its own .fez-slot. childNodes() should only return the outer 2.
      const root = document.createElement("div");
      root.id = "cn-5";
      root.classList.add("fez");
      document.body.appendChild(root);

      root.innerHTML =
        '<div class="header"><span>H</span></div>' +
        '<div class="fez-slot" fez-keep="default-slot">' +
        '<div title="Tab1">' +
        '<div class="fez fez-nested">' +
        '<div class="fez-slot" fez-keep="default-slot">' +
        "<p>Deep1</p><p>Deep2</p>" +
        "</div>" +
        "</div>" +
        "</div>" +
        '<div title="Tab2">Simple</div>' +
        "</div>";

      const nodes = childNodes(root);
      expect(nodes.length).toBe(2);
      expect(nodes[0].getAttribute("title")).toBe("Tab1");
      expect(nodes[1].getAttribute("title")).toBe("Tab2");

      root.remove();
    });
  });
});
