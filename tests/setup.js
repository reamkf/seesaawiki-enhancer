import { Window } from 'happy-dom';

const window = new Window();

// happy-dom v20 defines some built-in constructors as getters that may resolve
// to undefined before the Window finishes initialization. Internal code
// references e.g. `this.window.SyntaxError` synchronously during DOM
// operations, so we shadow those with the test runtime's natives.
const builtinKeys = [
  'SyntaxError',
  'TypeError',
  'RangeError',
  'ReferenceError',
  'Error',
  'URIError',
  'EvalError',
];
for (const key of builtinKeys) {
  Object.defineProperty(window, key, {
    configurable: true,
    writable: true,
    value: globalThis[key],
  });
}

const globalKeys = [
  'document',
  'window',
  'HTMLElement',
  'HTMLTextAreaElement',
  'HTMLDivElement',
  'HTMLAnchorElement',
  'Element',
  'Node',
  'Text',
  'Comment',
  'DocumentFragment',
  'DOMParser',
  'XMLSerializer',
  'navigator',
];

for (const key of globalKeys) {
  if (!(key in globalThis) && key in window) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      writable: true,
      value: window[key],
    });
  }
}
