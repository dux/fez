# Fold Pjax into Fez and clean up the load options

## Context

Fez bundles Pjax (`src/fez/pjax/`) but exposes it as a second global, `window.Pjax`.
Goal: `Fez` is the only interface, and Pjax stays an internal lib.
While moving it, the `load` / `refresh` / `reload` option surface also gets cleaned up.
It grew out of the CoffeeScript port and has real problems (see Findings).

Decisions made:
* `window.Pjax` is removed, with no alias.
* Top-level surface: `Fez.load`, `Fez.refresh`, `Fez.qs`, `Fez.hash`, `Fez.hpath`, `Fez.hqs`. Everything else is on `Fez.pjax`.
* `load` / `refresh` return a Promise, and the `done` option is removed.
* `reload` is folded into `refresh`, which always sends `cache-control: no-cache`.
* `ajax: node` is renamed to `source: node`.

## Findings (current `./src/fez/pjax/pjax.js`)

1. **Loose overloads.**
   * `load(x, y)`: `x` may be a path, an options object, a DOM node (becomes `ajax`) or a function (becomes `done`).
   * `y` may be an object or a string (becomes `target`).
   * `refresh(x)` checks for `'#...'`.
   * `reload(opts)` passes `opts` as the *path*, so `reload('#spot_assets')` (used in sleepy-shoe `edit.haml`) only scrolls to the element and never fetches.
2. **Unknown keys are ignored silently.** Real misuse in apps:
   * `Pjax.load(url, { node: '#toggle-data' })` in nekretnine and vibe `input-toggle.fez`. `node` is internal, so this does a full swap.
   * `Pjax.refresh({ no_cache: true })` does nothing.
3. **The caller's object is mutated, and internal state lives in it.**
   * `refresh` writes `force`, `history` and `scroll` into the passed object.
   * `node`, `ajax_node`, `method`, `form_data`, `req_start_time`, `redirects` and a rewritten `path` all live on `opts`, and that same object is published as `pjax:render` `detail.opts`.
   * A reused options constant carries state from one call into the next.
4. **Three history knobs:** `history: false`, `replace: true`, and `replacePath`.
   * `replacePath` has no caller in the repo or in any local app.
5. **Redundant keys.**
   * `path` and `href` are aliases for the positional URL.
   * `force` only exists so `refresh` can bypass the 2s same-href debounce.
   * `cache: false` only exists for `reload`.
6. **`reload()` scrolls to top while `refresh()` does not.** Two verbs for nearly the same thing.
7. **A missing `target` falls through to a full swap.** `_resolveTarget` leaves `target = null` when the selector does not match, and `applyLoadedData` then swaps the whole container.
8. **`load()` sniffs the deprecated `window.event`** for cmd-click and middle-click.
   A programmatic `Fez.load()` inside any meta-key handler opens a new tab.
   `onclick.js` already handles that gesture itself.
9. **No result.** The return value is `false` or `undefined`.
   `done` fires only on success, so errors are only visible through the `pjax:render` event.

## New surface

`load` and `refresh` share one signature and differ only in their defaults.

```js
Fez.load(what?, opts?)
Fez.refresh(what?, opts?)

// what:
//   undefined     -> current URL, full container swap
//   '/path', '?q' -> that URL ('?q' resolved against the source region or pathname), full swap
//   '#sel' | el   -> current URL, swap only that node (same as opts.target)
Fez.load('/users')                        // navigate
Fez.load('#panel')                        // re-fetch current URL into #panel
Fez.load('/x', { target: '#panel' })      // other URL into #panel
Fez.refresh()                             // fresh copy of the current page
Fez.refresh('/users/1/edit')              // navigate, fresh, keep scroll

opts = {
  target,   // '#sel' | Element (with id) - swap only this node from the response
  source,   // Element that started the load; inside a .ajax region -> region swap, no history
  form,     // HTMLFormElement - GET serializes to the query, POST sends FormData
  history,  // 'push' (default) | 'replace' | false
  scroll,   // boolean; default true for full swaps, false for target/region swaps
}

await Fez.load('/users')  // -> pjax:render detail {from,to,status,error,duration,mode,opts} | null when skipped
```

Defaults are applied only when the option is `undefined`, so an explicit value always wins:

