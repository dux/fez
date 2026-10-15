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
 * @param {boolean} [hasCatch] - the block renders {:catch}; without it a rejection is reported
 * @returns {Object} { status, value, error }
 */
export default function awaitHelper(component, awaitId, promiseOrValue, hasCatch = false) {
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
    existing.justSettled = false;
    return existing;
  }

  // A new promise in the very render its predecessor's settle scheduled, again
  // and again: the template builds it ({#await fetchData()}), so every settle
  // starts the next request. Keep the settled value and say so once.
  const loops = existing?.justSettled ? existing.loops + 1 : 0;
  if (loops >= 3) {
    if (!existing.reported) {
      existing.reported = true;
      component.fezError?.(
        'await',
        '{#await} gets a new promise on every render - assign it to state once (this.state.data = fetchData()) and await state.data',
      );
    }
    return existing;
  }

  // New promise - set pending state and start tracking
  const state = { status: 'pending', value: null, error: null, promise: promiseOrValue, loops };
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
    current.justSettled = true;
    if (status === 'rejected' && !hasCatch) {
      component.fezError?.('await', `{#await} rejected and has no {:catch}: ${result?.message || result}`, result instanceof Error ? result : undefined);
    }
    component.fezNextTick?.(component.fezRender, 'fezRender');
  };
  promiseOrValue.then(
    (value) => settle('resolved', 'value', value),
    (error) => settle('rejected', 'error', error),
  );

  return state;
}
