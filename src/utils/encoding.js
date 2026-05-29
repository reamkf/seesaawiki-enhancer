import Encoding from 'encoding-japanese';
import { nonEscapedCharSet } from '../nonEscapedChars.js';

export function convertCharRef(s) {
  return s
    .split('')
    .map((char) =>
      nonEscapedCharSet.has(char) ? char : `&#${char.charCodeAt(0)};`
    )
    .join('');
}

export function decodeHTMLEntities(text) {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}

export function encodeEUCJP(str) {
  const eucjpArray = Encoding.convert(Encoding.stringToCode(str), 'EUCJP', 'UNICODE');
  let result = '';
  for (let i = 0; i < eucjpArray.length; i++) {
    result += '%' + eucjpArray[i].toString(16).padStart(2, '0').toUpperCase();
  }
  return result;
}
