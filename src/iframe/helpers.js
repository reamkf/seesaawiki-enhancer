export function encodeEUCJP(str) {
  const Encoding = (window.parent && window.parent.Encoding) || window.Encoding;
  const eucjpArray = Encoding.convert(Encoding.stringToCode(str), 'EUCJP', 'UNICODE');
  let result = '';
  for (let i = 0; i < eucjpArray.length; i++) {
    result += '%' + eucjpArray[i].toString(16).padStart(2, '0').toUpperCase();
  }
  return result;
}

export function decodeHTMLEntities(text) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

export function escapeHTML(text) {
  return text
    .split('')
    .map((char) => `&#${char.charCodeAt(0)};`)
    .join('');
}

export function wrapSelectedText(monaco, editor, prefix, suffix) {
  const selection = editor.getSelection();
  const selectedText = editor.getModel().getValueInRange(selection);

  if (selectedText) {
    if (selectedText.startsWith(prefix) && selectedText.endsWith(suffix)) {
      editor.executeEdits('', [
        {
          range: selection,
          text: selectedText.slice(prefix.length, selectedText.length - suffix.length),
        },
      ]);
    } else {
      editor.executeEdits('', [
        {
          range: selection,
          text: prefix + selectedText + suffix,
        },
      ]);
    }
  } else {
    const position = editor.getPosition();
    editor.executeEdits('', [
      {
        range: new monaco.Range(
          position.lineNumber,
          position.column,
          position.lineNumber,
          position.column
        ),
        text: prefix + suffix,
      },
    ]);
    editor.setPosition({
      lineNumber: position.lineNumber,
      column: position.column + prefix.length,
    });
  }
}

export function insertAtBeginningOfLine(monaco, editor, prefix, maxLevel = 1) {
  const selection = editor.getSelection();
  const position = selection.getStartPosition();
  const line = editor.getModel().getLineContent(position.lineNumber);
  const regex = new RegExp(`^\\${prefix}{0,${maxLevel}}`);
  const currentLevel = line.match(regex)[0].length;
  if (currentLevel < maxLevel) {
    editor.executeEdits('', [
      {
        range: new monaco.Range(position.lineNumber, 1, position.lineNumber, 1),
        text: prefix,
      },
    ]);
  }
}
