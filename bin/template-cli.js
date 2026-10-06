// Template helpers shared by `fez compile` and `fez template`.

import createTemplate, { clearTemplateCache } from '../src/fez/lib/template.js';

export function firstLine(message) {
  return String(message || 'Unknown error').split('\n')[0];
}

export function captureConsoleErrors(callback) {
  const oldError = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args.map(String).join(' '));
  try {
    callback();
  } finally {
    clearTemplateCache();
    console.error = oldError;
  }
  return logs;
}

export function debugTemplateFunction(html, componentName) {
  const RealFunction = globalThis.Function;
  const oldError = console.error;
  let debug = '';
  globalThis.Function = function (...args) {
    try {
      return RealFunction(...args);
    } catch (error) {
      debug = [
        `Generated template function for <${componentName}> failed: ${error.message}`,
        '',
        args.join('\n---ARG---\n'),
      ].join('\n');
      throw error;
    }
  };
  console.error = () => {};
  try {
    clearTemplateCache();
    createTemplate(html, { name: componentName });
  } finally {
    console.error = oldError;
    globalThis.Function = RealFunction;
    clearTemplateCache();
  }
  return debug;
}
