/**
 * Fez - TypeScript Type Definitions
 *
 * This file provides type information for the Fez framework.
 * Import: `import Fez, { FezBase } from '@dinoreic/fez'` (`{ Fez, FezBase }` works too).
 * The CDN build (<script src=".../fez.min.js">) sets window.Fez and window.FezBase instead.
 */

// =============================================================================
// UTILITY TYPES
// =============================================================================

/** Reactive state proxy that triggers re-renders on property changes */
type ReactiveState<T = Record<string, any>> = T;

/** Global state proxy for cross-component communication */
type GlobalState = Record<string, any>;

/** Values published after onMount; methods run once with the live component as this. */
type GlobalStateDeclaration = Record<string, any> & ThisType<FezBase>;

/**
 * Component props. Plain HTML attributes arrive as strings unless the
 * component declares a PROPS schema entry for them (then they are coerced).
 */
type ComponentProps = Record<string, any>;

/** Evaluated props (when using :prop syntax) */
type EvaluatedProps = Record<string, any>;

// =============================================================================
// PROPS SCHEMA (PROPS = { ... })
// =============================================================================

/** Built-in prop types. Any other function is a custom caster `(raw, name) => value`. */
type PropType =
  | StringConstructor
  | NumberConstructor
  | BooleanConstructor
  | ArrayConstructor
  | ObjectConstructor
  | FunctionConstructor
  | DateConstructor
  | ((raw: any, name: string) => any);

/** Full form of a PROPS entry */
interface PropSpec<T = any> {
  type?: PropType;
  /**
   * Applied when the prop is missing or failed coercion; functions are called.
   * A function that declares a parameter runs first instead, as a transform:
   * it receives the raw attribute value (undefined when missing) and its
   * result is type checked - `default: (raw) => (raw || '').split(',')`.
   */
  default?: T | (() => T) | ((raw: any, name: string) => T);
  /**
   * Copy the coerced value into this.state before init(): `true` keeps the
   * prop name, a string renames the state key.
   */
  state?: boolean | string;
  /** Report a `props` error via Fez.onError when missing */
  required?: boolean;
  /** Allowed values, checked after coercion */
  enum?: readonly T[];
}

/** `PROPS = { name: String, count: { type: Number, default: 0 } }` */
type PropsSchema = Record<string, PropType | PropSpec>;

type PropTypeOf<T> =
  T extends StringConstructor ? string :
  T extends NumberConstructor ? number :
  T extends BooleanConstructor ? boolean :
  T extends ArrayConstructor ? any[] :
  T extends ObjectConstructor ? Record<string, any> :
  T extends FunctionConstructor ? Function :
  T extends DateConstructor ? Date :
  T extends (raw: any, name: string) => infer R ? R :
  any;

/** Derive a typed props object from a PROPS schema: `PropsOf<typeof PROPS>` */
type PropsOf<S extends PropsSchema> = {
  [K in keyof S]: S[K] extends PropSpec<any>
    ? PropTypeOf<S[K]['type']>
    : PropTypeOf<S[K]>;
} & Record<string, any>;

// =============================================================================
// LIFECYCLE HOOK TYPES
// =============================================================================

/** Called when fez element is connected to DOM, before first render */
type InitHook = (props: ComponentProps & EvaluatedProps) => void;

/** Execute after init and first render; a returned function runs on destroy */
type OnMountHook = (props: ComponentProps & EvaluatedProps) => void | (() => void) | Promise<void>;

/** Execute before every render - use for reactive computed state */
type BeforeRenderHook = () => void;

/** Execute after every render */
type AfterRenderHook = () => void;

/** After mount (changed = every prop) and whenever new props arrive (changed = props whose value differs) */
type OnRefreshHook = (props: ComponentProps & EvaluatedProps, changed: Record<string, any>) => void;

/** Called when local component state changes */
type OnStateChangeHook = (key: string, value: any, oldValue: any) => void;

/** Called when global state changes */
type OnGlobalStateChangeHook = (key: string, value: any, oldValue: any) => void;

