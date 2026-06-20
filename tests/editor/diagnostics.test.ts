import { describe, it, expect } from 'bun:test';
import { computeSeesaawikiDiagnostics } from '../../src/editor/diagnostics.js';

const diag = (text: string) =>
  computeSeesaawikiDiagnostics(text.split('\n'));

describe('computeSeesaawikiDiagnostics', () => {
  it('returns no diagnostics for a well-formed simple block', () => {
    expect(diag(['[+]Title', 'content', '[END]'].join('\n'))).toEqual([]);
  });

  it('returns no diagnostics for well-formed nested blocks', () => {
    expect(
      diag(
        [
          '[+]Outer',
          '[+]Inner',
          'content',
          '[END]',
          '[END]',
        ].join('\n')
      )
    ).toEqual([]);
  });

  it('flags a single missing [END]', () => {
    const diagnostics = diag(['[+]Title', 'content1', 'content2'].join('\n'));
    expect(diagnostics).toEqual([
      {
        line: 1,
        startColumn: 1,
        endColumn: 4,
        message: '[+] に対応する [END] が見つかりません。',
      },
    ]);
  });

  it('flags both unclosed openers when all [END] tags are missing', () => {
    const diagnostics = diag(
      ['[+]Outer', '[+]Inner', 'content'].join('\n')
    );
    expect(diagnostics).toEqual([
      {
        line: 1,
        startColumn: 1,
        endColumn: 4,
        message: '[+] に対応する [END] が見つかりません。',
      },
      {
        line: 2,
        startColumn: 1,
        endColumn: 4,
        message: '[+] に対応する [END] が見つかりません。',
      },
    ]);
  });

  it('flags only the outer opener when the inner block is closed but the outer is not', () => {
    const diagnostics = diag(
      [
        '[+]Outer',
        '[+]Inner',
        'content',
        '[END]',
        'tail',
      ].join('\n')
    );
    expect(diagnostics).toEqual([
      {
        line: 1,
        startColumn: 1,
        endColumn: 4,
        message: '[+] に対応する [END] が見つかりません。',
      },
    ]);
  });

  it('flags a stray [END] with no matching opener', () => {
    const diagnostics = diag(['content', '[END]'].join('\n'));
    expect(diagnostics).toEqual([
      {
        line: 2,
        startColumn: 1,
        endColumn: 6,
        message: '対応する [+] または [-] が見つかりません。',
      },
    ]);
  });

  it('recognises [-] as an opener', () => {
    expect(
      diag(['[-]Title', 'content', '[END]'].join('\n'))
    ).toEqual([]);
    const missing = diag(['[-]Title', 'content'].join('\n'));
    expect(missing).toEqual([
      {
        line: 1,
        startColumn: 1,
        endColumn: 4,
        message: '[-] に対応する [END] が見つかりません。',
      },
    ]);
  });

  it('returns an empty array when there are no folding markers', () => {
    expect(diag(['plain', 'text', '*heading'].join('\n'))).toEqual([]);
  });
});
