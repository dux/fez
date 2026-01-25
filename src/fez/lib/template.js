/**
 * Fez Template Compiler
 *
 * Compiles Svelte-style templates to render functions.
 * Supports legacy {{ }} and [[ ]] syntax via auto-conversion.
 *
 * Syntax:
 *   {expression}        - Output escaped value
 *   {@html expr}        - Output raw HTML
 *   {@json expr}        - Output formatted JSON
 *   {#if cond}...{/if}  - Conditional
 *   {#each arr as item} - Loop
 *   {#for item in arr}  - Loop (alt syntax)
 */

import createSvelteTemplate from './svelte-template.js'

// Template cache
const cache = new Map()

// =============================================================================
// MAIN EXPORT
// =============================================================================

/**
 * Create a template render function
 *
 * @param {string} text - Template HTML
 * @param {Object} opts - { name: componentName }
 * @returns {Function} Render function (ctx) => html
 */
export default function createTemplate(text, opts = {}) {
  // Check cache
  if (cache.has(text)) {
    return cache.get(text)
  }

  // Convert legacy syntax if detected
  if (hasLegacySyntax(text)) {
    text = convertLegacySyntax(text, opts.name)
  }

  // Compile
  const fn = createSvelteTemplate(text, opts)
  cache.set(text, fn)

  return fn
}

/**
 * Clear template cache (for testing)
 */
export function clearTemplateCache() {
  cache.clear()
}

// =============================================================================
// LEGACY SYNTAX SUPPORT
// =============================================================================

/**
 * Check if text uses old {{ }} or [[ ]] syntax
 */
function hasLegacySyntax(text) {
  return (text.includes('{{') && text.includes('}}')) ||
         (text.includes('[[') && text.includes(']]'))
}

/**
 * Convert {{ }}/[[ ]] syntax to { } syntax
 *
 * Mappings:
 *   {{ expr }}      -> {expr}
 *   {{if cond}}     -> {#if cond}
 *   {{for x in y}}  -> {#for x in y}
 *   {{each y as x}} -> {#each y as x}
 *   {{raw x}}       -> {@html x}
 *   {{json x}}      -> {@json x}
 *   {{block x}}     -> {@block x}
 */
function convertLegacySyntax(text, componentName) {
  // Normalize [[ ]] to {{ }}
  text = text.replaceAll('[[', '{{').replaceAll(']]', '}}')

  // Blocks
  text = text.replace(/\{\{block\s+(\w+)\s*\}\}/g, '{@block $1}')
  text = text.replace(/\{\{\/block\}\}/g, '{/block}')
  text = text.replace(/\{\{block:([\w\-]+)\s*\}\}/g, '{@block:$1}')

  // Conditionals
  text = text.replace(/\{\{#?if\s+(.*?)\}\}/g, '{#if $1}')
  text = text.replace(/\{\{\/if\}\}/g, '{/if}')
  text = text.replace(/\{\{#?unless\s+(.*?)\}\}/g, '{#unless $1}')
  text = text.replace(/\{\{\/unless\}\}/g, '{/unless}')
  text = text.replace(/\{\{:?else\}\}/g, '{:else}')

  // Loops
  text = text.replace(/\{\{#?for\s+(.*?)\}\}/g, '{#for $1}')
  text = text.replace(/\{\{\/for\}\}/g, '{/for}')
  text = text.replace(/\{\{#?each\s+(.*?)\}\}/g, '{#each $1}')
  text = text.replace(/\{\{\/each\}\}/g, '{/each}')

  // Special directives
  text = text.replace(/\{\{#?(?:raw|html)\s+(.*?)\}\}/g, '{@html $1}')
  text = text.replace(/\{\{json\s+(.*?)\}\}/g, '{@json $1}')

  // Expressions
  text = text.replace(/\{\{\s*(.*?)\s*\}\}/g, '{$1}')

  // Log warning
  if (componentName) {
    console.warn(`Fez component "${componentName}" uses old {{ ... }} notation, converting.`)
  }

  return text
}
