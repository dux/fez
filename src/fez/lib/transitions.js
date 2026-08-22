/**
 * Element enter/leave transitions (Svelte-style in:/out: directives).
 *
 *   <div fez:in="fade">
 *   <div fez:in="fly, y=20, duration=300" fez:out="fade, duration=150">
 *   <div fez:in="fly; y: 20; duration: 300; easing: quintOut">
 *   <div fez:transition="fade">   (both directions; fez:in / fez:out override)
 *
 * First token is the transition name, the rest are key=value (or key: value)
 * pairs separated by "," or ";". Numbers and booleans are coerced.
 *
 * Resolution order for the name:
 *   1. Fez.transitions[name] - built-ins below or user registered functions
 *      returning { keyframes, duration?, delay?, easing?, cleanup? } (WAAPI)
 *   2. anything else is treated as a CSS @keyframes name (node.style.animation)
 *
 * Outro is the same animation played in reverse. Both honour
 * prefers-reduced-motion (animation skipped, element still enters/leaves).
 */

// Svelte-ish easing names mapped to CSS timing functions. Anything not listed
// (linear, ease-out, cubic-bezier(...), steps(...)) is passed through as is.
export const EASINGS = {
  linear: 'linear',
  ease: 'ease',
  easeIn: 'ease-in',
  easeOut: 'ease-out',
  easeInOut: 'ease-in-out',
  sineIn: 'cubic-bezier(0.12, 0, 0.39, 0)',
  sineOut: 'cubic-bezier(0.61, 1, 0.88, 1)',
  sineInOut: 'cubic-bezier(0.37, 0, 0.63, 1)',
  quadIn: 'cubic-bezier(0.11, 0, 0.5, 0)',
  quadOut: 'cubic-bezier(0.5, 1, 0.89, 1)',
  quadInOut: 'cubic-bezier(0.45, 0, 0.55, 1)',
  cubicIn: 'cubic-bezier(0.32, 0, 0.67, 0)',
  cubicOut: 'cubic-bezier(0.33, 1, 0.68, 1)',
  cubicInOut: 'cubic-bezier(0.65, 0, 0.35, 1)',
  quartIn: 'cubic-bezier(0.5, 0, 0.75, 0)',
  quartOut: 'cubic-bezier(0.25, 1, 0.5, 1)',
  quartInOut: 'cubic-bezier(0.76, 0, 0.24, 1)',
  quintIn: 'cubic-bezier(0.64, 0, 0.78, 0)',
  quintOut: 'cubic-bezier(0.22, 1, 0.36, 1)',
  quintInOut: 'cubic-bezier(0.83, 0, 0.17, 1)',
  expoIn: 'cubic-bezier(0.7, 0, 0.84, 0)',
  expoOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
  expoInOut: 'cubic-bezier(0.87, 0, 0.13, 1)',
  circIn: 'cubic-bezier(0.55, 0, 1, 0.45)',
  circOut: 'cubic-bezier(0, 0.55, 0.45, 1)',
  circInOut: 'cubic-bezier(0.85, 0, 0.15, 1)',
  backIn: 'cubic-bezier(0.36, 0, 0.66, -0.56)',
  backOut: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
  backInOut: 'cubic-bezier(0.68, -0.6, 0.32, 1.6)',
};

export function resolveEasing(name, fallback = 'cubicOut') {
  const key = name == null || name === '' ? fallback : String(name);
  return EASINGS[key] || key;
}

const DEFAULT_DURATION = 300;

/**
 * "fly, y=20, duration=300" -> { name: 'fly', params: { y: 20, duration: 300 } }
 * Accepts "," or ";" separators and "=" or ":" pair delimiters. Separators
 * inside parentheses are kept, so easing=cubic-bezier(0.1, 0.2, 0.3, 1) works.
 */
