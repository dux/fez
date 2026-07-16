/**
 * nodeMorph - Pluggable DOM differ
 *
 * A simple, hook-driven DOM differ that:
 * - Matches keyed elements by id, key, fez-key, or fez-keep attribute
 * - Lets callers extend keying via describeOld/describeNew (used by fez to match live
 *   component instances by UID and template placeholders by class)
 * - Falls back to tag+class similarity scoring for unkeyed siblings
 * - Uses classList.add/remove for class sync (preserves CSS animations)
 * - Skips value sync on focused INPUT/TEXTAREA/SELECT
 */

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Morph target element to match newNode structure.
 * Mutates target in-place. newNode is consumed (nodes may be moved out of it).
 *
 * The target's own attributes are NOT touched - only its children are diffed.
 *
 * @param {Element} target  - live DOM element to update
 * @param {Element} newNode - detached element with desired state
 * @param {Object}  opts
 * @param {Function} [opts.describeOld(oldNode)] - return { key, aliases?, preserve?, softMatch? } or null
 * @param {Function} [opts.describeNew(newNode)] - return primary key string or null
 * @param {Function} [opts.skipNode(oldNode)]    - return true to preserve subtree as-is
 * @param {Function} [opts.shouldPreserve(oldNode, newNode)] - return false to force rewrite of a preserve match
 * @param {Function} [opts.beforeRemove(node)]   - called before removing a node
 * @param {Function} [opts.onPreserve(oldNode, newNode)] - called when a keyed node is matched and preserved
 */
export function nodeMorph(target, newNode, opts = {}) {
  // NOTE: We do NOT sync root element attributes here.
  // Callers may set root attributes (e.g. component wrappers); diffing them
  // would surprise the caller.
  diffChildren(target, newNode, opts);

  // Clean up trailing whitespace text node (matches old behavior)
  const next = target.nextSibling;
  if (next?.nodeType === 3 && !next.textContent.trim()) {
    next.remove();
  }
}

// Back-compat alias
export const fezMorph = nodeMorph;

// ---------------------------------------------------------------------------
// Attribute Sync
// ---------------------------------------------------------------------------

function syncAttributes(oldNode, newNode) {
  const oldAttrs = oldNode.attributes;
  const newAttrs = newNode.attributes;

  // Check if this is a focused form input - skip value/checked sync
  const isActiveInput =
    oldNode === document.activeElement && isFormInput(oldNode);

  // Remove attributes not present in new node
  // Exception: preserve `style` if new node doesn't set it AND both nodes
  // share a non-empty class - then this is the same element being re-synced
  // and any JS-set style (e.g. positioning) should survive. Empty class
  // matching empty class is not identity (soft-matched bare tags like <th>
  // must not keep a previous column's width). If class changed, the node is
  // being repurposed (e.g. pjax page swap), so stale style must be cleared.
  const newHasStyle = newNode.hasAttribute("style");
  const oldClass = oldNode.getAttribute("class") || "";
  const newClass = newNode.getAttribute("class") || "";
  const sameNamedClass = oldClass !== "" && oldClass === newClass;
  for (let i = oldAttrs.length - 1; i >= 0; i--) {
    const name = oldAttrs[i].name;
    if (!newNode.hasAttribute(name)) {
      if (name === "style" && !newHasStyle && sameNamedClass) continue;
      oldNode.removeAttribute(name);
    }
  }

  // Set/update attributes from new node
  for (let i = 0; i < newAttrs.length; i++) {
    const attr = newAttrs[i];

    // Skip value/checked on focused form inputs
    if (isActiveInput && (attr.name === "value" || attr.name === "checked")) {
      continue;
    }

    if (oldNode.getAttribute(attr.name) !== attr.value) {
      if (attr.name === "class") {
        syncClassList(oldNode, newNode);
      } else {
        try {
          oldNode.setAttribute(attr.name, attr.value);
        } catch (error) {
          console.error("Error setting attribute:", {
            node: oldNode,
            attribute: attr.name,
            error: error.message,
          });
        }
      }
    }
  }
}

function syncInternalKeys(oldNode, newNode) {
  if (oldNode.nodeType !== 1 || newNode.nodeType !== 1) return;
  if (newNode._fezKey !== undefined) {
    oldNode._fezKey = newNode._fezKey;
  } else {
    delete oldNode._fezKey;
  }
}

/**
 * Sync classes using classList.add/remove to preserve CSS animations.
 */