| | `load` | `refresh` |
|---|---|---|
| request cache | normal | `cache-control: no-cache` |
| 2s same-URL debounce | yes | no |
| `scroll` | `true` for a full swap, `false` when a node is swapped (`'#sel'`, element, `target`, `source` region) | `false` |
| `history` | `false` when the current URL is fetched into a node; otherwise `'push'`, collapsing to `'replace'` when the URL does not change | same as `load` |

A `'#sel'` argument now always means a node, never an in-page anchor scroll.
Plain `<a href="#x">` anchors never reached pjax anyway (`onclick.js` returns early for them).
`'#sel'` or an element that does not resolve reports `Pjax.error('target not found: ...')` and resolves `null`.

Removed:
* the function / options-object first argument (an Element first argument now means `target`, no longer `ajax`)
* the in-page anchor scroll for a `'#id'` argument
* the string second argument
* the `path`, `href`, `done`, `cache`, `force`, `replace` and `replacePath` options
* `reload`

Migration map for apps:

| Old | New |
|---|---|
| `Pjax.reload()` | `Fez.refresh()` |
| `Pjax.reload('#x')` | `Fez.refresh('#x')` |
| `Pjax.refresh(path)` | `Fez.refresh(path)` (unchanged shape) |
| `Pjax.refresh(this)` | `Fez.refresh(null, { source: this })` |
| `{ node: '#x' }` (silently ignored today) | `{ target: '#x' }` |
| `{ replace: true }` | `{ history: 'replace' }` |
| `{ ajax: el }` | `{ source: el }` |
| `load(x, fn)` / `done: fn` | `.then(fn)` |
| `load(href, '#t')` | `load(href, { target: '#t' })` |

## Changes

### `./src/fez/pjax/pjax.js`
* `load` and `refresh` become two thin entry points into one normalizer:
  ```
  + static load(what, opts)    { return Pjax.fetch(Pjax.getOpts(what, opts), { fresh: false }) }
  + static refresh(what, opts) { return Pjax.fetch(Pjax.getOpts(what, opts), { fresh: true }) }
  - refresh's '#...' sniffing and opts.force / opts.scroll mutation, reload()
  ```
  * `getOpts(what, opts)` copies `{ ...opts }`, so the caller's object is never touched.
  * `what` is a string starting with `#`, or an Element, so it becomes `target` with the current URL. Any other string is the href. `undefined` means the current URL.
  * Any key outside `target, source, form, history, scroll` gives `Pjax.error('unknown load option: <key>')` and is dropped.
  * `undefined` values are allowed, because `onclick.js` passes `target: undefined`.
  * `fresh` is a mode on the request instance, not a user option. It drives no-cache and the debounce bypass.
* One `applyDefaults(o, fresh)` fills only the `undefined` options, following the defaults table:
  * `scroll`: `false` when there is a target or source region; otherwise `!fresh`.
  * `history`: `false` for a node fetched from the current URL; otherwise `'push'`.
  * The existing `_lastHrefCheck === href` rule still collapses an unchanged URL to a replace.
* The `href.startsWith('#')` anchor-scroll branch in `load()` goes away, because `#` input is now a target.
* Swap key: each request gets `this.key`. It is the target or region id for node swaps, and `'full'` for a container swap.
  * Debounce: `Pjax._lastLoad = { key, href, time }` replaces `lastHref` / `_lastLoadTime` for the 2s check.
    As a result, `load('#a')` followed by `load('#b')` no longer drops the second call.
    `Pjax.lastHref` / `pastHref` stay as navigation history for `last()` / `refreshed()`.
  * In-flight: `Pjax.request` (a single XHR) becomes `Pjax.requests` (a Map from key to XHR):
    * a new request aborts only the one with the same key
    * a `'full'` request aborts all of them, because a page swap replaces the regions anyway
    * `handleResponse`'s "superseded" check compares against `Pjax.requests.get(this.key)`
* `pjax:start` cancel is honored: when `Pjax.emit('start', ...)` returns false, `sendRequest` skips the XHR and resolves `null`.
  Today the return value is ignored, although the README calls the event cancelable.
* Target checks run in `getOpts`, before any request, each reporting `Pjax.error` and resolving `null`:
  * the selector or element does not resolve
  * the resolved node has no `id` (today this is found only after the fetch and falls through to a full swap)
  * a positional node (`'#sel'` / element) is given together with `opts.target`
