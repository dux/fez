/**
 * Fez Pub/Sub System
 *
 * Global API:
 *   Fez.subscribe('event', callback)                 // Always fires
 *   Fez.subscribe('#selector', 'event', callback)   // Fires if selector found at publish time
 *   Fez.subscribe(node, 'event', callback)          // Fires if node.isConnected
 *   Fez.publish('event', ...args)                    // Broadcast to all
 *
 * Instance API (see instance.js):
 *   this.subscribe('event', callback)               // Auto-cleanup on destroy
 *   this.publish('event', ...args)                  // Bubble to parent components
 */

// =============================================================================
// STORAGE
// =============================================================================

// Global subscriptions: channel -> Set of { selector, node, callback }
const globalSubs = new Map()

// Component subscriptions: channel -> [[component, callback], ...]
// Used for parent-child bubbling (this.publish)
const componentSubs = {}

// =============================================================================
// GLOBAL PUB/SUB
// =============================================================================

/**
 * Subscribe to a channel (global)
 *
 * @param {string|Node} nodeOrSelector - Selector, node, or channel name
 * @param {string|Function} channelOrCallback - Channel name or callback
 * @param {Function} [callback] - Callback function
 * @returns {Function} Unsubscribe function
 *
 * @example
 *   subscribe('user-login', (user) => console.log(user))
 *   subscribe('#header', 'theme-change', (theme) => ...)
 *   subscribe(document.body, 'resize', () => ...)
 */
function subscribe(nodeOrSelector, channelOrCallback, callback) {
  let selector = null
  let node = null
  let channel

  // Normalize arguments
  if (typeof channelOrCallback === 'function') {
    // subscribe('event', callback)
    channel = nodeOrSelector
    callback = channelOrCallback
  } else {
    // subscribe(node/selector, 'event', callback)
    channel = channelOrCallback
    if (typeof nodeOrSelector === 'string') {
      selector = nodeOrSelector  // Store selector, resolve at publish time
    } else {
      node = nodeOrSelector  // Store node reference
    }
  }

  if (!globalSubs.has(channel)) {
    globalSubs.set(channel, new Set())
  }

  const channelSubs = globalSubs.get(channel)

  // Remove duplicate (same selector/node + callback)
  for (const sub of channelSubs) {
    if (sub.callback === callback && sub.selector === selector && sub.node === node) {
      channelSubs.delete(sub)
    }
  }

  const subscription = { selector, node, callback }
  channelSubs.add(subscription)

  // Return unsubscribe function
  return () => channelSubs.delete(subscription)
}

/**
 * Publish to a channel (global broadcast)
 *
 * @param {string} channel - Event name
 * @param {...any} args - Arguments to pass to callbacks
 */
function publish(channel, ...args) {
  const channelSubs = globalSubs.get(channel)
  if (channelSubs) {
    for (const sub of channelSubs) {
      let target = null

      if (sub.selector) {
        // Resolve selector at publish time
        target = document.querySelector(sub.selector)
        if (!target) continue  // Skip if not found
      } else if (sub.node) {
        // Check node connection
        if (!sub.node.isConnected) {
          channelSubs.delete(sub)  // Auto-cleanup disconnected
          continue
        }
        target = sub.node
      }

      // Call with target as context (or null for global)
      try {
        sub.callback.call(target, ...args)
      } catch (e) {
        console.error(`Fez pubsub error on "${channel}":`, e)
      }
    }
  }

  // Also trigger component subscriptions (legacy compatibility)
  if (componentSubs[channel]) {
    componentSubs[channel].forEach(([comp, cb]) => {
      if (comp.isConnected) {
        cb.bind(comp)(...args)
      }
    })
  }
}

// =============================================================================
// COMPONENT PUB/SUB (for this.subscribe / this.publish)
// =============================================================================

/**
 * Subscribe from a component (used by this.subscribe)
 * Stores subscription for parent-child bubbling
 *
 * @param {FezBase} component - Component instance
 * @param {string} channel - Event name
 * @param {Function} callback - Handler function
 * @returns {Function} Unsubscribe function
 */
function componentSubscribe(component, channel, callback) {
  componentSubs[channel] ||= []

  // Clean up disconnected components
  componentSubs[channel] = componentSubs[channel].filter(([comp]) => comp.isConnected)

  // Add subscription
  componentSubs[channel].push([component, callback])

  // Return unsubscribe function
  return () => {
    componentSubs[channel] = componentSubs[channel].filter(
      ([comp, cb]) => !(comp === component && cb === callback)
    )
  }
}

/**
 * Publish from a component (used by this.publish)
 * Bubbles up through parent components
 *
 * @param {FezBase} component - Component instance
 * @param {string} channel - Event name
 * @param {...any} args - Arguments
 * @returns {boolean} True if a parent handled the event
 */
function componentPublish(component, channel, ...args) {
  const handlePublish = (comp) => {
    if (componentSubs[channel]) {
      const sub = componentSubs[channel].find(([c]) => c === comp)
      if (sub) {
        sub[1].bind(comp)(...args)
        return true
      }
    }
    return false
  }

  // Check current component first
  if (handlePublish(component)) {
    return true
  }

  // Bubble up to parent components
  let parent = component.root?.parentElement
  while (parent) {
    if (parent.fez) {
      if (handlePublish(parent.fez)) {
        return true
      }
    }
    parent = parent.parentElement
  }

  return false
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  subscribe,
  publish,
  componentSubscribe,
  componentPublish,
  globalSubs,
  componentSubs
}