function syncClassList(oldNode, newNode) {
  const oldClasses = new Set(
    (oldNode.getAttribute("class") || "").split(/\s+/).filter(Boolean),
  );
  const newClasses = new Set(
    (newNode.getAttribute("class") || "").split(/\s+/).filter(Boolean),
  );

  for (const cls of oldClasses) {
    if (!newClasses.has(cls)) {
      oldNode.classList.remove(cls);
    }
  }
  for (const cls of newClasses) {
    if (!oldClasses.has(cls)) {
      oldNode.classList.add(cls);
    }
  }
}

function isFormInput(node) {
  const tag = node.nodeName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
}

// ---------------------------------------------------------------------------
// Node Keys
// ---------------------------------------------------------------------------

/**
 * Built-in attribute keying. Same logic for old and new nodes.
 * Returns { key, preserve } or null.
 */
function builtinKey(node) {
  if (node.nodeType !== 1) return null;

  const keepKey = node.getAttribute?.("fez-keep");
  if (keepKey) return { key: "keep-" + keepKey, preserve: true };

  if (node._fezKey !== undefined) {
    return { key: "key-" + node._fezKey, preserve: false };
  }

  // Attribute form: compiled templates promote fez-key to _fezKey before the
  // morph, so this only fires for server-rendered HTML (pjax swaps).
  const fezKey = node.getAttribute?.("fez-key");
  if (fezKey) return { key: "key-" + fezKey, preserve: false };

  const key = node.getAttribute?.("key");
  if (key) return { key: "key-" + key, preserve: false };

  const id = node.id;
  if (id) return { key: "id-" + id, preserve: false };

  return null;
}

/**
 * Resolve descriptor for an old (live) node.
 * Caller hook wins; falls back to built-in attribute keying.
 */
function describeOld(node, opts) {
  if (opts.describeOld) {
    const d = opts.describeOld(node);
    if (d) return d;
  }
  return builtinKey(node);
}

/**
 * Resolve key for a new (template) node.
 * Caller hook wins; falls back to built-in attribute keying.
 */
function describeNewKey(node, opts) {
  if (opts.describeNew) {
    const k = opts.describeNew(node);
    if (k) return k;
  }
  const b = builtinKey(node);
  return b ? b.key : null;
}

// ---------------------------------------------------------------------------
// Child Diffing
// ---------------------------------------------------------------------------

