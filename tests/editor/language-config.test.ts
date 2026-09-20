import { afterAll, describe, expect, it } from 'bun:test';
import type * as monacoNs from 'monaco-editor';
// @ts-expect-error - Monaco's internal Monarch modules have no type declarations.
import { compile } from 'monaco-editor/esm/vs/editor/standalone/common/monarch/monarchCompile.js';
// @ts-expect-error - Monaco's internal Monarch modules have no type declarations.
import { MonarchTokenizer } from 'monaco-editor/esm/vs/editor/standalone/common/monarch/monarchLexer.js';
import { setupSeesaawikiTokens } from '../../src/editor/language-config.js';

let language!: monacoNs.languages.IMonarchLanguage;
setupSeesaawikiTokens({
  languages: {
    setMonarchTokensProvider(_id: string, definition: monacoNs.languages.IMonarchLanguage) {
      language = definition;
    },
  },
} as unknown as typeof monacoNs);

const tokenizer = new MonarchTokenizer({}, {}, 'seesaawiki', compile('seesaawiki', language), {
  getValue: () => 20000,
  onDidChangeConfiguration: () => ({ dispose() {} }),
});
afterAll(() => tokenizer.dispose());

function tokenize(lines: string[]) {
  let state = tokenizer.getInitialState();
  const tokens = lines.map((line) => {
    const result = tokenizer.tokenize(line, true, state);
    state = result.endState;
    return result.tokens as { offset: number; type: string }[];
  });
  return { tokens, state };
}

function tokenAt(tokens: { offset: number; type: string }[], offset: number) {
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].offset <= offset) return tokens[i].type;
  }
}

