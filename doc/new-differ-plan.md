# Fez Custom Differ - Replace Idiomorph

## The Problem

Fez does not use Shadow DOM. Custom elements like `<input-select>` are replaced at
mount time with `<div class="fez fez-input-select">`. When a parent component
re-renders, the entire template is re-evaluated and passed to Idiomorph for DOM
diffing.

### Core issue: child component state loss

Idiomorph works at the DOM tree level. It does not understand fez components. When it
sees the new tree vs the old tree, it uses tag-name matching and ID-set heuristics to
pair nodes. A fez component like `<input-select>` is just a `<div>` to Idiomorph.

Current workaround (root.js:215-230): `beforeNodeMorphed` returns `false` for any
child node with `.fez` class, skipping the entire subtree. This works in simple cases
but fails when:

1. **Sibling structure changes** - Idiomorph matches nodes positionally when IDs/tags
   are ambiguous. If you add an item above a component in a list, Idiomorph may match
   the old component to the wrong new node, fail the soft-match, and remove + recreate
   it instead of preserving it.

2. **Component appears/disappears conditionally** - `{#if show}<my-comp />{/if}` toggled
   inside a larger template can cause Idiomorph to misalign the entire subtree below.

3. **No change detection** - Even if the template output is byte-for-byte identical,
   Idiomorph still walks the entire tree. Every `state.x = x` (same value) still triggers
   template eval + full morph.

4. **fez-keep is shallow** - `fezKeepNode()` (instance.js:446) only matches direct
   children (`:scope >`). Nested preserved elements inside non-keep wrappers are not
   handled.

### Idiomorph bugs already patched

Three patches in the vendored idiomorph.js:

- **syncClassList** (lines 356-378): upstream uses `setAttribute('class', ...)` which
  restarts CSS animations. Replaced with `classList.add/remove`.
- **ignoreValueOfActiveElement** (lines 111-122): upstream skips morph for any focused
  element. Patched to restrict to INPUT/TEXTAREA/SELECT only.
- **setAttribute error** (lines 322-329): added try/catch around setAttribute to prevent
  crash on invalid attributes.

These are symptoms of a library that was not designed for our use case.

---

## Design: fez-morph - A Component-Aware Differ

Replace Idiomorph with a custom algorithm that understands fez components natively.
~300-400 lines of focused code vs Idiomorph's 944 lines of generic code.

### Key Principles

1. **Hash-skip**: stamp every component root with a `_fezHash` (JS property, not DOM attr)
   of its rendered innerHTML. If the hash matches on re-render, skip the morph entirely.
2. **Component identity**: nodes with `.fez` class are matched by UID, not by position or
   tag-name heuristic. They are never morphed, only preserved/moved/destroyed.
3. **Keyed matching**: non-component nodes with `fez-keep` are matched by key across the
   full subtree (not just direct children).
4. **Minimal touching**: only mutate what actually changed - attributes, text nodes, and
   structural additions/removals.

---

## Algorithm

### Phase 0: Early Exit (hash check)

```
fezRender():
  newHtml = template(this)
  newHash = fnv1(newHtml)
  if (newHash === this._fezHash) return   // nothing changed, skip entirely
  this._fezHash = newHash
  // ... proceed to morph
```

This alone eliminates the most common wasted work: re-renders triggered by setting
a state property to the same value, or parent re-renders that produce identical child
templates. `Fez.fnv1()` already exists in utility.js.

### Phase 1: Build Match Maps

Before diffing, scan both old and new child lists to build identity maps:

```
for each child in oldChildren:
  if child has .fez class and child.fez:
    componentMap[child.fez.UID] = child      // match by UID
  else if child has fez-keep attr:
    keepMap[child.getAttribute('fez-keep')] = child  // match by key
  else if child has id:
    idMap[child.id] = child                  // match by id
```

For new children:

```
for each child in newChildren:
  if child has fez-keep attr:
    key = child.getAttribute('fez-keep')
    if keepMap[key] exists:
      replace child with keepMap[key] in newParent  // swap preserved node
  if child has .fez class (a placeholder for a component that should exist):
    look up matching component in componentMap by fez-name + position
```

### Phase 2: Diff Children (recursive)

Walk old and new child lists in parallel. For each pair:

```
diff(oldParent, newParent):
  oldChildren = Array.from(oldParent.childNodes)
  newChildren = Array.from(newParent.childNodes)

  // Build maps from Phase 1
  oldByKey = buildKeyMap(oldChildren)   // fez-keep, id, UID
  newByKey = buildKeyMap(newChildren)

  // Mark old children that have no match in new tree for removal
  // Mark new children that have no match in old tree for insertion

  // For matched pairs:
  for each (oldChild, newChild) matched pair:
    if oldChild === newChild:
      continue  // same node (from fez-keep swap), skip

    if both are text nodes:
      if oldChild.textContent !== newChild.textContent:
        oldChild.textContent = newChild.textContent
      continue

    if both are elements with same tagName:
      if oldChild has .fez class:
        continue  // fez component - never morph, already preserved
      syncAttributes(oldChild, newChild)
      diff(oldChild, newChild)  // recurse into children
      continue

    // Different node types or tag names: replace
    oldParent.replaceChild(newChild, oldChild)

  // Append remaining new children
  // Remove unmatched old children (call fezOnDestroy for fez components)
```

