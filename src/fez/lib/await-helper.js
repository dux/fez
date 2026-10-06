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
  component._awaitStates ||= new Map();

  // Release resolved values when the component is destroyed
  if (!component._awaitStatesCleanupAdded) {
    component._awaitStatesCleanupAdded = true;
    component.addOnDestroy?.(() => {
      component._awaitStates = null;
    });
  }

  // Check if we already have state for this await block
  const existing = component._awaitStates.get(awaitId);

  // If not a promise, return resolved immediately
  if (!promiseOrValue || typeof promiseOrValue.then !== 'function') {
    return { status: 'resolved', value: promiseOrValue, error: null };
  }

  // If we have existing state for this exact promise, return it
  if (existing && existing.promise === promiseOrValue) {
    return existing;
  }

  // New promise - set pending state and start tracking
  const state = { status: 'pending', value: null, error: null, promise: promiseOrValue };
  component._awaitStates.set(awaitId, state);

  // Settle only if this is still the current promise for this await block and
  // the component was not destroyed meanwhile (destroy drops _awaitStates).
  // Two-arg then: a rejection is handled here and never escapes as unhandled.
  const settle = (status, key, result) => {
    const current = component._awaitStates?.get(awaitId);
    if (current?.promise !== promiseOrValue) {
      return;
    }
    current.status = status;
    current[key] = result;
    component.fezNextTick?.(component.fezRender, 'fezRender');
  };
  promiseOrValue.then(
    (value) => settle('resolved', 'value', value),
    (error) => settle('rejected', 'error', error),
  );

  return state;
}
