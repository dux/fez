/**
 * Fez - Runtime Custom DOM Elements Library
 *
 * Entry point that:
 * - Exports FezBase and Fez
 * - Sets up auto-compilation observer
 * - Handles garbage collection
 */

// =============================================================================
// EXPORTS
// =============================================================================

import FezBase from './fez/instance.js'
import Fez from './fez/root.js'

// Expose to window. Rollup inlines the fez dist IIFE into every app bundle that
// contains a .fez component, so this module can run several times on one page.
// Only the first run may claim window.Fez / load defaults / start the observer:
// custom elements are defined against that first instance and connectNode reads
// the global window.Fez.index, so a later copy resetting it orphans those elements.
const fezPrimary = typeof window !== 'undefined' && !window.Fez

if (fezPrimary) {
  window.FezBase = FezBase
  window.Fez = Fez

  // Load default components
  import('./fez/defaults.js')
}

// =============================================================================
// AUTO-COMPILATION OBSERVER
// =============================================================================

// Watch for template/xmp/script[fez] elements and compile them
const observer = new MutationObserver(mutations => {
  for (const { addedNodes, removedNodes } of mutations) {
    // Compile new fez templates
    addedNodes.forEach(node => {
      if (node.nodeType !== 1) return

      if (node.matches?.('template[fez], xmp[fez], script[fez]')) {
        Fez.compile(node)
        node.remove()
      }

      node.querySelectorAll?.('template[fez], xmp[fez], script[fez]').forEach(tpl => {
        Fez.compile(tpl)
        tpl.remove()
      })
    })

    // Cleanup removed components
    // Use microtask to check if node was just moved (will be reconnected)
    // vs actually removed from the document
    removedNodes.forEach(node => {
      if (node.nodeType !== 1) return

      // Helper to cleanup a single element
      const cleanup = (el) => {
        if (el.fez && !el.fez._destroyed) {
          // Delay cleanup to check if node is reconnected (just moved, not removed)
          queueMicrotask(() => {
            // If still not connected and not destroyed, cleanup
            if (!el.isConnected && el.fez && !el.fez._destroyed) {
              Fez.instances.delete(el.fez.UID)
              el.fez.fezOnDestroy()
            }
          })
        }
      }

      // Check if removed node itself is a fez component
      cleanup(node)

      // Check all children for fez components
      node.querySelectorAll?.('.fez')?.forEach(cleanup)
    })
  }
})

if (fezPrimary) observer.observe(document.documentElement, {
  childList: true,
  subtree: true
})

// =============================================================================
// MODULE EXPORTS
// =============================================================================

export default Fez
export { Fez, FezBase }
