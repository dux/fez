(function () {
  if (window.__aiBridge) return;

  var localHosts = ["localhost", "127.0.0.1", "::1", "lvh.me"];
  var host = window.location.hostname;
  var pagePort = Number(window.location.port || 0);
  var isLocal = localHosts.indexOf(host) !== -1 || host.indexOf(".lvh.me") !== -1;

  if (!isLocal || pagePort <= 2999) return;

  var serverPort = Number(window.AI_BRIDGE_PORT || localStorage.aiBridgePort || document.currentScript && document.currentScript.dataset.port || 47832);
  if (serverPort <= 2999) return;

  var clientId = crypto.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random();
  var openedAt = Date.now();
  var focusedAt = document.hasFocus() ? openedAt : 0;
  var socket = null;
  var reconnectTimer = null;
  var reconnectDelay = 500;
  var historyWrapped = false;

  function describe() {
    return {
      clientId: clientId,
      href: window.location.href,
      title: document.title,
      visible: document.visibilityState === "visible",
      focused: document.hasFocus(),
      focusedAt: focusedAt,
      openedAt: openedAt,
      pagePort: pagePort,
      userAgent: navigator.userAgent,
    };
  }

  function serialize(value) {
    if (value === undefined) return { type: "undefined" };
    try {
      return { type: "json", value: JSON.parse(JSON.stringify(value)) };
    } catch (e) {
      return { type: "string", value: String(value) };
    }
  }

  function send(payload) {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(payload));
    }
  }

  function sendPage() {
    send({ type: "page", page: describe() });
  }

  function markFocused() {
    focusedAt = Date.now();
    sendPage();
  }

  async function runCode(msg) {
    if (msg.expr) return await (0, eval)("(async () => (" + msg.expr + "))()");
    if (msg.body) return await (0, eval)("(async () => { " + msg.body + " })()");
    throw new Error("Expected expr or body");
  }

  function wrapHistory(method) {
    var original = history[method];
    history[method] = function () {
      var result = original.apply(this, arguments);
      setTimeout(sendPage, 0);
      return result;
    };
  }

  if (!historyWrapped) {
    historyWrapped = true;
    wrapHistory("pushState");
    wrapHistory("replaceState");
  }

  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") focusedAt = Date.now();
    sendPage();
  });
  window.addEventListener("focus", markFocused);
  window.addEventListener("pointerdown", markFocused, { passive: true });
  window.addEventListener("keydown", markFocused, { passive: true });
  window.addEventListener("popstate", sendPage);
  window.addEventListener("hashchange", sendPage);
  window.addEventListener("pageshow", function () {
    focusedAt = Date.now();
    sendPage();
  });

  function connect() {
    clearTimeout(reconnectTimer);

    socket = new WebSocket("ws://127.0.0.1:" + serverPort + "/socket");

    socket.addEventListener("open", function () {
      reconnectDelay = 500;
      send({ type: "hello", page: describe() });
    });

    socket.addEventListener("message", async function (event) {
      var msg;
      try { msg = JSON.parse(event.data); } catch (e) { return; }

      if (msg.type === "ping") {
        send({ type: "pong", page: describe() });
        return;
      }

      if (msg.type !== "ask" || !msg.id) return;

      try {
        var value = await runCode(msg);
        send({ type: "result", id: msg.id, ok: true, page: describe(), result: serialize(value) });
      } catch (err) {
        send({ type: "result", id: msg.id, ok: false, page: describe(), error: { name: err && err.name, message: err && err.message || String(err), stack: err && err.stack } });
      }
    });

    socket.addEventListener("close", function () {
      reconnectTimer = setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 1.5, 5000);
    });
  }

  var levels = ["log", "warn", "error", "info", "debug"];
  var origConsole = {};

  levels.forEach(function (level) {
    origConsole[level] = console[level];
    console[level] = function () {
      origConsole[level].apply(console, arguments);
      var args = [];
      for (var i = 0; i < arguments.length; i++) args.push(serialize(arguments[i]));
      send({ type: "console", level: level, args: args, page: describe() });
    };
  });

  window.addEventListener("error", function (e) {
    send({ type: "console", level: "error", args: [serialize(e.message), serialize(e.filename + ":" + e.lineno)], page: describe() });
  });

  window.addEventListener("unhandledrejection", function (e) {
    var msg = e.reason && e.reason.message ? e.reason.message : String(e.reason);
    send({ type: "console", level: "error", args: [serialize("Unhandled rejection: " + msg)], page: describe() });
  });

  var origFetch = window.fetch;
  window.fetch = function () {
    var url = arguments[0];
    var opts = arguments[1] || {};
    var method = (opts.method || "GET").toUpperCase();
    if (typeof url === "object" && url.url) url = url.url;
    var startTime = Date.now();

    return origFetch.apply(this, arguments).then(function (res) {
      send({ type: "network", method: method, url: String(url), status: res.status, duration: Date.now() - startTime, ok: res.ok, page: describe() });
      if (!res.ok) {
        res.clone().text().then(function (body) {
          send({ type: "console", level: "error", args: [serialize("HTTP " + res.status + " " + method + " " + url), serialize(body.slice(0, 500))], page: describe() });
        }).catch(function () {});
      }
      return res;
    }).catch(function (err) {
      send({ type: "network", method: method, url: String(url), status: 0, duration: Date.now() - startTime, ok: false, error: err.message, page: describe() });
      throw err;
    });
  };

  var origXhrOpen = XMLHttpRequest.prototype.open;
  var origXhrSend = XMLHttpRequest.prototype.send;

  XMLHttpRequest.prototype.open = function (method, url) {
    this.__aiBridge = { method: method.toUpperCase(), url: String(url), startTime: 0 };
    return origXhrOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function () {
    var xhr = this;
    var info = xhr.__aiBridge;
    if (info) {
      info.startTime = Date.now();
      xhr.addEventListener("loadend", function () {
        send({ type: "network", method: info.method, url: info.url, status: xhr.status, duration: Date.now() - info.startTime, ok: xhr.status >= 200 && xhr.status < 400, page: describe() });
        if (xhr.status >= 400) {
          send({ type: "console", level: "error", args: [serialize("HTTP " + xhr.status + " " + info.method + " " + info.url), serialize((xhr.responseText || "").slice(0, 500))], page: describe() });
        }
      });
    }
    return origXhrSend.apply(this, arguments);
  };

  window.__aiBridge = { reconnect: connect, describe: describe, sendPage: sendPage };

  connect();
})();
