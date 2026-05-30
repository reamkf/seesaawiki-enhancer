import { wrapSelectedText, insertAtBeginningOfLine, escapeHTML } from './helpers.js';
import { context } from './context.js';

function getTableCellRanges(monaco, editor, lineNumber) {
  const model = editor.getModel();
  const lineContent = model.getLineContent(lineNumber);

  const tableMatch = lineContent.match(/^\|([^|]*\|)+c?$/);
  if (!tableMatch) return null;

  const cellContents = lineContent.split('|');
  const cellRanges = [];

  let cellStart = 1;
  let cellEnd;

  for (let i = 0; i < cellContents.length; i++) {
    cellEnd = cellStart + cellContents[i].length;
    cellRanges.push(new monaco.Range(lineNumber, cellStart, lineNumber, cellEnd));
    cellStart = cellEnd + 1;
  }

  return cellRanges;
}

function insertTextAtCursor(monaco, editor, text) {
  const selection = editor.getSelection();
  const range = selection.isEmpty()
    ? new monaco.Range(
        selection.startLineNumber,
        selection.startColumn,
        selection.startLineNumber,
        selection.startColumn
      )
    : selection;

  editor.pushUndoStop();
  editor.executeEdits('my-source', [
    {
      range,
      text,
      forceMoveMarkers: true,
    },
  ]);
  editor.pushUndoStop();
}

function setupEditorKeybindings(monaco, editor) {
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
      const model = editor.getModel();
      const position = editor.getPosition();
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
      const position = editor.getPosition();
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
      const model = editor.getModel();
      const position = editor.getPosition();
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
          let targetRange;
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
      const model = editor.getModel();
      const position = editor.getPosition();
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
          let targetRange;
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

        const snippetController = editor.getContribution('snippetController2');

        if (/^(https?:\/\/[^\s/$.?#].[^\s]*)$/i.test(pasteText)) {
          const url = new URL(pasteText);
          const domain = url.hostname;
          const path = url.pathname;
          const extension = path.split('.').pop();

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
            snippetController.insert(`[[\${1:リンクテキスト}\${2|>,>>,>>>|}${clipboardText}]]`);
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

function setupEditorContextMenu(editor) {
  editor.addAction({
    id: 'escape-html',
    label: 'Escape as HTML Entity',
    contextMenuGroupId: 'modification',
    contextMenuOrder: 1.5,
    run: function (ed) {
      const selection = ed.getSelection();
      const selectedText = ed.getModel().getValueInRange(selection);

      if (selectedText) {
        const escapedText = escapeHTML(selectedText);
        ed.executeEdits('escape-html', [{ range: selection, text: escapedText }]);
      }
    },
  });

  editor.addAction({
    id: 'unescape-html',
    label: 'Unescape HTML Entity',
    contextMenuGroupId: 'modification',
    contextMenuOrder: 1.6,
    run: function (ed) {
      const selection = ed.getSelection();
      const selectedText = ed.getModel().getValueInRange(selection);

      if (selectedText && context.decodeHTMLEntities) {
        const unescapedText = context.decodeHTMLEntities(selectedText);
        ed.executeEdits('unescape-html', [{ range: selection, text: unescapedText }]);
      }
    },
  });
}

export function createEditor(monaco, container, { value = '' } = {}) {
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
    find: { return: false },
    wordSeparators:
      './\\()"\'-:,.;<>~!@#$%^&*|+=[]{}`~?。．、，　：；（）「」［］｛｝《》！？＜＞てにをはがのともへでや',
  });

  setupEditorKeybindings(monaco, editor);
  setupEditorContextMenu(editor);

  return editor;
}