/** Called when component is destroyed */
type OnDestroyHook = () => void;

/** Error boundary: catches a descendant's mount error, render throw or template runtime error. Throw to pass it further up. */
type OnErrorHook = (error: any, component: FezBase) => void;

/** What a `fez:use` action may return: a cleanup, or update (later renders) / destroy (node leaves or component is destroyed) hooks */
type FezActionResult = void | (() => void) | {
  update?(node: HTMLElement): void;
  destroy?(): void;
};

/** `fez:use="el => ..."` or `fez:use="methodName"`: runs once per node */
type FezAction = (node: HTMLElement) => FezActionResult;

/** Options for this.on(): addEventListener options plus an optional throttle in ms */
type FezOnOptions = AddEventListenerOptions & { throttle?: number };

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

  /** Expose the live instance as window[name] (cleared on destroy) */
  GLOBAL?: string;

  /** Publish after onMount and delete these keys on destroy. */
  GLOBAL_STATE?: GlobalStateDeclaration;

  /** Append one <tag> to body on ready unless the page already placed it */
  MOUNT?: boolean;

  /** Component metadata */
  META?: Record<string, any>;

  /** Runtime props schema - validates and coerces values into this.props */
  PROPS?: PropsSchema;
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

  /** Execute after init and first render; a returned function runs on destroy */
  onMount?(props: ComponentProps & EvaluatedProps): void | (() => void) | Promise<void>;

  /**
   * Runs after onMount (changed = every prop) and again whenever new props
   * arrive from a parent re-render, a pjax / nodeMorph swap or fez-component
   * (changed = props whose value differs, {} when none did).
   */
  onRefresh?(props: ComponentProps & EvaluatedProps, changed: Record<string, any>): void;

  /** Execute before every render - use for reactive computed state */
  beforeRender?(): void;

  /** Execute after every render (also when an unchanged render skipped the morph) */
  afterRender?(): void;

  /** Called when local component state changes */
  onStateChange?(key: string, value: any, oldValue: any): void;

  /** Called when a global state key this component read changes */
  onGlobalStateChange?(key: string, value: any, oldValue: any): void;

  /** Delegated submit of a form inside this component (not a child component's form); default is prevented */
  onSubmit?(data: Record<string, FormDataEntryValue>): void;

  /**
   * Error boundary: catches a descendant's mount error, render throw or
   * template runtime error. Throwing from it passes the error further up;
   * without a boundary the error goes to Fez.onError.
   */
  onError?(error: any, component: FezBase): void;

  /** Called when component is destroyed */
  onDestroy?(): void;

  // ===================================================================
  // COMPONENT STATE
  // ===================================================================

  /**
   * Reactive component state. A write re-renders only when the last render
   * read that top-level key, so refs, library instances and counters the
   * template never reads are free to keep here.
   */
  state: ReactiveState;

  /** Global state proxy - shared across components */
  globalState: GlobalState;

  /** Publish after onMount and delete these keys on destroy. */
  GLOBAL_STATE?: GlobalStateDeclaration;

  /**
   * Component props from HTML attributes (coerced through PROPS when declared).
   * Reactive one level deep: writing this.props.x schedules a render, same as
   * this.state.x. Nested values are handed back raw (identity preserved), so
   * assign the container rather than mutating inside it.
   */
  props: ComponentProps & EvaluatedProps;

  /** Runtime props schema (instance-field form; `static PROPS` also works) */
  PROPS?: PropsSchema;

  /** Normalized PROPS schema for this class */
  static propsSchema(): Record<string, PropSpec> | null;

  /** Cast a single prop through the PROPS schema */
  static castProp(name: string, value: any, tagName?: string): any;

  /** Cast a props object through the PROPS schema (returns a new object) */
  static castProps(props: Record<string, any>, tagName?: string): Record<string, any>;

  /** HTML-ish boolean parsing used for Boolean props */
  static toBoolean(value: any, name?: string): boolean;

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

  /** Component class this instance was created from */
  class: typeof FezBase;

  /** Get or set root element attribute */
  attr(name: string): string | null;
  attr(name: string, value: string): string;

  /** Set a root attribute through the PROPS schema into this.props (and a `state`-linked key); null removes it */
  setAttribute(name: string, value: any): any;

  /** Get or set node value (input/textarea/select or innerHTML) */
  val(selector: string | HTMLElement): any;
  val(selector: string | HTMLElement, value: any): void;

  /** Set CSS properties on root */
  setStyle(key: string | Record<string, string>, value?: string): void;

  /** Copy props as attributes to root */
  copy(...names: string[]): void;

  /** Get or set root ID */
  rootId(): string;

  /** Element children the tag had before mount (the slot content), as an array */
  childNodes(): HTMLElement[];
  childNodes<T>(func: (node: HTMLElement, index: number) => T): T[];

  /** childNodes() as plain objects: inner HTML, the node, its tag name and every attribute */
  childObjects(): Array<{
    html: string;
    ROOT: HTMLElement;
    NODE_NAME: string;
    [attr: string]: any;
  }>;

  /** Dissolve component into parent */
  dissolve(inNode?: HTMLElement): HTMLElement[];

  /** Get form data from closest/child form */
  formData(node?: HTMLElement): Record<string, FormDataEntryValue>;

  /**
   * Build a DOM node: n('span', { id }), n('.foo.bar', body), n('ul', [li, li]).
   * Attrs and body may swap places; function attrs are bound to the component.
   */
  n(name: string | Node[], attrs?: Record<string, any> | string | Node | Node[], body?: string | Node | Node[]): HTMLElement;

  /** Check if component is attached to DOM */
  readonly isConnected: boolean;

  // ===================================================================
  // RENDERING
  // ===================================================================

  /** Re-render on the next frame (batched with state writes) */
  refresh(): void;

  /** Resolves once the pending render reached the DOM, right away when none is pending */
  tick(): Promise<void>;

  /**
   * context(key, value) provides a value to descendants (and this component);
   * context(key) reads it from the nearest component up the tree.
   * Read it in init(); it is not reactive.
   */
  context<T = any>(key: any): T | undefined;
  context<T>(key: any, value: T): T;

  /**
   * Run func with state change triggers off: writes inside fire no
   * onStateChange and schedule no render. Scopes nest; func's return value
   * is passed back. Fez runs init() and every render in it.
   */
  noChangeStateTrigger<T>(func: (this: this) => T): T;

  /** Render the component template to DOM (defaults to the compiled template) */
  fezRender(template?: string | Function | string[] | Node[]): void;

  /** Parse HTML and replace fez. references */
  fezParseHtml(text: string): string;

  /** Schedule work on next animation frame (debounced by name) */
  fezNextTick(func: () => void, name?: string): void;

  // ===================================================================
  // EVENT HANDLERS
  // ===================================================================

  /**
   * Event listener with auto-cleanup, bound to the component and skipped while
   * it is disconnected. String-first: events in Fez.WINDOW_EVENTS go to window,
   * the rest to document. Returns a disposer for early unregister.
   */
  on(eventName: string, handler: (this: this, event: any) => void, opts?: FezOnOptions): () => void;
  on(target: EventTarget, eventName: string, handler: (this: this, event: any) => void, opts?: FezOnOptions): () => void;

  /** Call func(rect, el) now and whenever el resizes (ResizeObserver, throttled by delay, default 200ms) */
  observeResize(el: Element, func: (this: this, rect: DOMRect, el: Element) => void, delay?: number): void;

  /** Register a cleanup for destroy; returns a function that drops it again */
  addOnDestroy(callback: () => void): () => void;

  /** Timeout with auto-cleanup */
  setTimeout(func: () => void, delay: number): number;

  /** Interval with auto-cleanup; a named interval replaces the running one with that name */
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

  /**
   * Render slots for passing live values through rendered HTML
   * (`:attr="expr"` props and loop handlers). Keys are positional per render.
   */
  fezGlobals: {
    set(value: any): number;
    value(key: number): any;
    setHandler(fn: Function): number;
    handler(key: number): Function | undefined;
    beginRender(): void;
    commitRender(): void;
    clear(): void;
    readonly valuesChanged: boolean;
  };
}

