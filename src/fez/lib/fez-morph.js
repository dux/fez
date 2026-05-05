/**
 * Fez-specific wiring for the generic nodeMorph differ.
 *
 * Provides:
 *  - Fez.morphdom(target, newNode)        - internal: used by component re-render
 *  - Fez.nodeMorph(target, src, opts?)    - public: accepts string|Element|DocumentFragment
 */

import { nodeMorph } from './morph.js';

/**
 * Describe a live (old) fez component node so the differ can:
 *  - match by UID
 *  - also match against template placeholders by id and fez-name class
 *  - preserve the subtree (no internal morphing)
 *  - exclude from soft-matching
 */
function fezDescribeOld(node) {
  if (node.nodeType !== 1) return null;
  if (!node.classList?.contains('fez') || !node.fez) return null;

  const aliases = [];
  if (node.id) aliases.push('id-' + node.id);
  if (node.classList) {
    for (const cls of node.classList) {
      if (cls.startsWith('fez-') && cls !== 'fez') {
        aliases.push('fez-class-' + cls);
        break;
      }
    }
  }
  return {
    key: 'fez-uid-' + node.fez.UID,
    aliases,
    preserve: true,
    softMatch: false,
  };
}

/**
 * Attach Fez.morphdom and Fez.nodeMorph to the Fez root.
 */
export default function attachMorph(Fez) {
  /**
   * Describe a template (new) fez component placeholder so it matches against
   * the live component's `fez-class-` alias. Recognizes three forms:
   *   1. Inline-rendered: <div class="fez fez-x">   (already mounted-ish)
   *   2. Raw custom tag:  <my-comp>                 (server-rendered placeholder)
   *   3. fez= attribute:  <div fez="my-comp">       (server-rendered placeholder)
   */
  function fezDescribeNew(node) {
    if (node.nodeType !== 1) return null;

    if (node.classList?.contains('fez')) {
      for (const cls of node.classList) {
        if (cls.startsWith('fez-') && cls !== 'fez') {
          return 'fez-class-' + cls;
        }
      }
    }

    const tag = node.tagName?.toLowerCase();
    if (tag && Fez.index?.[tag]) {
      return 'fez-class-fez-' + tag;
    }

    const fezAttr = node.getAttribute?.('fez');
    if (fezAttr && Fez.index?.[fezAttr]) {
      return 'fez-class-fez-' + fezAttr;
    }

    return null;
  }

  const fezMorphOpts = {
    describeOld: fezDescribeOld,
    describeNew: fezDescribeNew,

    // Defensive: if a fez component slips past keying, still skip its subtree
    skipNode: (oldNode) => {
      if (oldNode.classList?.contains('fez') && oldNode.fez && !oldNode.fez._destroyed) {
        if (Fez.LOG) {
          console.log(
            `Fez: preserved child component ${oldNode.fez.fezName} (UID ${oldNode.fez.UID})`,
          );
        }
        return true;
      }
      return false;
    },

    // Cleanup destroyed fez components
    beforeRemove: (node) => {
      if (node.classList?.contains('fez') && node.fez) {
        node.fez.fezOnDestroy();
      }
    },

    // Notify preserved fez children that their parent re-rendered
    onPreserve: (oldNode) => {
      if (oldNode.classList?.contains('fez') && oldNode.fez && !oldNode.fez._destroyed) {
        oldNode.fez.onRefresh(oldNode.fez.props);
      }
    },
  };

  /**
   * Morph DOM node to new state.
   * Child fez components are automatically preserved (matched by UID/class).
   * Use fez-keep attribute for explicit element preservation.
   */
  Fez.morphdom = (target, newNode) => {
    nodeMorph(target, newNode, fezMorphOpts);
  };

  /**
   * Public morph helper. Accepts source as a string (HTML) or Element.
   *
   * Tag rules:
   *  - If src root tag matches target's tag, src is used directly.
   *  - Otherwise src is treated as the new children of target (wrapped in a
   *    same-tag container so children parse in the right context).
   *
   * Target's own attributes are NOT diffed; only its children are updated.
   */
  Fez.nodeMorph = (target, src, opts = {}) => {
    if (!target || target.nodeType !== 1) {
      Fez.onError('nodeMorph', 'target must be an Element');
      return;
    }

    const tagName = target.tagName;
    const tagLower = tagName.toLowerCase();
    let newNode;

    if (typeof src === 'string') {
      const wrapper = document.createElement(tagLower);
      wrapper.innerHTML = src;
      // If the user provided a single root with the matching tag, unwrap it.
      if (
        wrapper.children.length === 1 &&
        wrapper.firstElementChild.tagName === tagName &&
        wrapper.childNodes.length === 1
      ) {
        newNode = wrapper.firstElementChild;
      } else {
        newNode = wrapper;
      }
    } else if (src && src.nodeType === 11) {
      // DocumentFragment
      newNode = document.createElement(tagLower);
      newNode.appendChild(src);
    } else if (src && src.nodeType === 1) {
      if (src.tagName === tagName) {
        newNode = src;
      } else {
        newNode = document.createElement(tagLower);
        newNode.appendChild(src);
      }
    } else {
      Fez.onError('nodeMorph', 'src must be a string, Element, or DocumentFragment');
      return;
    }

    nodeMorph(target, newNode, { ...fezMorphOpts, ...opts });
  };
}
