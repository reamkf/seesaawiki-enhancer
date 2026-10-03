// Prototype.jsが上書きしたネイティブメソッドをMonaco読み込み前に復元する。
// 副作用importのため、必ずmonacoより前に置くこと。
import '../utils/native-methods.js';
import * as monaco from 'monaco-editor/editor/editor.api';
import EditorWorker from 'monaco-editor/editor/editor.worker?worker&inline';
import EditorWorkerUrl from 'monaco-editor/editor/editor.worker?worker&url';
import 'monaco-editor/editor/editor.main.js';
import type * as monacoNs from 'monaco-editor';
import { registerSeesaaWikiLanguage } from './language-register.js';
import { SeesaaWikiDocumentSymbolProvider } from './symbol-provider.js';
import { createEditor, type CreateEditorOptions } from './editor.js';
import { createSeesaawikiDiffEditor } from './diff-editor.js';
import { wrapSelectedText, insertAtBeginningOfLine } from './helpers.js';
import { context, type EditorContext } from './context.js';
import { withoutPrototypePollution } from '../utils/prototype-guard.js';

type MonacoNamespace = typeof monacoNs;

interface MonacoEnvironmentSetup {
  getWorker(moduleId: string, label: string): Worker;
}

declare const self: {
  MonacoEnvironment?: MonacoEnvironmentSetup;
};

// 組み込み言語ワーカーは使用しないため、ダミーを設定して警告を抑制
self.MonacoEnvironment = {
  getWorker() {
    if (import.meta.env?.DEV) {
      return new Worker(EditorWorkerUrl, { type: 'module' });
    }
    return new EditorWorker();
  },
};

withoutPrototypePollution(() => registerSeesaaWikiLanguage(monaco as unknown as MonacoNamespace));

export interface SeesaawikiEditorApi {
  monaco: MonacoNamespace;
  SymbolProvider: typeof SeesaaWikiDocumentSymbolProvider;
  setContext(values: Partial<EditorContext>): void;
  createEditor(
    container: HTMLElement,
    options?: CreateEditorOptions
  ): monacoNs.editor.IStandaloneCodeEditor;
  createDiffEditor(
    container: HTMLElement,
    oldContent: string,
    newContent: string
  ): monacoNs.editor.IStandaloneDiffEditor;
  wrapSelectedText(
    editor: monacoNs.editor.IStandaloneCodeEditor,
    prefix: string,
    suffix: string
  ): void;
  insertAtBeginningOfLine(
    editor: monacoNs.editor.IStandaloneCodeEditor,
    prefix: string,
    maxLevel: number
  ): void;
}

const monacoTyped = monaco as unknown as MonacoNamespace;

export const api: SeesaawikiEditorApi = {
  monaco: monacoTyped,
  SymbolProvider: SeesaaWikiDocumentSymbolProvider,
  setContext(values) {
    Object.assign(context, values);
  },
  createEditor(container, options) {
    return withoutPrototypePollution(() => createEditor(monacoTyped, container, options));
  },
  createDiffEditor(container, oldContent, newContent) {
    return withoutPrototypePollution(() =>
      createSeesaawikiDiffEditor(monacoTyped, container, oldContent, newContent)
    );
  },
  wrapSelectedText(editor, prefix, suffix) {
    wrapSelectedText(monacoTyped, editor, prefix, suffix);
  },
  insertAtBeginningOfLine(editor, prefix, maxLevel) {
    insertAtBeginningOfLine(monacoTyped, editor, prefix, maxLevel);
  },
};
