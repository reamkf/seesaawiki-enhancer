import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { registerSeesaaWikiLanguage } from './language-register.js';
import { SeesaaWikiDocumentSymbolProvider } from './symbol-provider.js';
import { createEditor } from './editor.js';
import { createSeesaawikiDiffEditor } from './diff-editor.js';
import { wrapSelectedText, insertAtBeginningOfLine } from './helpers.js';
import { context } from './context.js';

// 組み込み言語ワーカーは使用しないため、ダミーを設定して警告を抑制
self.MonacoEnvironment = {
  getWorker() {
    return {
      postMessage() {},
      terminate() {},
      addEventListener() {},
      removeEventListener() {},
    };
  },
};

registerSeesaaWikiLanguage(monaco);

const api = {
  monaco,
  SymbolProvider: SeesaaWikiDocumentSymbolProvider,
  setContext(values) {
    Object.assign(context, values);
  },
  createEditor(container, options) {
    return createEditor(monaco, container, options);
  },
  createDiffEditor(oldContent, newContent) {
    return createSeesaawikiDiffEditor(monaco, oldContent, newContent);
  },
  wrapSelectedText(editor, prefix, suffix) {
    wrapSelectedText(monaco, editor, prefix, suffix);
  },
  insertAtBeginningOfLine(editor, prefix, maxLevel) {
    insertAtBeginningOfLine(monaco, editor, prefix, maxLevel);
  },
};

window.__seesaawikiApi = api;

if (window.parent !== window) {
  window.parent.postMessage({ type: 'seesaawiki:ready' }, '*');
}