// =============================================================================
// Fez STATIC API
// =============================================================================

/** Main Fez function - register or find components */
/** One entry of Fez.index */
interface FezIndexEntry {
  class?: typeof FezBase;
  meta?: Record<string, any>;
  props?: PropsSchema;
  demo?: string | HTMLElement;
  info?: string | HTMLElement;
  source?: string;
}

/**
 * Fez.index helpers. Intersected with the name index below: an interface
 * cannot declare both, since the methods do not satisfy the index signature.
 */
interface FezIndexMethods {
  /** Get component data object */
  get(name: string): FezIndexEntry & { demo?: HTMLElement; info?: HTMLElement };

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
}

type FezIndex = FezIndexMethods & { [name: string]: FezIndexEntry };

/** Fez.head config: one of js / css / script / fez; other keys become attributes of the created tag */
interface FezHeadConfig {
  /** Script URL */
  js?: string;
  /** With js: import the module and set window[module] to its default export */
  module?: string;
  /** Stylesheet URL */
  css?: string;
  /** Inline script source; one containing `import ` runs as a module */
  script?: string;
  /** A .fez file, or a .txt list of .fez paths (one per line, # comments) */
  fez?: string;
  /** Bare specifier map; handled at compile time in a .fez <script>, before the class */
  importmap?: Record<string, string>;
  [attr: string]: any;
}

