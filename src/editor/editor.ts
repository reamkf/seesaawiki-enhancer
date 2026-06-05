import type * as monacoNs from 'monaco-editor';
import { wrapSelectedText, escapeHTML } from './helpers.js';
import { context } from './context.js';

type MonacoNamespace = typeof monacoNs;
type Editor = monacoNs.editor.IStandaloneCodeEditor;

function getTableCellRanges(
  monaco: MonacoNamespace,
  editor: Editor,
  lineNumber: number
): monacoNs.Range[] | null {
  const model = editor.getModel();
  if (!model) return null;
  const lineContent = model.getLineContent(lineNumber);

  const tableMatch = lineContent.match(/^\|([^|]*\|)+c?$/);
  if (!tableMatch) return null;

  const cellContents = lineContent.split('|');
  const cellRanges: monacoNs.Range[] = [];

  let cellStart = 1;
  let cellEnd: number;

  for (let i = 0; i < cellContents.length; i++) {
    cellEnd = cellStart + cellContents[i].length;
    cellRanges.push(new monaco.Range(lineNumber, cellStart, lineNumber, cellEnd));
    cellStart = cellEnd + 1;
  }

  return cellRanges;
}

function insertTextAtCursor(
  monaco: MonacoNamespace,
  editor: Editor,
  text: string
): void {
  const selections = editor.getSelections() ?? [editor.getSelection()!];
  const model = editor.getModel()!;
  const newSelections: monacoNs.Selection[] = new Array(selections.length);
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
      const range = selection.isEmpty()
        ? new monaco.Range(
            selection.startLineNumber,
            selection.startColumn,
            selection.startLineNumber,
            selection.startColumn
          )
        : selection;
      const startOffset = model.getOffsetAt(range.getStartPosition());

      editor.executeEdits('insert-text-at-cursor', [
        {
          range,
          text,
          forceMoveMarkers: true,
        },
      ]);

      const endOffset = startOffset + text.length;
      const endPosition = model.getPositionAt(endOffset);
      newSelections[index] = new monaco.Selection(
        endPosition.lineNumber,
        endPosition.column,
        endPosition.lineNumber,
        endPosition.column
      );
    });
  editor.pushUndoStop();
  editor.setSelections(newSelections);
}

interface SnippetController extends monacoNs.editor.IEditorContribution {
  insert(template: string): void;
}

