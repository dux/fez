/**
 * Fez - TypeScript Type Definitions
 *
 * This file provides type information for the Fez framework.
 * Import: `import { Fez, FezBase } from '@dinoreic/fez'`
 */

// =============================================================================
// UTILITY TYPES
// =============================================================================

/** Reactive state proxy that triggers re-renders on property changes */
type ReactiveState<T = Record<string, any>> = T;

/** Global state proxy for cross-component communication */
type GlobalState = Record<string, any>;

/** Non-reactive per-instance storage */
type LocalStore = Record<string, any>;

/** Component props (always strings from HTML attributes) */
type ComponentProps = Record<string, string>;

/** Evaluated props (when using :prop syntax) */
type EvaluatedProps = Record<string, any>;

// =============================================================================
// LIFECYCLE HOOK TYPES
// =============================================================================

/** Called when fez element is connected to DOM, before first render */
type InitHook = (props: ComponentProps & EvaluatedProps) => void;

/** Execute after init and first render */
type OnMountHook = (props: ComponentProps & EvaluatedProps) => void;

/** Execute before every render - use for reactive computed state */
type BeforeRenderHook = () => void;

/** Execute after every render */
type AfterRenderHook = () => void;

/** Monitor new or changed node attributes */
type OnPropsChangeHook = (attrName: string, attrValue: string) => void;

/** Called when local component state changes */
type OnStateChangeHook = (key: string, value: any, oldValue: any) => void;

/** Called when global state changes */
type OnGlobalStateChangeHook = (key: string, value: any) => void;

/** Called when component is destroyed */
type OnDestroyHook = () => void;

// =============================================================================
// COMPONENT CONFIGURATION
// =============================================================================

interface FezComponentConfig {
  /** Set element node name (defaults to 'div') */
  NAME?: string | ((node: HTMLElement) => string);

  /** Static alternative - use static nodeName = 'span' */
  static?: {
    nodeName?: string;
  };

  /** Component-scoped CSS styles (SCSS syntax), from <style> */
  CSS?: string | (() => string);

  /** Document-global CSS styles (SCSS syntax), from <style global> */
  CSS_GLOBAL?: string | (() => string);

  /** Component HTML template */
  HTML?: string | (() => string);

  /** Make component globally accessible as window[name] */
  GLOBAL?: string | boolean;

  /** Component metadata */
  META?: Record<string, any>;
}

// =============================================================================
// FezBase CLASS
// =============================================================================

/** Base class for all Fez components */
declare abstract class FezBase {
  // ===================================================================
  // LIFECYCLE HOOKS (override as needed)
  // ===================================================================

  /** Called when fez element is connected to DOM, before first render */
  init?(props: ComponentProps & EvaluatedProps): void;

  /** Execute after init and first render */
  onMount?(props: ComponentProps & EvaluatedProps): void;

  /** Execute before every render - use for reactive computed state */
  beforeRender?(): void;

  /** Execute after every render */
  afterRender?(): void;

  /** Monitor new or changed node attributes */
  onPropsChange?(attrName: string, attrValue: string): void;

  /** Called when local component state changes */
  onStateChange?(key: string, value: any, oldValue: any): void;

  /** Called when global state changes */
  onGlobalStateChange?(key: string, value: any): void;

  /** Called when component is destroyed */
  onDestroy?(): void;

  // ===================================================================
  // COMPONENT STATE
  // ===================================================================

  /** Reactive local state - changes trigger re-renders */
  state: ReactiveState;

  /** Global state proxy - shared across components */
  globalState: GlobalState;

  /** Non-reactive per-instance storage - changes do not trigger re-renders */
  local: LocalStore;

  /** Component props from HTML attributes */
  props: ComponentProps & EvaluatedProps;

  /** Unique component instance ID */
  UID: number;

  /** Component tag name (e.g., 'ui-button') */
  fezName: string;

  /** Root DOM element */
  root: HTMLElement;

  // ===================================================================
  // DOM HELPERS
  // ===================================================================

  /** Find element by selector within component */
  find<T extends HTMLElement = HTMLElement>(selector: string): T | null;

  /** Get or set root element attribute */
  attr(name: string): string | null;
  attr(name: string, value: string): void;

  /** Get or set node value (input/textarea/select or innerHTML) */
  val(selector: string | HTMLElement): any;
  val(selector: string | HTMLElement, value: any): void;

