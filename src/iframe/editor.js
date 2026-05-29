import {
  wrapSelectedText,
  insertAtBeginningOfLine,
  escapeHTML,
  decodeHTMLEntities,
} from './helpers.js';

function getTableCellRanges(_w, lineNumber) {
  const model = _w.monacoEditor.getModel();
  const lineContent = model.getLineContent(lineNumber);

  const tableMatch = lineContent.match(/^\|([^|]*\|)+c?$/);
  if (tableMatch) {
    const cellContents = lineContent.split('|');
    const cellRanges = [];

    let cellStart = 1;
    let cellEnd;

    for (let i = 0; i < cellContents.length; i++) {
      cellEnd = cellStart + cellContents[i].length;
      cellRanges.push(
        new _w.monaco.Range(lineNumber, cellStart, lineNumber, cellEnd)
      );
      cellStart = cellEnd + 1;
    }

    return cellRanges;
  } else {
    return null;
  }
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

function setupEditorKeybindings(_w) {
  const monaco = _w.monaco;
  _w.monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyB, () => {
    wrapSelectedText(monaco, _w.monacoEditor, "''", "''");
  });

  _w.monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyI, () => {
    wrapSelectedText(monaco, _w.monacoEditor, "'''", "'''");
  });

  _w.monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyU, () => {
    wrapSelectedText(monaco, _w.monacoEditor, '%%%', '%%%');
  });

  _w.monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyD, () => {
    wrapSelectedText(monaco, _w.monacoEditor, '%%', '%%');
  });

  _w.monacoEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyK, () => {
    wrapSelectedText(monaco, _w.monacoEditor, '[[', ']]');
  });

  _w.monacoEditor.addCommand(
    monaco.KeyCode.Enter,
    () => {
      const model = _w.monacoEditor.getModel();
      const position = _w.monacoEditor.getPosition();
      const lineContent = model.getLineContent(position.lineNumber);

      const bulletMatch = lineContent.match(/^((?:-|\+){1,3})(?!-)(.*)$/);
      if (bulletMatch) {
        const [, bullet, content] = bulletMatch;
        if (content.trim() != '') {
          const nextLineContent = bullet;
          _w.monacoEditor.executeEdits('', [
            {
              range: new monaco.Range(
                position.lineNumber,
                position.column,
                position.lineNumber,
                position.column
              ),
              text: '\n' + nextLineContent,
            },
          ]);
          _w.monacoEditor.setPosition({
            lineNumber: position.lineNumber + 1,
            column: nextLineContent.length + 1,
          });
        } else {
          _w.monacoEditor.executeEdits('', [
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

      const cellRanges = getTableCellRanges(_w, position.lineNumber);
      if (cellRanges) {
        if (position.column === lineContent.length + 1) {
          _w.monacoEditor.trigger('keyboard', 'type', { text: '\n' });
        } else {
          const nextLineNumber = position.lineNumber + 1;
          if (nextLineNumber <= model.getLineCount()) {
            const nextCellRanges = getTableCellRanges(_w, nextLineNumber);
            const currentCellIndex = cellRanges.findIndex((cell) =>
              cell.containsPosition(position)
            );
            if (nextCellRanges && nextCellRanges.length - 1 >= currentCellIndex) {
              const targetRange = nextCellRanges[currentCellIndex];
              _w.monacoEditor.setSelection(targetRange);
              _w.monacoEditor.revealPositionInCenterIfOutsideViewport(
                targetRange.getStartPosition()
              );
            }
          }
        }
        return;
      }

      if (lineContent.startsWith('>') || lineContent.startsWith(' ')) {
        const content = lineContent.slice(1).trim();
        if (content != '') {
          _w.monacoEditor.executeEdits('', [
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
          _w.monacoEditor.setPosition({
            lineNumber: position.lineNumber + 1,
            column: 2,
          });
        } else {
          _w.monacoEditor.executeEdits('', [
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

      _w.monacoEditor.trigger('keyboard', 'type', { text: '\n' });
    },
    'editorTextFocus && !editorReadonly && !editorTabMovesFocus && !suggestWidgetHasFocusedSuggestion && !suggestWidgetVisible && !hasNextTabstop && !inSnippetMode'
  );

  _w.monacoEditor.addCommand(
    monaco.KeyMod.Shift | monaco.KeyCode.Enter,
    () => {
      const position = _w.monacoEditor.getPosition();

      const cellRanges = getTableCellRanges(_w, position.lineNumber);
      if (cellRanges) {
        const prevLineNumber = position.lineNumber - 1;
        if (prevLineNumber > 0) {
          const prevCellRanges = getTableCellRanges(_w, prevLineNumber);
          const currentCellIndex = cellRanges.findIndex((cell) =>
            cell.containsPosition(position)
          );
          if (prevCellRanges && prevCellRanges.length - 1 >= currentCellIndex) {
            const targetRange = prevCellRanges[currentCellIndex];
            _w.monacoEditor.setSelection(targetRange);
            _w.monacoEditor.revealPositionInCenterIfOutsideViewport(
              targetRange.getStartPosition()
            );
          }
        }
        return;
      }

      _w.monacoEditor.trigger('keyboard', 'type', { text: '\n' });
    },
    'editorTextFocus && !editorReadonly && !editorTabMovesFocus && !suggestWidgetHasFocusedSuggestion && !suggestWidgetVisible'
  );

  _w.monacoEditor.addCommand(
    monaco.KeyCode.Tab,
    () => {
      const model = _w.monacoEditor.getModel();
      const position = _w.monacoEditor.getPosition();
      const lineContent = model.getLineContent(position.lineNumber);

      const bulletMatch = lineContent.match(/^((?:-|\+){1,3})(?!-)(.*)$/);
      if (bulletMatch) {
        const [, bullet] = bulletMatch;
        if (bullet.length < 3) {
          _w.monacoEditor.executeEdits('', [
            {
              range: new monaco.Range(position.lineNumber, 1, position.lineNumber, 1),
              text: bullet[0],
            },
          ]);
        }
        return;
      }

      const cellRanges = getTableCellRanges(_w, position.lineNumber);
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
              const nextCellRanges = getTableCellRanges(_w, nextLineNumber);
              if (nextCellRanges) {
                targetRange = nextCellRanges[0];
              }
            }
          }

          if (targetRange) {
            _w.monacoEditor.setSelection(targetRange);
            _w.monacoEditor.revealPositionInCenterIfOutsideViewport(
              targetRange.getStartPosition()
            );
          }
        }
        return;
      }

      _w.monacoEditor.trigger('keyboard', 'tab', {});
    },
    'editorTextFocus && !editorReadonly && !editorTabMovesFocus && !suggestWidgetHasFocusedSuggestion && !suggestWidgetVisible && !hasNextTabstop && !inSnippetMode'
  );

  _w.monacoEditor.addCommand(
    monaco.KeyMod.Shift | monaco.KeyCode.Tab,
    () => {
      const model = _w.monacoEditor.getModel();
      const position = _w.monacoEditor.getPosition();
      const lineContent = model.getLineContent(position.lineNumber);

      const bulletMatch = lineContent.match(/^((?:-|\+){1,3})(\s*)([^-]*)$/);
      if (bulletMatch) {
        const [, bullet] = bulletMatch;
        if (bullet.length > 1) {
          _w.monacoEditor.executeEdits('', [
            {
              range: new monaco.Range(position.lineNumber, 1, position.lineNumber, 2),
              text: '',
            },
          ]);
        }
        return;
      }

      const cellRanges = getTableCellRanges(_w, position.lineNumber);
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
              const prevCellRanges = getTableCellRanges(_w, prevLineNumber);
              if (prevCellRanges) {
                targetRange = prevCellRanges[prevCellRanges.length - 1];
              }
            }
          }

          if (targetRange) {
            _w.monacoEditor.setSelection(targetRange);
            _w.monacoEditor.revealPositionInCenterIfOutsideViewport(
              targetRange.getStartPosition()
            );
          }
        }
        return;
      }

      _w.monacoEditor.trigger('keyboard', 'outdent', {});
    },
    'editorTextFocus && !editorReadonly && !editorTabMovesFocus && !suggestWidgetHasFocusedSuggestion && !suggestWidgetVisible && !hasNextTabstop && !inSnippetMode'
  );

  _w.monacoEditor.addCommand(
    monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyV,
    async () => {
      try {
        const clipboardText = await navigator.clipboard.readText();
        let pasteText = clipboardText.trim();

        const snippetController = _w.monacoEditor.getContribution('snippetController2');

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
            snippetController.insert(
              `[[\${1:リンクテキスト}\${2|>,>>,>>>|}${clipboardText}]]`
            );
            return;
          }
        }

        insertTextAtCursor(monaco, _w.monacoEditor, pasteText);
      } catch (error) {
        console.error('クリップボードの読み取りに失敗しました:', error);
      }
    },
    'editorTextFocus && !editorReadonly'
  );
}