function setupEditorKeybindings(monaco: MonacoNamespace, editor: Editor): void {
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => {
    wrapSelectedText(monaco, editor, "''", "''");
  });

  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI, () => {
    wrapSelectedText(monaco, editor, "'''", "'''");
  });

  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyU, () => {
    wrapSelectedText(monaco, editor, '%%%', '%%%');
  });

  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD, () => {
    wrapSelectedText(monaco, editor, '%%', '%%');
  });

  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
    wrapSelectedText(monaco, editor, '[[', ']]');
  });

  editor.addCommand(
    monaco.KeyCode.Enter,
    () => {
      const selections = editor.getSelections();
      if (selections && selections.length > 1) {
        const model = editor.getModel()!;
        const newSelections: monacoNs.Selection[] = new Array(selections.length);
        const selectionsWithIndex = selections.map((selection, index) => ({ selection, index }));

        selectionsWithIndex.sort((a, b) => {
          const aPos = a.selection.getEndPosition();
          const bPos = b.selection.getEndPosition();
          if (aPos.lineNumber !== bPos.lineNumber) {
            return bPos.lineNumber - aPos.lineNumber;
          }
          return bPos.column - aPos.column;
        });

        editor.pushUndoStop();
        selectionsWithIndex.forEach(({ selection, index }) => {
          const position = selection.getEndPosition();
          const lineContent = model.getLineContent(position.lineNumber);
          const range = selection.isEmpty()
            ? new monaco.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                position.column
              )
            : selection;

          const bulletMatch = lineContent.match(/^((?:-|\+){1,3})(?!-)(.*)$/);
          if (bulletMatch) {
            const [, bullet, content] = bulletMatch;
            if (content.trim() != '') {
              editor.executeEdits('multi-enter', [
                {
                  range,
                  text: '\n' + bullet,
                },
              ]);
              newSelections[index] = new monaco.Selection(
                position.lineNumber + 1,
                bullet.length + 1,
                position.lineNumber + 1,
                bullet.length + 1
              );
            } else {
              editor.executeEdits('multi-enter', [
                {
                  range: new monaco.Range(
                    position.lineNumber,
                    1,
                    position.lineNumber,
                    position.column
                  ),
                  text: '',
                },
              ]);
              newSelections[index] = new monaco.Selection(
                position.lineNumber,
                1,
                position.lineNumber,
                1
              );
            }
            return;
          }

          if (lineContent.startsWith('>') || lineContent.startsWith(' ')) {
            const content = lineContent.slice(1).trim();
            if (content != '') {
              editor.executeEdits('multi-enter', [
                {
                  range,
                  text: '\n' + lineContent[0],
                },
              ]);
              newSelections[index] = new monaco.Selection(
                position.lineNumber + 1,
                2,
                position.lineNumber + 1,
                2
              );
            } else {
              editor.executeEdits('multi-enter', [
                {
                  range: new monaco.Range(
                    position.lineNumber,
                    1,
                    position.lineNumber,
                    position.column
                  ),
                  text: '',
                },
              ]);
              newSelections[index] = new monaco.Selection(
                position.lineNumber,
                1,
                position.lineNumber,
                1
              );
            }
            return;
          }

          editor.executeEdits('multi-enter', [
            {
              range,
              text: '\n',
            },
          ]);
          newSelections[index] = new monaco.Selection(
            position.lineNumber + 1,
            1,
            position.lineNumber + 1,
            1
          );
        });
        editor.pushUndoStop();
        editor.setSelections(newSelections);
        return;
      }

      const model = editor.getModel()!;
      const position = editor.getPosition()!;
      const lineContent = model.getLineContent(position.lineNumber);

      const bulletMatch = lineContent.match(/^((?:-|\+){1,3})(?!-)(.*)$/);
      if (bulletMatch) {
        const [, bullet, content] = bulletMatch;
        if (content.trim() != '') {
          editor.executeEdits('', [
            {
              range: new monaco.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                position.column
              ),
              text: '\n' + bullet,
            },
          ]);
          editor.setPosition({
            lineNumber: position.lineNumber + 1,
            column: bullet.length + 1,
          });
        } else {
          editor.executeEdits('', [
            {
              range: new monaco.Range(
                position.lineNumber,
                1,
                position.lineNumber,
                position.column
              ),
              text: '',
            },
          ]);
        }
        return;
      }

      const cellRanges = getTableCellRanges(monaco, editor, position.lineNumber);
      if (cellRanges) {
        if (position.column === lineContent.length + 1) {
          editor.trigger('keyboard', 'type', { text: '\n' });
        } else {
          const nextLineNumber = position.lineNumber + 1;
          if (nextLineNumber <= model.getLineCount()) {
            const nextCellRanges = getTableCellRanges(monaco, editor, nextLineNumber);
            const currentCellIndex = cellRanges.findIndex((cell) =>
              cell.containsPosition(position)
            );
            if (nextCellRanges && nextCellRanges.length - 1 >= currentCellIndex) {
              const targetRange = nextCellRanges[currentCellIndex];
              editor.setSelection(targetRange);
              editor.revealPositionInCenterIfOutsideViewport(targetRange.getStartPosition());
            }
          }
        }
        return;
      }

      if (lineContent.startsWith('>') || lineContent.startsWith(' ')) {
        const content = lineContent.slice(1).trim();
        if (content != '') {
          editor.executeEdits('', [
            {
              range: new monaco.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                position.column
              ),
              text: '\n' + lineContent[0],
            },
          ]);
          editor.setPosition({
            lineNumber: position.lineNumber + 1,
            column: 2,
          });
        } else {
          editor.executeEdits('', [
            {
              range: new monaco.Range(
                position.lineNumber,
                1,
                position.lineNumber,
                position.column
              ),
              text: '',
            },
          ]);
        }
        return;
      }

      editor.trigger('keyboard', 'type', { text: '\n' });
    },
    'editorTextFocus && !editorReadonly && !editorTabMovesFocus && !suggestWidgetHasFocusedSuggestion && !suggestWidgetVisible && !hasNextTabstop && !inSnippetMode'
  );

  editor.addCommand(
    monaco.KeyMod.Shift | monaco.KeyCode.Enter,
    () => {
      const position = editor.getPosition()!;
      const cellRanges = getTableCellRanges(monaco, editor, position.lineNumber);
      if (cellRanges) {
        const prevLineNumber = position.lineNumber - 1;
        if (prevLineNumber > 0) {
          const prevCellRanges = getTableCellRanges(monaco, editor, prevLineNumber);
          const currentCellIndex = cellRanges.findIndex((cell) =>
            cell.containsPosition(position)
          );
          if (prevCellRanges && prevCellRanges.length - 1 >= currentCellIndex) {
            const targetRange = prevCellRanges[currentCellIndex];
            editor.setSelection(targetRange);
            editor.revealPositionInCenterIfOutsideViewport(targetRange.getStartPosition());
          }
        }
        return;
      }

      editor.trigger('keyboard', 'type', { text: '\n' });
    },
    'editorTextFocus && !editorReadonly && !editorTabMovesFocus && !suggestWidgetHasFocusedSuggestion && !suggestWidgetVisible'
  );

  editor.addCommand(
    monaco.KeyCode.Tab,
    () => {
      const selections = editor.getSelections();
      if (selections && selections.length > 0) {
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
          const lineContent = model.getLineContent(lineNumber);
          const bulletMatch = lineContent.match(/^((?:-|\+){1,3})(?!-)(.*)$/);
          if (bulletMatch) {
            const [, bullet] = bulletMatch;
            if (bullet.length < 3) {
              edits.push({
                range: new monaco.Range(lineNumber, 1, lineNumber, 1),
                text: bullet[0],
                forceMoveMarkers: true,
              });
            }
          }
        });

        if (edits.length > 0) {
          editor.pushUndoStop();
          editor.executeEdits('bullet-indent', edits);
          editor.pushUndoStop();
          return;
        }
      }

      const model = editor.getModel()!;
      const position = editor.getPosition()!;
      const lineContent = model.getLineContent(position.lineNumber);

      const bulletMatch = lineContent.match(/^((?:-|\+){1,3})(?!-)(.*)$/);
      if (bulletMatch) {
        const [, bullet] = bulletMatch;
        if (bullet.length < 3) {
          editor.executeEdits('', [
            {
              range: new monaco.Range(position.lineNumber, 1, position.lineNumber, 1),
              text: bullet[0],
            },
          ]);
        }
        return;
      }

      const cellRanges = getTableCellRanges(monaco, editor, position.lineNumber);
      if (cellRanges) {
        const currentCellIndex = cellRanges.findIndex((cell) =>
          cell.containsPosition(position)
        );

        if (currentCellIndex !== -1) {
          let targetRange: monacoNs.Range | undefined;
          if (currentCellIndex < cellRanges.length - 1) {
            targetRange = cellRanges[currentCellIndex + 1];
          } else {
            const nextLineNumber = position.lineNumber + 1;
            if (nextLineNumber <= model.getLineCount()) {
              const nextCellRanges = getTableCellRanges(monaco, editor, nextLineNumber);
              if (nextCellRanges) {
                targetRange = nextCellRanges[0];
              }
            }
          }

          if (targetRange) {
            editor.setSelection(targetRange);
            editor.revealPositionInCenterIfOutsideViewport(targetRange.getStartPosition());
          }
        }
        return;
      }

      editor.trigger('keyboard', 'tab', {});
    },
    'editorTextFocus && !editorReadonly && !editorTabMovesFocus && !suggestWidgetHasFocusedSuggestion && !suggestWidgetVisible && !hasNextTabstop && !inSnippetMode'
  );

  editor.addCommand(
    monaco.KeyMod.Shift | monaco.KeyCode.Tab,
    () => {
      const selections = editor.getSelections();
      if (selections && selections.length > 0) {
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
          const lineContent = model.getLineContent(lineNumber);
          const bulletMatch = lineContent.match(/^((?:-|\+){1,3})(\s*)([^-]*)$/);
          if (bulletMatch) {
            const [, bullet] = bulletMatch;
            if (bullet.length > 1) {
              edits.push({
                range: new monaco.Range(lineNumber, 1, lineNumber, 2),
                text: '',
                forceMoveMarkers: true,
              });
            }
          }
        });

        if (edits.length > 0) {
          editor.pushUndoStop();
          editor.executeEdits('bullet-outdent', edits);
          editor.pushUndoStop();
          return;
        }
      }

      const model = editor.getModel()!;
      const position = editor.getPosition()!;
      const lineContent = model.getLineContent(position.lineNumber);

      const bulletMatch = lineContent.match(/^((?:-|\+){1,3})(\s*)([^-]*)$/);
      if (bulletMatch) {
        const [, bullet] = bulletMatch;
        if (bullet.length > 1) {
          editor.executeEdits('', [
            {
              range: new monaco.Range(position.lineNumber, 1, position.lineNumber, 2),
              text: '',
            },
          ]);
        }
        return;
      }

      const cellRanges = getTableCellRanges(monaco, editor, position.lineNumber);
      if (cellRanges) {
        const currentCellIndex = cellRanges.findIndex((cell) =>
          cell.containsPosition(position)
        );

        if (currentCellIndex !== -1) {
          let targetRange: monacoNs.Range | undefined;
          if (currentCellIndex > 0) {
            targetRange = cellRanges[currentCellIndex - 1];
          } else {
            const prevLineNumber = position.lineNumber - 1;
            if (prevLineNumber > 0) {
              const prevCellRanges = getTableCellRanges(monaco, editor, prevLineNumber);
              if (prevCellRanges) {
                targetRange = prevCellRanges[prevCellRanges.length - 1];
              }
            }
          }

          if (targetRange) {
            editor.setSelection(targetRange);
            editor.revealPositionInCenterIfOutsideViewport(targetRange.getStartPosition());
          }
        }
        return;
      }

      editor.trigger('keyboard', 'outdent', {});
    },
    'editorTextFocus && !editorReadonly && !editorTabMovesFocus && !suggestWidgetHasFocusedSuggestion && !suggestWidgetVisible && !hasNextTabstop && !inSnippetMode'
  );

  editor.addCommand(
    monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyV,
    async () => {
      try {
        const clipboardText = await navigator.clipboard.readText();
        let pasteText = clipboardText.trim();

        const snippetController = editor.getContribution<SnippetController>('snippetController2');

        if (/^(https?:\/\/[^\s/$.?#].[^\s]*)$/i.test(pasteText)) {
          const url = new URL(pasteText);
          const domain = url.hostname;
          const path = url.pathname;
          const extension = path.split('.').pop() ?? '';

          if (/^(jpg|jpeg|png|gif|bmp|webp|tiff|svg)$/i.test(extension)) {
            pasteText = `&ref(${clipboardText})`;
          } else if (/^(mp4|webm|ogg|avi|mov|flv|wmv|mkv|m4v|3gp|mpeg|mpg)$/i.test(extension)) {
            pasteText = `&video(${clipboardText})`;
          } else if (/^(mp3|wav|ogg|flac|m4a|aac|wma|aiff|alac)$/i.test(extension)) {
            pasteText = `&audio(${clipboardText})`;
          } else if (/^(www\.)?(youtube\.com|youtu\.be)$/.test(domain)) {
            pasteText = `&youtube(${clipboardText})`;
          } else if (/^(www\.)?(nicovideo\.jp|nico\.ms)$/.test(domain)) {
            pasteText = `&niconico(${clipboardText})`;
          } else if (/^(mobile\.)?(x|twitter|fxtwitter|vxtwitter|fixupx)\.com$/.test(domain)) {
            const tweetMatch = path.match(/^\/[\w\d_]+\/status(es)?\/(\d+)/);
            if (tweetMatch) {
              pasteText = `&twitter(${tweetMatch[2]})`;
            } else {
              const profileMatch = path.match(/^\/([\w\d_]+)$/);
              if (profileMatch) {
                pasteText = `&twitter_profile(${profileMatch[1]})`;
              }
            }
          } else {
            snippetController?.insert(`[[\${1:リンクテキスト}\${2|>,>>,>>>|}${clipboardText}]]`);
            return;
          }
        }

        insertTextAtCursor(monaco, editor, pasteText);
      } catch (error) {
        console.error('クリップボードの読み取りに失敗しました:', error);
      }
    },
    'editorTextFocus && !editorReadonly'
  );
}

function setupEditorContextMenu(monaco: MonacoNamespace, editor: Editor): void {
  editor.addAction({
    id: 'escape-html',
    label: 'Escape as HTML Entity',
    contextMenuGroupId: 'modification',
    contextMenuOrder: 1.5,
    run(ed) {
      const selections = ed.getSelections() ?? [ed.getSelection()!];
      const model = ed.getModel()!;
      const newSelections: monacoNs.Selection[] = new Array(selections.length);
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

      ed.pushUndoStop();
      selectionsWithIndex
        .slice()
        .reverse()
        .forEach(({ selection, index }) => {
          const selectedText = model.getValueInRange(selection);
          if (!selectedText) {
            newSelections[index] = selection;
            return;
          }

          const escapedText = escapeHTML(selectedText);
          const startOffset = model.getOffsetAt(selection.getStartPosition());
          ed.executeEdits('escape-html', [{ range: selection, text: escapedText }]);
          const endPosition = model.getPositionAt(startOffset + escapedText.length);
          newSelections[index] = new monaco.Selection(
            selection.getStartPosition().lineNumber,
            selection.getStartPosition().column,
            endPosition.lineNumber,
            endPosition.column
          );
        });
      ed.pushUndoStop();
      ed.setSelections(newSelections);
    },
  });

  editor.addAction({
    id: 'unescape-html',
    label: 'Unescape HTML Entity',
    contextMenuGroupId: 'modification',
    contextMenuOrder: 1.6,
    run(ed) {
      const selections = ed.getSelections() ?? [ed.getSelection()!];
      const model = ed.getModel()!;
      const newSelections: monacoNs.Selection[] = new Array(selections.length);
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

      ed.pushUndoStop();
      selectionsWithIndex
        .slice()
        .reverse()
        .forEach(({ selection, index }) => {
          const selectedText = model.getValueInRange(selection);
          if (!selectedText || !context.decodeHTMLEntities) {
            newSelections[index] = selection;
            return;
          }

          const unescapedText = context.decodeHTMLEntities(selectedText);
          const startOffset = model.getOffsetAt(selection.getStartPosition());
          ed.executeEdits('unescape-html', [{ range: selection, text: unescapedText }]);
          const endPosition = model.getPositionAt(startOffset + unescapedText.length);
          newSelections[index] = new monaco.Selection(
            selection.getStartPosition().lineNumber,
            selection.getStartPosition().column,
            endPosition.lineNumber,
            endPosition.column
          );
        });
      ed.pushUndoStop();
      ed.setSelections(newSelections);
    },
  });
}

export interface CreateEditorOptions {
  value?: string;
}

export function createEditor(
  monaco: MonacoNamespace,
  container: HTMLElement,
  { value = '' }: CreateEditorOptions = {}
): Editor {
  const editor = monaco.editor.create(container, {
    value,
    language: 'seesaawiki',
    theme: 'seesaawikiTheme',
    wordWrap: 'on',
    automaticLayout: true,
    bracketPairColorization: { enabled: true },
    renderLineHighlight: 'all',
    unicodeHighlight: {
      ambiguousCharacters: false,
      invisibleCharacters: false,
      nonBasicASCII: false,
    },
    wordSeparators:
      './\\()"\'-:,.;<>~!@#$%^&*|+=[]{}`~?。．、，　：；（）「」［］｛｝《》！？＜＞てにをはがのともへでや',
  } as monacoNs.editor.IStandaloneEditorConstructionOptions);

  setupEditorKeybindings(monaco, editor);
  setupEditorContextMenu(monaco, editor);

  return editor;
}
