// pretty print HTML
const log_pretty_print = (html) => {
  const parts = html
    .split(/(<\/?[^>]+>)/g)
    .map(p => p.trim())
    .filter(p => p);

  let indent = 0;
  const lines = [];

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    const nextPart = parts[i + 1];
    const nextNextPart = parts[i + 2];

    // Check if it's a tag
    if (part.startsWith('<')) {
      // Check if this is an opening tag followed by text and then its closing tag
      if (!part.startsWith('</') && !part.endsWith('/>') && nextPart && !nextPart.startsWith('<') && nextNextPart && nextNextPart.startsWith('</')) {
        // Combine them on one line
        const actualIndent = Math.max(0, indent);
        lines.push('  '.repeat(actualIndent) + part + nextPart + nextNextPart);
        i += 2; // Skip the next two parts
      }
      // Closing tag
      else if (part.startsWith('</')) {
        indent--;
        const actualIndent = Math.max(0, indent);
        lines.push('  '.repeat(actualIndent) + part);
      }
      // Self-closing tag
      else if (part.endsWith('/>') || part.includes(' />')) {
        const actualIndent = Math.max(0, indent);
        lines.push('  '.repeat(actualIndent) + part);
      }
      // Opening tag
      else {
        const actualIndent = Math.max(0, indent);
        lines.push('  '.repeat(actualIndent) + part);
        indent++;
      }
    }
    // Text node
    else if (part) {
      const actualIndent = Math.max(0, indent);
      lines.push('  '.repeat(actualIndent) + part);
    }
  }

  return lines.join('\n');
}