/** The FezBase class type, named outside `declare global` so the global const does not reference itself */
type FezBaseClass = typeof FezBase;

interface FezStatic {
  // ===================================================================
  // COMPONENT REGISTRATION & LOOKUP
  // ===================================================================

  /** Run callback for every live instance of name and return them (an arrow is never taken for a class) */
  (name: string, callback: (fez: FezBase) => void): FezBase[];

  /** Register a component */
  (name: string, klass: typeof FezBase | (abstract new (...args: any[]) => any)): void;

  /** Find component by UID */
  (uid: number): FezBase | undefined;

  /** Find component by DOM node or selector */
  (name: string | Node): FezBase | undefined;

  /** Find with selector context */
  (name: string, selector: string | Node): FezBase | undefined;

  // ===================================================================
  // COMPONENT INDEX
  // ===================================================================

  /** Unified component index: entries by component name, plus the helper methods */
  index: FezIndex;

  // ===================================================================
  // COMPONENT INSTANCES
  // ===================================================================

  /** Library version (X.Y.Z from package.json at build time) */
  version: string;

  /** Event names this.on('event', fn) binds on window; the rest go to document. Mutate to customize. */
  WINDOW_EVENTS: Set<string>;

  /** Counter for unique instance IDs */
  instanceCount: number;

  /** Active component instances by UID */
  instances: Map<number, FezBase>;

  /** Closest component instance of a node, selector or instance; undefined when nothing matches */
  find(onode: Node | string | FezBase, name?: string): FezBase | undefined;

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

  /**
   * Define a CSS shortcut. The usage site picks the form: `:name {` expands the
   * value as a selector / at-rule prelude, `:name;` inlines it as declarations.
   */
  cssMixin(name: string, value: string): void;
  /** Expand every registered mixin in a CSS string */
  cssMixin(css: string): string;

  // ===================================================================
  // DOM UTILITIES
  // ===================================================================

  /** Get DOM node containing passed HTML (a node is returned as is) */
  domRoot(htmlData: string | Node, tagName?: string): HTMLElement;

  /** Activate node by adding class and removing from siblings */
  activateNode(node: HTMLElement, className?: string): void;

  /**
   * Morph target's children to src with the component-aware differ: live
   * components are preserved and get onRefresh. Target's own attributes are
   * left alone. A string or element whose root tag matches target is used as is.
   */
  nodeMorph(target: Element, src: string | Element | DocumentFragment): void;

