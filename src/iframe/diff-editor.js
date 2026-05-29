export function createSeesaawikiDiffEditor(monaco, oldContent, newContent) {
  const container = document.getElementById('monaco-editor-container');
  const diffEditor = monaco.editor.createDiffEditor(container, {
    readOnly: true,
    renderSideBySide: false,
    automaticLayout: true,
    theme: 'seesaawikiTheme',
    wordWrap: 'on',
    scrollBeyondLastLine: false,
    unicodeHighlight: {
      ambiguousCharacters: false,
      invisibleCharacters: false,
      nonBasicASCII: false,
    },
    wordSeparators:
      './\\()"\'-:,.;<>~!@#$%^&*|+=[]{}`~?。．、，　：；（）「」［］｛｝《》！？＜＞てにをはがのともへでや',
  });

  const originalModel = monaco.editor.createModel(oldContent, 'seesaawiki');
  const modifiedModel = monaco.editor.createModel(newContent, 'seesaawiki');

  diffEditor.setModel({
    original: originalModel,
    modified: modifiedModel,
  });

  return diffEditor;
}