  /** Add classes to root or given node */
  addClass(names: string, node?: HTMLElement): void;

  /** Toggle a class on root or given node */
  toggleClass(name: string, force?: boolean, node?: HTMLElement): void;

  /** Set CSS properties on root */
  setStyle(key: string | Record<string, string>, value?: string): void;

  /** Copy props as attributes to root */
  copy(...names: string[]): void;

  /** Get or set root ID */
  rootId(): string;

  /** Get root element children as array */
  childNodes(): HTMLElement[];
  childNodes<T>(func: (node: HTMLElement) => T): T[];
  childNodes(asObject: true): Array<{
    html: string;
    ROOT: HTMLElement;
    [attr: string]: any;
  }>;

  /** Dissolve component into parent */
  dissolve(inNode?: HTMLElement): HTMLElement[];

  /** Get form data from closest/child form */
  formData(node?: HTMLElement): Record<string, string>;

  /** Check if component is attached to DOM */
  readonly isConnected: boolean;

  /** Get single node property */
  prop<T = any>(name: string): T;

  // ===================================================================
  // RENDERING
  // ===================================================================

  /** Force a re-render on next frame */
  fezRefresh(): void;

  /** Alias for fezRefresh */
  refresh(): void;

  /** Render the component template to DOM */
  fezRender(template?: string | Function | Node[]): void;

  /** Parse HTML and replace fez. references */
  fezParseHtml(text: string): string;

  /** Schedule work on next animation frame (debounced by name) */
  fezNextTick(func: () => void, name?: string): void;

  // ===================================================================
  // EVENT HANDLERS
  // ===================================================================

  /** Add window event listener with auto-cleanup */
  on(eventName: string, func: () => void, delay?: number): void;

  /** Window resize handler with auto-cleanup */
  onWindowResize(func: () => void, delay?: number): void;

  /** Window scroll handler with auto-cleanup */
  onWindowScroll(func: () => void, delay?: number): void;

  /** Element resize handler using ResizeObserver */
  onElementResize(el: HTMLElement, func: () => void, delay?: number): void;

  /** Timeout with auto-cleanup */
  setTimeout(func: () => void, delay: number): number;

  /** Interval with auto-cleanup */
  setInterval(func: () => void, tick: number, name?: string): number;

  // ===================================================================
  // PUB/SUB
  // ===================================================================

  /** 
   * Publish to parent components (bubbles up through DOM)
   * @returns True if a parent handled the event
   */
  publish(channel: string, ...args: any[]): boolean;

  /** 
   * Subscribe to a channel (auto-cleanup on destroy)
   * @returns Unsubscribe function
   */
  subscribe(channel: string, func: (...args: any[]) => void): () => void;

  // ===================================================================
  // SLOTS
  // ===================================================================

  /** Copy child nodes natively to preserve bound events */
  fezSlot(source: HTMLElement, target?: HTMLElement): HTMLElement;

  // ===================================================================
  // INTERNAL PROPERTIES
  // ===================================================================

  /** Store for passing values to child components (e.g., loop vars) */
  fezGlobals: {
    set(value: any): number;
    delete(key: number): any;
  };

  /** Block template functions */
  fezBlocks: Record<string, Function>;
}

// =============================================================================
// Fez STATIC API
// =============================================================================

/** Main Fez function - register or find components */
interface FezStatic {
  // ===================================================================
  // COMPONENT REGISTRATION & LOOKUP
  // ===================================================================

  /** Register a component */
  (name: string, klass: typeof FezBase | Function): void;

  /** Find component by UID */
  (uid: number): FezBase | undefined;

  /** Find component by DOM node or selector */
  (name: string | Node): FezBase | undefined;

  /** Find all components of name and execute callback */
  (name: string, callback: (fez: FezBase) => void): FezBase[];

  /** Find with selector context */
  (name: string, selector: string | Node): FezBase | undefined;

  // ===================================================================
  // COMPONENT INDEX
  // ===================================================================

  /** Unified component index */
  index: {
    /** Get component by name */
    [name: string]: {
      class?: typeof FezBase;
      meta?: Record<string, any>;
      demo?: string | HTMLElement;
      info?: string | HTMLElement;
      source?: string;
    };

    /** Get component data object */
    get(name: string): {
      class?: typeof FezBase;
      meta?: Record<string, any>;
      demo?: HTMLElement;
      info?: HTMLElement;
      source?: string;
    };

    /** Render demo into element and execute scripts */
    apply(name: string, el: HTMLElement): void;

    /** Get all component names */
    names(): string[];

    /** Get component names that have demos */
    withDemo(): string[];

    /** Get all components */
    all(): Record<string, any>;

    /** Log all component names to console */
    info(): void;

    /** Ensure entry exists for component */
    ensure(name: string): Record<string, any>;
  };

