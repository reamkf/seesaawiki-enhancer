import { describe, it, expect } from 'bun:test';
import { convertCharRef, decodeHTMLEntities, encodeEUCJP } from '../../src/utils/encoding.js';

describe('convertCharRef', () => {
  it('leaves ASCII characters as-is (they are in the non-escaped set)', () => {
    expect(convertCharRef('Foo Bar')).toBe('Foo Bar');
  });

  it('leaves common Japanese hiragana as-is', () => {
    expect(convertCharRef('あいうえお')).toBe('あいうえお');
  });

  it('escapes characters outside the non-escaped set as numeric refs', () => {
    // U+1F600 ("😀") is a surrogate pair; not in the non-escaped set.
    const result = convertCharRef('😀');
    expect(result).toMatch(/^(&#\d+;){2}$/);
  });

  it('returns empty string for empty input', () => {
    expect(convertCharRef('')).toBe('');
  });

  it('mixes literal and escaped output by character', () => {
    const result = convertCharRef('A😀B');
    expect(result.startsWith('A')).toBe(true);
    expect(result.endsWith('B')).toBe(true);
    expect(result).toMatch(/&#\d+;/);
  });
});

describe('encodeEUCJP', () => {
  it('leaves ASCII unreserved characters as-is (like real wiki URLs)', () => {
    expect(encodeEUCJP('A')).toBe('A');
    expect(encodeEUCJP('Foo')).toBe('Foo');
    expect(encodeEUCJP('a-z_0.~')).toBe('a-z_0.~');
  });

  it('encodes space as %20', () => {
    expect(encodeEUCJP('a b')).toBe('a%20b');
  });

  it('encodes hiragana as multi-byte EUC-JP percent escapes in lowercase', () => {
    expect(encodeEUCJP('あ')).toBe('%a4%a2');
  });

  it('encodes Japanese phrase correctly', () => {
    // "日本語" in EUC-JP: 0xC6FC 0xCBDC 0xB8EC
    expect(encodeEUCJP('日本語')).toBe('%c6%fc%cb%dc%b8%ec');
  });

  it('returns empty string for empty input', () => {
    expect(encodeEUCJP('')).toBe('');
  });

  it('lowercases hex digits', () => {
    expect(encodeEUCJP('あ')).toBe(encodeEUCJP('あ').toLowerCase());
  });
});

describe('decodeHTMLEntities', () => {
  it('decodes named HTML entities', () => {
    expect(decodeHTMLEntities('&amp;')).toBe('&');
    expect(decodeHTMLEntities('&lt;')).toBe('<');
    expect(decodeHTMLEntities('&gt;')).toBe('>');
    expect(decodeHTMLEntities('&quot;')).toBe('"');
  });

  it('decodes numeric character references', () => {
    expect(decodeHTMLEntities('&#65;')).toBe('A');
    expect(decodeHTMLEntities('&#x41;')).toBe('A');
  });

  it('leaves plain text unchanged', () => {
    expect(decodeHTMLEntities('plain text')).toBe('plain text');
  });

  it('decodes multiple entities in one string', () => {
    expect(decodeHTMLEntities('a&amp;b&lt;c')).toBe('a&b<c');
  });

  it('with stripAnchors=true, strips anchors and keeps text content', () => {
    const result = decodeHTMLEntities('see <a href="x">here</a>', { stripAnchors: true });
    expect(result).toBe('see here');
  });

  it('with stripAnchors=true, handles multiple anchors', () => {
    const result = decodeHTMLEntities('<a>one</a> and <a>two</a>', { stripAnchors: true });
    expect(result).toBe('one and two');
  });

  it('with stripAnchors=true, decodes entities outside anchors', () => {
    const result = decodeHTMLEntities('&amp; <a href="x">link</a>', { stripAnchors: true });
    expect(result).toBe('& link');
  });
});