function diffChildren(target, newParent, opts) {
  const oldChildren = Array.from(target.childNodes);
  const newChildren = Array.from(newParent.childNodes);

  if (oldChildren.length === 0 && newChildren.length === 0) return;

  // Fast path: no old children, just append all new
  if (oldChildren.length === 0) {
    for (const child of newChildren) {
      target.appendChild(child);
    }
    return;
  }

  // Fast path: no new children, remove all old
  if (newChildren.length === 0) {
    for (const child of oldChildren) {
      if (opts.beforeRemove && child.nodeType === 1) {
        callBeforeRemoveDeep(child, opts);
      }
      target.removeChild(child);
    }
    return;
  }

  // Build key map for old children.
  // A node may register under multiple keys (primary + aliases).
  const oldByKey = new Map();
  const oldDescriptors = new Map(); // node -> descriptor
  const addOldKey = (key, child) => {
    if (!oldByKey.has(key)) oldByKey.set(key, []);
    oldByKey.get(key).push(child);
  };
  for (const child of oldChildren) {
    const desc = describeOld(child, opts);
    if (!desc) continue;
    oldDescriptors.set(child, desc);
    addOldKey(desc.key, child);
    if (desc.aliases) {
      for (const alias of desc.aliases) {
        addOldKey(alias, child);
      }
    }
  }

  // Phase 1: Match each new child to an old child
  const matches = []; // [{old, new, preserve}]
  const usedOld = new Set();

  // Pass 1a: match by key
  // Multiple new children can resolve to the same alias (e.g. when fezDescribeNew
  // returns 'fez-class-fez-X' for every <X> sibling because the template has no
  // explicit key=). Skip claiming an old child that's already been claimed —
  // treat the duplicate as unmatched so it falls through to soft-match or
  // insertion-as-new. Otherwise N siblings collapse onto the first old child
  // and the rest get garbage-collected in Phase 2.
  for (let i = 0; i < newChildren.length; i++) {
    const newChild = newChildren[i];
    const key = describeNewKey(newChild, opts);

    if (key && oldByKey.has(key)) {
      const oldBucket = oldByKey.get(key);
      while (oldBucket.length && usedOld.has(oldBucket[0])) {
        oldBucket.shift();
      }
      const oldChild = oldBucket.shift();

      if (!oldChild) {
        matches.push({ old: null, new: newChild, preserve: false });
        continue;
      }
      const desc = oldDescriptors.get(oldChild);
      const preserve = !!desc?.preserve;
      matches.push({ old: oldChild, new: newChild, preserve });
      usedOld.add(oldChild);
    } else {
      matches.push({ old: null, new: newChild, preserve: false });
    }
  }

  // Pass 1b: for unmatched new children, find best-match among unmatched old
  // Uses class similarity scoring to avoid mismatching when leading siblings
  // are added/removed by {#if} blocks.
  // Two-pass: collect all candidate pairs with scores, then assign highest first.
  // This prevents low-quality matches from consuming candidates needed by better ones.
  const unmatchedOld = oldChildren.filter((c) => !usedOld.has(c));
  const candidates = [];

  for (let i = 0; i < matches.length; i++) {
    if (matches[i].old) continue; // already matched

    const newChild = matches[i].new;
    // Don't soft-match new nodes that have a preserve key (e.g. fez-keep).
    // They were keyed for an exact match; soft-matching by tag would be wrong.
    if (newChild.nodeType === 1) {
      const b = builtinKey(newChild);
      if (b?.preserve) continue;
    }

    for (let j = 0; j < unmatchedOld.length; j++) {
      const candidate = unmatchedOld[j];
      // Caller can opt nodes out of soft-matching (e.g. fez components, fez-keep)
      if (candidate.nodeType === 1) {
        const desc = oldDescriptors.get(candidate);
        if (desc?.preserve) continue;
        if (desc && desc.softMatch === false) continue;
      }
      const score = scoreSoftMatch(candidate, newChild);
      if (score > 0) {
        candidates.push({ matchIdx: i, oldIdx: j, score });
      }
    }
  }

  // Sort by score descending - highest quality matches get priority
  candidates.sort((a, b) => b.score - a.score);

  // Assign matches: best-scored pairs first
  const usedOldIdx = new Set();
  const assignedMatch = new Set();
  for (const c of candidates) {
    if (assignedMatch.has(c.matchIdx) || usedOldIdx.has(c.oldIdx)) continue;
    matches[c.matchIdx].old = unmatchedOld[c.oldIdx];
    usedOld.add(unmatchedOld[c.oldIdx]);
    usedOldIdx.add(c.oldIdx);
    assignedMatch.add(c.matchIdx);
  }

  // Phase 2: Remove unmatched old children
  for (const child of oldChildren) {
    if (!usedOld.has(child)) {
      if (child.nodeType === 1) {
        callBeforeRemoveDeep(child, opts);
      }
      target.removeChild(child);
    }
  }

  // Phase 3: Apply matches in order (morph + position)
  let cursor = target.firstChild;

  for (const match of matches) {
    if (match.old) {
      // We have a matched old node
      const oldChild = match.old;
      const newChild = match.new;

      if (match.preserve) {
        // Allow callers (Fez) to reject preserve when source content changed
        // (e.g. slot text STEP → PDF) even if the key still matches.
        if (opts.shouldPreserve && !opts.shouldPreserve(oldChild, newChild)) {
          if (oldChild.nodeType === 1) {
            callBeforeRemoveDeep(oldChild, opts);
          }
          target.insertBefore(newChild, oldChild);
          target.removeChild(oldChild);
          cursor = newChild.nextSibling;
          continue;
        }
        if (opts.onPreserve) opts.onPreserve(oldChild, newChild);
        syncInternalKeys(oldChild, newChild);
        // preserve entirely, just ensure position
        if (oldChild !== cursor) {
          target.insertBefore(oldChild, cursor);
        } else {
          cursor = cursor.nextSibling;
        }
        continue;
      }

      // Morph the matched pair
      if (oldChild.nodeType === 3 && newChild.nodeType === 3) {
        // Both text nodes
        if (oldChild.textContent !== newChild.textContent) {
          oldChild.textContent = newChild.textContent;
        }
      } else if (oldChild.nodeType === 8 && newChild.nodeType === 8) {
        // Both comment nodes
        if (oldChild.textContent !== newChild.textContent) {
          oldChild.textContent = newChild.textContent;
        }
      } else if (oldChild.nodeType === 1 && newChild.nodeType === 1) {
        // Both elements
        if (opts.skipNode && opts.skipNode(oldChild)) {
          // Skip this subtree entirely
        } else if (oldChild.nodeName === newChild.nodeName) {
          // Same tag: sync attributes and recurse
          syncAttributes(oldChild, newChild);
          syncInternalKeys(oldChild, newChild);
          diffChildren(oldChild, newChild, opts);
          syncDomProperties(oldChild, newChild);
        } else {
          // Different tag: replace
          callBeforeRemoveDeep(oldChild, opts);
          const replacement = newChild;
          target.insertBefore(replacement, oldChild);
          target.removeChild(oldChild);
          cursor = replacement.nextSibling;
          continue;
        }
      } else {
        // Different node types: replace
        if (oldChild.nodeType === 1) {
          callBeforeRemoveDeep(oldChild, opts);
        }
        target.insertBefore(newChild, oldChild);
        target.removeChild(oldChild);
        cursor = newChild.nextSibling;
        continue;
      }

      // Ensure correct position
      if (oldChild !== cursor) {
        target.insertBefore(oldChild, cursor);
      } else {
        cursor = cursor.nextSibling;
      }
    } else {
      // No old match: insert new node
      target.insertBefore(match.new, cursor);
    }
  }
}

