import { describe, expect, it } from 'bun:test';
import { decodeHTMLEntities } from '../../src/utils/encoding.js';
import { extractDiffContent } from '../../src/features/diff-content.js';

describe('extractDiffContent', () => {
  it('does not include escaped closing span tags from the diff wrapper', () => {
    const html =
      '&lt;span class="line-delete"&gt;old<br>\n' +
      '&lt;span class="line-add"&gt;new<br>\n' +
      '&lt;/span&gt;&lt;/span&gt;&lt;/span&gt;';

    expect(extractDiffContent(html, decodeHTMLEntities)).toEqual({
      oldContent: 'old\n',
      newContent: 'new\n',
    });
  });

  it('does not include closing spans generated while decoding diff markup', () => {
    const html = '<span class="line-delete">old<br>\n<span class="line-add">new<br>\n';
    const decodeWithGeneratedClosingSpans = (value: string) =>
      `${value}</span></span></span>`;

    expect(extractDiffContent(html, decodeWithGeneratedClosingSpans)).toEqual({
      oldContent: 'old\n',
      newContent: 'new\n',
    });
  });

  it('preserves an escaped closing span in the diff content', () => {
    const html =
      '&lt;span class="line-delete"&gt;old<br>\n' +
      '&lt;span class="line-add"&gt;new &lt;/span&gt; text<br>\n' +
      '&lt;/span&gt;';

    expect(extractDiffContent(html, decodeHTMLEntities).newContent).toBe('new </span> text\n');
  });
});
