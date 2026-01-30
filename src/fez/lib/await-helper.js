/**
 * Async await helper for {#await} blocks in templates
 *
 * Manages promise state tracking and triggers re-renders when promises resolve/reject.
 */

/**
 * Handle promise state for {#await} blocks in templates
 * Returns { status: 'pending'|'resolved'|'rejected', value, error }
 *
 * @param {FezBase} component - The component instance
 * @param {number} awaitId - Unique ID for this await block
 * @param {Promise|any} promiseOrValue - The promise or value to await
 * @returns {Object} { status, value, error }
 */
export default function awaitHelper(component, awaitId, promiseOrValue) {
  // Initialize await states map on the component
  component._awaitStates ||= new Map()

  // Check if we already have state for this await block
  const existing = component._awaitStates.get(awaitId)

  // If not a promise, return resolved immediately
  if (!promiseOrValue || typeof promiseOrValue.then !== 'function') {
    return { status: 'resolved', value: promiseOrValue, error: null }
  }

  // If we have existing state for this exact promise, return it
  if (existing && existing.promise === promiseOrValue) {
    return existing
  }

  // New promise - set pending state and start tracking
  const state = { status: 'pending', value: null, error: null, promise: promiseOrValue }
  component._awaitStates.set(awaitId, state)

  // Handle promise resolution
  promiseOrValue
    .then(value => {
      // Only update if this is still the current promise for this await block
      const current = component._awaitStates.get(awaitId)
      if (current && current.promise === promiseOrValue) {
        current.status = 'resolved'
        current.value = value
        // Trigger re-render
        if (component.isConnected) {
          component.fezNextTick(component.fezRender, 'fezRender')
        }
      }
    })
    .catch(error => {
      const current = component._awaitStates.get(awaitId)
      if (current && current.promise === promiseOrValue) {
        current.status = 'rejected'
        current.error = error
        // Trigger re-render
        if (component.isConnected) {
          component.fezNextTick(component.fezRender, 'fezRender')
        }
      }
    })

  return state
}