  // ===================================================================
  // COMPONENT INSTANCES
  // ===================================================================

  /** Counter for unique instance IDs */
  instanceCount: number;

  /** Active component instances by UID */
  instances: Map<number, FezBase>;

  /** Find a component instance from a DOM node */
  find(onode: Node | string, name?: string): FezBase | undefined;

  // ===================================================================
  // CSS UTILITIES
  // ===================================================================

  /** Wrap rules in a generated class, inject them, return the class name */
  cssClass(text: string): string;

  /** All CSS injected so far, in injection order */
  extractCss(): string;

  /**
   * Inject a stylesheet, deduped on its text. Without opts it goes in verbatim.
   * opts.name scopes it to that component; opts.wrap wraps the whole sheet in
   * the component root first. (Compiled components use this internally - in
   * .fez sources, scope comes from <style> vs <style global>.)
   */
  globalCss(cssClass: string | Function, opts?: { name?: string; wrap?: boolean }): string;

  /** Define custom CSS shortcuts */
  cssMixin(name: string, value: string): void;

  // ===================================================================
  // DOM UTILITIES
  // ===================================================================

  /** Get DOM node containing passed HTML */
  domRoot(htmlData: string | HTMLElement): HTMLElement;

  /** Activate node by adding class and removing from siblings */
  activateNode(node: HTMLElement, className?: string): void;

  /** Morph DOM node to new state */
  morphdom(target: Element, newNode: Element, opts?: {
    skipNode?: (oldNode: Element) => boolean;
    beforeRemove?: (node: Element) => void;
  }): void;

  /** Create template render function */
  createTemplate(text: string, opts?: { name: string }): Function;

  // ===================================================================
  // FETCH & DATA
  // ===================================================================

  /** Built-in fetch with caching */
  fetch(url: string, callback?: (data: any) => void): Promise<any>;

  /** Local storage with JSON serialization */
  localStorage: {
    set(key: string, value: any): void;
    get<T = any>(key: string, defaultValue?: T): T;
    remove(key: string): void;
    clear(): void;
  };

  // ===================================================================
  // PUB/SUB
  // ===================================================================

  /** Subscribe globally to a channel */
  subscribe(channel: string, callback: (...args: any[]) => void): () => void;
  subscribe(nodeOrSelector: Node | string, channel: string, callback: (...args: any[]) => void): () => void;

  /** Publish globally to a channel */
  publish(channel: string, ...args: any[]): void;

  // ===================================================================
  // GLOBAL STATE
  // ===================================================================

  /** Global reactive state management */
  state: {
    /** Get global state value */
    get(key: string): any;

    /** Set global state value */
    set(key: string, value: any): void;

    /** Subscribe to specific key changes */
    subscribe(key: string, callback: (value: any, oldValue: any) => void): () => void;

    /** Subscribe to ALL state changes */
    subscribe(callback: (key: string, value: any, oldValue: any) => void): () => void;

    /** Iterate over components using a specific state key */
    forEach(key: string, callback: (fez: FezBase) => void): void;

    /** Create state proxy for component */
    createProxy(component: FezBase): GlobalState;
  };

  // ===================================================================
  // UTILITIES
  // ===================================================================

  /** Get unique ID for a string */
  fnv1(str: string): string;

  /** Resolve a function from string or function reference */
  getFunction(value: string | Function, context?: any): Function;

  /** Check if value is truthy (from props) */
  isTrue(value: any): boolean;

  /** Get type short identifier */
  typeof(value: any): 'o' | 'f' | 's' | 'a' | 'i' | 'n' | 'u';

  /** Convert collection to pairs */
  toPairs(obj: any[]): Array<[any, number]>;
  toPairs(obj: Record<string, any>): Array<[string, any]>;
  toPairs(obj: null | undefined): [];

  /** Throttle function execution */
  throttle(func: Function, delay: number): Function;

  /** Execute callback when DOM is ready */
  onReady(callback: Function): void;

  /** Add utilities to Fez object */
  addUtilities(obj: Record<string, Function>): void;

