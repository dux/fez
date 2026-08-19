// Document-level click handler for pjax navigation, ported from dux-pjax.
// Created per Pjax class (see createPjax) so the handler always talks to the
// class whose statics the app may have overridden (before/confirm/load...).

export default function createOnClick(Pjax) {
  const PjaxOnClick = {
    main(event) {
      const node = event.target.closest(
        '*[click]:not([click=""]), *[href]:not([href=""]), *[pjax-refresh]:not([pjax-refresh=""])',
      );
      if (!node) return;

      event.stopPropagation();
      event.preventDefault();

      // Snapshot the parts of the event we need; the post-confirm path may run
      // on a future tick (custom modal returning a Promise) when the original
      // MouseEvent is no longer trustworthy.
      const ctx = {
        node,
        which: event.which,
        metaKey: event.metaKey,
      };

      const proceed = () => PjaxOnClick.execute(ctx);

      const confirmMsg = node.getAttribute('pjax-confirm');
      if (confirmMsg) {
        const result = Pjax.confirm(confirmMsg, node);
        if (result && typeof result.then === 'function') {
          result
            .then((ok) => {
              if (ok) proceed();
            })
            .catch((err) => Pjax.error(`confirm rejected: ${err}`));
          return;
        }
        if (!result) return;
      }

      proceed();
    },

    execute(ctx) {
      const node = ctx.node;

      const click = node.getAttribute('click');
      if (click) {
        return new Function(click).bind(node)();
      }

      const href = node.getAttribute('href');
      const replace = node.hasAttribute('pjax-replace');

      const pjaxRefresh = node.getAttribute('pjax-refresh');
      if (pjaxRefresh) {
        const targetNode = document.querySelector(pjaxRefresh);
        if (!targetNode) {
          Pjax.error(`pjax-refresh selector did not match: ${pjaxRefresh}`);
          return;
        }
        Pjax.refresh(pjaxRefresh);
        return;
      }

      const pjaxTarget = node.getAttribute('pjax-target');
      if (pjaxTarget) {
        const targetNode = document.querySelector(pjaxTarget);
        if (!targetNode) {
          Pjax.error(`pjax-target selector did not match: ${pjaxTarget}`);
          return;
        }
        Pjax.load(href, { target: targetNode, replace });
        return;
      }

      // middle-click / cmd-click is a user gesture to open a new tab, regardless
      // of the link's own target.
      if (ctx.which === 2 || ctx.metaKey) {
        return window.open(href);
      }

      const target = node.getAttribute('target');

      // Opt out of pjax when the link, or any ancestor, carries a no-pjax class
      // (e.g. `direct`, `no-pjax`). closest() walks up the tree so a wrapper opting
      // out covers everything inside it.
      const noPjaxSel = Pjax.config.no_pjax_class.map((cls) => `.${cls}`).join(', ');
      if (noPjaxSel && node.closest(noPjaxSel)) {
        return PjaxOnClick.leave(href, target);
      }

      if (/^javascript:/.test(href)) {
        return new Function(href.replace(/^javascript:/, ''))();
      }

      // Scheme links (mailto:, tel:, external http, vscode:) or links asking for a
      // named target leave pjax too.
      if (/^\w+:/.test(href) || target) {
        return PjaxOnClick.leave(href, target);
      }

      Pjax.load(href, { ajax: node, replace });
      return false;
    },

    // Leave the SPA. Open a new window only when the link declares a `target`;
    // otherwise navigate the current tab. Kept as a seam so tests can stub it -
    // DOM test environments forbid assigning window.location.
    leave(href, target) {
      if (target) window.open(href, target);
      else window.location.href = href;
    },
  };

  return PjaxOnClick;
}