  /** Create template render function */
  createTemplate(text: string, opts?: { name: string }): Function;

  /**
   * Load resources into document.head: { js }, { css }, { script }, { fez } (a
   * .fez file or a .txt list of them), a DOM node (runs its scripts, compiles
   * its fez definitions) or an HTML string (appended, scripts re-created so
   * they run). Returns the created or existing <script> / <link> for js / css.
   */
  head(config: FezHeadConfig | Node | string, callback?: (error?: any) => void): HTMLElement | void;

  /** `<tag data-props="...">html</tag>` with opts JSON-encoded as props */
  tag(tag: string, opts?: Record<string, any>, html?: string): string;

  // ===================================================================
  // FETCH & DATA
  // ===================================================================

  /**
   * fetch with JSON / text handling. GET responses are cached for 5 minutes
   * (max 100 entries) and concurrent GETs share one request; other methods
   * always hit the network. data becomes the query string for GET and a
   * FormData body for POST. A method must be uppercase ('POST'). With a
   * callback nothing is returned and errors go to Fez.onError.
   */
  fetch<T = any>(url: string, callback: (data: T) => void): void;
  fetch<T = any>(url: string, data: Record<string, any>, callback: (data: T) => void): void;
  fetch<T = any>(url: string, data?: Record<string, any>): Promise<T>;
  fetch<T = any>(method: string, url: string, callback: (data: T) => void): void;
  fetch<T = any>(method: string, url: string, data: Record<string, any>, callback: (data: T) => void): void;
  fetch<T = any>(method: string, url: string, data?: Record<string, any>): Promise<T>;

  /** Drop cached and in-flight Fez.fetch requests */
  clearFetchCache(): void;

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

    /** Delete a key and notify readers with undefined. */
    delete(key: string): void;

    /** Subscribe to specific key changes */
    subscribe(key: string, callback: (value: any, oldValue: any, key: string) => void): () => void;

    /** Subscribe to ALL state changes (same argument order as the keyed form) */
    subscribe(callback: (value: any, oldValue: any, key: string) => void): () => void;

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

  /** Short unique id: 'fez_uid_...' */
  uid(): string;

  /**
   * Resolve a function from a function, an arrow / function source, a dotted
   * path ("this.focus") or a function body; a no-op for empty values
   */
  getFunction(value: string | Function | null | undefined): Function;

  /**
   * Park a function on window for inline HTML and return its expression
   * (`Fez.POINTER[n]`). One-time use unless opts.persist.
   */
  pointer(func: Function, opts?: { persist?: boolean }): string;

  /** Check if value is truthy (from props): '1', 'true', 'on' */
  isTrue(value: any): boolean;

  /** Template truthiness: empty arrays and empty objects are false */
  isTruthy(value: any): boolean;

  /** Escape any value as HTML text; null / undefined render '' */
  htmlEscape(value: any): string;

  /** Rendered ` name="value"` for an unquoted name={expr} attribute, or '' to drop it */
  htmlAttr(name: string, value: any): string;

  /** One `name: value;` declaration for style:name={expr}, or '' when null / undefined / false */
  styleProp(name: string, value: any): string;

  /** Escape a value for a quoted JS string in handler code (templates use it for onclick="fez.rm('{id}')") */
  jsEscape(value: any): string;

  /** Darken a #hex color by percent (default 20) */
  darkenColor(color: string, percent?: number): string;

  /** Lighten a #hex color by percent (default 20) */
  lightenColor(color: string, percent?: number): string;

  /** Get type short identifier */
  typeof(value: any): 'o' | 'f' | 's' | 'a' | 'i' | 'n' | 'b' | 'u';

  /** Convert collection to pairs */
  toPairs(obj: any[]): Array<[any, number]>;
  toPairs(obj: Record<string, any>): Array<[string, any]>;
  toPairs(obj: null | undefined): [];

  /** Throttle function execution (leading call, trailing call kept; delay default 200ms) */
  throttle<F extends (...args: any[]) => any>(func: F, delay?: number): (...args: Parameters<F>) => void;