export function parseTransition(text) {
  const parts = String(text ?? '')
    .split(/[,;](?![^(]*\))/)
    .map((s) => s.trim())
    .filter(Boolean);

  const name = parts.shift() || '';
  const params = {};

  for (const part of parts) {
    const m = part.match(/^([^=:\s]+)\s*[=:]\s*(.*)$/);
    if (!m) {
      // bare flag: "fly, global" -> { global: true }
      params[part] = true;
      continue;
    }
    params[m[1]] = coerce(m[2].trim());
  }

  return { name, params };
}

function coerce(value) {
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  const q = value[0];
  if ((q === '"' || q === "'") && value.endsWith(q) && value.length >= 2) {
    return value.slice(1, -1);
  }
  return value;
}

const num = (v, fallback) => (typeof v === 'number' && !Number.isNaN(v) ? v : fallback);

// Existing transform/filter on the element is the "natural" end state, so the
// transition composes with it instead of wiping it.
const baseValue = (cs, prop) => (cs[prop] && cs[prop] !== 'none' ? cs[prop] : '');

// window.getComputedStyle via the node's own window (works for detached docs / tests)
const computed = (node) => {
  const win = node.ownerDocument?.defaultView || globalThis;
  return typeof win.getComputedStyle === 'function' ? win.getComputedStyle(node) : {};
};

// ---------------------------------------------------------------------------
// Built-ins. Each returns the INTRO keyframes (first frame = hidden, last frame
// = natural state); outro plays the same frames reversed.
// ---------------------------------------------------------------------------

