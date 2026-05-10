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
  // <fez-include src="./demo/fez/ui-slider.html"></fez-include>
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

  // Sticky component index for <fez-demo>
  Fez(
    "fez-demo-nav",
    class {
      init() {
        this.state.items = [];
        this.state.activeIndex = -1;
        this.state.markerTop = 0;
        this.state.markerHeight = 0;
        this.state.open = false;
        this.state.loaded = false;
        this.state.selectedName = "";
      }

      onMount() {
        this.setTimeout(() => this.loadComponents(), 1000);
        if (typeof window !== "undefined" && window.addEventListener) {
          this.on("scroll", this.updateActive, { throttle: 50 });
          this.on("resize", this.sync, { throttle: 100 });
          this.on("hashchange", this.syncToHash);
        }
        this.on(this.root, "click", this.handleClick);
      }

      onRefresh() {
        this.setTimeout(() => this.updateMarker(), 0);
      }

      loadComponents() {
        const items = this.loadedComponents();
        if (!items.length) {
          this.setTimeout(() => this.loadComponents(), 250);
          return;
        }

        this.state.items = items;
        this.state.loaded = true;
        this.setTimeout(() => this.syncToHash() || this.sync(), 0);
      }

      loadedComponents() {
        const names = Fez.index.withDemo().sort();
        const rendered = names.filter(name => document.getElementById(this.sectionId(name)));
        return rendered.length ? rendered : names;
      }

      sectionId(name) {
        return `fez-demo-${String(name).replace(/[^a-z0-9_-]/gi, "-")}`;
      }

      sync() {
        this.updateActive();
        this.updateMarker();
      }

      toggle() {
        this.state.open = !this.state.open;
        if (this.state.open) {
          this.setTimeout(() => this.sync(), 0);
        }
      }

      syncToHash() {
        if (!window.location.hash) {
          this.state.selectedName = "";
          this.state.activeIndex = -1;
          return false;
        }

        const id = window.location.hash.slice(1);
        const index = this.state.items.findIndex(name => this.sectionId(name) === id);
        if (index < 0) return false;

        this.state.activeIndex = index;
        this.state.selectedName = this.state.items[index];
        this.scrollToComponent(this.state.items[index]);
        return true;
      }

      handleClick(event) {
        const link = event.target?.closest?.(".fez-demo-nav-link");
        if (!link) return;

        const index = Number(link.dataset.index);
        if (Number.isFinite(index)) {
          this.state.activeIndex = index;
          this.state.selectedName = this.state.items[index] || "";
          this.setTimeout(() => this.scrollToComponent(this.state.items[index]), 0);
        }
        this.state.open = false;
        this.setTimeout(() => this.sync(), 0);
      }

      clearSelection(event) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        this.state.selectedName = "";
        this.state.open = false;
        this.setTimeout(() => {
          const current = this.find(".fez-demo-nav-current");
          if (current) current.textContent = "quick select";
        }, 0);
        this.setTimeout(() => this.sync(), 0);

        if (window.history?.replaceState) {
          window.history.replaceState(null, "", window.location.pathname + window.location.search);
        }
      }

      scrollToComponent(name) {
        const target = document.getElementById(this.sectionId(name));
        if (!target) return;

        target.scrollIntoView({ behavior: "auto", block: "start" });
        window.scrollBy(0, -12);
        this.state.open = false;
        this.state.selectedName = name;
        const index = this.state.items.indexOf(name);
        if (index >= 0) this.state.activeIndex = index;
        this.updateMarker();

        if (window.history?.replaceState) {
          window.history.replaceState(null, "", `#${this.sectionId(name)}`);
        }
      }

      updateActive() {
        const items = this.state.items;
        if (!items.length) return;

        if (!this.state.selectedName && !window.location.hash && window.scrollY < 20) {
          this.state.activeIndex = -1;
          this.updateMarker(-1);
          return;
        }

        const viewportHeight =
          window.innerHeight || document.documentElement?.clientHeight || 800;
        const focusLine = Math.min(viewportHeight * 0.35, 260);
        let nextIndex = this.state.activeIndex;

        items.forEach((name, index) => {
          const section = document.getElementById(this.sectionId(name));
          if (!section?.getBoundingClientRect) return;
          if (section.getBoundingClientRect().top <= focusLine) {
            nextIndex = index;
          }
        });

        if (this.state.activeIndex !== nextIndex) {
          this.state.activeIndex = nextIndex;
        }
        this.updateMarker(nextIndex);
      }

      updateMarker(index = this.state.activeIndex) {
        if (index < 0) {
          if (this.state.markerTop !== 0) this.state.markerTop = 0;
          if (this.state.markerHeight !== 0) this.state.markerHeight = 0;
          return;
        }

        const list = this.find(".fez-demo-nav-list");
        const activeLink = this.find(`[data-index="${index}"]`);
        if (!list?.getBoundingClientRect || !activeLink?.getBoundingClientRect) {
          return;
        }

        const listRect = list.getBoundingClientRect();
        const activeRect = activeLink.getBoundingClientRect();
        const markerTop = Math.round(activeRect.top - listRect.top);
        const markerHeight = Math.round(activeRect.height);

        if (this.state.markerTop !== markerTop) {
          this.state.markerTop = markerTop;
        }
        if (this.state.markerHeight !== markerHeight) {
          this.state.markerHeight = markerHeight;
        }
      }

      CSS() {
        return `.fez-demo-side-nav {
        position: fixed;
        top: 10px;
        left: 12px;
        z-index: 1000;
        width: min(340px, calc(100vw - 32px));
        text-align: left;
        transform: none;
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
        box-sizing: border-box;
        height: calc(100vh - 76px);
        max-height: calc(100vh - 76px);
        overflow: auto;
        margin-top: 10px;
        padding: 14px 16px 14px 14px;
        border: 1px solid #e3e3e3;
        border-radius: 10px;
        background: #fff;
        box-shadow: 0 16px 42px rgba(0, 0, 0, 0.16);
        animation: fezDemoNavPop 160ms ease-out;
      }
      @keyframes fezDemoNavPop {
        from {
          opacity: 0;
          transform: translateY(-8px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
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
        return `<nav class="fez-demo-side-nav" aria-label="Demo components">
        <div class="fez-demo-nav-control">
          <button
            class="fez-demo-nav-toggle"
            aria-label="Components"
            aria-expanded={state.open ? 'true' : 'false'}
            onclick="fez.toggle()"
          >
            <span class="fez-demo-nav-icon" aria-hidden="true">F</span>
            <span class="fez-demo-nav-current {state.selectedName ? '' : 'placeholder'}">{state.selectedName ? state.selectedName : 'quick select'}</span>
          </button>
          {#if state.selectedName}
            <button class="fez-demo-nav-clear" aria-label="Clear selection" onclick="fez.clearSelection(event)">X</button>
          {/if}
        </div>
        {#if state.open}
          <div class="fez-demo-nav-panel">
            <div
              class="fez-demo-nav-list"
              style="--marker-top: {state.markerTop}px; --marker-height: {state.markerHeight}px;"
            >
              <span class="fez-demo-nav-marker" aria-hidden="true"></span>
              {#each state.items as name, index}
                <a
                  class="fez-demo-nav-link {state.activeIndex === index ? 'active' : ''}"
                  href="#{fez.sectionId(name)}"
                  data-index={index}
                  aria-current={state.activeIndex === index && state.activeIndex >= 0 ? 'page' : 'false'}
                >{name}</a>
              {/each}
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

        const checkReady = () => {
          if (name) {
            if (Fez.index[name]?.class) {
              this.state.components = Fez.index[name]?.demo ? [name] : [];
              this.state.ready = true;
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
              this.state.ready = true;
            } else {
              setTimeout(checkReady, 100);
            }
          }
        };
        checkReady();
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
        max-width: 1180px;
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
        scroll-margin-top: 28px;
      }
      .fez-demo-anchor {
        display: block;
        height: 0;
        scroll-margin-top: 12px;
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
        <header class="fez-demo-header">
          <a class="fez-demo-brand" href="{state.allComponentsUrl}">
            <span class="fez-demo-logo">Fez</span>
            <span class="fez-demo-subtitle">Component demos</span>
          </a>
        </header>
        <div class="fez-demo-shell">
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