* Internal state moves from `opts` onto the instance: `this.node`, `this.ajaxNode`, `this.method`, `this.body`, `this.startedAt`, `this.redirects`, `this.fresh`, `this.key`.
  `emitDone` / `emit('start')` publish the clean normalized `opts`.
* History:
  ```
  - opts.replace || _lastHrefCheck === href ? replace : push; opts.history === false skip; replacePath
  + history === false skip; history === 'replace' || _lastHrefCheck === href ? replace : push
  ```
* Promise:
  * `Pjax.fetch(opts)` returns `new Promise(resolve => { pjax.resolve = resolve; pjax.load() })`.
  * `emitDone(detail)` also calls `this.resolve(detail)`.
  * Every early exit in `load()` calls `this.resolve(null)`: debounce, `before()` false, hand-off to a full navigation via `redirect()`, and the missing target.
  * `followRedirect` keeps the same instance, so it resolves once.
  * The Promise never rejects; errors travel in `detail.error`, like `fetch()` resolving on HTTP errors.
    This keeps fire-and-forget calls (`Fez.load('/x')` with nothing capturing the result) free of unhandled rejections.
    Each exit path resolves exactly once.
    A throwing hook (`before()` / `after()` / `confirm()`) is caught, reported through `Pjax.error`, and resolves `null`.
  * Callers now get a Promise (truthy) instead of `false`.
    No local app reads the return value; only CoffeeScript's automatic returns in compiled bundles pick it up, and nothing uses them.
* Delete the `window.event` cmd-click / middle-click block in `load()`.
* Delete `reload`, the `done` handling, and the `href`/`path` option aliases in `_resolveArgs`.
  `_resolveArgs` shrinks to href plus form serialization.
* Rename `_resolveAjax` to `_resolveSource` (reads `opts.source`).

### `./src/fez/pjax/onclick.js`
```
- Pjax.load(href, { target: targetNode, replace })
+ Pjax.load(href, { target: targetNode, history: replace ? 'replace' : undefined })
- Pjax.load(href, { ajax: node, replace })
+ Pjax.load(href, { source: node, history: replace ? 'replace' : undefined })
```
`pjax-refresh` already calls `Pjax.refresh(selector)`, so it needs no change.
In `pjax.js`: the `data-pjax` submit handler passes `target: is_pjax === 'true' ? undefined : is_pjax`, and popstate passes `{ history: false }`, which is unchanged.

### `./bin/fez-refactor`
Add a rule in `auditFile` (same `report(line, message, suggestion)` shape as the `var` / `{{` rules) that flags `\bPjax\.` in `.fez/.js/.ts` files.
The suggestion is picked from the migration table:
* `Pjax.(load|refresh|qs|hash|hpath|hqs)` becomes `Fez.$1`
* `Pjax.reload` becomes `Fez.refresh`
* any other `Pjax.x` becomes `Fez.pjax.x`
* on the same line: `ajax:` becomes `source:`, `replace: true` becomes `history: 'replace'`, `done` becomes `.then()`

It reports only and never rewrites, like the existing rules.
Its test goes in `./test/fez-bin.test.js` `describe('fez refactor')`.
`.haml` / `.coffee` in the apps are out of its reach; they are migrated with `rg`.

### `./src/fez/pjax/boot.js`
```
- if (window.Pjax) { return; }
- window.Pjax = Pjax;
+ Fez.pjax = Pjax;
+ Fez.load    = (...a) => Fez.pjax.load(...a);
+ Fez.refresh = (...a) => Fez.pjax.refresh(...a);
+ Fez.qs / Fez.hash / Fez.hpath / Fez.hqs  (same delegation)
```
The shortcuts delegate at call time, so an override of `Fez.pjax.load` also changes `Fez.load`.
Boot gating is unchanged.
`./src/fez.js` changes only in its comment.

### `./fez.d.ts`
* `PjaxLoadOptions` becomes `{ target?: string | Element; source?: Element; form?: HTMLFormElement; history?: 'push' | 'replace' | false; scroll?: boolean }`.
* `load` and `refresh` share one signature: `(what?: string | Element | null, opts?: PjaxLoadOptions) => Promise<PjaxRenderDetail | null>`.
  The doc comments state each verb's defaults.
