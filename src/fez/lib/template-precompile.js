// Build-time template compilation for the bundler plugin (compile-module.js).
// The template becomes code in the emitted module, so the browser compiles
// nothing: no new Function, no inline handler attributes, and a
// Content-Security-Policy without 'unsafe-eval' / 'unsafe-inline' works.
//
// The runtime compiler evaluates a template inside `with (this)`. Modules are
// strict and have no `with`, so every free name of the generated code is
// rewritten to the lookup `with` does: the component's property when it has
// one, else the outer (global) binding.

import { parseExpressionAt } from 'acorn';
import closeCustomTags from './close-custom-tags.js';
import { compileTemplateLiteral } from './template-compiler.js';
import { normalizeTemplateText, slotTemplate } from './template.js';

// always on a component, so read straight off it
const OWN = new Set(['state', 'props', 'globalState', 'UID', 'fezGlobals']);

// never component properties: left alone
const GLOBALS = new Set([
  'Fez',
  'undefined',
  'NaN',
  'Infinity',
  'arguments',
  'globalThis',
  'window',
  'document',
  'console',
  'Math',
  'JSON',
  'Object',
  'Array',
  'String',
  'Number',
  'Boolean',
  'Date',
]);

/**
 * Compile a component template (the html of a .fez file) to a function
 * expression source. Called with the component as `this`, it returns the
 * HTML string. Throws on template errors.
 *
 * @returns {{ code: string, slotUnwrap: boolean }}
 */
export function precompileTemplate(html, { name } = {}) {
  const slot = slotTemplate(closeCustomTags(html.trim()));
  const text = normalizeTemplateText(slot.html, { name });
  const literal = compileTemplateLiteral(text, { name, strict: true, precompile: true });
  const code = rewriteFreeNames(`function () {\nconst fez = this;\nreturn \`${literal}\`;\n}`);
  return { code, slotUnwrap: slot.slotUnwrap };
}

/**
 * Rewrite the free names of a function expression source to `with (fez)`
 * lookups (see the file comment).
 */
