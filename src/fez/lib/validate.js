// Shared source validation used by the runtime compiler and the build-time
// module compiler. Keep messages in sync with validateStyle() in bin/fez-compile.

export const STYLE_SCOPE_ERRORS = {
  body: 'body { } in a scoped <style>. Move these rules to <style global>.',
  host: ':host is not supported. <style> is already scoped - use `&` for the root node.',
  fez: ':fez is no longer an author-facing selector. <style> is already scoped - use `&` for the root node.',
  globalInGlobal:
    ':global() inside <style global>. These rules are already global - drop the wrapper.',
};

// Blank out comments while keeping length and line breaks, so scope checks
// never fire on prose - "was :fez before" in a comment is not an error.
export function withoutComments(style) {
  return style
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/^([ \t]*)\/\/[^\n]*/gm, (m, indent) => indent + ' '.repeat(m.length - indent.length));
}

export function assertStyleScope(tagName, rawStyle, isGlobal) {
  if (!rawStyle) {
    return;
  }
  const style = withoutComments(rawStyle);

  const fail = (message) => {
    throw new Error(`<${tagName}> style error: ${message}`);
  };

  if (!isGlobal && /(?:^|\s)body\s*\{/.test(style)) {
    fail(STYLE_SCOPE_ERRORS.body);
  }
  if (/:host\b/.test(style)) {
    fail(STYLE_SCOPE_ERRORS.host);
  }
  if (/:fez\b/.test(style)) {
    fail(STYLE_SCOPE_ERRORS.fez);
  }
  if (isGlobal && /:global\(/.test(style)) {
    fail(STYLE_SCOPE_ERRORS.globalInGlobal);
  }
}