  /** Execute callback when DOM is ready */
  onReady(callback: () => void): void;

  /** Call func every pingRate ms (default 200) until it returns a truthy value */
  untilTrue(func: () => any, pingRate?: number): void;

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

  /** Show a value in the dump dialog (ESC closes, arrows page through earlier dumps) */
  dump(value: any): void;

  /** Highlight all fez components */
  highlightAll(): void;

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
   * Content size: <div fez:animate="height"> (height | width | size; "flip, height" does both).
   * Register your own: `Fez.transitions.pop = (node, params) => ({ keyframes, duration })`.
   * Names not in the registry are treated as CSS @keyframes names.
   */
  transitions: Record<string, FezTransitionFn>;

  /**
   * Animate an element's box when its content changes - what
   * `fez:animate="height"` does, for plain DOM outside templates.
   * spec: "height" | "width" | "size" plus duration / delay / easing params,
   * as a string ("height, duration=250") or a parsed { name, params }.
   * Calling again only updates the params. Returns true when spec is a size animation.
   */
  animateSize(node: HTMLElement, spec: string | { name: string; params?: FezTransitionParams }): boolean;

  // ===================================================================
  // PAGE NAVIGATION (pjax)
  // ===================================================================

  /** The pjax navigation class: config, hooks (before/after/confirm/error), start() */
  pjax: PjaxStatic;
  /** Fetch a URL and swap it into the page. Same as Fez.pjax.load */
  load: PjaxStatic['load'];
  /** Fresh re-fetch (no-cache, no debounce, keeps scroll). Same as Fez.pjax.refresh */
  refresh: PjaxStatic['refresh'];
  /** Read or set a query-string param. Same as Fez.pjax.qs */
  qs: PjaxStatic['qs'];
  /** Read or set a hash param. Same as Fez.pjax.hash */
  hash: PjaxStatic['hash'];
  /** Read or set the hash route path. Same as Fez.pjax.hpath */
  hpath: PjaxStatic['hpath'];
  /** Read or set a hash route query param. Same as Fez.pjax.hqs */
  hqs: PjaxStatic['hqs'];
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

/**
 * Options accepted by Fez.load / Fez.refresh. Unknown keys are reported through
 * Fez.pjax.error and dropped. Defaults apply only to undefined values.
 */
interface PjaxLoadOptions {
  /** Swap only this node (selector or element with an id) instead of the pjax container */
  target?: string | Element;
  /** Element that started the load; inside a .ajax region only that region is swapped, without history */
  source?: Element;
  /** GET serializes the form into the query string, POST sends it as FormData */
  form?: HTMLFormElement;
  /** 'push' (default), 'replace', or false to leave history alone. Default false for node swaps of the current URL */
  history?: 'push' | 'replace' | false;
  /** Smooth scroll to top after the swap. Default true for a full load swap, false otherwise */
  scroll?: boolean;
}

/**
 * What to load: a URL ('/path', '?query'), or a '#selector' / element that
 * becomes the target and re-fetches the current URL. Nothing means the current URL.
 */
type PjaxLoadWhat = string | Element | null | undefined;

/** Resolves the pjax:render detail, or null when no request was sent. Never rejects. */
type PjaxLoadResult = Promise<PjaxRenderDetail | null>;

/** Shared options for query-string and hash state setters. Neither setter fetches a page. */
interface PjaxUrlStateOptions {
  /** Replace the current history entry instead of adding one. */
  replace?: boolean;
  /** Return the URL without changing it; takes precedence over replace. */
  href?: boolean;
}

/** Options for Fez.hpath. `qs` replaces the route's query when a path is set. */
interface PjaxHashPathOptions extends PjaxUrlStateOptions {
  qs?: string | URLSearchParams | Record<string, string | number>;
}

interface PjaxConfig {
  /** Suppress Fez.pjax.console logging (defaults to true unless location.port >= 1000) */
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
  /** Request timeout in ms */
  timeout: number;
  /** Max cached pages for back-button restores */
  history_max: number;
}

/** detail of the pjax:render CustomEvent */
interface PjaxRenderDetail {
  from: string | null;
  to: string;
  status: number | null;
  error: 'network' | 'abort' | 'timeout' | 'status' | 'apply' | 'layout' | null;
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
 * PushState + AJAX navigation, exposed as Fez.pjax (Fez.load, Fez.refresh and
 * the URL state helpers delegate to it). Handlers bind automatically when the
 * page has a <pjax> or .pjax container; call Fez.pjax.start() manually when the
 * container is injected after load.
 */
interface PjaxStatic {
  config: PjaxConfig;
  /** Full-swap responses by path, restored on Back/Forward without a fetch (config.history_max entries) */
  historyData: Record<string, { html: string; scrollY: number }>;
  /** In-flight requests by swap key: 'full', or the target / .ajax region id */
  requests: Map<string, AbortController>;
  /** Force console logging regardless of config.is_silent */
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