  // ===================================================================
  // COMPONENT COMPILATION
  // ===================================================================

  /** Compile Fez component from template/xmp/script */
  compile(tagName?: string | Node, html?: string): void;

  // ===================================================================
  // LOGGING & ERROR HANDLING
  // ===================================================================

  /** Enable framework logging */
  LOG?: boolean;

  /** Enable development mode */
  DEV?: boolean;

  /** Log message (only if LOG enabled) */
  consoleLog(text: string): void;

  /** Error message */
  consoleError(text: string, show?: boolean): string;

  /** Error handler - can be overridden */
  onError(kind: string, message: string | Error, context?: Record<string, any>): string;

  /** Log component information */
  info(): void;

  /** Highlight all fez components */
  highlightAll(): void;

  // ===================================================================
  // ASYNC HELPERS
  // ===================================================================

  /** Async/await helper for promises in templates */
  fezAwait(promise: Promise<any>, handlers: {
    pending?: Function;
    then?: Function;
    catch?: Function;
  }): any;

  // ===================================================================
  // ELEMENT TRANSITIONS (fez:in / fez:out)
  // ===================================================================

  /**
   * Named transitions used by the `fez:in` / `fez:out` template attributes:
   *
   *   <div fez:in="fade">
   *   <div fez:in="fly, y=20, duration=300" fez:out="fade; duration: 150">
   *   <div fez:transition="fade">   (both directions; fez:in / fez:out override)
   *
   * Built-ins (all take duration, delay, easing):
   *   fade, fly (from=left|right|top|bottom, distance | x, y; opacity),
   *   slide (axis, opacity), scale (start, opacity), pop (start, opacity),
   *   blur (amount, opacity), flip (axis, angle, perspective, opacity),
   *   rotate (angle, start, opacity), draw (SVG; duration | speed).
   * List reorder: <li key=".." fez:animate="flip, duration=250"> (FLIP on kept nodes).
   * Register your own: `Fez.transitions.pop = (node, params) => ({ keyframes, duration })`.
   * Names not in the registry are treated as CSS @keyframes names.
   */
  transitions: Record<string, FezTransitionFn>;
}

// =============================================================================
// ELEMENT TRANSITIONS
// =============================================================================

/** Parsed `fez:in` / `fez:out` params: "fly, y=20, flag" -> { y: 20, flag: true } */
type FezTransitionParams = Record<string, string | number | boolean>;

/** What a transition function returns. Keyframes describe the INTRO; outro is played in reverse. */
interface FezTransitionSpec {
  /** Web Animations API keyframes, first = hidden state, last = natural state */
  keyframes?: Keyframe[];
  /** Milliseconds (default 300, or params.duration) */
  duration?: number;
  /** Milliseconds (default 0, or params.delay) */
  delay?: number;
  /** CSS timing function or a Svelte-style name (cubicOut, quintOut, backOut, ...) */
  easing?: string;
  /** Called once the animation has finished (or was skipped) */
  cleanup?: () => void;
}

type FezTransitionFn = (node: HTMLElement, params: FezTransitionParams) => FezTransitionSpec;

// =============================================================================
// PJAX NAVIGATION (bundled since 0.6.0)
// =============================================================================

/** Options accepted by Pjax.load / refresh / reload */
interface PjaxLoadOptions {
  /** Target path (alias: href) */
  path?: string;
  href?: string;
  /** Swap only this node (selector or element with an id) instead of the pjax container */
  target?: string | Element;
  /** Resolve the closest .ajax region of this node and swap only it */
  ajax?: Element;
  /** false skips history push and the pjax:render history href */
  history?: boolean;
  /** Use replaceState instead of pushState */
  replace?: boolean;
  /** Commit this path to history instead of the fetched one ('?q=1' is resolved against pathname) */
  replacePath?: string;
  /** false skips the smooth scroll-to-top after a swap */
  scroll?: boolean;
  /** false sends cache-control: no-cache */
  cache?: boolean;
  /** Bypass the 2s same-href debounce */
  force?: boolean;
  /** Serialize this form into the query string */
  form?: HTMLFormElement;
  /** Called after a successful swap */
  done?: () => void;
}

