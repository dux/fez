import { readFileSync } from "fs";
import { join } from "path";

const DEFAULT_PORT = 47832;
const RESULT_TIMEOUT_MS = 10_000;
const PING_INTERVAL_MS = 30_000;
const STALE_TIMEOUT_MS = 90_000;

const clientJs = readFileSync(join(import.meta.dirname, "client.js"), "utf-8");

if (Bun.argv.includes("--help") || Bun.argv.includes("-h")) {
  console.log(`Usage: fez ai-server [--port PORT]

Starts the local AI bridge server for development browser eval.

Environment:
  AI_BRIDGE_PORT  Port to listen on, defaults to ${DEFAULT_PORT}.
`);
  process.exit(0);
}

const port = Number(Bun.env.AI_BRIDGE_PORT || DEFAULT_PORT);

if (!Number.isInteger(port) || port <= 2999) {
  throw new Error("AI bridge port must be above 2999");
}

const clients = new Map();
const pending = new Map();
const consoleLogs = [];
const MAX_CONSOLE_LOGS = 500;

const LEVEL_COLORS = { error: "\x1b[31m", warn: "\x1b[33m", info: "\x1b[36m", debug: "\x1b[90m", log: "\x1b[37m" };
const RESET = "\x1b[0m";

const formatConsoleArg = (arg) => {
  if (!arg) return "";
  if (arg.type === "undefined") return "undefined";
  if (arg.type === "string") return arg.value;
  if (arg.type === "json") return typeof arg.value === "string" ? arg.value : JSON.stringify(arg.value);
  return String(arg);
};

const handleConsoleMessage = (message, clientId) => {
  const entry = {
    level: message.level,
    args: message.args,
    url: message.page?.href,
    title: message.page?.title,
    clientId,
    ts: new Date().toISOString(),
  };

  consoleLogs.push(entry);
  if (consoleLogs.length > MAX_CONSOLE_LOGS) consoleLogs.shift();

  const color = LEVEL_COLORS[message.level] || "";
  const tag = message.level.toUpperCase().padEnd(5);
  const text = message.args.map(formatConsoleArg).join(" ");
  const page = message.page?.title || message.page?.href || "";
  console.log(`${color}[${tag}]${RESET} ${text}  ${RESET}\x1b[90m(${page})${RESET}`);
};

const json = (body, init = {}) => {
  return Response.json(body, {
    ...init,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type",
      ...init.headers,
    },
  });
};

const parseJson = async (request) => {
  try {
    return await request.json();
  } catch (error) {
    return undefined;
  }
};

const summarizeClient = (client) => ({
  id: client.id,
  page: client.page,
  connectedAt: new Date(client.connectedAt).toISOString(),
  lastSeenAt: new Date(client.lastSeenAt).toISOString(),
});

const clientRank = (client) => [
  client.page?.focused ? 1 : 0,
  client.page?.visible ? 1 : 0,
  Number(client.page?.focusedAt || 0),
  Number(client.page?.openedAt || 0),
  client.lastSeenAt,
  client.connectedAt,
];

const compareClients = (a, b) => {
  const left = clientRank(a);
  const right = clientRank(b);

  for (let i = 0; i < left.length; i += 1) {
    if (left[i] !== right[i]) return right[i] - left[i];
  }

  return 0;
};

const pickClient = (input) => {
  if (input.clientId) {
    return clients.get(input.clientId);
  }

  const list = [...clients.values()];
  const filtered = input.urlIncludes
    ? list.filter((client) => client.page?.href.includes(input.urlIncludes || ""))
    : list;

  return filtered.sort(compareClients)[0];
};

const askClient = (client, payload) => {
  const id = crypto.randomUUID();

  const promise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`Timed out waiting for browser response after ${RESULT_TIMEOUT_MS}ms`));
    }, RESULT_TIMEOUT_MS);

    pending.set(id, { resolve, reject, timer });
  });

  client.socket.send(JSON.stringify({ ...payload, type: "ask", id }));
  return promise;
};

let server;

