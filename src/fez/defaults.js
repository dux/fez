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

        // Wait for components to be loaded, then render
        const checkReady = () => {
          // If name provided, render only that component
          if (name) {
            if (Fez.index[name]?.demo) {
              this.state.components = [name];
              this.state.ready = true;
            } else {
              setTimeout(checkReady, 100);
            }
          } else {
            // Render all components that have demos
            const names = Fez.index.withDemo().sort();
            if (names.length > 0) {
              this.state.components = names;
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
            (Fez.index[name]?.source || "Source not available"),
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
      }
      .fez-demo-header {

        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 18px;
        padding: 14px 22px;
        margin: 12px auto 34px;
        max-width: 900px;
        background: #fff;
        border-radius: 14px;
        box-shadow: 0 2px 12px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.06);
        border: 1px solid #e5e7eb;
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
      .fez-demo-nav {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-wrap: wrap;
        justify-content: flex-end;
      }
      .fez-demo-nav a {
        display: inline-flex;
        align-items: center;
        min-height: 34px;
        padding: 0 12px;
        border: 1px solid transparent;
        border-radius: 6px;
        color: #374151;
        font-size: 14px;
        line-height: 1;
        text-decoration: none;
      }
      .fez-demo-nav a:hover {
        border-color: #d1d5db;
        background: #f9fafb;
      }
      .fez-demo-nav a[aria-current="page"] {
        border-color: #c7d2fe;
        background: #eef2ff;
        color: #3730a3;
      }
      @media (max-width: 640px) {
        .fez-demo-header {
          align-items: flex-start;
          flex-direction: column;
        }
        .fez-demo-brand {
          flex-direction: column;
          gap: 4px;
        }
        .fez-demo-nav {
          justify-content: flex-start;
          width: 100%;
        }
      }
      .fez-demo-item {
        margin-bottom: 40px;
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
      .fez-demo-btn {
        padding: 8px 16px;
        border: 1px solid #ccc;
        background: #fff;
        border-radius: 4px;
        cursor: pointer;
        &:hover { background: #f0f0f0; }
      }`;
      }

      HTML() {
        return `{#if state.ready}
        <header class="fez-demo-header">
          <a class="fez-demo-brand" href="{state.allComponentsUrl}">
            <span class="fez-demo-logo">Fez</span>
            <span class="fez-demo-subtitle">Component demos</span>
          </a>
          <nav class="fez-demo-nav" aria-label="Demo navigation">
            <a href="{state.allComponentsUrl}" aria-current="{state.filtered ? '' : 'page'}">Components</a>
            <a href="https://dux.github.io/fez/">Docs</a>
            <a href="https://github.com/dux/fez">GitHub</a>
          </nav>
        </header>
        {#each state.components as name}
          <div class="fez-demo-item">
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