function setupEditorContextMenu(_w) {
  const _decodeHTMLEntities =
    (window.parent && window.parent.decodeHTMLEntities) || decodeHTMLEntities;

  _w.monacoEditor.addAction({
    id: 'escape-html',
    label: 'Escape as HTML Entity',
    contextMenuGroupId: 'modification',
    contextMenuOrder: 1.5,
    run: function (ed) {
      const selection = ed.getSelection();
      const selectedText = ed.getModel().getValueInRange(selection);

      if (selectedText) {
        const escapedText = escapeHTML(selectedText);
        ed.executeEdits('escape-html', [
          {
            range: selection,
            text: escapedText,
          },
        ]);
      }
    },
  });

  _w.monacoEditor.addAction({
    id: 'unescape-html',
    label: 'Unescape HTML Entity',
    contextMenuGroupId: 'modification',
    contextMenuOrder: 1.6,
    run: function (ed) {
      const selection = ed.getSelection();
      const selectedText = ed.getModel().getValueInRange(selection);

      if (selectedText) {
        const unescapedText = _decodeHTMLEntities(selectedText);
        ed.executeEdits('unescape-html', [
          {
            range: selection,
            text: unescapedText,
          },
        ]);
      }
    },
  });
}

function setupEditorToolbarBindings(_w) {
  const parentDocument = window.parent.document;
  const monaco = _w.monaco;

  const bind = (selector, handler, byClass = false) => {
    const el = byClass
      ? parentDocument.getElementsByClassName(selector)[0]
      : parentDocument.getElementById(selector);
    if (el) el.addEventListener('click', handler);
  };

  bind('bt-undo', () => _w.monacoEditor.trigger('source', 'undo'), true);
  bind('bt-redo', () => _w.monacoEditor.trigger('source', 'redo'), true);
  bind('bold', () => wrapSelectedText(monaco, _w.monacoEditor, "''", "''"));
  bind('italic', () => wrapSelectedText(monaco, _w.monacoEditor, "'''", "'''"));
  bind('underline', () => wrapSelectedText(monaco, _w.monacoEditor, '%%%', '%%%'));
  bind('ul', () => insertAtBeginningOfLine(monaco, _w.monacoEditor, '-', 3));
  bind('ol', () => insertAtBeginningOfLine(monaco, _w.monacoEditor, '+', 3));
  bind('h2', () => insertAtBeginningOfLine(monaco, _w.monacoEditor, '+', 3));
  bind('strike', () => wrapSelectedText(monaco, _w.monacoEditor, '%%', '%%'));
  bind('toggle_open', () =>
    wrapSelectedText(monaco, _w.monacoEditor, '[+]\n', '\n[END]')
  );
  bind('toggle_close', () =>
    wrapSelectedText(monaco, _w.monacoEditor, '[-]\n', '\n[END]')
  );
  bind('blockquote', () =>
    insertAtBeginningOfLine(monaco, _w.monacoEditor, '>', 1)
  );
  bind('annotation', () => wrapSelectedText(monaco, _w.monacoEditor, '((', '))'));
}

export function replaceTextareaWithMonaco(_w, value = '') {
  const monacoEditor = _w.monaco.editor.create(
    _w.document.getElementById('monaco-editor-container'),
    {
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
    }
  );
  _w.monacoEditor = monacoEditor;

  setupEditorKeybindings(_w);
  setupEditorContextMenu(_w);
  setupEditorToolbarBindings(_w);

  return monacoEditor;
}
