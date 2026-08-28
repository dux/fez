// Wrap defaults in a function to avoid immediate execution
const loadDefaults = () => {
  // include fez component by name
  //<fez-component name="some-node" :props="fez.props"></fez-component>
  Fez(
    "fez-component",
    class {
      init(props) {
        const tag = document.createElement(props.name);
        tag.props = props.props || props["data-props"] || props;

        while (this.root.firstChild) {
          this.root.parentNode.insertBefore(
            this.root.lastChild,
            tag.nextSibling,
          );
        }

        this.root.innerHTML = "";
        this.root.appendChild(tag);
      }
    },
  );

  // include remote data from url
  // <fez-include src="./docs/fez/ui-slider.html"></fez-include>
  Fez(
    "fez-include",
    class {
      init(props) {
        Fez.fetch(props.src, (data) => {
          const dom = Fez.domRoot(data);
          Fez.head(dom); // include scripts and load fez components
          this.root.innerHTML = dom.innerHTML;
        });
      }
    },
  );

  // Show node only if test validates
  // <fez-if if="window.foo">...
  Fez(
    "fez-if",
    class {
      init(props) {
        const test = new Function(`return (${props.if || props.test})`);
        if (!test()) {
          this.root.remove();
        }
      }
    },
  );

  // Inline reactive template. Children are compiled as this instance's template,
  // so they can read state / globalState / props and re-render on change like
  // any component - handy for dropping a global value into static HTML.
  // <fez-inline>global max: {globalState.maxCount || 0}</fez-inline>
  // <fez-inline :state="{n: 0}"><button onclick="fez.state.n++">{state.n}</button></fez-inline>
  Fez(
    "fez-inline",
    class {
      // renders inline so it can sit inside running text
      NAME = "span";

      init(props) {
        const template = this.root.innerHTML.trim();
        this.root.innerHTML = "";
        // children are the template, not slot content
        this._fezSlotNodes = this._fezChildNodes = undefined;

        if (template) {
          this.fezHtmlFunc = Fez.createTemplate(template, {
            name: "fez-inline",
          });
        }

        if (props.state) {
          Object.assign(this.state, props.state);
        }
      }
    },
  );

  // In-flow component picker for demo pages (see docs/fez/fez-demo-nav.fez)
  Fez(
    "fez-demo-nav",
    class {
      init(props) {
        this.for = props.for || ""
        this.offset = Number(props.offset ?? 16)
        this.state.items = []
        this.state.activeIndex = -1
        this.state.markerTop = 0
        this.state.markerHeight = 0
        this.state.open = false
        this.state.filter = ""
        this.state.visible = []
      }

      // list rendered by the panel - keeps the original index so data-index,
      // the marker and activeIndex stay valid while filtered
      beforeRender() {
        const query = String(this.state.filter || "").trim().toLowerCase()
        this.state.visible = (this.state.items || [])
          .map((name, index) => ({ name, index }))
          .filter(item => !query || item.name.toLowerCase().includes(query))
      }

      onMount() {
        this.loadComponents()
        this.on("scroll", this.updateActive, { throttle: 50 })
        this.on("resize", this.updateMarker, { throttle: 100 })
        this.on("hashchange", this.syncToHash)
        this.on(this.root, "click", this.handleClick)
        this.on(document, "click", this.closeOnOutsideClick)

        // the page renders a fresh picker wherever the selection moves - the one
        // placed above the selected section brings itself into view, the one at
        // the top does so only after a clear (flag set by clearSelection)
        if (this.for) {
          if (this.for === this.globalState.demoSelected) {
            this.whenSectionsReady(() => this.reveal())
          }
        } else if (Fez.state.get("demoNavReveal")) {
          Fez.state.set("demoNavReveal", false)
          this.reveal()
        }
      }

      // marker tracks the active link, so re-measure after every render
      afterRender() {
        this.setTimeout(() => this.updateMarker(), 0)
      }

      // components keep registering while the demo list loads - wait until the
      // count is stable between two polls before trusting it
      loadComponents(lastCount = -1) {
        const names = Fez.index.withDemo().sort()
        if (!names.length || names.length !== lastCount) {
          this.setTimeout(() => this.loadComponents(names.length), 200)
          return
        }

        this.state.items = names
        this.setTimeout(() => this.syncToHash() || this.updateActive(), 0)
      }

      // sections render async, one fetch per component - poll until every demo
      // component has its anchor on the page (or give up after ~3s)
      whenSectionsReady(callback, tries = 0) {
        const names = Fez.index.withDemo()
        const ready = names.length && names.every(name => document.getElementById(this.sectionId(name)))
        if (ready || tries > 30) {
          this.setTimeout(callback, 0)
        } else {
          this.setTimeout(() => this.whenSectionsReady(callback, tries + 1), 100)
        }
      }

      sectionId(name) {
        return `fez-demo-${String(name).replace(/[^a-z0-9_-]/gi, "-")}`
      }

      toggle() {
        this.state.open = !this.state.open
        this.state.filter = ""
        if (this.state.open) {
          this.setTimeout(() => this.updateMarker(), 0)
        }
      }

      closeOnOutsideClick(event) {
        if (this.state.open && !this.root.contains(event.target)) {
          this.state.open = false
        }
      }

      onFilter(value) {
        this.state.filter = value
        this.setTimeout(() => this.updateMarker(), 0)
      }

      onFilterKey(event) {
        if (event.key === "Escape") {
          event.preventDefault()
          if (this.state.filter) {
            this.clearFilter()
          } else {
            this.state.open = false
          }
          return
        }

        if (event.key === "Enter") {
          event.preventDefault()
          const first = this.state.visible[0]
          if (first) this.select(first.name)
        }
      }

      clearFilter() {
        this.state.filter = ""
        // morph skips value sync on the focused input, so clear it by hand
        const input = this.find(".fez-demo-nav-filter")
        if (input) {
          input.value = ""
          input.focus()
        }
        this.setTimeout(() => this.updateMarker(), 0)
      }

      syncToHash() {
        const id = window.location.hash.slice(1)
        const name = id && this.state.items.find(item => this.sectionId(item) === id)

        if (name) {
          if (this.globalState.demoSelected !== name) this.globalState.demoSelected = name
          return true
        }

        if (!id && this.globalState.demoSelected) this.globalState.demoSelected = ""
        return false
      }

      handleClick(event) {
        const link = event.target?.closest?.(".fez-demo-nav-link")
        if (!link) return

        // scroll by hand instead of letting the href jump - pjax and the native
        // hash scroll would both land the title under the sticky site nav
        event.preventDefault()
        const index = Number(link.dataset.index)
        if (Number.isFinite(index) && this.state.items[index]) {
          this.select(this.state.items[index])
        }
      }

      select(name) {
        this.state.open = false
        this.state.filter = ""

        if (window.history?.replaceState) {
          window.history.replaceState(null, "", `#${this.sectionId(name)}`)
        }

        if (this.globalState.demoSelected === name) {
          // already placed above this section - just bring it back into view
          this.revealSection(name)
        } else {
          // the page re-renders the picker above the section, that instance reveals itself
          this.globalState.demoSelected = name
        }
      }

      clearSelection(event) {
        event?.preventDefault?.()
        event?.stopPropagation?.()
        this.state.open = false

        if (window.history?.replaceState) {
          window.history.replaceState(null, "", window.location.pathname + window.location.search)
        }

        // the picker moves back to the top of the list - follow it there
        Fez.state.set("demoNavReveal", true)
        this.globalState.demoSelected = ""
      }

      scrollTo(node) {
        if (!node?.getBoundingClientRect) return
        const top = node.getBoundingClientRect().top + window.scrollY - this.offset
        window.scrollTo({ top: Math.max(top, 0), behavior: "auto" })
      }

      reveal() {
        this.scrollTo(this.root)
      }

      revealSection(name) {
        const picker = document.querySelector(`.fez-demo-nav-box[data-for="${name}"]`)
        this.scrollTo(picker || document.getElementById(this.sectionId(name)))
      }

      updateActive() {
        const items = this.state.items
        if (!items.length) return

        if (!this.globalState.demoSelected && !window.location.hash && window.scrollY < 20) {
          this.state.activeIndex = -1
          this.updateMarker(-1)
          return
        }

        const viewportHeight =
          window.innerHeight || document.documentElement?.clientHeight || 800
        const focusLine = Math.min(viewportHeight * 0.35, 260)
        let nextIndex = this.state.activeIndex

        items.forEach((name, index) => {
          const section = document.getElementById(this.sectionId(name))
          if (!section?.getBoundingClientRect) return
          if (section.getBoundingClientRect().top <= focusLine) {
            nextIndex = index
          }
        })

        if (this.state.activeIndex !== nextIndex) {
          this.state.activeIndex = nextIndex
        }
        this.updateMarker(nextIndex)
      }

      updateMarker(index = this.state.activeIndex) {
        if (index < 0) {
          if (this.state.markerTop !== 0) this.state.markerTop = 0
          if (this.state.markerHeight !== 0) this.state.markerHeight = 0
          return
        }

        const list = this.find(".fez-demo-nav-list")
        if (!list?.getBoundingClientRect) return

        const activeLink = this.find(`[data-index="${index}"]`)
        if (!activeLink?.getBoundingClientRect) {
          // active item filtered out of the list - collapse the marker
          if (this.state.markerHeight !== 0) this.state.markerHeight = 0
          return
        }

        const listRect = list.getBoundingClientRect()
        const activeRect = activeLink.getBoundingClientRect()
        const markerTop = Math.round(activeRect.top - listRect.top)
        const markerHeight = Math.round(activeRect.height)

        if (this.state.markerTop !== markerTop) {
          this.state.markerTop = markerTop
        }
        if (this.state.markerHeight !== markerHeight) {
          this.state.markerHeight = markerHeight
        }
      }

      CSS() {
        return `.fez-demo-nav-box {
    position: relative;
    z-index: 20;
    box-sizing: border-box;
    width: min(420px, 100%);
    margin: 0 auto;
    text-align: left;
  }

  .fez-demo-nav-control {
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 46px;
    margin: 0 auto;
    border: 1px solid #dedede;
    border-radius: 999px;
    background: #fff;
    color: #20242c;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  }

  .fez-demo-nav-toggle {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    flex: 1 1 auto;
    gap: 10px;
    min-width: 0;
    min-height: 44px;
    padding: 6px 10px 6px 7px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: #20242c;
    font: inherit;
    line-height: 1;
    cursor: pointer;
  }

  .fez-demo-nav-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 32px;
    height: 32px;
    border-radius: 999px;
    background: #20242c;
    color: #fff;
    font-size: 15px;
    font-weight: 800;
  }

  .fez-demo-nav-current {
    flex: 1 1 auto;
    min-width: 0;
    overflow: hidden;
    color: #242424;
    font-size: 15px;
    font-weight: 650;
    line-height: 1.2;
    text-align: left;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .fez-demo-nav-current.placeholder {
    color: #9a9a9a;
    font-weight: 500;
  }

  .fez-demo-nav-clear {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: 0 0 auto;
    width: 32px;
    height: 32px;
    margin-right: 7px;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: #8a8a8a;
    font: inherit;
    font-size: 20px;
    line-height: 1;
    cursor: pointer;
  }

  .fez-demo-nav-clear:hover {
    background: #f0f0f0;
    color: #222;
  }

  .fez-demo-nav-panel {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    right: 0;
    box-sizing: border-box;
    max-height: min(60vh, 520px);
    overflow: auto;
    padding: 14px 16px 14px 14px;
    border: 1px solid #e3e3e3;
    border-radius: 10px;
    background: #fff;
    box-shadow: 0 16px 42px rgba(0, 0, 0, 0.16);
  }

  .fez-demo-nav-filter-wrap {
    position: sticky;
    top: -14px;
    z-index: 1;
    display: flex;
    align-items: center;
    margin: -14px -16px 12px -14px;
    padding: 14px 16px 10px 14px;
    background: #fff;
  }

  .fez-demo-nav-filter {
    box-sizing: border-box;
    width: 100%;
    padding: 9px 32px 9px 12px;
    border: 1px solid #dedede;
    border-radius: 8px;
    background: #fff;
    color: #20242c;
    font: inherit;
    font-size: 14px;
    line-height: 1.2;
    outline: none;
  }

  .fez-demo-nav-filter:focus {
    border-color: #20242c;
  }

  .fez-demo-nav-filter-clear {
    flex: 0 0 auto;
    margin-left: -30px;
    width: 22px;
    height: 22px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: #8a8a8a;
    font: inherit;
    font-size: 15px;
    line-height: 1;
    cursor: pointer;
  }

  .fez-demo-nav-filter-clear:hover {
    background: #f0f0f0;
    color: #222;
  }

  .fez-demo-nav-empty {
    padding: 9px 0 9px 28px;
    color: #9a9a9a;
    font-size: 15px;
  }

  .fez-demo-nav-list {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0;
    margin: 0;
    padding: 0 0 0 3px;
    border-left: 4px solid #e7e7e7;
  }

  .fez-demo-nav-marker {
    position: absolute;
    left: -4px;
    top: 0;
    width: 4px;
    height: var(--marker-height, 40px);
    background: #222;
    transform: translateY(var(--marker-top, 0px));
    transition: transform 180ms ease, height 180ms ease;
  }

  .fez-demo-nav-link {
    display: block;
    padding: 9px 0 9px 28px;
    color: #8f8f8f;
    font-size: 15px;
    line-height: 1.35;
    text-decoration: none;
    overflow-wrap: anywhere;
    transition: color 160ms ease, font-weight 160ms ease;
  }

  .fez-demo-nav-link:hover,
  .fez-demo-nav-link.active {
    color: #242424;
  }

  .fez-demo-nav-link.active {
    font-weight: 650;
  }`;
      }

      HTML() {
        return `<nav class="fez-demo-nav-box {globalState.demoSelected ? 'is-selected' : ''}" data-for="{fez.for}" aria-label="Demo components">
        <div class="fez-demo-nav-control">
          <button
            class="fez-demo-nav-toggle"
            aria-label="Components"
            aria-expanded={state.open ? 'true' : 'false'}
            onclick="fez.toggle()"
          >
            <span class="fez-demo-nav-icon" aria-hidden="true">F</span>
            <span class="fez-demo-nav-current {globalState.demoSelected ? '' : 'placeholder'}">{globalState.demoSelected || 'quick select'}</span>
          </button>
          {#if globalState.demoSelected}
            <button class="fez-demo-nav-clear" aria-label="Clear selection" onclick="fez.clearSelection(event)">X</button>
          {/if}
        </div>
        {#if state.open}
          <div class="fez-demo-nav-panel" fez:transition="fly, from=top, distance=8, duration=160">
            <div class="fez-demo-nav-filter-wrap">
              <input
                class="fez-demo-nav-filter"
                type="text"
                placeholder="Filter components..."
                aria-label="Filter components"
                autocomplete="off"
                spellcheck="false"
                fez:use="el => el.focus()"
                value={state.filter}
                oninput="fez.onFilter(this.value)"
                onkeydown="fez.onFilterKey(event)"
              />
              {#if state.filter}
                <button class="fez-demo-nav-filter-clear" aria-label="Clear filter" onclick="fez.clearFilter()">X</button>
              {/if}
            </div>
            <div
              class="fez-demo-nav-list"
              style="--marker-top: {state.markerTop}px; --marker-height: {state.markerHeight}px;"
            >
              <span class="fez-demo-nav-marker" aria-hidden="true"></span>
              {#each state.visible as item}
                <a
                  class="fez-demo-nav-link {state.activeIndex === item.index ? 'active' : ''}"
                  href="#{fez.sectionId(item.name)}"
                  data-index={item.index}
                  aria-current={state.activeIndex === item.index && state.activeIndex >= 0 ? 'page' : 'false'}
                >{item.name}</a>
              {/each}
              {#if !state.visible.length}
                <div class="fez-demo-nav-empty">No components match.</div>
              {/if}
            </div>
          </div>
        {/if}
      </nav>`;
      }
    },
  );

  // Render all components with their demos
  // <fez-demo></fez-demo>
  // <fez-demo name="ui-clock"></fez-demo>
  // Also supports ?fez=NAME query string
  Fez(
    "fez-demo",
    class {
      init(props) {
        this.state.ready = false;
        this.state.components = [];
        this.state.undocumented = [];
        this.state.filtered = false;
        this.state.showAllUrl = "";
        this.state.allComponentsUrl = "";

        // Check for name from props or query string
        const urlParams = new URLSearchParams(window.location.search);
        const name = props.name || urlParams.get("fez");
        const allUrl = new URL(window.location.href);
        allUrl.searchParams.delete("fez");
        this.state.allComponentsUrl =
          allUrl.pathname + allUrl.search + allUrl.hash;

        // If filtering, store URL without ?fez param
        if (urlParams.get("fez")) {
          this.state.showAllUrl = this.state.allComponentsUrl;
          this.state.filtered = true;
        }

        const notFez = n => !n.startsWith('fez-');
        let lastCount = 0;
        let stableTicks = 0;
        let nameTicks = 0;

        const checkReady = () => {
          if (name) {
            // a name can be registered before its <demo> lands (built-in
            // shadowed by a later .fez), so wait for the demo, then give up
            if (Fez.index[name]?.demo) {
              this.state.components = [name];
              this.markReady();
            } else if (Fez.index[name]?.class && ++nameTicks > 20) {
              this.state.components = [];
              this.markReady();
            } else {
              setTimeout(checkReady, 100);
            }
          } else {
            const all = Fez.index.names().filter(notFez);
            if (all.length > 0 && all.length === lastCount) {
              stableTicks++;
            } else {
              stableTicks = 0;
            }
            lastCount = all.length;

            if (stableTicks >= 2) {
              this.state.components = Fez.index.withDemo().filter(notFez).sort();
              this.state.undocumented = all.filter(n => !Fez.index[n]?.demo).sort();
              this.markReady();
            } else {
              setTimeout(checkReady, 100);
            }
          }
        };
        checkReady();
      }

      markReady() {
        this.state.ready = true;
        // the browser handled #fez-demo-x long before these anchors existed,
        // so honour the hash once they are on the page
        this.setTimeout(() => {
          const id = window.location.hash.slice(1);
          const target = id && document.getElementById(id);
          if (target) target.scrollIntoView({ block: "start" });
        }, 50);
      }

      showHtml(name) {
        const html = Fez.index[name]?.demo || "No demo HTML";
        Fez.log("Demo HTML: " + name + "\n\n" + html);
      }

      showFez(name) {
        Fez.log(
          "Fez source: " +
            name +
            "\n\n" +
            (Fez.index[name]?.source || "Made via raw Fez API, source not available"),
        );
      }

      openSingle(name) {
        const url = new URL(window.location.href);
        url.searchParams.set("fez", name);
        window.location.href = url.toString();
      }

      openCodePen(name) {
        const demo = Fez.index[name]?.demo || "";
        const code = Fez.index[name]?.source || "";
        const body = [
          '<link rel="stylesheet" href="//cdn.simplecss.org/simple.css" />\n<scr' +
            'ipt src="//dux.github.io/fez/dist/fez.js"></scr' +
            "ipt>",
          "<!-- FEZ code start -->\n<x" +
            `mp fez="${name}">\n${code}\n</xm` +
            "p>\n<!-- FEZ code end -->",
          `<!-- HTML code start -->\n${demo}\n<!-- HTML code end -->`,
        ];

        const data = {
          title: "Fez component - " + name,
          html: body.join("\n\n"),
          css: "body { padding-top: 50px; }",
          js: "",
          editors: "100",
        };

        const form = document.createElement("form");
        form.method = "POST";
        form.action = "https://codepen.io/pen/define";
        form.target = "_blank";

        const input = document.createElement("input");
        input.type = "hidden";
        input.name = "data";
        input.value = JSON.stringify(data);

        form.appendChild(input);
        document.body.appendChild(form);
        form.submit();
        document.body.removeChild(form);
      }

      renderDemo(el) {
        const name = el.dataset.name;
        Fez.index.apply(name, el);
      }

      renderInfo(el) {
        const name = el.dataset.name;
        const data = Fez.index.get(name);
        if (data.info) {
          el.innerHTML = data.info.innerHTML;
        } else {
          el.innerHTML = "<em>No info available</em>";
        }
      }

      CSS() {
        return `:fez {
        display: block;
        font-family: system-ui, -apple-system, sans-serif;
        color: #1f2937;
        padding: 0 22px 40px;
        box-sizing: border-box;
      }
      .fez-demo-header {
        display: flex;
        align-items: center;
        justify-content: flex-start;
        padding: 24px 0 18px;
        margin: 0 auto;
        max-width: 980px;
      }
      .fez-demo-header.is-single {
        max-width: 1560px;
      }
      .fez-demo-brand {
        display: flex;
        align-items: baseline;
        gap: 12px;
        min-width: 0;
        text-decoration: none;
        color: inherit;
      }
      .fez-demo-logo {
        font-size: 22px;
        font-weight: 750;
        line-height: 1;
      }
      .fez-demo-subtitle {
        color: #6b7280;
        font-size: 14px;
        line-height: 1.3;
        white-space: nowrap;
      }
      .fez-demo-shell {
        display: block;
        max-width: 980px;
        margin: 0 auto;
      }
      /* single component view has the whole page to itself, let it breathe */
      .fez-demo-shell.is-single {
        max-width: 1560px;
      }
      .fez-demo-shell.is-single .fez-demo-item {
        margin-bottom: 0;
      }
      .fez-demo-main {
        min-width: 0;
      }
      @media (max-width: 640px) {
        .fez-demo-header {
          padding-top: 16px;
        }
        .fez-demo-brand {
          flex-direction: column;
          gap: 4px;
        }
      }
      @media (max-width: 980px) {
        .fez-demo-shell {
          display: block;
        }
      }
      .fez-demo-item {
        margin-bottom: 40px;
        scroll-margin-top: 72px;
      }
      .fez-demo-anchor {
        display: block;
        height: 0;
        scroll-margin-top: 72px;
      }
      .fez-demo-title {
        display: flex;
        align-items: center;
        gap: 15px;
        font-size: 18px;
        font-weight: 600;
        margin: 0 0 25px 0;
        &::before {
          content: '';
          flex: 1;
          height: 1px;
          background: #ddd;
        }
        &::after {
          content: '';
          flex: 1;
          height: 1px;
          background: #ddd;
        }
        .fez-demo-show-all, .fez-demo-open-single {
          font-size: 14px;
          font-weight: normal;
          color: #666;
          text-decoration: none;
          cursor: pointer;
          &:hover { text-decoration: underline; }
        }
      }
      .fez-demo-cols {
        display: flex;
        gap: 40px;
        @media (max-width: 768px) {
          flex-direction: column;
          gap: 20px;
        }
      }
      .fez-demo-left, .fez-demo-right {
        flex: 1;
        min-width: 0;
        overflow: visible;
      }
      .fez-demo-content {
        min-height: 50px;
        text-align: left;
        h3, h4, h5 { margin: 16px 0 8px; }
        h3:first-child, h4:first-child, h5:first-child { margin-top: 0; }
      }
      .fez-demo-info {
        text-align: left;
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 6px;
        padding: 20px;
        line-height: 1.6;
        ul { margin: 0; padding-left: 20px; }
        code { background: #e8e8e8; padding: 2px 5px; border-radius: 3px; font-size: 13px; }
      }
      .fez-demo-buttons {
        margin-top: 30px;
        display: flex;
        gap: 10px;
      }
      .fez-demo-undocumented {
        margin-top: 40px;
        padding-top: 20px;
        border-top: 1px solid #ddd;
        h3 { font-size: 16px; font-weight: 600; color: #6b7280; margin: 0 0 12px; }
        .fez-demo-undocumented-list { display: flex; flex-wrap: wrap; gap: 8px; }
      }
      .fez-demo-btn {
        padding: 8px 16px;
        border: 1px solid #ccc;
        background: #fff;
        color: #333;
        font: inherit;
        line-height: 1.2;
        border-radius: 4px;
        cursor: pointer;
        box-shadow: none;
        &:hover { background: #f0f0f0; color: #333; }
      }`;
      }

      HTML() {
        return `{#if state.ready}
        <header class="fez-demo-header {state.filtered ? 'is-single' : ''}">
          <a class="fez-demo-brand" href="{state.allComponentsUrl}">
            <span class="fez-demo-logo">Fez</span>
            <span class="fez-demo-subtitle">Component demos</span>
          </a>
        </header>
        <div class="fez-demo-shell {state.filtered ? 'is-single' : ''}">
          <main class="fez-demo-main">
            {#each state.components as name}
              <div class="fez-demo-item" data-demo-name={name}>
                <a class="fez-demo-anchor" id="fez-demo-{name}" name="fez-demo-{name}" aria-hidden="true"></a>
                <h2 class="fez-demo-title">{name}{#if state.filtered} <a href="{state.showAllUrl}" class="fez-demo-show-all">show all</a>{:else} <a onclick="fez.openSingle('{name}')" class="fez-demo-open-single">open</a>{/if}</h2>
                <div class="fez-demo-cols">
                  <div class="fez-demo-left">
                    <div class="fez-demo-content" data-name={name} fez-use="renderDemo"></div>
                  </div>
                  <div class="fez-demo-right">
                    <div class="fez-demo-info" data-name={name} fez-use="renderInfo"></div>
                    <div class="fez-demo-buttons">
                      <button class="fez-demo-btn" onclick="fez.showHtml('{name}')">Demo HTML</button>
                      <button class="fez-demo-btn" onclick="fez.showFez('{name}')">Fez Component</button>
                      <button class="fez-demo-btn" onclick="fez.openCodePen('{name}')">CodePen</button>
                    </div>
                  </div>
                </div>
              </div>
            {/each}
            {#if state.undocumented.length}
              <div class="fez-demo-undocumented">
                <h3>Undocumented</h3>
                <div class="fez-demo-undocumented-list">
                  {#each state.undocumented as name}
                    <button class="fez-demo-btn" onclick="fez.showFez('{name}')">{name}</button>
                  {/each}
                </div>
              </div>
            {/if}
          </main>
        </div>
      {:else}
        <div style="text-align: center; color: #888;">Loading components...</div>
      {/if}`;
      }
    },
  );
};

// Only load defaults if Fez is available and DOM exists
if (
  typeof Fez !== "undefined" &&
  Fez &&
  typeof document !== "undefined" &&
  document.head
) {
  loadDefaults();
}

// Export for use in tests
export { loadDefaults };
