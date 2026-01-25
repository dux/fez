// Global state manager with automatic component subscription
//
// Components access state via this.globalState proxy which automatically:
// - Registers component as listener when reading a value
// - Notifies component when that value changes
// - Calls onGlobalStateChange(key, value) if defined, then fezRender()
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

const GlobalState = {
  data: {},
  listeners: new Map(), // key -> Set of components
  subscribers: new Map(), // key -> Set of functions (for subscribe method)
  globalSubscribers: new Set(), // Set of functions that listen to all changes

  notify(key, value, oldValue) {
    Fez.consoleLog(`Global state change for ${key}: ${value} (from ${oldValue})`)

    // Notify component listeners
    const listeners = this.listeners.get(key)
    if (listeners) {
      listeners.forEach(comp => {
        if (comp.isConnected) {
          try {
            comp.onGlobalStateChange(key, value, oldValue)
            comp.fezRender()
          } catch (error) {
            console.error(`Error in component listener for key ${key}:`, error)
          }
        } else {
          listeners.delete(comp)
        }
      })
    }

    // Notify key-specific subscribers
    const subscribers = this.subscribers.get(key)
    if (subscribers) {
      subscribers.forEach(func => {
        try {
          func(value, oldValue, key)
        } catch (error) {
          console.error(`Error in subscriber for key ${key}:`, error)
        }
      })
    }

    // Notify global subscribers
    this.globalSubscribers.forEach(func => {
      try {
        func(key, value, oldValue)
      } catch (error) {
        console.error(`Error in global subscriber:`, error)
      }
    })
  },

  createProxy(component) {
    // Register cleanup when component is destroyed
    component.addOnDestroy(() => {
      for (const [key, listeners] of this.listeners) {
        listeners.delete(component)
      }
      component._globalStateKeys?.clear()
    })

    return new Proxy({}, {
      get: (target, key) => {
        // Skip symbol keys and prototype methods
        if (typeof key === 'symbol') return undefined

        // Skip if already listening to this key
        component._globalStateKeys ||= new Set()
        if (!component._globalStateKeys.has(key)) {
          component._globalStateKeys.add(key)

          if (!this.listeners.has(key)) {
            this.listeners.set(key, new Set())
          }
          this.listeners.get(key).add(component)
        }

        return this.data[key]
      },

      set: (target, key, value) => {
        // Skip symbol keys
        if (typeof key === 'symbol') return true

        const oldValue = this.data[key]
        if (oldValue !== value) {
          this.data[key] = value
          this.notify(key, value, oldValue)
        }
        return true
      }
    })
  },

  // Direct methods for use outside components
  set(key, value) {
    const oldValue = this.data[key]
    if (oldValue !== value) {
      this.data[key] = value
      this.notify(key, value, oldValue)
    }
  },

  get(key) {
    return this.data[key]
  },

  // Execute function for each component listening to a key
  forEach(key, func) {
    const listeners = this.listeners.get(key)
    if (listeners) {
      listeners.forEach(comp => {
        if (comp.isConnected) {
          func(comp)
        } else {
          listeners.delete(comp)
        }
      })
    }
  },

  // Subscribe to state changes
  // Usage: Fez.state.subscribe(func) - listen to all changes
  //        Fez.state.subscribe(key, func) - listen to specific key changes
  subscribe(keyOrFunc, func) {
    if (typeof keyOrFunc === 'function') {
      // subscribe(func) - global subscription
      this.globalSubscribers.add(keyOrFunc)
      return () => this.globalSubscribers.delete(keyOrFunc)
    } else {
      // subscribe(key, func) - key-specific subscription
      const key = keyOrFunc
      if (!this.subscribers.has(key)) {
        this.subscribers.set(key, new Set())
      }
      this.subscribers.get(key).add(func)
      return () => {
        const keySubscribers = this.subscribers.get(key)
        if (keySubscribers) {
          keySubscribers.delete(func)
          if (keySubscribers.size === 0) {
            this.subscribers.delete(key)
          }
        }
      }
    }
  }
}

export default GlobalState