export function rewriteFreeNames(code) {
  const root = parseExpressionAt(code, 0, { ecmaVersion: 'latest' });
  const edits = [];
  const scopes = [];

  const free = (name) => !GLOBALS.has(name) && !scopes.some((scope) => scope.has(name));
  const has = (name) => `${JSON.stringify(name)} in fez`;
  const lookup = (name) => (OWN.has(name) ? `fez.${name}` : `(${has(name)} ? fez.${name} : ${name})`);
  const replace = (node, text) => edits.push({ start: node.start, end: node.end, text });

  const reference = (id) => {
    if (free(id.name)) {
      replace(id, lookup(id.name));
    }
  };

  // assignment target: the component's property when it has one, as with `with`
  const target = (node) => {
    switch (node.type) {
      case 'Identifier':
        if (free(node.name)) {
          replace(node, `(${has(node.name)} ? fez : globalThis).${node.name}`);
        }
        return;
      case 'ObjectPattern':
        for (const prop of node.properties) {
          if (prop.type === 'RestElement') {
            target(prop.argument);
            continue;
          }
          if (prop.computed) {
            visit(prop.key);
          }
          if (prop.shorthand && prop.value.type === 'Identifier') {
            if (free(prop.value.name)) {
              replace(prop, `${prop.key.name}: (${has(prop.key.name)} ? fez : globalThis).${prop.key.name}`);
            }
          } else {
            target(prop.value);
          }
        }
        return;
      case 'ArrayPattern':
        node.elements.forEach((element) => element && target(element));
        return;
      case 'AssignmentPattern':
        target(node.left);
        visit(node.right);
        return;
      case 'RestElement':
        target(node.argument);
        return;
      default:
        visit(node);
    }
  };

  // declaration pattern: its names are bound, only defaults and computed keys are code
  const pattern = (node) => {
    switch (node.type) {
      case 'ObjectPattern':
        for (const prop of node.properties) {
          if (prop.type === 'RestElement') {
            pattern(prop.argument);
            continue;
          }
          if (prop.computed) {
            visit(prop.key);
          }
          pattern(prop.value);
        }
        return;
      case 'ArrayPattern':
        node.elements.forEach((element) => element && pattern(element));
        return;
      case 'AssignmentPattern':
        pattern(node.left);
        visit(node.right);
        return;
      case 'RestElement':
        pattern(node.argument);
        return;
    }
  };

  const visit = (node) => {
    if (!node || typeof node.type !== 'string') {
      return;
    }
    switch (node.type) {
      case 'Identifier':
        return reference(node);
      case 'FunctionExpression':
      case 'FunctionDeclaration':
      case 'ArrowFunctionExpression':
        scopes.push(functionScope(node));
        node.params.forEach(pattern);
        visit(node.body);
        scopes.pop();
        return;
      case 'MemberExpression':
        visit(node.object);
        if (node.computed) {
          visit(node.property);
        }
        return;
      case 'Property':
        if (node.computed) {
          visit(node.key);
        }
        if (node.shorthand && node.value.type === 'Identifier') {
          if (free(node.value.name)) {
            replace(node, `${node.key.name}: ${lookup(node.key.name)}`);
          }
          return;
        }
        return visit(node.value);
      case 'MethodDefinition':
      case 'PropertyDefinition':
        if (node.computed) {
          visit(node.key);
        }
        return visit(node.value);
      case 'VariableDeclarator':
        pattern(node.id);
        return visit(node.init);
      case 'CallExpression':
        if (node.callee.type === 'Identifier' && free(node.callee.name)) {
          return call(node);
        }
        break;
      case 'UnaryExpression':
        if (node.operator === 'typeof' && node.argument.type === 'Identifier' && free(node.argument.name)) {
          const name = node.argument.name;
          return replace(node, `(${has(name)} ? typeof fez.${name} : typeof ${name})`);
        }
        break;
      case 'AssignmentExpression':
        target(node.left);
        return visit(node.right);
      case 'UpdateExpression':
        return target(node.argument);
      case 'ForInStatement':
      case 'ForOfStatement':
        if (node.left.type === 'VariableDeclaration') {
          visit(node.left);
        } else {
          target(node.left);
        }
        visit(node.right);
        return visit(node.body);
      case 'CatchClause':
        return visit(node.body);
      case 'ClassDeclaration':
      case 'ClassExpression':
        visit(node.superClass);
        return visit(node.body);
      case 'LabeledStatement':
        return visit(node.body);
      case 'BreakStatement':
      case 'ContinueStatement':
      case 'MetaProperty':
        return;
    }
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(visit);
      } else if (child && typeof child.type === 'string') {
        visit(child);
      }
    }
  };

  // save(x) -> the component's method called on it, or the outer save(x)
  const call = (node) => {
    const name = node.callee.name;
    if (OWN.has(name)) {
      replace(node.callee, `fez.${name}`);
    } else {
      replace(node.callee, `(${has(name)} ? fez.${name} : ${name}).call`);
      const paren = code.indexOf('(', node.callee.end);
      const thisArg = `${has(name)} ? fez : void 0`;
      edits.push({ start: paren + 1, end: paren + 1, text: node.arguments.length ? `${thisArg}, ` : thisArg });
    }
    node.arguments.forEach(visit);
  };

  visit(root);

  // insertions before a replacement that starts at the same offset
  edits.sort((a, b) => a.start - b.start || a.end - a.start - (b.end - b.start));
  let out = '';
  let pos = 0;
  for (const edit of edits) {
    out += code.slice(pos, edit.start) + edit.text;
    pos = edit.end;
  }
  return out + code.slice(pos, root.end);
}

// Names a function declares: params, var / let / const / function / class in
// its body (block scoping is not tracked: a name declared anywhere in the
// function counts as bound in all of it), catch params, own name.
function functionScope(fn) {
  const names = new Set();
  if (fn.type !== 'ArrowFunctionExpression') {
    names.add('arguments');
  }
  if (fn.id) {
    names.add(fn.id.name);
  }
  fn.params.forEach((param) => patternNames(param, names));
  const hoist = (node) => {
    if (!node || typeof node.type !== 'string') {
      return;
    }
    switch (node.type) {
      case 'FunctionDeclaration':
        names.add(node.id.name);
        return;
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        return;
      case 'VariableDeclarator':
        patternNames(node.id, names);
        break;
      case 'ClassDeclaration':
        names.add(node.id.name);
        break;
      case 'CatchClause':
        if (node.param) {
          patternNames(node.param, names);
        }
        break;
    }
    for (const key of Object.keys(node)) {
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(hoist);
      } else if (child && typeof child.type === 'string') {
        hoist(child);
      }
    }
  };
  hoist(fn.body);
  return names;
}

function patternNames(node, names) {
  switch (node?.type) {
    case 'Identifier':
      names.add(node.name);
      return;
    case 'ObjectPattern':
      node.properties.forEach((prop) =>
        patternNames(prop.type === 'RestElement' ? prop.argument : prop.value, names),
      );
      return;
    case 'ArrayPattern':
      node.elements.forEach((element) => patternNames(element, names));
      return;
    case 'AssignmentPattern':
      patternNames(node.left, names);
      return;
    case 'RestElement':
      patternNames(node.argument, names);
  }
}