### Phase 3: Sync Attributes

```
syncAttributes(oldNode, newNode):
  // Remove old attrs not in new
  for attr in oldNode.attributes:
    if !newNode.hasAttribute(attr.name):
      oldNode.removeAttribute(attr.name)

  // Set/update new attrs
  for attr in newNode.attributes:
    if oldNode.getAttribute(attr.name) !== attr.value:
      if attr.name === 'class':
        syncClassList(oldNode, newNode)   // keep the animation-safe patch
      else:
        try:
          oldNode.setAttribute(attr.name, attr.value)
        catch:
          // ignore (keep the dux fix)
```

### Phase 4: Child Matching Strategy

The hardest part. Children without keys need positional matching. Strategy:

```
matchChildren(oldList, newList):
  matched = []
  usedOld = Set()
  usedNew = Set()

  // Pass 1: match by identity (UID, fez-keep key, id)
  for each newChild in newList:
    key = getKey(newChild)  // fez-keep attr, id, or fez UID
    if key and oldByKey[key]:
      matched.push([oldByKey[key], newChild])
      usedOld.add(oldByKey[key])
      usedNew.add(newChild)

  // Pass 2: match remaining by tag name + position
  oldIdx = 0
  for each newChild in newList:
    if usedNew.has(newChild): continue
    while oldIdx < oldList.length and usedOld.has(oldList[oldIdx]):
      oldIdx++
    if oldIdx < oldList.length:
      oldChild = oldList[oldIdx]
      if isSoftMatch(oldChild, newChild):  // same nodeType + tagName
        matched.push([oldChild, newChild])
        usedOld.add(oldChild)
        usedNew.add(newChild)
      oldIdx++

  // Remaining old = to remove, remaining new = to insert
  return { matched, toRemove, toInsert }
```

### Handling `ignoreActiveValue`

```
syncAttributes(oldNode, newNode):
  // Skip value/checked sync on focused INPUT/TEXTAREA/SELECT
  if oldNode === document.activeElement:
    tag = oldNode.nodeName
    if tag === 'INPUT' or tag === 'TEXTAREA' or tag === 'SELECT':
      skip 'value' and 'checked' attributes
```

---

## File Structure

```
src/fez/vendor/idiomorph.js   -> DELETE (after migration)
src/fez/morph.js              -> NEW - the custom differ (~300-400 lines)
src/fez/root.js               -> UPDATE Fez.morphdom() to use new differ
src/fez/instance.js           -> UPDATE fezRender() to add hash-skip
                               -> UPDATE fezKeepNode() - merge into differ
test/morph.test.js            -> NEW - unit tests for the differ
test/idiomorph.test.js        -> UPDATE or replace with morph tests
test/fez-keep.test.js         -> UPDATE to use new differ
```

---

## Implementation Steps

### Step 1: Hash-skip in fezRender (low risk, high impact)

Add hash check before morphing. This is safe to add even before replacing Idiomorph -
it just prevents unnecessary morph calls:

```js
// instance.js fezRender()
if (renderedTpl) {
  const newHash = Fez.fnv1(renderedTpl);
  if (newHash === this._fezHash) {
    this._isRendering = false;
    return; // identical output, skip morph
  }
  this._fezHash = newHash;
  // ... proceed with morph
}
```

### Step 2: Write morph.js core

The new `fezMorph(oldNode, newNode, opts)` function. API:

```js
export function fezMorph(target, newNode, opts = {}) {
  // opts.beforeRemove(node) - callback before removing a node
  // opts.skipNode(node) - return true to skip a subtree entirely
  // Returns: void (mutates target in-place)
}
```

Core logic:

1. Copy target attributes to preserve root identity
2. Build key maps for children
3. Swap fez-keep nodes from target into newNode (absorb fezKeepNode logic)
4. Diff children recursively
5. Clean up whitespace

### Step 3: Integrate into root.js

Replace `Fez.morphdom`:

```js
import { fezMorph } from "./morph.js";

Fez.morphdom = (target, newNode) => {
  fezMorph(target, newNode, {
    skipNode: (oldNode) => {
      // Preserve child fez components
      return (
        oldNode.classList?.contains("fez") &&
        oldNode.fez &&
        !oldNode.fez._destroyed
      );
    },
    beforeRemove: (node) => {
      // Cleanup destroyed fez components
      if (node.classList?.contains("fez") && node.fez) {
        node.fez.fezOnDestroy();
      }
    },
  });
};
```

### Step 4: Absorb fezKeepNode into the differ

Currently `fezKeepNode()` runs as a pre-pass before Idiomorph, swapping preserved nodes.
The new differ handles this natively via key maps. Remove `fezKeepNode()` from
instance.js and let the differ's Phase 1 key matching handle it.