* `reload` is removed.
* `FezStatic` gains `pjax: PjaxStatic` plus `load`, `refresh`, `qs`, `hash`, `hpath` and `hqs`, typed as `PjaxStatic['...']`.
* The global `const Pjax` and `Window.Pjax` are removed.
* `pjax:start` / `pjax:render` keep their names.

### Tests

Existing suites keep their layout and shared env (`./test/pjax-env.js`, `createPjax()` per test).
Obsolete tests are rewritten, not deleted, unless the behavior itself is gone.

**`./test/pjax-core.test.js`**
* Rewritten, same intent with the new shape:
  * "derives ajax context when DOM node provided" becomes "`source` inside a `.ajax` region resolves the region".
  * "refreshes a targeted node when selector passed", "forces selector refreshes to skip history and scrolling" and "refresh without selector uses current path and disables scroll" move into `describe('load/refresh defaults')`.
  * The `historyAddCurrent` tests use `history: false | 'replace'`.
  * "instance load aborts previous in-flight request" moves into `describe('swap keys')`.
  * "instance load returns false when href is empty" and "instance load aborts when before() returns false" assert the promise resolves `null`.
* Removed together with their behavior:
  * "disables cache when calling reload"
  * "getOpts treats function arg as done callback", "getOpts treats plain object arg as opts", "getOpts converts href alias to path", "getOpts treats string second arg as target"
  * "normalizes replacePath with query-only value using pathname"
  * "instance load redirects for URLs containing hash": `'#x'` is a target now, and `'/p#x'` keeps its redirect test under a new name
* New `describe('argument shapes')`, table-driven over `['load', 'refresh']`, same cases for both:
  * `undefined` fetches the current URL with mode `full`
  * `'/x'` fetches `/x` with mode `full`
  * `'?q=1'` fetches `pathname?q=1`, or the source region's `data-path?q=1`
  * `'#panel'` and an element each fetch the current URL with mode `target`
  * `'/x', { target: '#panel' }` fetches `/x` with mode `target`
  * `'#panel', { target: '#other' }` reports an error and resolves `null`
* New `describe('options')`:
  * an unknown key (`node`, `no_cache`, `done`, `ajax`, `replace`) reports `unknown load option: <key>` and is dropped
  * `undefined` values are accepted silently
  * the caller's object is deep-equal to its original after the call, and a reused constant carries nothing into the next call
  * `pjax:render` `detail.opts` holds only the public keys
* New `describe('load/refresh defaults')`, table-driven with rows `[verb, args, expected { scroll, history, noCache, debounced }]`:
  * `load('/x')` gives `{ scroll: true, history: 'push', noCache: false, debounced: true }`
  * `load('#panel')` / `load(el)` gives `{ scroll: false, history: false, noCache: false, debounced: true }`
  * `load('/x', { target })` gives `{ scroll: false, history: 'push' }`
  * `load('/x', { source })` inside `.ajax` gives `{ scroll: false, history: false }`
  * `refresh()` gives `{ scroll: false, history: 'replace' (same URL), noCache: true, debounced: false }`
  * `refresh('/x')` gives `{ scroll: false, history: 'push', noCache: true }`
  * `refresh('#panel')` gives `{ scroll: false, history: false, noCache: true }`
  * explicit `scroll: true` / `history: 'push'` / `history: false` override every row
  * `.no-scroll` (`config.no_scroll_selector`) still suppresses scroll
* New `describe('target checks')`, all resolving `null` without opening an XHR:
  * the selector matches nothing
  * the element has no id
  * a positional node together with `opts.target`
* New `describe('swap keys')`:
  * `load('#a')` + `load('#b')` in one tick send two XHRs and both resolve with a detail
  * two `load('#a')` calls within 2s: the second resolves `null` (debounced)
  * two `refresh('#a')` calls: the first XHR is aborted and resolves `error: 'abort'`
  * a full `load('/x')` aborts pending `#a` / `#b` XHRs
  * a late response of a superseded request does not swap
* The `window.event` cmd-click test: with `window.event = { metaKey: true }` set, `load('/x')` still sends an XHR and never calls `window.open`.

