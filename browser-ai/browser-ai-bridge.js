export const DEFAULT_AI_BRIDGE_PORT = 47832;

const ROOT_SELECTOR = "browser-ai-bridge";
const localHosts = new Set(["localhost", "127.0.0.1", "::1", "lvh.me"]);

let rootMounted = false;
let historyWrapped = false;

const pagePort = () => Number(window.location.port || 0);

export const isLocalAiBridgePage = () => {
  const host = window.location.hostname;
  return localHosts.has(host) || host.endsWith(".lvh.me");
};

export const shouldConnectAiBridge = () => isLocalAiBridgePage() && pagePort() > 2999;

export function ensureBrowserAiBridgeRoot() {
  if (rootMounted || !shouldConnectAiBridge()) return;
  rootMounted = true;

  if (!document.querySelector(ROOT_SELECTOR)) {
    document.body.appendChild(document.createElement(ROOT_SELECTOR));
  }
}

export class BrowserAiBridge {
  init() {
    this.clientId = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
    this.openedAt = Date.now();
    this.focusedAt = document.hasFocus() ? this.openedAt : 0;
    this.socket = null;
    this.reconnectTimer = null;
    this.reconnectDelay = 500;
    this.serverPort = Number(window.AI_BRIDGE_PORT || localStorage.aiBridgePort || DEFAULT_AI_BRIDGE_PORT);
  }

  onMount() {
    if (!shouldConnectAiBridge()) return;

    this.root.style.display = "none";

    if (!Number.isInteger(this.serverPort) || this.serverPort <= 2999) {
      console.warn("[ai-bridge] disabled: server port must be above 2999");
      return;
    }

    this.bindPageEvents();
    this.connect();
    window.AiBridge = this;
  }

  onDestroy() {
    window.clearTimeout(this.reconnectTimer);
    this.socket?.close();
    if (window.AiBridge === this) {
      delete window.AiBridge;
    }
  }

  describe() {
    return {
      clientId: this.clientId,
      href: window.location.href,
      title: document.title,
      visible: document.visibilityState === "visible",
      focused: document.hasFocus(),
      focusedAt: this.focusedAt,
      openedAt: this.openedAt,
      pagePort: pagePort(),
      userAgent: navigator.userAgent,
    };
  }

  serializeValue(value) {
    if (value === undefined) return { type: "undefined" };

    try {
      return { type: "json", value: JSON.parse(JSON.stringify(value)) };
    } catch (error) {
      return { type: "string", value: String(value) };
    }
  }

  async runCode(message) {
    if (message.expr) {
      return await (0, eval)(`(async () => (${message.expr}))()`);
    }

    if (message.body) {
      return await (0, eval)(`(async () => { ${message.body} })()`);
    }

    throw new Error("Expected expr or body");
  }

  send(payload) {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(payload));
    }
  }

  sendPage() {
    this.send({ type: "page", page: this.describe() });
  }

  markFocused() {
    this.focusedAt = Date.now();
    this.sendPage();
  }

  bindPageEvents() {
    if (!historyWrapped) {
      historyWrapped = true;
      this.wrapHistory("pushState");
      this.wrapHistory("replaceState");
    }

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") this.focusedAt = Date.now();
      this.sendPage();
    });
    window.addEventListener("focus", () => this.markFocused());
    window.addEventListener("pointerdown", () => this.markFocused(), { passive: true });
    window.addEventListener("keydown", () => this.markFocused(), { passive: true });
    window.addEventListener("popstate", () => this.sendPage());
    window.addEventListener("hashchange", () => this.sendPage());
    window.addEventListener("pageshow", () => {
      this.focusedAt = Date.now();
      this.sendPage();
    });
  }

  wrapHistory(method) {
    const bridge = this;
    const original = history[method];

    history[method] = function () {
      const result = original.apply(this, arguments);
      window.setTimeout(() => bridge.sendPage(), 0);
      return result;
    };
  }

  connect() {
    window.clearTimeout(this.reconnectTimer);

    const socket = new WebSocket(`ws://127.0.0.1:${this.serverPort}/socket`);
    this.socket = socket;

    socket.addEventListener("open", () => {
      this.reconnectDelay = 500;
      this.send({ type: "hello", page: this.describe() });
    });

    socket.addEventListener("message", async (event) => {
      let message;

      try {
        message = JSON.parse(event.data);
      } catch (error) {
        return;
      }

      if (message.type === "ping") {
        this.send({ type: "pong", page: this.describe() });
        return;
      }

      if (message.type !== "ask" || !message.id) {
        return;
      }

      try {
        const value = await this.runCode(message);
        this.send({
          type: "result",
          id: message.id,
          ok: true,
          page: this.describe(),
          result: this.serializeValue(value),
        });
      } catch (error) {
        this.send({
          type: "result",
          id: message.id,
          ok: false,
          page: this.describe(),
          error: {
            name: error && error.name,
            message: error && error.message ? error.message : String(error),
            stack: error && error.stack,
          },
        });
      }
    });

    socket.addEventListener("close", () => {
      this.reconnectTimer = window.setTimeout(() => this.connect(), this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 1.5, 5000);
    });
  }
}

export function registerBrowserAiBridge(Fez) {
  Fez(ROOT_SELECTOR, BrowserAiBridge);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureBrowserAiBridgeRoot);
  } else {
    ensureBrowserAiBridgeRoot();
  }
}