const LOG = (() => {
  const logs = [];
  const logTypes = []; // Track the original type of each log
  let currentIndex = 0;
  let renderContent = null; // Will hold the render function

  // Add ESC key handler and arrow key navigation
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      const dialog = document.getElementById('dump-dialog');
      const button = document.getElementById('log-reopen-button');

      if (dialog) {
        // Close dialog
        dialog.remove();
        createLogButton();
      } else if (button) {
        // Open dialog
        button.remove();
        showLogDialog();
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      const dialog = document.getElementById('dump-dialog');
      if (dialog && logs.length > 0) {
        e.preventDefault();
        if (e.key === 'ArrowLeft' && currentIndex > 0) {
          currentIndex--;
          localStorage.setItem('_LOG_INDEX', currentIndex);
          renderContent();
        } else if (e.key === 'ArrowRight' && currentIndex < logs.length - 1) {
          currentIndex++;
          localStorage.setItem('_LOG_INDEX', currentIndex);
          renderContent();
        } else if (e.key === 'ArrowUp' && currentIndex > 0) {
          currentIndex = Math.max(0, currentIndex - 5);
          localStorage.setItem('_LOG_INDEX', currentIndex);
          renderContent();
        } else if (e.key === 'ArrowDown' && currentIndex < logs.length - 1) {
          currentIndex = Math.min(logs.length - 1, currentIndex + 5);
          localStorage.setItem('_LOG_INDEX', currentIndex);
          renderContent();
        }
      }
    }
  });

  const createLogButton = () => {
    let btn = document.getElementById('log-reopen-button');
    if (!btn) {
      btn = document.body.appendChild(document.createElement('button'));
      btn.id = 'log-reopen-button';
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>LOG';
      btn.style.cssText =
        'position:fixed; top: 10px; right: 10px;' +
        'padding:10px 20px;background:#ff3333;color:#fff;border:none;' +
        'cursor:pointer;font:14px/1.4 monospace;z-index:2147483647;' +
        'border-radius:8px;display:flex;align-items:center;' +
        'opacity:1;visibility:visible;box-shadow:0 4px 12px rgba(255,51,51,0.3)';
      btn.onclick = () => {
        btn.remove();
        showLogDialog();
      };
    }
  };

  const showLogDialog = () => {
    let d = document.getElementById('dump-dialog');
    if (!d) {
      d = document.body.appendChild(document.createElement('div'));
      d.id = 'dump-dialog';
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      d.style.cssText =
        'position:absolute; top:' + (scrollTop + 20) + 'px; left: 20px; right:20px;' +
        'background:#fff; border:1px solid #333; box-shadow:0 0 10px rgba(0,0,0,0.5);' +
        'padding:20px; overflow:auto; z-index:2147483646; font:13px/1.4 monospace;' +
        'white-space:pre; display:block; opacity:1; visibility:visible';
    }

    // Check if we have a saved index and it's still valid
    const savedIndex = parseInt(localStorage.getItem('_LOG_INDEX'));
    if (!isNaN(savedIndex) && savedIndex >= 0 && savedIndex < logs.length) {
      currentIndex = savedIndex;
    } else {
      currentIndex = logs.length - 1;
    }

    renderContent = () => {
      const buttons = logs.map((_, i) => {
        let bgColor = '#f0f0f0'; // default
        if (i !== currentIndex) {
          if (logTypes[i] === 'object') {
            bgColor = '#d6e3ef'; // super light blue
          } else if (logTypes[i] === 'array') {
            bgColor = '#d8d5ef'; // super light indigo
          }
        }
        return `<button style="font-size: 14px; font-weight: 400; padding:2px 6px; margin: 0 2px 2px 0;cursor:pointer;background:${i === currentIndex ? '#333' : bgColor};color:${i === currentIndex ? '#fff' : '#000'}" data-index="${i}">${i + 1}</button>`
      }).join('');

      d.innerHTML =
        '<div style="display:flex;flex-direction:column;height:100%">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">' +
        '<div style="display:flex;flex-wrap:wrap;gap:4px;flex:1;margin-right:10px">' + buttons + '</div>' +
        '<button style="padding:4px 8px;cursor:pointer;flex-shrink:0">&times;</button>' +
        '</div>' +
        '<xmp style="font-family:monospace;flex:1;overflow:auto;margin:0;padding:0;color:#000;background:#fff;font-size:14px;line-height:22px">' + logs[currentIndex] + '</xmp>' +
        '</div>';

      d.querySelector('button[style*="flex-shrink:0"]').onclick = () => {
        d.remove();
        createLogButton();
      };

      d.querySelectorAll('button[data-index]').forEach(btn => {
        btn.onclick = () => {
          currentIndex = parseInt(btn.dataset.index);
          localStorage.setItem('_LOG_INDEX', currentIndex);
          renderContent();
        };
      });
    };

    renderContent();
  };

  return o => {
    if (!document.body) {
      window.requestAnimationFrame( () => LOG(o) )
      return
    }

    // Store the original type
    let originalType = typeof o;

    if (o instanceof Node) {
      if (o.nodeType === Node.TEXT_NODE) {
        o = o.textContent || String(o)
      } else {
        o = log_pretty_print(o.outerHTML)
      }
    }

    if (o === undefined) { o = 'undefined' }
    if (o === null) { o = 'null' }

    if (Array.isArray(o)) {
      originalType = 'array';
    } else if (typeof o === 'object' && o !== null) {
      originalType = 'object';
    }

    if (typeof o != 'string') {
      o = JSON.stringify(o, (key, value) => {
        if (typeof value === 'function') {
          return String(value);
        }
        return value;
      }, 2).replaceAll('<', '&lt;')
    }

    o = o.trim()

    logs.push(o + `\n\ntype: ${originalType}`);
    logTypes.push(originalType);

    // Check if log dialog is open by checking for element
    const isOpen = !!document.getElementById('dump-dialog');

    if (!isOpen) {
      // Show log dialog by default
      showLogDialog();
    } else {
      // Update current index to the new log and refresh
      currentIndex = logs.length - 1;
      localStorage.setItem('_LOG_INDEX', currentIndex);
      if (renderContent) {
        renderContent();
      }
    }
  };
})();

if (typeof window !== 'undefined' && !window.LOG) {
  window.LOG = LOG
}

export default LOG