try {
  server = Bun.serve({
  hostname: "127.0.0.1",
  port,

  fetch: async (request, server) => {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return json({});
    }

    if (url.pathname === "/bridge.js" && request.method === "GET") {
      return new Response(clientJs, {
        headers: {
          "content-type": "application/javascript; charset=utf-8",
          "access-control-allow-origin": "*",
          "cache-control": "no-cache",
        },
      });
    }

    if (url.pathname === "/socket") {
      if (server.upgrade(request, { data: {} })) {
        return undefined;
      }

      return json({ error: "WebSocket upgrade failed" }, { status: 400 });
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: true, clients: clients.size, pending: pending.size });
    }

    if (url.pathname === "/clients" && request.method === "GET") {
      return json({ clients: [...clients.values()].map(summarizeClient) });
    }

    if (url.pathname === "/console" && request.method === "GET") {
      const level = url.searchParams.get("level");
      const last = Number(url.searchParams.get("last") || 50);
      let logs = level ? consoleLogs.filter((e) => e.level === level) : consoleLogs;
      return json({ logs: logs.slice(-last) });
    }

    if (url.pathname === "/console" && request.method === "DELETE") {
      consoleLogs.length = 0;
      return json({ ok: true });
    }

    if (url.pathname === "/ask" && request.method === "POST") {
      const body = await parseJson(request);

      if (!body || typeof body !== "object") {
        return json({ error: "Expected JSON body" }, { status: 400 });
      }

      if (typeof body.expr !== "string" && typeof body.body !== "string") {
        return json({ error: "Expected expr or body string" }, { status: 400 });
      }

      const client = pickClient(body);
      if (!client) {
        return json({ error: "No connected browser clients" }, { status: 404 });
      }

      try {
        const result = await askClient(client, {
          expr: body.expr,
          body: body.body,
        });

        return json({ client: summarizeClient(client), response: result });
      } catch (error) {
        return json({ error: error instanceof Error ? error.message : String(error) }, { status: 504 });
      }
    }

    return json({
      ok: true,
      endpoints: {
        "bridge.js": "GET /bridge.js - browser client script",
        health: "GET /health",
        clients: "GET /clients",
        console: "GET /console?level=error&last=50 | DELETE /console",
        ask: "POST /ask { expr?, body?, clientId?, urlIncludes? }",
        socket: "WS /socket",
      },
    });
  },

  websocket: {
    open(socket) {
      const id = crypto.randomUUID();
      socket.data.clientId = id;
      clients.set(id, {
        id,
        socket,
        connectedAt: Date.now(),
        lastSeenAt: Date.now(),
      });
    },

    message(socket, rawMessage) {
      let message;

      try {
        message = JSON.parse(String(rawMessage));
      } catch (error) {
        return;
      }

      const id = socket.data.clientId;
      if (!id) return;

      const client = clients.get(id);
      if (!client) return;

      client.lastSeenAt = Date.now();

      if ((message.type === "hello" || message.type === "page" || message.type === "pong") && message.page) {
        client.page = {
          ...message.page,
          clientId: id,
        };
        return;
      }

      if (message.type === "console") {
        handleConsoleMessage(message, id);
        return;
      }

      if (message.type === "result" && message.id) {
        const waiter = pending.get(message.id);
        if (!waiter) return;

        clearTimeout(waiter.timer);
        pending.delete(message.id);
        waiter.resolve(message);
      }
    },

    close(socket) {
      const id = socket.data.clientId;
      if (id) {
        clients.delete(id);
      }
    },
  },
});
} catch (err) {
  if (err.code === "EADDRINUSE" || (err.message && err.message.includes("address"))) {
    console.log(`Port ${port} already taken, ai-server running.`);
    process.exit(0);
  }
  throw err;
}

setInterval(() => {
  const now = Date.now();

  for (const [id, client] of clients) {
    if (now - client.lastSeenAt > STALE_TIMEOUT_MS) {
      try { client.socket.close(); } catch {}
      clients.delete(id);
    } else {
      try { client.socket.send(JSON.stringify({ type: "ping" })); } catch {}
    }
  }
}, PING_INTERVAL_MS);

console.log(`AI bridge server listening on http://${server.hostname}:${server.port}`);
