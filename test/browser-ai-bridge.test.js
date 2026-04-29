import { describe, expect, test, beforeEach } from "bun:test";

import {
  BrowserAiBridge,
  ensureBrowserAiBridgeRoot,
  isLocalAiBridgePage,
  registerBrowserAiBridge,
  shouldConnectAiBridge,
} from "../browser-ai/browser-ai-bridge.js";

let appendedNodes;

const setLocation = (hostname, port = "3333") => {
  globalThis.window.location = {
    hostname,
    port,
    href: `http://${hostname}:${port}/demo`,
  };
};

beforeEach(() => {
  appendedNodes = [];

  globalThis.window.document = globalThis.document;
  globalThis.window.AI_BRIDGE_PORT = undefined;
  globalThis.document.title = "Bridge test";
  Object.defineProperty(globalThis.document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  globalThis.document.hasFocus = () => true;
  globalThis.document.querySelector = () => null;
  globalThis.document.body.appendChild = (node) => appendedNodes.push(node);
  globalThis.document.createElement = (tag) => ({
    tagName: tag.toUpperCase(),
    dataset: {},
    style: {},
  });
  globalThis.localStorage.clear();

  setLocation("localhost", "3333");
});

describe("browser AI bridge", () => {
  test("connects only on local development pages above reserved ports", () => {
    expect(isLocalAiBridgePage()).toBe(true);
    expect(shouldConnectAiBridge()).toBe(true);

    setLocation("example.com", "3333");
    expect(isLocalAiBridgePage()).toBe(false);
    expect(shouldConnectAiBridge()).toBe(false);

    setLocation("localhost", "2999");
    expect(shouldConnectAiBridge()).toBe(false);

    setLocation("app.lvh.me", "3333");
    expect(isLocalAiBridgePage()).toBe(true);
    expect(shouldConnectAiBridge()).toBe(true);
  });

  test("registers and mounts one hidden root component", () => {
    const registered = [];
    const Fez = (name, klass) => registered.push({ name, klass });

    registerBrowserAiBridge(Fez);

    expect(registered).toEqual([
      { name: "browser-ai-bridge", klass: BrowserAiBridge },
    ]);
    expect(appendedNodes).toHaveLength(1);
    expect(appendedNodes[0].tagName).toBe("BROWSER-AI-BRIDGE");

    ensureBrowserAiBridgeRoot();
    expect(appendedNodes).toHaveLength(1);
  });

  test("serializes eval results for the socket response", () => {
    const bridge = new BrowserAiBridge();
    bridge.init();

    expect(bridge.serializeValue(undefined)).toEqual({ type: "undefined" });
    expect(bridge.serializeValue({ ok: true })).toEqual({
      type: "json",
      value: { ok: true },
    });

    const circular = {};
    circular.self = circular;
    expect(bridge.serializeValue(circular)).toEqual({
      type: "string",
      value: "[object Object]",
    });
  });

  test("describes open and focus order for server client selection", () => {
    const bridge = new BrowserAiBridge();
    bridge.init();

    const initial = bridge.describe();

    expect(initial.openedAt).toBeGreaterThan(0);
    expect(initial.focusedAt).toBeGreaterThanOrEqual(0);
    expect(typeof initial.focused).toBe("boolean");

    bridge.markFocused();

    expect(bridge.describe().focusedAt).toBeGreaterThanOrEqual(initial.focusedAt);
  });
});
