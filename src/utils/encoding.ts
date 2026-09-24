import Encoding from 'encoding-japanese';
import { nonEscapedCharSet } from '../nonEscapedChars.js';

export function convertCharRef(s: string): string {
  return s
    .split('')
    .map((char) =>
      nonEscapedCharSet.has(char) ? char : `&#${char.charCodeAt(0)};`
    )
    .join('');
}

export interface DecodeHTMLEntitiesOptions {
  stripAnchors?: boolean;
}

export function decodeHTMLEntities(
  text: string,
  options: DecodeHTMLEntitiesOptions = {}
): string {
  const { stripAnchors = false } = options;
  let html = text;

  if (stripAnchors) {
    const container = document.createElement('div');
    container.innerHTML = html;
    container.querySelectorAll('a').forEach((anchor) => {
      const textNode = document.createTextNode(anchor.textContent ?? '');
      anchor.replaceWith(textNode);
    });
    html = container.innerHTML;
  }

  const textarea = document.createElement('textarea');
  textarea.innerHTML = html;
  return textarea.value;
}

export type DecodeHTMLEntitiesFn = typeof decodeHTMLEntities;

export function encodeEUCJP(str: string): string {
  // 実ページのURL形式に合わせる: unreserved文字は素通し、
  // それ以外はEUC-JPバイト列を小文字%XXで表す。
  let result = '';
  for (const ch of str) {
    if (/[A-Za-z0-9\-_.~]/.test(ch)) {
      result += ch;
      continue;
    }
    // 波ダッシュ問題: PHPのEUC-JP変換に合わせてU+301Cは0xA1C1にする
    // (encoding-japaneseはJIS X 0213の0x8FA1C1を返してしまう)
    if (ch === '〜') {
      result += '%a1%c1';
      continue;
    }
    const bytes = Encoding.convert(Encoding.stringToCode(ch), 'EUCJP', 'UNICODE');
    for (let i = 0; i < bytes.length; i++) {
      result += '%' + bytes[i].toString(16).padStart(2, '0');
    }
  }
  return result;
}
