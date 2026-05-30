export function escapeHTML(text) {
  return text
    .split('')
    .map((char) => `&#${char.charCodeAt(0)};`)
    .join('');
}

export function wrapSelectedText(monaco, editor, prefix, suffix) {
  const selections = editor.getSelections() ?? [editor.getSelection()];
  const model = editor.getModel();
  const newSelections = new Array(selections.length);
  const selectionsWithIndex = selections.map((selection, index) => ({ selection, index }));

  selectionsWithIndex.sort((a, b) => {
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
  });

  editor.pushUndoStop();
  selectionsWithIndex
    .slice()
    .reverse()
    .forEach(({ selection, index }) => {
      const startOffset = model.getOffsetAt(selection.getStartPosition());
      const selectedText = model.getValueInRange(selection);
      let text;

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

export function insertAtBeginningOfLine(monaco, editor, prefix, maxLevel = 1) {
  const selections = editor.getSelections() ?? [editor.getSelection()];
  const model = editor.getModel();
  const lineNumbers = Array.from(
    new Set(selections.map((selection) => selection.getStartPosition().lineNumber))
  ).sort((a, b) => b - a);
  const edits = [];

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