describe('Seesaa Wiki Monarch tokenizer', () => {
  it.each([
    "''bold''", "'''italic'''", '%%%underline%%%', '%%deleted%%',
    '&size(20){large}', '&color(red){red}',
    '&color(red){&size(20){nested}}', '&size(20){&color(blue){nested}}',
    '&color(red){&color(blue){nested}}',
  ])('returns to the table after %s', (content) => {
    const line = `|${content}|center:next|c`;
    const { tokens, state } = tokenize([line]);
    expect(tokenAt(tokens[0], line.indexOf('|center'))).toBe('keyword.control.seesaawiki');
    expect(tokenAt(tokens[0], line.indexOf('center:'))).toBe('keyword.parameter.seesaawiki');
    expect(tokenAt(tokens[0], line.length - 1)).toBe('keyword.control.seesaawiki');
    expect(state.equals(tokenizer.getInitialState())).toBe(true);
  });

  it('does not accumulate states across many decorated rows', () => {
    const lines = Array.from({ length: 200 }, () => "|''bold''|&color(red){&size(20){nested}}|");
    const { state } = tokenize(lines);
    expect(state.equals(tokenizer.getInitialState())).toBe(true);
  });

  it('returns from deeply nested color and size expressions to the cell', () => {
    const content = '&color(red){&size(20){'.repeat(20) + "''nested''" + '}}'.repeat(20);
    const line = `|${content}|right:next|`;
    const { tokens, state } = tokenize([line]);
    expect(tokenAt(tokens[0], line.indexOf('right:'))).toBe('keyword.parameter.seesaawiki');
    expect(state.equals(tokenizer.getInitialState())).toBe(true);
  });

  it.each(['|unfinished', '|r[bgcolor(red)', '|'])('recovers on the next line after %s', (line) => {
    const { tokens, state } = tokenize([line, '', 'center: plain', '|left:cell|']);
    expect(tokenAt(tokens[2], 0)).not.toBe('keyword.parameter.seesaawiki');
    expect(tokenAt(tokens[3], 1)).toBe('keyword.parameter.seesaawiki');
    expect(state.equals(tokenizer.getInitialState())).toBe(true);
  });

  it.each(['red', '#abc', '#aabbcc', '#aabbccdd'])('highlights the entire color %s', (color) => {
    const { tokens, state } = tokenize([`&color(${color}){text}`]);
    for (let i = 7; i < 7 + color.length; i++) {
      expect(tokenAt(tokens[0], i)).toBe('constant.other.colorcode.seesaawiki');
    }
    expect(state.equals(tokenizer.getInitialState())).toBe(true);
  });

  it('keeps links, references, and row parameters inside the table', () => {
    const line = '|r[bgcolor(#cccccc)]:~center:[[label>Page]]|&ref(image.png,70,no_link)|';
    const { tokens, state } = tokenize([line]);
    expect(tokenAt(tokens[0], line.indexOf('bgcolor'))).toBe('keyword.parameter.seesaawiki');
    expect(tokenAt(tokens[0], line.indexOf('label'))).toBe('markup.underline.link.seesaawiki');
    expect(tokenAt(tokens[0], line.indexOf('70'))).toBe('number.seesaawiki');
    expect(state.equals(tokenizer.getInitialState())).toBe(true);
  });

  it('tokenizes an image and decorated label inside a table link', () => {
    const url = 'https://image02.seesaawiki.jp/k/h/kemono_friends3_5ch/UEXm5ELgn2.png';
    const line = `|[[&ref(${url},55,no_link)~~''ドール''>ドール]]|はなまるの副隊長！|`;
    const { tokens, state } = tokenize([line]);
    for (const [text, type] of [
      ['&', 'keyword.control'], ['ref', 'keyword'], ['(', 'delimiter.parenthesis'],
      [url, 'string.url'], [',', 'delimiter'], ['55', 'number'],
      ['no_link', 'keyword.parameter'], [')', 'delimiter.parenthesis'],
      ['~~', 'keyword.control'], ['ドール', 'markup.bold'],
      ['>', 'delimiter.angle'], ['ドール]]', 'markup.underline.link'],
      [']]', 'delimiter.square'], ['|はなまる', 'keyword.control'],
    ]) {
      expect(tokenAt(tokens[0], line.indexOf(text))).toBe(`${type}.seesaawiki`);
    }
    expect(state.equals(tokenizer.getInitialState())).toBe(true);
  });

  it.each(['ref', 'attachref'])('returns from %s and nested decoration to the link label', (name) => {
    const line = `|[[前&${name}(image.png,55,no_link)&color(red){&size(20){''太字''}}後>ページ]]|center:次|`;
    const { tokens, state } = tokenize([line]);
    expect(tokenAt(tokens[0], line.indexOf('55'))).toBe('number.seesaawiki');
    expect(tokenAt(tokens[0], line.indexOf('太字'))).toBe('markup.bold.seesaawiki');
    expect(tokenAt(tokens[0], line.indexOf('後'))).toBe('markup.underline.link.seesaawiki');
    expect(tokenAt(tokens[0], line.indexOf('ページ'))).toBe('markup.underline.link.seesaawiki');
    expect(tokenAt(tokens[0], line.indexOf('center:'))).toBe('keyword.parameter.seesaawiki');
    expect(state.equals(tokenizer.getInitialState())).toBe(true);
  });

  it.each(['>', '>>', '>>>'])('preserves link destinations after %s', (separator) => {
    const url = 'https://example.com/image_(1).png?a=1,2&b=3';
    const line = `[[label${separator}${url}]] [[page#anchor]]`;
    const { tokens, state } = tokenize([line]);
    for (let i = line.indexOf(url); i < line.indexOf(url) + url.length; i++) {
      expect(tokenAt(tokens[0], i)).toBe('string.url.seesaawiki');
    }
    expect(tokenAt(tokens[0], line.indexOf('#anchor'))).toBe('support.variable.italic.seesaawiki');
    expect(state.equals(tokenizer.getInitialState())).toBe(true);
  });

  it('keeps formatting-like text literal in the destination', () => {
    const destination = "&ref(image.png)~~''ページ''";
    const line = `[[表示>${destination}]]`;
    const { tokens, state } = tokenize([line]);
    for (let i = line.indexOf(destination); i < line.indexOf(destination) + destination.length; i++) {
      expect(tokenAt(tokens[0], i)).toBe('markup.underline.link.seesaawiki');
    }
    expect(state.equals(tokenizer.getInitialState())).toBe(true);
  });

  it('does not carry an explicit table closer into the next paragraph', () => {
    const { tokens, state } = tokenize(['{|', '|value|', '|}', 'center: plain']);
    expect(tokenAt(tokens[2], 0)).toBe('keyword.control.seesaawiki');
    expect(tokenAt(tokens[3], 0)).not.toBe('keyword.parameter.seesaawiki');
    expect(state.equals(tokenizer.getInitialState())).toBe(true);
  });

  it('handles tables in nested folding blocks and an unmatched folding closer', () => {
    const lines = ['[+]outer', '[-]inner', "|''bold''|", '[END]', '[END]', '[END]', '|center:cell|'];
    const { tokens, state } = tokenize(lines);
    expect(tokenAt(tokens[5], 0)).toBe('keyword.control.seesaawiki');
    expect(tokenAt(tokens[6], 1)).toBe('keyword.parameter.seesaawiki');
    expect(state.equals(tokenizer.getInitialState())).toBe(true);
  });
});