**`./test/pjax-events.test.js`**
* New `describe('promise result')`:
  * resolves the `pjax:render` detail on 200, on a non-200 `status`, on `network`, on `timeout` and on `abort`
  * resolves once across a same-origin redirect (`followRedirect`)
  * resolves `null` when debounced, when `before()` returns false, when `paths_to_skip` hands off to a full navigation, and when `pjax:start` is prevented
  * a throwing `before()` / `after()` resolves `null`, reports through `Pjax.error`, and a `process.on('unhandledRejection')` spy stays at 0
* "pjax:render to uses replacePath ..." is removed. "opts.replace forces replaceState ..." becomes "`history: 'replace'` forces replaceState".
* The `describe('Pjax.refresh and Pjax.reload bypass debounce')` block becomes `describe('refresh bypasses debounce')`, asserting the internal `fresh` mode rather than `opts.force`.
* `describe('fez boot gating')`:
  * "without a container: `Fez.pjax` is set, no handlers bound"
  * "with a container: handlers bound"
  * "`window.Pjax` stays undefined"
  * "`Fez.load` / `Fez.refresh` / `Fez.qs` / `Fez.hash` / `Fez.hpath` / `Fez.hqs` delegate to the current `Fez.pjax`" (swap in a stub class, call each shortcut, assert the stub received the args)
  * "`Fez.pjax.start()` for late containers"
  * "does not overwrite an existing window.Pjax" is removed

**`./test/pjax-onclick.test.js`**
* "calls Pjax.load with ajax context ..." becomes "calls load with `source` for regular href clicks".
* "pjax-replace passes replace flag ..." becomes "pjax-replace passes `history: 'replace'`".
* "uses pjax-target ..." asserts `{ target: node }` and no `replace` key.
* New: `data-pjax="#panel"` form submit calls `load(action, { form, target: '#panel' })`, and `data-pjax="true"` passes `target: undefined` without an unknown-option error.

**`./test/browser/pjax-url-state.test.js`**
* `Pjax.qs/hash/hpath/hqs` becomes `Fez.qs/...`.
* New browser case: `await Fez.load('#panel')` against a served fixture swaps only `#panel` and keeps `scrollY` (real layout, which happy-dom cannot check).

**`./test/fez-bin.test.js`** (`describe('fez refactor')`)
* A fixture `.fez` and `.js` holding `Pjax.load('/x', { ajax: el, replace: true })`, `Pjax.reload('#a')`, `Pjax.config.timeout` and `x.done`.
  The report lists each line with the matching suggestion (`Fez.load` + `source:` + `history: 'replace'`, `Fez.refresh('#a')`, `Fez.pjax.config`).
  The exit code is 1 and the file is unchanged.
* A file without `Pjax.` produces no Pjax report.

### Docs and demos

**`./README.md` "## Pjax Navigation"**: the section is rewritten, and a heading rename to "## Page Navigation (Fez.load)" is optional.
1. Intro: server HTML swapped into the page via `Fez.nodeMorph`; components survive. The public API is `Fez.load` / `Fez.refresh`, and `Fez.pjax` holds config and hooks.
2. Boot gating: the same text with `Fez.pjax.start()`. The dux-pjax coexistence paragraph is removed.
3. `### Fez.load and Fez.refresh`: the shared signature, the `what` shapes list, and the example block from "New surface".
4. `### Options`: a table with `target`, `source`, `form`, `history`, `scroll` and one line each.
   One sentence: unknown keys log `unknown load option: <key>`.
5. `### Defaults`: the load/refresh table. Defaults apply only to `undefined`.
6. `### Result`: `await Fez.load(...)` resolves the `pjax:render` detail or `null`, and never rejects.
   An example branches on `detail.error`.
7. `### Concurrent loads`: each node swap has its own debounce and in-flight slot, and a full navigation cancels region loads.
8. One line: `Fez.refresh()` re-fetches from the server, while a component's `this.refresh()` re-renders it.
9. `### Query-string and hash state` / `### Hash routes`: `Pjax.*` becomes `Fez.*`. The last paragraph becomes `Fez.load(Fez.qs('page', 2, { href: true }))`.
10. `### Link and form attributes`: unchanged markup. Hooks go through `Fez.pjax.confirm = ...`.
11. `### Events and hooks`: `pjax:start` is really cancelable now, and `Fez.pjax.before` / `after` / `error`.
    Config goes through `Fez.pjax.config`.
