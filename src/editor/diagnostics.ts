import type * as monacoNs from 'monaco-editor';

type MonacoNamespace = typeof monacoNs;
type Model = monacoNs.editor.ITextModel;

export interface SeesaawikiDiagnostic {
  line: number;
  startColumn: number;
  endColumn: number;
  message: string;
}

const FOLDING_OPEN_REGEX = /^\[(\+|-)\]/;
const FOLDING_CLOSE_REGEX = /^\[END\]/;
const TABLE_ROW_PREFIX_REGEX = /^\|/;
const TABLE_ROW_VALID_REGEX = /^\|.*\|c?$/;
const TABLE_BLOCK_OPEN_REGEX = /^\{\|/;
const TABLE_BLOCK_CLOSE_REGEX = /^\|\}\s*$/;

export function computeSeesaawikiDiagnostics(
  lines: string[]
): SeesaawikiDiagnostic[] {
  const diagnostics: SeesaawikiDiagnostic[] = [];
  const openStack: { line: number; marker: string }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    const openMatch = text.match(FOLDING_OPEN_REGEX);
    if (openMatch) {
      openStack.push({ line: i + 1, marker: openMatch[0] });
      continue;
    }
    if (FOLDING_CLOSE_REGEX.test(text)) {
      if (openStack.length === 0) {
        diagnostics.push({
          line: i + 1,
          startColumn: 1,
          endColumn: '[END]'.length + 1,
          message: '対応する [+] または [-] が見つかりません。',
        });
      } else {
        openStack.pop();
      }
    }
  }

  for (const unclosed of openStack) {
    diagnostics.push({
      line: unclosed.line,
      startColumn: 1,
      endColumn: unclosed.marker.length + 1,
      message: `${unclosed.marker} に対応する [END] が見つかりません。`,
    });
  }

  collectTableDiagnostics(lines, diagnostics);

  return diagnostics;
}

type TableMode = 'none' | 'implicit' | 'explicit';

function collectTableDiagnostics(
  lines: string[],
  diagnostics: SeesaawikiDiagnostic[]
): void {
  let mode: TableMode = 'none';
  const pending: { lineIndex: number; text: string }[] = [];

  const flushPending = (): void => {
    for (const p of pending) {
      const isBlank = p.text.trim().length === 0;
      diagnostics.push({
        line: p.lineIndex + 1,
        startColumn: 1,
        endColumn: Math.max(p.text.length + 1, 2),
        message: isBlank
          ? '表の途中に空行があります。'
          : '表の途中に | で囲まれていない行があります。',
      });
    }
    pending.length = 0;
  };

  for (let i = 0; i < lines.length; i++) {
    const text = lines[i];
    const isBlank = text.trim().length === 0;

    if (TABLE_BLOCK_OPEN_REGEX.test(text)) {
      pending.length = 0;
      mode = 'explicit';
      continue;
    }
    if (TABLE_BLOCK_CLOSE_REGEX.test(text)) {
      if (mode === 'explicit') {
        flushPending();
      } else {
        pending.length = 0;
      }
      mode = 'none';
      continue;
    }

    if (TABLE_ROW_PREFIX_REGEX.test(text)) {
      if (!TABLE_ROW_VALID_REGEX.test(text)) {
        diagnostics.push({
          line: i + 1,
          startColumn: 1,
          endColumn: text.length + 1,
          message: '表の行は | または |c で終わる必要があります。',
        });
      }
      flushPending();
      if (mode === 'none') mode = 'implicit';
      continue;
    }

    if (mode === 'implicit') {
      if (isBlank) {
        // 暗黙的な表は空行で終了とみなし、空行自体はエラーにしない。
        pending.length = 0;
        mode = 'none';
      } else {
        pending.push({ lineIndex: i, text });
      }
    } else if (mode === 'explicit') {
      pending.push({ lineIndex: i, text });
    }
  }
}

export const SEESAAWIKI_DIAGNOSTICS_OWNER = 'seesaawiki';

export function setupSeesaawikiDiagnostics(monaco: MonacoNamespace): void {
  const updateMarkers = (model: Model) => {
    if (model.isDisposed() || model.getLanguageId() !== 'seesaawiki') {
      return;
    }
    const lineCount = model.getLineCount();
    const lines: string[] = new Array(lineCount);
    for (let i = 1; i <= lineCount; i++) {
      lines[i - 1] = model.getLineContent(i);
    }
    const diagnostics = computeSeesaawikiDiagnostics(lines);
    const markers: monacoNs.editor.IMarkerData[] = diagnostics.map((d) => ({
      severity: monaco.MarkerSeverity.Error,
      message: d.message,
      startLineNumber: d.line,
      startColumn: d.startColumn,
      endLineNumber: d.line,
      endColumn: d.endColumn,
    }));
    monaco.editor.setModelMarkers(model, SEESAAWIKI_DIAGNOSTICS_OWNER, markers);
  };

  const watch = (model: Model) => {
    if (model.getLanguageId() !== 'seesaawiki') return;
    updateMarkers(model);
    const changeSub = model.onDidChangeContent(() => updateMarkers(model));
    const disposeSub = model.onWillDispose(() => {
      changeSub.dispose();
      disposeSub.dispose();
    });
  };

  monaco.editor.onDidCreateModel(watch);
  for (const model of monaco.editor.getModels()) {
    watch(model);
  }
}
