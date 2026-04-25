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

  /** Component CSS styles (SCSS syntax) */
  CSS?: string | (() => string);

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

  /** Generate unique CSS class from CSS text */
  cssClass(text: string): string;

  /** Register global CSS styles */
  globalCss(cssClass: string | Function, opts?: { name?: string; wrap?: boolean }): string;

  /** Define custom CSS shortcuts */
  cssMixin(name: string, value: string): void;

  /** Add global SCSS styles */
  globalCss(scss: string): void;

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
}

// =============================================================================
// GLOBAL DECLARATIONS
// =============================================================================

declare global {
  /** Global Fez object */
  const Fez: FezStatic;

  /** FezBase class */
  const FezBase: typeof FezBase;

  interface HTMLElement {
    /** Fez instance attached to element */
    fez?: FezBase;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export { FezBase };
export default FezStatic;
