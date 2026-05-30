// Prototype.jsが上書きしたネイティブメソッドをMonaco読み込み前に復元する。
// 副作用importのため、必ずmonacoより前に置くこと。
import '../utils/native-methods.js';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import 'monaco-editor/esm/vs/editor/editor.all.js';
import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneGotoLineQuickAccess.js';
import 'monaco-editor/esm/vs/editor/standalone/browser/quickAccess/standaloneGotoSymbolQuickAccess.js';
import { registerSeesaaWikiLanguage } from './language-register.js';
import { SeesaaWikiDocumentSymbolProvider } from './symbol-provider.js';
import { createEditor } from './editor.js';
import { createSeesaawikiDiffEditor } from './diff-editor.js';
import { wrapSelectedText, insertAtBeginningOfLine } from './helpers.js';
import { context } from './context.js';
import { withoutPrototypePollution } from '../utils/prototype-guard.js';

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

withoutPrototypePollution(() => registerSeesaaWikiLanguage(monaco));

export const api = {
  monaco,
  SymbolProvider: SeesaaWikiDocumentSymbolProvider,
  setContext(values) {
    Object.assign(context, values);
  },
  createEditor(container, options) {
    return withoutPrototypePollution(() => createEditor(monaco, container, options));
  },
  createDiffEditor(container, oldContent, newContent) {
    return withoutPrototypePollution(() =>
      createSeesaawikiDiffEditor(monaco, container, oldContent, newContent)
    );
  },
  wrapSelectedText(editor, prefix, suffix) {
    wrapSelectedText(monaco, editor, prefix, suffix);
  },
  insertAtBeginningOfLine(editor, prefix, maxLevel) {
    insertAtBeginningOfLine(monaco, editor, prefix, maxLevel);
  },
};
