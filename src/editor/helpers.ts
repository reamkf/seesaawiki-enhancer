import type * as monacoNs from 'monaco-editor';

type MonacoNamespace = typeof monacoNs;
type Editor = monacoNs.editor.IStandaloneCodeEditor;

interface SelectionWithIndex {
  selection: monacoNs.Selection;
  index: number;
}

// 複数選択を文書順（開始位置→終了位置）に並べるための比較関数。
export function compareSelectionsByPosition(
  a: SelectionWithIndex,
  b: SelectionWithIndex
): number {
  const aStart = a.selection.getStartPosition();
  const bStart = b.selection.getStartPosition();
  if (aStart.lineNumber !== bStart.lineNumber) {
    return aStart.lineNumber - bStart.lineNumber;
  }
  if (aStart.column !== bStart.column) {
    return aStart.column - bStart.column;
  }
  const aEnd = a.selection.getEndPosition();
  const bEnd = b.selection.getEndPosition();
  if (aEnd.lineNumber !== bEnd.lineNumber) {
    return aEnd.lineNumber - bEnd.lineNumber;
  }
  return aEnd.column - bEnd.column;
}

// 各選択範囲のテキストをtransformで置換し、置換後のテキスト全体を再選択する。
// transformがnullを返した選択範囲は変更せずそのまま維持する。
export function transformSelections(
  monaco: MonacoNamespace,
  editor: monacoNs.editor.ICodeEditor,
  editId: string,
  transform: (selectedText: string, selection: monacoNs.Selection) => string | null
): void {
  const selections = editor.getSelections() ?? [editor.getSelection()!];
  const model = editor.getModel()!;
  const newSelections: monacoNs.Selection[] = new Array(selections.length);
  const selectionsWithIndex = selections.map((selection, index) => ({ selection, index }));

  selectionsWithIndex.sort(compareSelectionsByPosition);

  editor.pushUndoStop();
  selectionsWithIndex
    .slice()
    .reverse()
    .forEach(({ selection, index }) => {
      const selectedText = model.getValueInRange(selection);
      const replacement = transform(selectedText, selection);
      if (replacement === null) {
        newSelections[index] = selection;
        return;
      }

      const startPosition = selection.getStartPosition();
      const startOffset = model.getOffsetAt(startPosition);
      editor.executeEdits(editId, [{ range: selection, text: replacement }]);
      const endPosition = model.getPositionAt(startOffset + replacement.length);
      newSelections[index] = new monaco.Selection(
        startPosition.lineNumber,
        startPosition.column,
        endPosition.lineNumber,
        endPosition.column
      );
    });
  editor.pushUndoStop();
  editor.setSelections(newSelections);
}

export function escapeHTML(text: string): string {
  return text
    .split('')
    .map((char) => `&#${char.charCodeAt(0)};`)
    .join('');
}

export function wrapSelectedText(
  monaco: MonacoNamespace,
  editor: Editor,
  prefix: string,
  suffix: string
): void {
  const selections = editor.getSelections() ?? [editor.getSelection()!];
  const model = editor.getModel()!;
  const newSelections: monacoNs.Selection[] = new Array(selections.length);
  const selectionsWithIndex = selections.map((selection, index) => ({ selection, index }));

  selectionsWithIndex.sort(compareSelectionsByPosition);

  editor.pushUndoStop();
  selectionsWithIndex
    .slice()
    .reverse()
    .forEach(({ selection, index }) => {
      const startOffset = model.getOffsetAt(selection.getStartPosition());
      const selectedText = model.getValueInRange(selection);
      let text: string;

      if (!selection.isEmpty()) {
        if (selectedText.startsWith(prefix) && selectedText.endsWith(suffix)) {
          text = selectedText.slice(prefix.length, selectedText.length - suffix.length);
        } else {
          text = prefix + selectedText + suffix;
        }
      } else {
        text = prefix + suffix;
      }

      editor.executeEdits('wrap-selected-text', [
        {
          range: selection,
          text,
        },
      ]);

      if (selection.isEmpty()) {
        const cursorOffset = startOffset + prefix.length;
        const cursorPosition = model.getPositionAt(cursorOffset);
        newSelections[index] = new monaco.Selection(
          cursorPosition.lineNumber,
          cursorPosition.column,
          cursorPosition.lineNumber,
          cursorPosition.column
        );
      } else {
        const startPosition = model.getPositionAt(startOffset);
        const endPosition = model.getPositionAt(startOffset + text.length);
        newSelections[index] = new monaco.Selection(
          startPosition.lineNumber,
          startPosition.column,
          endPosition.lineNumber,
          endPosition.column
        );
      }
    });
  editor.pushUndoStop();
  editor.setSelections(newSelections);
}

export function insertAtBeginningOfLine(
  monaco: MonacoNamespace,
  editor: Editor,
  prefix: string,
  maxLevel = 1
): void {
  const selections = editor.getSelections() ?? [editor.getSelection()!];
  const model = editor.getModel()!;
  const lineNumberSet = new Set<number>();

  selections.forEach((selection) => {
    const startLine = selection.getStartPosition().lineNumber;
    const endLine = selection.getEndPosition().lineNumber;
    for (let lineNumber = startLine; lineNumber <= endLine; lineNumber += 1) {
      lineNumberSet.add(lineNumber);
    }
  });

  const lineNumbers = Array.from(lineNumberSet).sort((a, b) => b - a);
  const edits: monacoNs.editor.IIdentifiedSingleEditOperation[] = [];

  lineNumbers.forEach((lineNumber) => {
    const line = model.getLineContent(lineNumber);
    const regex = new RegExp(`^\\${prefix}{0,${maxLevel}}`);
    const currentLevelMatch = line.match(regex);
    const currentLevel = currentLevelMatch ? currentLevelMatch[0].length : 0;
    if (currentLevel < maxLevel) {
      edits.push({
        range: new monaco.Range(lineNumber, 1, lineNumber, 1),
        text: prefix,
        forceMoveMarkers: true,
      });
    }
  });

  if (edits.length === 0) return;

  editor.pushUndoStop();
  editor.executeEdits('insert-at-beginning-of-line', edits);
  editor.pushUndoStop();
}