export const builtins = {
  fade(node, p) {
    const cs = computed(node);
    return {
      keyframes: [{ opacity: 0 }, { opacity: cs.opacity || 1 }],
      duration: num(p.duration, DEFAULT_DURATION),
      easing: resolveEasing(p.easing, 'linear'),
    };
  },

  fly(node, p) {
    const cs = computed(node);
    const base = baseValue(cs, 'transform');
    // from=left|right|top|bottom + distance is the readable form; explicit x/y win
    const d = num(p.distance, 40);
    const preset = FLY_FROM[p.from] || [0, 0];
    const x = num(p.x, preset[0] * d);
    const y = num(p.y, preset[1] * d);
    const opacity = num(p.opacity, 0);
    return {
      keyframes: [
        { transform: `${base} translate(${x}px, ${y}px)`.trim(), opacity },
        { transform: base || 'none', opacity: cs.opacity || 1 },
      ],
      duration: num(p.duration, 400),
      easing: resolveEasing(p.easing, 'cubicOut'),
    };
  },

  scale(node, p) {
    const cs = computed(node);
    const base = baseValue(cs, 'transform');
    const start = num(p.start, 0);
    const opacity = num(p.opacity, 0);
    return {
      keyframes: [
        { transform: `${base} scale(${start})`.trim(), opacity },
        { transform: base || 'none', opacity: cs.opacity || 1 },
      ],
      duration: num(p.duration, DEFAULT_DURATION),
      easing: resolveEasing(p.easing, 'cubicOut'),
    };
  },

  blur(node, p) {
    const cs = computed(node);
    const base = baseValue(cs, 'filter');
    const amount = num(p.amount, 5);
    const opacity = num(p.opacity, 0);
    return {
      keyframes: [
        { filter: `${base} blur(${amount}px)`.trim(), opacity },
        { filter: base || 'none', opacity: cs.opacity || 1 },
      ],
      duration: num(p.duration, DEFAULT_DURATION),
      easing: resolveEasing(p.easing, 'cubicInOut'),
    };
  },

  slide(node, p) {
    const cs = computed(node);
    const vertical = p.axis !== 'x';
    const size = vertical ? 'height' : 'width';
    const from = vertical
      ? [
          'paddingTop',
          'paddingBottom',
          'marginTop',
          'marginBottom',
          'borderTopWidth',
          'borderBottomWidth',
        ]
      : [
          'paddingLeft',
          'paddingRight',
          'marginLeft',
          'marginRight',
          'borderLeftWidth',
          'borderRightWidth',
        ];

    const collapsed = { [size]: '0px' };
    const natural = { [size]: cs[size] };
    for (const prop of from) {
      collapsed[prop] = '0px';
      natural[prop] = cs[prop];
    }
    // slide, opacity=0 -> fade while collapsing
    if (typeof p.opacity === 'number') {
      collapsed.opacity = p.opacity;
      natural.opacity = cs.opacity || 1;
    }

    // overflow is not animatable - clip for the duration, then restore
    const prevOverflow = node.style.overflow;
    node.style.overflow = 'hidden';

    return {
      keyframes: [collapsed, natural],
      duration: num(p.duration, 400),
      easing: resolveEasing(p.easing, 'cubicOut'),
      cleanup: () => {
        node.style.overflow = prevOverflow;
      },
    };
  },

  // dialogs, popovers, toasts, dropdowns: subtle scale with overshoot + fade
  pop(node, p) {
    const cs = computed(node);
    const base = baseValue(cs, 'transform');
    const start = num(p.start, 0.8);
    const opacity = num(p.opacity, 0);
    return {
      keyframes: [
        { transform: `${base} scale(${start})`.trim(), opacity },
        { transform: base || 'none', opacity: cs.opacity || 1 },
      ],
      duration: num(p.duration, 250),
      easing: resolveEasing(p.easing, 'backOut'),
    };
  },

  // 3D card flip around the y (default) or x axis
  flip(node, p) {
    const cs = computed(node);
    const base = baseValue(cs, 'transform');
    const axis = p.axis === 'x' ? 'X' : 'Y';
    const angle = num(p.angle, 90);
    const perspective = num(p.perspective, 600);
    const opacity = num(p.opacity, 0);
    return {
      keyframes: [
        {
          transform: `${base} perspective(${perspective}px) rotate${axis}(${angle}deg)`.trim(),
          opacity,
        },
        { transform: base || 'none', opacity: cs.opacity || 1 },
      ],
      duration: num(p.duration, 400),
      easing: resolveEasing(p.easing, 'cubicOut'),
    };
  },

  // spin in: rotate from `angle` degrees (+ optional scale) to rest
  rotate(node, p) {
    const cs = computed(node);
    const base = baseValue(cs, 'transform');
    const angle = num(p.angle, -90);
    const start = num(p.start, 1);
    const opacity = num(p.opacity, 0);
    return {
      keyframes: [
        { transform: `${base} rotate(${angle}deg) scale(${start})`.trim(), opacity },
        { transform: base || 'none', opacity: cs.opacity || 1 },
      ],
      duration: num(p.duration, DEFAULT_DURATION),
      easing: resolveEasing(p.easing, 'cubicOut'),
    };
  },

  // SVG stroke drawing (<path>, <circle>, <line> ... anything with getTotalLength).
  // duration, or speed in px/ms (duration = length / speed). Non-SVG nodes just fade.
  draw(node, p) {
    if (typeof node.getTotalLength !== 'function') {
      return builtins.fade(node, p);
    }
    const len = node.getTotalLength();
    const duration =
      typeof p.speed === 'number' && p.speed > 0 ? len / p.speed : num(p.duration, 800);
    return {
      keyframes: [
        { strokeDasharray: `${len}`, strokeDashoffset: `${len}` },
        { strokeDasharray: `${len}`, strokeDashoffset: '0' },
      ],
      duration,
      easing: resolveEasing(p.easing, 'cubicInOut'),
    };
  },
};

const FLY_FROM = { left: [-1, 0], right: [1, 0], top: [0, -1], bottom: [0, 1] };

/** Registry exposed as Fez.transitions - add your own: Fez.transitions.foo = (node, params) => ({ ... }) */
export const transitions = { ...builtins };

