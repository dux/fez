import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import utility from "../src/fez/lib/utility.js";

// Minimal Fez stub carrying just what Fez.fetch touches.
function makeFez() {
  const Fez = {
    consoleLog: () => {},
    onError: (_scope, err) => {
      throw err;
    },
  };
  utility(Fez);
  return Fez;
}

// Deferred fetch mock: each call is counted and left pending until resolved
// manually, so we can fan out concurrent callers while the request is in flight.
function installDeferredFetch(body = "hello", contentType = "text/plain") {
  const original = global.fetch;
  const state = { calls: 0, resolvers: [] };
  global.fetch = (url) => {
    state.calls++;
    return new Promise((resolve) => {
      state.resolvers.push(() =>
        resolve({
          headers: { get: () => contentType },
          text: async () => body,
          json: async () => JSON.parse(body),
        }),
      );
    });
  };
  state.flush = () => state.resolvers.forEach((r) => r());
  state.restore = () => {
    global.fetch = original;
  };
  return state;
}

let net;
beforeEach(() => {
  net = installDeferredFetch();
});
afterEach(() => {
  net.restore();
});

describe("Fez.fetch in-flight de-dup", () => {
  test("concurrent identical GETs share one network request", async () => {
    const Fez = makeFez();

    const a = Fez.fetch("/demo/fez/ui-card.fez");
    const b = Fez.fetch("/demo/fez/ui-card.fez");
    const c = Fez.fetch("/demo/fez/ui-card.fez");

    // All three joined before any resolved.
    expect(net.calls).toBe(1);

    net.flush();
    expect(await a).toBe("hello");
    expect(await b).toBe("hello");
    expect(await c).toBe("hello");
  });

  test("callback and promise callers de-dup together", async () => {
    const Fez = makeFez();

    let cbValue;
    const p = Fez.fetch("/x.fez");
    Fez.fetch("/x.fez", (data) => {
      cbValue = data;
    });

    expect(net.calls).toBe(1);

    net.flush();
    await p;
    // let the callback microtask settle
    await Promise.resolve();
    expect(cbValue).toBe("hello");
  });

  test("in-flight entry clears after settle, allowing a later refetch on miss", async () => {
    const Fez = makeFez();

    const first = Fez.fetch("/y.fez");
    expect(net.calls).toBe(1);
    net.flush();
    await first;

    // Resolved value is cached now -> served from cache, no new network call.
    await Fez.fetch("/y.fez");
    expect(net.calls).toBe(1);

    // After clearing, the next call must hit the network again (and the stale
    // in-flight entry must be gone, not block the refetch).
    Fez.clearFetchCache();
    const again = Fez.fetch("/y.fez");
    expect(net.calls).toBe(2);
    net.flush();
    await again;
  });

  test("POSTs are not de-duped (non-idempotent)", async () => {
    const Fez = makeFez();

    const a = Fez.fetch("POST", "/submit", { name: "a" });
    const b = Fez.fetch("POST", "/submit", { name: "b" });

    expect(net.calls).toBe(2);

    net.flush();
    await Promise.all([a, b]);
  });

  test("sequential POSTs to the same URL each hit the network (never cached)", async () => {
    const Fez = makeFez();

    const a = Fez.fetch("POST", "/submit", { name: "first" });
    net.flush();
    await a;

    // The body is not part of the cache key, so a cached POST would wrongly
    // serve 'first' back and never send 'second'. It must hit the network.
    const b = Fez.fetch("POST", "/submit", { name: "second" });
    expect(net.calls).toBe(2);
    net.flush();
    await b;
  });

  test("a failed GET clears the in-flight entry so a retry re-fetches", async () => {
    const Fez = makeFez();

    // Rejecting deferred fetch, overriding the beforeEach mock for this test.
    const st = { calls: 0, rejecters: [] };
    global.fetch = () => {
      st.calls++;
      return new Promise((_resolve, reject) => {
        st.rejecters.push(() => reject(new Error("boom")));
      });
    };

    // Two concurrent callers share one in-flight request.
    const a = Fez.fetch("/flaky.fez").catch(() => "err-a");
    const b = Fez.fetch("/flaky.fez").catch(() => "err-b");
    expect(st.calls).toBe(1);

    st.rejecters.forEach((r) => r());
    expect(await a).toBe("err-a");
    expect(await b).toBe("err-b");
    await Promise.resolve(); // let the .finally cleanup microtask run

    // If the in-flight entry cleared on rejection, this retries the network.
    // (Without the .finally cleanup it returns the poisoned rejected promise
    // and st.calls stays 1.)
    const c = Fez.fetch("/flaky.fez").catch(() => "err-c");
    expect(st.calls).toBe(2);
    st.rejecters.forEach((r) => r());
    expect(await c).toBe("err-c");
  });
});
