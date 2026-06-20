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

  describe('tables', () => {
    it('accepts a well-formed table', () => {
      expect(
        diag(['|name|value|', '|a|1|', '|b|2|'].join('\n'))
      ).toEqual([]);
    });

    it('accepts a header row ending with |c', () => {
      expect(
        diag(['|name|value|c', '|a|1|', '|b|2|'].join('\n'))
      ).toEqual([]);
    });

    it('flags a row that starts with | but does not end with | or |c', () => {
      const diagnostics = diag(['|a|b|', '|broken'].join('\n'));
      expect(diagnostics).toEqual([
        {
          line: 2,
          startColumn: 1,
          endColumn: '|broken'.length + 1,
          message: '表の行は | または |c で終わる必要があります。',
        },
      ]);
    });

    it('does not flag a blank line between two implicit table rows (the blank ends the table)', () => {
      expect(diag(['|a|b|', '', '|c|d|'].join('\n'))).toEqual([]);
    });

    it('flags a non-row line between two table rows', () => {
      const diagnostics = diag(
        ['|a|b|', 'intrusion', '|c|d|'].join('\n')
      );
      expect(diagnostics).toEqual([
        {
          line: 2,
          startColumn: 1,
          endColumn: 'intrusion'.length + 1,
          message: '表の途中に | で囲まれていない行があります。',
        },
      ]);
    });

    it('does not flag non-row lines that follow the last table row', () => {
      expect(
        diag(['|a|b|', '|c|d|', '', 'paragraph'].join('\n'))
      ).toEqual([]);
    });

    it('does not flag non-row lines that precede the first table row', () => {
      expect(
        diag(['paragraph', '', '|a|b|', '|c|d|'].join('\n'))
      ).toEqual([]);
    });

    describe('{|...|} block syntax', () => {
      it('does not flag a well-formed {|...|} block', () => {
        expect(
          diag(
            [
              '{| class="custom-css" style="table-layout: fixed;"',
              '|a|b|',
              '|c|d|',
              '|}',
            ].join('\n')
          )
        ).toEqual([]);
      });

      it('does not flag the closing |} line as a malformed row', () => {
        expect(diag(['{|', '|a|b|', '|}'].join('\n'))).toEqual([]);
      });

      it('reproduces the user-reported block without false positives', () => {
        const block = [
          '{| class="custom-css" style="table-layout: fixed;"',
          '|r[bgcolor(#cccccc)]:~center:月曜日|center:火曜日|center:水曜日|center:木曜日|',
          '|r[bgcolor(#f8f8f8)]:center:&ref(a.png,70,no_link)|center:&ref(b.png,70,no_link)|center:&ref(c.png,70,no_link)|center:&ref(d.png,70,no_link)|',
          '|くたくた攻撃|すやすや攻撃|どく攻撃|からげんき攻撃|',
          '|r[bgcolor(#cccccc)]:~center:金曜日|center:土曜日|center:日曜日|',
          '|ひやひや攻撃|くたくた攻撃|びりびり攻撃|',
          '|}',
        ];
        expect(diag(block.join('\n'))).toEqual([]);
      });

      it('still flags a blank line inside a {|...|} block', () => {
        const diagnostics = diag(
          ['{|', '|a|b|', '', '|c|d|', '|}'].join('\n')
        );
        expect(diagnostics).toEqual([
          {
            line: 3,
            startColumn: 1,
            endColumn: 2,
            message: '表の途中に空行があります。',
          },
        ]);
      });

      it('still flags a non-row line inside a {|...|} block before the closer', () => {
        const diagnostics = diag(
          ['{|', '|a|b|', 'intruder', '|}'].join('\n')
        );
        expect(diagnostics).toEqual([
          {
            line: 3,
            startColumn: 1,
            endColumn: 'intruder'.length + 1,
            message: '表の途中に | で囲まれていない行があります。',
          },
        ]);
      });
    });

    it('flags only the malformed row when an implicit table is interrupted by a blank line', () => {
      const diagnostics = diag(
        [
          '|a|b|', // 1 ok
          '', // 2 blank — ends implicit table (no error)
          'middle', // 3 outside any table (no error)
          '|broken', // 4 malformed row — error
          '|c|d|', // 5 ok
        ].join('\n')
      );
      expect(diagnostics).toEqual([
        {
          line: 4,
          startColumn: 1,
          endColumn: '|broken'.length + 1,
          message: '表の行は | または |c で終わる必要があります。',
        },
      ]);
    });

    it('flags only the non-row intruder when an implicit table has no blank separator', () => {
      const diagnostics = diag(
        ['|a|b|', 'intrusion', '|c|d|'].join('\n')
      );
      expect(diagnostics).toEqual([
        {
          line: 2,
          startColumn: 1,
          endColumn: 'intrusion'.length + 1,
          message: '表の途中に | で囲まれていない行があります。',
        },
      ]);
    });
  });
});