12. `### Upgrading from window.Pjax`: the migration table plus `fez refactor <dir>` to find call sites.
* The `fez refactor` line in the CLI section also mentions `Pjax.*` detection.

**`./AGENTS.md`**
* Repo-local "Bundled Pjax navigation" section (top of file):
  * The intro: "exposed as `Fez.pjax`, with `Fez.load`, `Fez.refresh`, `Fez.qs`, `Fez.hash`, `Fez.hpath`, `Fez.hqs` delegating at call time. No `window.Pjax`."
  * The boot-gating bullet: `Fez.pjax.start()`. The "another lib set window.Pjax" sentence is removed.
  * A new bullet: "`load` / `refresh` share `(what?, opts?)` and one normalizer (`getOpts` + `applyDefaults`). They differ only in defaults: `refresh` is no-cache, undebounced, and does not scroll. Options: `target`, `source`, `form`, `history`, `scroll`, and unknown keys report an error. Internal request state lives on the instance, never on opts."
  * A new bullet: "The promise never rejects: it resolves the `pjax:render` detail or `null`. Every exit path in `load()` must resolve exactly once."
  * A new bullet: "Debounce and in-flight abort are keyed per swap node (`'full'` or the target/region id). A full load aborts all."
  * The URL-state bullet uses `Fez.qs()` etc. The tests bullet adds the `fez refactor` Pjax rule in `test/fez-bin.test.js`.
* LLM reference part (after `---`, printed by `fez agents`): add a short `## Page navigation` section after "Component communication".
  * It covers `Fez.load` / `Fez.refresh` with the 5 options, the defaults in one line each, and `await` for the result.
  * It also has the rule "use `Fez.refresh('#id')` to re-fetch a server-rendered region; use `this.refresh()` to re-render a component".
  * It also keeps the existing `this.on('pjax:render', ...)` pattern.
  * Update the `this.on('pjax:render')` example near line 1054 if it mentions `Pjax.`.

**Site and demos**
* `./pages_src/root/features.html`:
  * rename the 44 refs
  * the "window.Pjax · boot gating · start()" card becomes "Fez.pjax · boot gating · start()", and the "backs off" output is removed
  * add one card for "Fez.load / Fez.refresh: one signature, different defaults" with the defaults table
* `./pages_src/root/fez/demo-hash-route.fez` and `./pages_src/root/fez/demo-hash-state.fez`: `Fez.hpath/hqs/hash`. Their `<info>` blocks mention `Fez.*`.

## Out of scope (follow-up per app repo)

soho-tasks, youbnfts.com, dboss (vendored `fez.min.js`), sleepy-shoe, nekretnine, vibe and cms-lux use `Pjax.*`, about 600 call sites, some inside server templates.
They are migrated per repo with the table above after this ships.
That migration also fixes the silently broken `reload('#x')`, `{ node: ... }` and `{ no_cache }` calls.

Noticed at first and done in a follow-up (with the split into `url-state.js` / `scripts.js`, the move to `fetch`, and dropping the string round trip before the morph):
* `load('/page#section')` loads in place and scrolls to the anchor; on the current path it only scrolls.
* On `/docs#x`, `load('/docs')` loads instead of doing nothing.
* Back/Forward keeps the cache-first restore.

## Verification

* `bun test` covers the pjax core, onclick and events suites.
* Run the browser suite for `test/browser/pjax-url-state.test.js`.
* `fez compile 'pages_src/root/fez/demo-hash-*.fez'`.
* `bin/fez-refactor ~/dev/ruby/soho-tasks/app/assets` (read-only report) lists the `Pjax.*` sites with correct suggestions.
* `rg -n '\bPjax\.' src pages_src README.md AGENTS.md test fez.d.ts` should leave only the internal references in `src/fez/pjax/*.js` and the `createPjax` tests.
* `rg -n "reload|replacePath|\bdone\b|opts\.(node|ajax_node|force|cache)" src/fez/pjax` should find nothing.
* Manual check: the user runs `bun run dev` on `http://localhost:8000/`. Confirm:
  * links swap in place
  * `await Fez.load('/features.html')` returns a detail with status 200
  * `Fez.load('/x', { node: 1 })` logs an unknown-option error
  * the hash-route demos work
  * `window.Pjax` is `undefined`
