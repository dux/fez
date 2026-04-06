/**
 * fez-morph - Component-aware DOM differ for Fez
 *
 * Replaces Idiomorph with a simpler, Fez-specific algorithm that:
 * - Matches fez components by UID (never morphs them, only moves/preserves/destroys)
 * - Matches keyed elements by fez-keep attribute (preserved entirely)
 * - Matches elements by id (morphed in place)
 * - Falls back to tag+position matching
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
 * @param {Element} target  - live DOM element to update
 * @param {Element} newNode - detached element with desired state
 * @param {Object}  opts
 * @param {Function} opts.skipNode(oldNode)    - return true to preserve subtree as-is
 * @param {Function} opts.beforeRemove(node)   - called before removing a node
 */
export function fezMorph(target, newNode, opts = {}) {
  // NOTE: We do NOT sync root element attributes here.
  // The root is the component wrapper (class="fez fez-name goXXX") managed by Fez,
  // not by the template. Syncing root attrs would strip component CSS classes.

  // Diff children recursively
  diffChildren(target, newNode, opts);

  // Clean up trailing whitespace text node (matches old behavior)
  const next = target.nextSibling;
  if (next?.nodeType === 3 && !next.textContent.trim()) {
    next.remove();
  }
}

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
  // Exception: preserve `style` if new node doesn't set it at all,
  // since style is commonly set by JS (e.g. positioning) and should
  // only be synced when the template explicitly provides a style attribute.
  const newHasStyle = newNode.hasAttribute("style");
  for (let i = oldAttrs.length - 1; i >= 0; i--) {
    const name = oldAttrs[i].name;
    if (!newNode.hasAttribute(name)) {
      if (name === "style" && !newHasStyle) continue;
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

function getNodeKey(node) {
  if (node.nodeType !== 1) return null;

  // Fez component - match by UID
  if (node.classList?.contains("fez") && node.fez) {
    return "fez-uid-" + node.fez.UID;
  }

  // fez-keep attribute
  const keepKey = node.getAttribute?.("fez-keep");
  if (keepKey) return "keep-" + keepKey;

  // key attribute (auto-generated or user-provided)
  const key = node.getAttribute?.("key");
  if (key) return "key-" + key;

  // id attribute
  const id = node.id;
  if (id) return "id-" + id;

  return null;
}

/**
 * For new (template) nodes, get the key they SHOULD match against.
 * New nodes don't have .fez instances, but they may have fez-keep or id.
 */
function getNewNodeKey(node) {
  if (node.nodeType !== 1) return null;

  // fez-keep attribute
  const keepKey = node.getAttribute?.("fez-keep");
  if (keepKey) return "keep-" + keepKey;

  // key attribute (auto-generated or user-provided)
  const key = node.getAttribute?.("key");
  if (key) return "key-" + key;

  // id attribute
  const id = node.id;
  if (id) return "id-" + id;

  // Check if this is a placeholder for a fez component (has fez class)
  // New template nodes don't have .fez but may have class="fez fez-name"
  if (node.classList?.contains("fez")) {
    // Match by fez-name class
    for (const cls of node.classList) {
      if (cls.startsWith("fez-") && cls !== "fez") {
        return "fez-class-" + cls;
      }
    }
  }

  return null;
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

  // Build key map for old children
  // A node can have multiple keys (e.g., fez component has UID key + id key)
  const oldByKey = new Map();
  for (const child of oldChildren) {
    const key = getNodeKey(child);
    if (key) {
      oldByKey.set(key, child);
      // Fez components also match by id and class (template placeholders have no .fez)
      if (key.startsWith("fez-uid-")) {
        if (child.id) {
          oldByKey.set("id-" + child.id, child);
        }
        // Also match by fez-name class (e.g., "fez-class-fez-my-comp")
        if (child.classList) {
          for (const cls of child.classList) {
            if (cls.startsWith("fez-") && cls !== "fez") {
              oldByKey.set("fez-class-" + cls, child);
              break;
            }
          }
        }
      }
    }
  }

  // Phase 1: Match each new child to an old child
  const matches = []; // [{old, new, preserve}]
  const usedOld = new Set();

  // Pass 1a: match by key (fez-keep, id, fez UID)
  for (let i = 0; i < newChildren.length; i++) {
    const newChild = newChildren[i];
    const key = getNewNodeKey(newChild);

    if (key && oldByKey.has(key)) {
      const oldChild = oldByKey.get(key);
      const preserve = key.startsWith("keep-") || key.startsWith("fez-uid-");
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
    // Don't soft-match new nodes that have a fez-keep key
    if (
      getNewNodeKey(newChild) &&
      getNewNodeKey(newChild).startsWith("keep-")
    ) {
      continue;
    }

    for (let j = 0; j < unmatchedOld.length; j++) {
      const candidate = unmatchedOld[j];
      // Don't soft-match old nodes that have fez-keep or are fez components
      if (
        candidate.nodeType === 1 &&
        (candidate.getAttribute?.("fez-keep") ||
          (candidate.classList?.contains("fez") && candidate.fez))
      ) {
        continue;
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
        // fez-keep or fez component: preserve entirely, just ensure position
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
          // Skip this subtree entirely (fez component via skipNode callback)
        } else if (oldChild.nodeName === newChild.nodeName) {
          // Same tag: sync attributes and recurse
          syncAttributes(oldChild, newChild);
          diffChildren(oldChild, newChild, opts);
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
function scoreSoftMatch(oldNode, newNode) {
  if (oldNode.nodeType !== newNode.nodeType) return 0;

  // Text/comment nodes: same nodeType is enough
  if (oldNode.nodeType !== 1) return 1;

  // Elements: must have same tag
  if (oldNode.nodeName !== newNode.nodeName) return 0;

  let score = 1;

  // Score by shared CSS classes
  const oldClasses = oldNode.getAttribute?.("class");
  const newClasses = newNode.getAttribute?.("class");
  if (oldClasses && newClasses) {
    const oldSet = new Set(oldClasses.split(/\s+/).filter(Boolean));
    const newSet = new Set(newClasses.split(/\s+/).filter(Boolean));
    for (const cls of newSet) {
      if (oldSet.has(cls)) score += 3;
    }
  } else if (!oldClasses && !newClasses) {
    // Both have no class - slight bonus for similarity
    score += 1;
  }

  // Bonus for same attribute count (structural similarity)
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
