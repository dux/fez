window.LOG = (() => {
  const logs = [];
  const logTypes = []; // Track the original type of each log
  let currentIndex = 0;

  return o => {
    if (!document.body) {
      window.requestAnimationFrame( () => LOG(o) )
      return
    }

    // Store the original type
    let originalType = typeof o;
    if (Array.isArray(o)) {
      originalType = 'array';
    } else if (typeof o === 'object' && o !== null) {
      originalType = 'object';
    }

    if (typeof o != 'string') {
      o = JSON.stringify(o, (key, value) => {
        if (typeof value === 'function') {
          return 'function(){...}';
        }
        return value;
      }, 2).replaceAll('<', '&lt;')
    }

    o = o.trim()

    logs.push(o + `\n\ntype: ${originalType}`);
    logTypes.push(originalType);

    let d = document.getElementById('dump-dialog');
    if (!d) {
      d = document.body.appendChild(document.createElement('div'));
      d.id = 'dump-dialog';
      d.style.cssText =
        'position:fixed;top:30px;left:30px;right:50px;bottom:50px;' +
        'background:#fff;border:1px solid#333;box-shadow:0 0 10px rgba(0,0,0,0.5);' +
        'padding:20px;overflow:auto;z-index:9999;font:13px/1.4 monospace;white-space:pre';
    }

    // Check if we have a saved index and it's still valid
    const savedIndex = parseInt(localStorage.getItem('_LOG_INDEX'));
    if (!isNaN(savedIndex) && savedIndex >= 0 && savedIndex < logs.length) {
      currentIndex = savedIndex;
    } else {
      currentIndex = logs.length - 1;
    }

    const renderContent = () => {
      const buttons = logs.map((_, i) => {
        let bgColor = '#f0f0f0'; // default
        if (i !== currentIndex) {
          if (logTypes[i] === 'object') {
            bgColor = '#d6e3ef'; // super light blue
          } else if (logTypes[i] === 'array') {
            bgColor = '#d8d5ef'; // super light indigo
          }
        }
        return `<button style="padding:4px 8px;margin:0;cursor:pointer;background:${i === currentIndex ? '#333' : bgColor};color:${i === currentIndex ? '#fff' : '#000'}" data-index="${i}">${i + 1}</button>`
      }).join('');

      d.innerHTML =
        '<div style="display:flex;flex-direction:column;height:100%">' +
        '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px">' +
        '<div style="display:flex;flex-wrap:wrap;gap:4px;flex:1;margin-right:10px">' + buttons + '</div>' +
        '<button style="padding:4px 8px;cursor:pointer;flex-shrink:0">&times;</button>' +
        '</div>' +
        '<xmp style="flex:1;overflow:auto;margin:0;padding:0;color:#000;background:#fff;font-size:14px;line-height:22px">' + logs[currentIndex] + '</xmp>' +
        '</div>';

      d.querySelector('button[style*="flex-shrink:0"]').onclick = () => d.remove();

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
})();

// pretty print
window.PP = (html) => {
  const parts = html
    .replace(/\r?\n/g, '')
    .split(/(<\/?[^>]+>)/g)
    .filter(p => p.trim());
  let indent = 0;
  return parts.map(part => {
    if (/^<\/\w/.test(part)) indent--;
    const line = '  '.repeat(indent) + part.trim();
    if (/^<\w[^>]*[^\/]>$/.test(part)) indent++;
    return line;
  }).join('\n');
}