The `:scope >` restriction on fez-keep (instance.js:446) was a workaround for Idiomorph
not understanding component boundaries. With a component-aware differ that stops recursion
at `.fez` nodes, we can safely match fez-keep at any depth within the component's own
subtree.

### Step 5: Tests

Port existing tests from `idiomorph.test.js` and `fez-keep.test.js`, plus new cases:

- Hash-skip: same output -> no DOM mutation
- Hash-skip: different output -> morph happens
- Attribute sync: add, remove, update attributes
- Attribute sync: class uses classList (animation-safe)
- Attribute sync: skip focused input value
- Text node update
- Element replace (different tag)
- Child reorder with fez-keep keys
- Child insert/remove
- Fez component preservation (skip .fez nodes)
- Fez component removal (fezOnDestroy called)
- Fez component reorder in list (matched by UID, not position)
- Nested fez-keep (not just direct children)
- Conditional show/hide with fez component siblings
- Large template with many children (performance)

### Step 6: Delete idiomorph.js

Remove the vendored file and all imports.

---

## Edge Cases to Handle

### 1. Component reorder in loops

```html
{#each state.items as item}
<span fez-keep="item-{item.id}">
  <my-comp data="{item.id}" />
</span>
{/each}
```

Items reorder -> fez-keep keys change position -> differ matches by key, moves nodes.
The `<my-comp>` inside the preserved span is untouched.

### 2. Conditional component

```html
{#if state.show}
<my-comp />
{/if}
<other-comp />
```

When `show` toggles: `<my-comp>` is added/removed. `<other-comp>` shifts position.
Without keyed matching, positional matching would misalign. Solution: the differ
identifies `<other-comp>` (a `.fez` node) by its UID and moves it, rather than
trying to morph `<my-comp>` into `<other-comp>`.

### 3. Same-value state assignment

```js
this.state.count = this.state.count; // no change
```

Hash-skip catches this. Template output is identical -> skip morph entirely.

### 4. SVG elements

SVG nodes must be created with `createElementNS`. The differ should use
`importNode` or `adoptNode` when moving nodes from the template into the live DOM,
rather than `createElement`. Since we use `innerHTML` to parse the template, the
browser already creates SVG nodes correctly. The differ just moves/preserves them.

### 5. `<script>` and `<style>` in templates

These should be ignored during diffing (don't execute scripts on morph).
The differ should skip `<script>` nodes and only sync `<style>` content.

---

## Performance Notes

- **fnv1 hash** is O(n) on the HTML string length. For a typical component template
  (1-5 KB), this is ~1-5 microseconds. The hash check eliminates the entire morph when
  nothing changed.
- **Key maps** are built once per diff call. Map lookups are O(1).
- **Tree walk** is O(n) where n = number of DOM nodes in the component (not including
  skipped child component subtrees).
- **No virtual DOM** - we diff directly against the live DOM, same as Idiomorph.
  The new template is parsed via innerHTML into a detached element, then diffed against
  the live tree.

### Comparison with Idiomorph

| Aspect                  | Idiomorph                  | fez-morph              |
| ----------------------- | -------------------------- | ---------------------- |
| Lines of code           | 944                        | ~300-400               |
| Component awareness     | None (callback workaround) | Native                 |
| Hash skip               | No                         | Yes                    |
| Key matching            | ID-set heuristic (complex) | Simple key/id/UID maps |
| fez-keep                | External pre-pass          | Built-in               |
| Nested fez-keep         | Direct children only       | Full subtree           |
| Active input protection | Patched (was buggy)        | Native                 |
| Class sync              | Patched (was buggy)        | Native                 |
| setAttribute errors     | Patched (was buggy)        | Native                 |

---

## Migration Plan

1. Add hash-skip to fezRender (can ship independently, zero risk)
2. Write morph.js with full test suite
3. Wire morph.js into root.js behind a flag: `Fez.USE_NEW_MORPH = true`
4. Test with demo components, verify no regressions
5. Make new morph the default, keep Idiomorph as fallback for one release
6. Delete idiomorph.js

---

## Open Questions

1. **Should hash be on innerHTML or the full rendered string?** innerHTML is what we
   compare. The rendered template string before `fezParseHtml()` processing could also
   work but includes `fez.` references that get rewritten - better to hash after
   `fezParseHtml()`.

2. **Should we also hash attributes?** The root element's attributes are copied from old
   to new before morphing. If we hash innerHTML only, attribute changes on the root still
   need the full diff. Could add a separate attribute hash, but this adds complexity for
   a rare case.

3. **Should fez-keep matching be depth-limited?** Matching `fez-keep` across the full
   subtree could accidentally match elements inside other components if the differ doesn't
   stop at `.fez` boundaries. The differ must NOT recurse into `.fez` child nodes for
   key matching.

4. **Should the differ handle `<table>` special cases?** Browsers enforce structure rules
   for tables (`<tr>` must be inside `<tbody>`, etc.). innerHTML parsing handles this
   automatically. The differ should not need special table handling since we parse via
   innerHTML.
