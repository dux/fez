// Global state with automatic component subscription
//
// Components access state via this.globalState proxy which automatically:
// - Registers component as listener when reading a value
// - Notifies component when that value changes
// - Calls onGlobalStateChange(key, value, oldValue) right away, then
//   schedules fezRender() on the next frame (same tick as local state, so
//   several key changes in one handler render once)
//
// Example usage:
//
//   class Counter extends FezBase {
//     increment() {
//       this.globalState.count = (this.globalState.count || 0) + 1
//     }
//
//     onGlobalStateChange(key, value) {
//       console.log(`State ${key} changed to ${value}`)
//     }
//
//     render() {
//       return `<button onclick="fez.increment()">
//         Count: ${this.globalState.count || 0}
//       </button>`
//     }
//   }
//
// External access:
//   Fez.state.set('count', 10)
//   Fez.state.get('count') // 10
//   Fez.state.subscribe('count', (value, oldValue, key) => {})
//   Fez.state.subscribe((key, value, oldValue) => {})

// One registry for everything that listens: a sub is { fn, fez? }. Component
// subs carry their instance so forEach() and liveness pruning can see it;
// plain subscribe() subs are just the function.
const GlobalState = {
  data: {},
  subs: new Map(), // key -> Set of { fn, fez? }
  anySubs: new Set(), // Set of fn listening to every key

  // `writer` is the component behind a this.globalState write (internal),
  // so its own listener can tell a self-write apart from an outside one
  set(key, value, writer) {
    const oldValue = this.data[key];
    if (oldValue === value) return;
    this.data[key] = value;
    this.notify(key, value, oldValue, writer);
  },

  get(key) {
    return this.data[key];
  },

  notify(key, value, oldValue, writer) {
    Fez.consoleLog(`Global state change for ${key}: ${value} (from ${oldValue})`);

    const subs = this.subs.get(key);
    if (subs) {
      for (const sub of subs) {
        // Component gone without running its destroy hook - drop it
        if (sub.fez && !sub.fez.isConnected) {
          subs.delete(sub);
          continue;
        }
        try {
          sub.fn(value, oldValue, key, writer);
        } catch (error) {
          console.error(`Error in subscriber for key ${key}:`, error);
        }
      }
    }

    for (const fn of this.anySubs) {
      try {
        fn(key, value, oldValue);
      } catch (error) {
        console.error("Error in global subscriber:", error);
      }
    }
  },

  addSub(key, sub) {
    if (!this.subs.has(key)) this.subs.set(key, new Set());
    this.subs.get(key).add(sub);
    return () => {
      const subs = this.subs.get(key);
      if (!subs) return;
      subs.delete(sub);
      if (subs.size === 0) this.subs.delete(key);
    };
  },

  // Subscribe to state changes, returns unsubscribe function
  //   Fez.state.subscribe(func)      - listen to all changes
  //   Fez.state.subscribe(key, func) - listen to specific key changes
  subscribe(keyOrFunc, func) {
    if (typeof keyOrFunc === "function") {
      this.anySubs.add(keyOrFunc);
      return () => this.anySubs.delete(keyOrFunc);
    }
    return this.addSub(keyOrFunc, { fn: func });
  },

  // Execute function for each connected component listening to a key
  forEach(key, func) {
    const subs = this.subs.get(key);
    if (!subs) return;
    for (const sub of subs) {
      if (!sub.fez) continue;
      if (sub.fez.isConnected) {
        func(sub.fez);
      } else {
        subs.delete(sub);
      }
    }
  },

  createProxy(component) {
    // key -> unsubscribe, so a component subscribes to each key once
    const keys = new Map();

    component.addOnDestroy(() => {
      keys.forEach((unsub) => unsub());
      keys.clear();
    });

    const listen = (key) => {
      if (keys.has(key)) return;
      const fn = (value, oldValue, _key, writer) => {
        component.onGlobalStateChange(key, value, oldValue);
        // Mirror local state: a self-write inside a silent scope (init, a
        // render in flight) is already covered. Anything else (another
        // component, Fez.state.set) coalesces with local state changes into
        // one frame.
        const selfWrite = writer === component && component._fezSilent;
        if (!selfWrite) {
          component.fezNextTick(component.fezRender, "fezRender");
        }
      };
      keys.set(key, this.addSub(key, { fn, fez: component }));
    };

    return new Proxy(
      {},
      {
        get: (_, key) => {
          if (typeof key === "symbol") return undefined;
          listen(key);
          return this.data[key];
        },
        set: (_, key, value) => {
          if (typeof key !== "symbol") this.set(key, value, component);
          return true;
        },
        has: (_, key) => typeof key !== "symbol" && key in this.data,
      },
    );
  },
};

export default GlobalState;
