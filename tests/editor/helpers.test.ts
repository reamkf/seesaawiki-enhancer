import { describe, it, expect } from 'bun:test';
import { escapeHTML } from '../../src/editor/helpers.js';

describe('escapeHTML', () => {
  it('converts ASCII characters to numeric character references', () => {
    expect(escapeHTML('A')).toBe('&#65;');
  });

  it('converts every character independently', () => {
    expect(escapeHTML('AB')).toBe('&#65;&#66;');
  });

  it('handles symbols (&, <, >)', () => {
    expect(escapeHTML('<')).toBe('&#60;');
    expect(escapeHTML('>')).toBe('&#62;');
    expect(escapeHTML('&')).toBe('&#38;');
  });

  it('handles whitespace', () => {
    expect(escapeHTML(' ')).toBe('&#32;');
    expect(escapeHTML('\n')).toBe('&#10;');
  });

  it('handles Japanese characters using code points', () => {
    expect(escapeHTML('あ')).toBe(`&#${'あ'.charCodeAt(0)};`);
  });

  it('returns empty string for empty input', () => {
    expect(escapeHTML('')).toBe('');
  });

  it('produces output that decodes back to the original string', () => {
    const original = 'Hello <world> & "friends"';
    const escaped = escapeHTML(original);
    const textarea = document.createElement('textarea');
    textarea.innerHTML = escaped;
    expect(textarea.value).toBe(original);
  });
});