interface PjaxConfig {
  /** Suppress Pjax.console logging (defaults to true unless location.port >= 1000) */
  is_silent: boolean;
  /** Selectors that opt a trigger node out of scroll-to-top */
  no_scroll_selector: string[];
  /** Paths handled with a full browser navigation (string prefix, RegExp, or predicate) */
  paths_to_skip: Array<string | RegExp | ((href: string) => boolean)>;
  /** Class names that opt a link (or ancestor) out of pjax */
  no_pjax_class: string[];
  /** Class names that opt a node out of .ajax region resolution */
  no_ajax_class: string[];
  /** Selector for scoped ajax regions */
  ajax_selector: string;
  /** XHR timeout in ms */
  timeout: number;
  /** Max cached pages for back-button restores */
  history_max: number;
}

/** detail of the pjax:render CustomEvent */
interface PjaxRenderDetail {
  from: string | null;
  to: string;
  status: number | null;
  error: 'network' | 'abort' | 'timeout' | 'status' | 'apply' | null;
  duration: number;
  mode: 'full' | 'target' | 'ajax';
  opts: PjaxLoadOptions;
}

/** detail of the pjax:start CustomEvent */
interface PjaxStartDetail {
  from: string | null;
  to: string;
  mode: 'full' | 'target' | 'ajax';
  opts: PjaxLoadOptions;
}

/**
 * PushState + AJAX navigation, exposed as window.Pjax.
 * Handlers bind automatically when the page has a <pjax> or .pjax container;
 * call Pjax.start() manually when the container is injected after load.
 */
interface PjaxStatic {
  config: PjaxConfig;
  /** Force Pjax.console logging regardless of config.is_silent */
  DEV?: boolean;
  /** Wrap full swaps in document.startViewTransition when available */
  useViewTransition?: boolean;
  /** Last href navigated to */
  lastHref?: string;
  /** Href navigated to before lastHref */
  pastHref?: string;

  /** Bind document/window handlers (idempotent; done automatically when a pjax container exists) */
  start(): void;
  /** Bind only the link click hijack (idempotent, called by start) */
  onDocumentClick(): void;

  /** Navigate and swap the pjax container */
  load(href?: string | PjaxLoadOptions | (() => void), opts?: PjaxLoadOptions | string): false | void;
  /** Re-fetch the current page in place; '#selector' refreshes only that node without history */
  refresh(selectorOrPath?: string | (() => void), opts?: PjaxLoadOptions): false | void;
  /** Re-fetch bypassing cache */
  reload(opts?: PjaxLoadOptions): false | void;
  /** true when the last navigation hit the same href twice */
  refreshed(): boolean;

  /** Current pathname + search */
  path(): string;
  /** Last navigated href, or current path */
  last(): string;
  /** The pjax container element (<pjax> tag or .pjax class) */
  node(): Element | undefined;

  /** Hook: return false to cancel a navigation */
  before(href: string, opts: PjaxLoadOptions): boolean | void;
  /** Hook: called after a full page swap */
  after(href: string): void;
  /** Hook: pjax-confirm dialogs; may return a Promise to defer the navigation */
  confirm(message: string, node: Element): boolean | Promise<boolean>;
  /** Log an error (override to route into app toasts) */
  error(msg: string): void;
  /** Log when not silenced (config.is_silent / DEV) */
  console(msg: string): void;

  /** history.pushState wrapper */
  pushState(href: string): void;
  /** Alias for pushState */
  push(href: string): void;
  /** history.replaceState wrapper */
  replace(href: string): void;

  /** Dispatch a cancelable pjax:<name> event; false when preventDefault was called */
  emit(name: string, detail?: any): boolean;

  /** Read a query-string param */
  qs(key: string): string | undefined;
  /** Set (or remove with null/false) a param, then navigate - or push / return the href */
  qs(key: string, value: string | number | null | false, opts?: { push?: boolean; href?: boolean }): string | false | void;
}

// =============================================================================
// GLOBAL DECLARATIONS
// =============================================================================

declare global {
  /** Global Fez object */
  const Fez: FezStatic;

  /** FezBase class */
  const FezBase: typeof FezBase;

  /** Bundled pjax navigation (fez 0.6.0+) */
  const Pjax: PjaxStatic;

  interface Window {
    Pjax: PjaxStatic;
  }

  interface HTMLElement {
    /** Fez instance attached to element */
    fez?: FezBase;
  }

  interface DocumentEventMap {
    'pjax:start': CustomEvent<PjaxStartDetail>;
    'pjax:render': CustomEvent<PjaxRenderDetail>;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { FezBase };
export default FezStatic;
