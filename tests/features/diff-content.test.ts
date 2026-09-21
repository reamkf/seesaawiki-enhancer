import { describe, expect, it } from 'bun:test';
import { decodeHTMLEntities } from '../../src/utils/encoding.js';
import { extractDiffContent } from '../../src/features/diff-content.js';

const decodeWithGeneratedClosingSpans = (value: string) => {
  const decoded = decodeHTMLEntities(value);
  return value.includes('<span') ? `${decoded}</span></span></span>` : decoded;
};

describe('extractDiffContent', () => {
  it('does not include closing spans generated while decoding diff markup', () => {
    const html =
      '<span class="line-delete">old<br></span>\n' +
      '<span class="line-add">new<br></span>\n';

    expect(extractDiffContent(html, decodeWithGeneratedClosingSpans)).toEqual({
      oldContent: 'old\n',
      newContent: 'new\n',
    });
  });

  it('preserves an escaped closing span in the diff content', () => {
    const html = '<span class="line-add">new &lt;/span&gt; text<br></span>\n';

    expect(extractDiffContent(html, decodeWithGeneratedClosingSpans).newContent).toBe(
      'new </span> text\n'
    );
  });

  it('preserves a closing span at the end of a changed line', () => {
    const html = '<span class="line-add">new &lt;/span&gt;<br></span>\n';

    expect(extractDiffContent(html, decodeWithGeneratedClosingSpans).newContent).toBe(
      'new </span>\n'
    );
  });
});
