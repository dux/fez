import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { Window } from "happy-dom";
import n from "../src/fez/lib/n.js";

let window, doc;
let originalWindow, originalDocument;

let originalNode;

beforeAll(() => {
  originalWindow = global.window;
  originalDocument = global.document;
  originalNode = global.Node;

  window = new Window();
  doc = window.document;
  global.document = doc;
  global.window = window;
  global.Node = window.Node;
});

afterAll(() => {
  global.window = originalWindow;
  global.document = originalDocument;
  global.Node = originalNode;
});

// Minimal fez context for n() calls
const fezCtx = { fezHtmlRoot: "fez." };

describe("boolean attribute normalization", () => {
  describe("n() helper handles boolean attributes", () => {
    test("checked=false does not set attribute", () => {
      const node = n.call(fezCtx, "input", {
        type: "checkbox",
        checked: false,
      });
      expect(node.hasAttribute("checked")).toBe(false);
    });

    test("checked=null does not set attribute", () => {
      const node = n.call(fezCtx, "input", { type: "checkbox", checked: null });
      expect(node.hasAttribute("checked")).toBe(false);
    });

    test("checked=undefined does not set attribute", () => {
      const node = n.call(fezCtx, "input", {
        type: "checkbox",
        checked: undefined,
      });
      expect(node.hasAttribute("checked")).toBe(false);
    });

    test("checked=0 does not set attribute", () => {
      const node = n.call(fezCtx, "input", { type: "checkbox", checked: 0 });
      expect(node.hasAttribute("checked")).toBe(false);
    });

    test('checked="" does not set attribute', () => {
      const node = n.call(fezCtx, "input", { type: "checkbox", checked: "" });
      expect(node.hasAttribute("checked")).toBe(false);
    });

    test("checked=true sets attribute", () => {
      const node = n.call(fezCtx, "input", { type: "checkbox", checked: true });
      expect(node.hasAttribute("checked")).toBe(true);
    });

    test("disabled=false does not set attribute", () => {
      const node = n.call(fezCtx, "button", { disabled: false });
      expect(node.hasAttribute("disabled")).toBe(false);
    });

    test("disabled=true sets attribute", () => {
      const node = n.call(fezCtx, "button", { disabled: true });
      expect(node.hasAttribute("disabled")).toBe(true);
    });

    test("selected=false does not set attribute", () => {
      const node = n.call(fezCtx, "option", { selected: false });
      expect(node.hasAttribute("selected")).toBe(false);
    });

    test("selected=true sets attribute", () => {
      const node = n.call(fezCtx, "option", { selected: true });
      expect(node.hasAttribute("selected")).toBe(true);
    });

    test("non-boolean attributes still work normally", () => {
      const node = n.call(fezCtx, "input", { type: "text", value: "hello" });
      expect(node.getAttribute("type")).toBe("text");
      expect(node.getAttribute("value")).toBe("hello");
    });
  });

  describe("DOM boolean attribute normalization", () => {
    test('checked="false" should be removed from DOM element', () => {
      const el = doc.createElement("input");
      el.setAttribute("type", "checkbox");
      el.setAttribute("checked", "false");
      // Simulate what fezRenderPostProcess does
      const value = el.getAttribute("checked");
      if (["false", "null", "undefined"].includes(value)) {
        el.removeAttribute("checked");
        el.checked = false;
      }
      expect(el.hasAttribute("checked")).toBe(false);
    });

    test('checked="null" should be removed from DOM element', () => {
      const el = doc.createElement("input");
      el.setAttribute("type", "checkbox");
      el.setAttribute("checked", "null");
      const value = el.getAttribute("checked");
      if (["false", "null", "undefined"].includes(value)) {
        el.removeAttribute("checked");
        el.checked = false;
      }
      expect(el.hasAttribute("checked")).toBe(false);
    });

    test('checked="undefined" should be removed from DOM element', () => {
      const el = doc.createElement("input");
      el.setAttribute("type", "checkbox");
      el.setAttribute("checked", "undefined");
      const value = el.getAttribute("checked");
      if (["false", "null", "undefined"].includes(value)) {
        el.removeAttribute("checked");
        el.checked = false;
      }
      expect(el.hasAttribute("checked")).toBe(false);
    });

    test('checked="checked" should be preserved', () => {
      const el = doc.createElement("input");
      el.setAttribute("type", "checkbox");
      el.setAttribute("checked", "checked");
      const value = el.getAttribute("checked");
      if (!["false", "null", "undefined"].includes(value)) {
        el.setAttribute("checked", "checked");
      }
      expect(el.hasAttribute("checked")).toBe(true);
    });
  });
});
