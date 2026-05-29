import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { registerSeesaaWikiLanguage } from './language-register.js';
import { SeesaaWikiDocumentSymbolProvider } from './symbol-provider.js';
import { replaceTextareaWithMonaco } from './editor.js';
import { createSeesaawikiDiffEditor } from './diff-editor.js';

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

window.monaco = monaco;
window.SeesaaWikiDocumentSymbolProvider = SeesaaWikiDocumentSymbolProvider;
window.replaceTextareaWithMonaco = (w, value) => {
  w.monaco = monaco;
  return replaceTextareaWithMonaco(w, value);
};
window.createSeesaawikiDiffEditor = (oldContent, newContent) =>
  createSeesaawikiDiffEditor(monaco, oldContent, newContent);

registerSeesaaWikiLanguage(monaco);

window.__seesaawikiReady = true;