function reducedMotion() {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Play a transition on node. direction: 'in' | 'out'. Resolves when done
 * (always resolves - a broken transition must never leave a node stuck).
 */
export function runTransition(node, spec, direction = 'in') {
  if (!node || node.nodeType !== 1 || !spec?.name) {
    return Promise.resolve();
  }

  const { name, params } = spec;
  const fn = transitions[name];
  const reverse = direction === 'out';

  if (reducedMotion()) {
    return Promise.resolve();
  }

  if (typeof fn === 'function') {
    let def;
    try {
      def = fn(node, params) || {};
    } catch (error) {
      console.error(`Fez: transition "${name}" failed`, error);
      return Promise.resolve();
    }

    if (!def.keyframes || typeof node.animate !== 'function') {
      def.cleanup?.();
      return Promise.resolve();
    }

    const anim = node.animate(def.keyframes, {
      duration: num(def.duration, num(params.duration, DEFAULT_DURATION)),
      delay: num(def.delay, num(params.delay, 0)),
      easing: resolveEasing(def.easing ?? params.easing),
      // intro: hold frame 0 during delay, then hand back to the stylesheet.
      // outro: hold the last (hidden) frame until the node is detached.
      fill: reverse ? 'both' : 'backwards',
      direction: reverse ? 'reverse' : 'normal',
    });

    return anim.finished.catch(() => {}).then(() => def.cleanup?.());
  }

  // Unknown name -> user defined CSS @keyframes
  const duration = num(params.duration, DEFAULT_DURATION);
  const delay = num(params.delay, 0);
  const easing = resolveEasing(params.easing, 'ease');
  const fill = reverse ? 'both reverse' : 'backwards';

  return new Promise((resolve) => {
    let done = false;
    const finish = (event) => {
      if (done || (event && event.target !== node)) {
        return;
      }
      done = true;
      clearTimeout(timer);
      node.removeEventListener('animationend', finish);
      node.removeEventListener('animationcancel', finish);
      if (!reverse) {
        node.style.animation = '';
      }
      resolve();
    };
    node.addEventListener('animationend', finish);
    node.addEventListener('animationcancel', finish);
    // a typo in the name never fires animationend - do not get stuck
    const timer = setTimeout(finish, duration + delay + 50);
    node.style.animation = `${name} ${duration}ms ${easing} ${delay}ms ${fill}`;
  });
}

// ---------------------------------------------------------------------------
// fez:animate="flip" - FLIP for elements the differ keeps but moves
// (list reorder). Measure before the morph, play the delta after it.
// ---------------------------------------------------------------------------

/** Snapshot positions of nodes carrying an animate spec. Call BEFORE the morph. */
export function measureFlip(nodes) {
  const entries = [];
  for (const node of nodes || []) {
    if (!node?.isConnected || node._fezLeaving || !node._fezAnimate) {
      continue;
    }
    entries.push({ node, rect: node.getBoundingClientRect(), spec: node._fezAnimate });
  }
  return entries;
}

/** Animate measured nodes from their old position to the new one. Call AFTER the morph. */
export function playFlip(entries) {
  if (!entries?.length || reducedMotion()) {
    return;
  }
  for (const { node, rect, spec } of entries) {
    if (!node.isConnected || node._fezLeaving || typeof node.animate !== 'function') {
      continue;
    }
    // a still-running flip would skew the measurement - drop it first, the new
    // delta starts from where the node visually was (old rect included it)
    node._fezFlipAnim?.cancel();
    const next = node.getBoundingClientRect();
    const dx = rect.left - next.left;
    const dy = rect.top - next.top;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
      continue;
    }

    const base = baseValue(computed(node), 'transform');
    const p = spec.params || {};
    const anim = node.animate(
      [{ transform: `${base} translate(${dx}px, ${dy}px)`.trim() }, { transform: base || 'none' }],
      {
        duration: num(p.duration, DEFAULT_DURATION),
        delay: num(p.delay, 0),
        easing: resolveEasing(p.easing, 'cubicOut'),
        fill: 'backwards',
      },
    );
    node._fezFlipAnim = anim;
    anim.finished
      .catch(() => {})
      .then(() => {
        if (node._fezFlipAnim === anim) {
          node._fezFlipAnim = null;
        }
      });
  }
}