function syncDomProperties(oldNode, newNode) {
  if (oldNode.nodeType !== 1 || newNode.nodeType !== 1) return;

  const isActiveInput =
    oldNode === document.activeElement && isFormInput(oldNode);
  const tag = oldNode.nodeName;

  if ("disabled" in oldNode) {
    syncBooleanProperty(oldNode, newNode, "disabled");
  }

  if (tag === "INPUT") {
    const type = (oldNode.getAttribute("type") || "").toLowerCase();
    if (!isActiveInput && newNode.hasAttribute("value")) {
      oldNode.value = newNode.getAttribute("value");
    }
    if (!isActiveInput && (type === "checkbox" || type === "radio")) {
      syncBooleanProperty(oldNode, newNode, "checked");
    }
  } else if (tag === "TEXTAREA") {
    if (!isActiveInput) oldNode.value = newNode.value;
  } else if (tag === "SELECT") {
    if (!isActiveInput) oldNode.value = newNode.value;
  } else if (tag === "OPTION") {
    syncBooleanProperty(oldNode, newNode, "selected");
  }
}

function booleanAttrEnabled(node, attr) {
  if (!node.hasAttribute(attr)) return false;
  return !["false", "null", "undefined"].includes(node.getAttribute(attr));
}

function syncBooleanProperty(oldNode, newNode, attr) {
  const enabled = booleanAttrEnabled(newNode, attr);
  oldNode[attr] = enabled;
  if (!enabled) oldNode.removeAttribute(attr);
}

/**
 * Score how well two nodes match for soft matching.
 * Returns 0 for no match (different nodeType or tagName).
 * Higher score = better match.
 *
 * Scoring:
 *   1  = same nodeType (text/comment nodes)
 *   1  = same tagName (elements, base score)
 *  +3  per shared CSS class
 *  +2  for same number of attributes
 */
function getClassSet(node) {
  if (node._morphClassSet) return node._morphClassSet;
  const raw = node.getAttribute?.("class");
  const result = raw ? new Set(raw.split(/\s+/).filter(Boolean)) : null;
  node._morphClassSet = result;
  return result;
}

function scoreSoftMatch(oldNode, newNode) {
  if (oldNode.nodeType !== newNode.nodeType) return 0;
  if (oldNode.nodeType !== 1) return 1;
  if (oldNode.nodeName !== newNode.nodeName) return 0;

  let score = 1;

  const oldSet = getClassSet(oldNode);
  const newSet = getClassSet(newNode);
  if (oldSet && newSet) {
    for (const cls of newSet) {
      if (oldSet.has(cls)) score += 3;
    }
  } else if (!oldSet && !newSet) {
    score += 1;
  }

  if (
    oldNode.attributes &&
    newNode.attributes &&
    oldNode.attributes.length === newNode.attributes.length
  ) {
    score += 2;
  }

  return score;
}

/**
 * Call beforeRemove on a node and all fez components inside it.
 */
function callBeforeRemoveDeep(node, opts) {
  if (!opts.beforeRemove) return;
  opts.beforeRemove(node);
  if (node.querySelectorAll) {
    node.querySelectorAll(".fez").forEach((child) => {
      opts.beforeRemove(child);
    });
  }
}

// Export for testing
export { syncClassList, isFormInput };
