import createSvelteTemplate from './svelte-template.js'

// Template cache to avoid recompiling the same templates
const templateCache = new Map()

/**
 * Detect if template uses old-style double-brace syntax
 * Old style: {{ expression }} or [[ expression ]]
 * New style: { expression }
 */
function isOldStyleTemplate(text) {
  return (text.includes('{{') && text.includes('}}')) ||
         (text.includes('[[') && text.includes(']]'))
}

/**
 * Convert old-style {{ }}/[[ ]] syntax to new Svelte-style { } syntax
 * This allows gradual migration while keeping a single parser
 */
function convertOldToNewSyntax(text, componentName) {
  // First normalize [[ ]] to {{ }}
  text = text.replaceAll('[[', '{{').replaceAll(']]', '}}')

  // Convert block definitions: {{block name}}...{{/block}} -> {@block name}...{/block}
  text = text.replace(/\{\{block\s+(\w+)\s*\}\}/g, '{@block $1}')
  text = text.replace(/\{\{\/block\}\}/g, '{/block}')
  text = text.replace(/\{\{block:([\w\-]+)\s*\}\}/g, '{@block:$1}')

  // Convert control structures - capture full expression including closing }}
  // {{#if cond}} or {{if cond}} -> {#if cond}
  text = text.replace(/\{\{#?if\s+(.*?)\}\}/g, '{#if $1}')
  text = text.replace(/\{\{\/if\}\}/g, '{/if}')

  // {{#unless cond}} or {{unless cond}} -> {#unless cond}
  text = text.replace(/\{\{#?unless\s+(.*?)\}\}/g, '{#unless $1}')
  text = text.replace(/\{\{\/unless\}\}/g, '{/unless}')

  // {{else}} or {{:else}} -> {:else}
  text = text.replace(/\{\{:?else\}\}/g, '{:else}')

  // {{#for x in y}} or {{for x in y}} -> {#for x in y}
  text = text.replace(/\{\{#?for\s+(.*?)\}\}/g, '{#for $1}')
  text = text.replace(/\{\{\/for\}\}/g, '{/for}')

  // {{#each x as y}} or {{each x as y}} -> {#each x as y}
  text = text.replace(/\{\{#?each\s+(.*?)\}\}/g, '{#each $1}')
  text = text.replace(/\{\{\/each\}\}/g, '{/each}')

  // {{raw x}} or {{#raw x}} or {{html x}} or {{#html x}} -> {@html x}
  text = text.replace(/\{\{#?(?:raw|html)\s+(.*?)\}\}/g, '{@html $1}')

  // {{json x}} -> {@json x}
  text = text.replace(/\{\{json\s+(.*?)\}\}/g, '{@json $1}')

  // Convert remaining expressions: {{ expr }} -> {expr}
  // Handle attribute context: attr={{ expr }} -> attr={expr}
  text = text.replace(/\{\{\s*(.*?)\s*\}\}/g, '{$1}')

  // Log warning in development
  if (typeof console !== 'undefined' && componentName) {
    console.warn(`Fez component "${componentName}" uses old {{ ... }} notation, converting.`)
  }

  return text
}

// let tpl = createTemplate(string)
// tpl({ ... this state ...})
export default function createTemplate(text, opts = {}) {
  // Check cache first
  const cacheKey = text
  if (templateCache.has(cacheKey)) {
    return templateCache.get(cacheKey)
  }

  // Convert old syntax to new if detected
  if (isOldStyleTemplate(text)) {
    text = convertOldToNewSyntax(text, opts.name || opts.componentName)
  }

  // Always use the svelte-style parser now
  const templateFunc = createSvelteTemplate(text, opts)

  templateCache.set(cacheKey, templateFunc)

  return templateFunc
}

// Clear template cache (useful for testing)
export function clearTemplateCache() {
  templateCache.clear()
}