  /** Fetch and swap. Scrolls to top on a full swap; same URL + node is debounced for 2s */
  load(what?: PjaxLoadWhat, opts?: PjaxLoadOptions): PjaxLoadResult;
  /** Same signature as load, fresh: cache-control no-cache, no debounce, keeps scroll */
  refresh(what?: PjaxLoadWhat, opts?: PjaxLoadOptions): PjaxLoadResult;
  /** true when the last navigation hit the same href twice */
  refreshed(): boolean;

  /** Current pathname + search */
  path(): string;
  /** Last navigated href, or current path */
  last(): string;
  /** The pjax container element (<pjax> tag or .pjax class) */
  node(): Element | undefined;
  /** Layout id from <meta name="pjax-layout">, sent as x-pjax-layout on full swaps; null without one */
  layout(): string | null;

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
  /** Return the updated URL without changing history. */
  qs(key: string, value: string | number | null | false, opts: PjaxUrlStateOptions & { href: true }): string;
  /** Set (or remove with null/false) a query param, pushing history by default without fetching. */
  qs(key: string, value: string | number | null | false, opts?: PjaxUrlStateOptions): string | void;
  /** Read a named hash param (#key=value&other=value). */
  hash(key: string): string | undefined;
  /** Return the updated URL without changing history. */
  hash(key: string, value: string | number | null | false, opts: PjaxUrlStateOptions & { href: true }): string;
  /** Set (or remove with null/false) a hash param, pushing history by default without fetching. */
  hash(key: string, value: string | number | null | false, opts?: PjaxUrlStateOptions): string | void;
  /** Read the last path segment of a hash route (#/foo, #ns/foo); '' when the fragment is not a route. */
  hpath(): string;
  /** Return the URL for a new hash route path without changing history. */
  hpath(value: string | null | false, opts: PjaxHashPathOptions & { href: true }): string;
  /** Set the hash route path (#/foo), pushing history by default without fetching. */
  hpath(value: string | null | false, opts?: PjaxHashPathOptions): string | void;
  /** Read a query-string param from a hash route fragment (#/foo?bar=baz). */
  hqs(key: string): string | undefined;
  /** Return the updated URL without changing history. */
  hqs(key: string, value: string | number | null | false, opts: PjaxUrlStateOptions & { href: true }): string;
  /** Set (or remove with null/false) a hash route query param, preserving the path. */
  hqs(key: string, value: string | number | null | false, opts?: PjaxUrlStateOptions): string | void;
}

// =============================================================================
// GLOBAL DECLARATIONS
// =============================================================================

/** The Fez object, as exported by the ESM / CJS builds */
declare const Fez: FezStatic;

declare global {
  /** Global Fez object */
  const Fez: FezStatic;

  /** FezBase class */
  const FezBase: FezBaseClass;

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

export { Fez, FezBase };
export type {
  FezStatic, FezAction, FezActionResult, FezHeadConfig, FezOnOptions,
  PropsSchema, PropSpec, PropType, PropsOf,
  PjaxLoadOptions, PjaxRenderDetail, PjaxStartDetail,
};
export default Fez;
