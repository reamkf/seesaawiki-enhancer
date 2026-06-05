import { describe, it, expect } from 'bun:test';
import { getWikiPageType, getWikiId, makeGetWikiPageUrl } from '../../src/utils/url.js';
import { WikiPageType } from '../../src/constants.js';

describe('getWikiPageType', () => {
  it('detects PAGE for /d/ paths', () => {
    expect(getWikiPageType('https://seesaawiki.jp/example/d/SomePage')).toBe(WikiPageType.PAGE);
  });

  it('detects LIST for /l/ paths', () => {
    expect(getWikiPageType('https://seesaawiki.jp/example/l/')).toBe(WikiPageType.LIST);
  });

  it('detects EDIT for /e/add', () => {
    expect(getWikiPageType('https://seesaawiki.jp/example/e/add')).toBe(WikiPageType.EDIT);
  });

  it('detects EDIT for /e/edit with id param', () => {
    expect(getWikiPageType('https://seesaawiki.jp/example/e/edit?id=123')).toBe(WikiPageType.EDIT);
  });

  it('does NOT detect EDIT for /e/edit without id param', () => {
    expect(getWikiPageType('https://seesaawiki.jp/example/e/edit')).toBeNull();
  });

  it('detects ATTACHMENT for /e/attachment', () => {
    expect(getWikiPageType('https://seesaawiki.jp/example/e/attachment')).toBe(WikiPageType.ATTACHMENT);
  });

  it('detects DIFF for /diff/ paths', () => {
    expect(getWikiPageType('https://seesaawiki.jp/example/diff/123')).toBe(WikiPageType.DIFF);
  });

  it('detects HISTORY for /hist/ paths', () => {
    expect(getWikiPageType('https://seesaawiki.jp/example/hist/123')).toBe(WikiPageType.HISTORY);
  });

  it('detects SEARCH for /search with keywords param', () => {
    expect(getWikiPageType('https://seesaawiki.jp/example/search?keywords=foo')).toBe(WikiPageType.SEARCH);
  });

  it('does NOT detect SEARCH for /search without keywords param', () => {
    expect(getWikiPageType('https://seesaawiki.jp/example/search')).toBeNull();
  });

  it('detects PAGE for root path', () => {
    expect(getWikiPageType('https://seesaawiki.jp/example/')).toBe(WikiPageType.PAGE);
  });

  it('returns null for unrecognized path', () => {
    expect(getWikiPageType('https://seesaawiki.jp/example/unknown')).toBeNull();
  });

  it('prioritizes /d/ over other patterns', () => {
    expect(getWikiPageType('https://seesaawiki.jp/example/d/page/l/')).toBe(WikiPageType.PAGE);
  });
});

describe('getWikiId', () => {
  it('extracts wiki id from seesaawiki.jp', () => {
    expect(getWikiId('https://seesaawiki.jp/example/d/SomePage')).toBe('example');
  });

  it('extracts w/ prefixed wiki id from seesaawiki.jp', () => {
    expect(getWikiId('https://seesaawiki.jp/w/example/d/SomePage')).toBe('w/example');
  });

  it('extracts wiki id from memo.wiki subdomain', () => {
    expect(getWikiId('https://foo.memo.wiki/d/SomePage')).toBe('foo-memo');
  });

  it('extracts wiki id from game-info.wiki subdomain', () => {
    expect(getWikiId('https://bar.game-info.wiki/d/SomePage')).toBe('bar-game-info');
  });

  it('extracts wiki id from sokuhou.wiki subdomain', () => {
    expect(getWikiId('https://baz.sokuhou.wiki/')).toBe('baz-sokuhou');
  });

  it('extracts wiki id from chronicle.wiki subdomain', () => {
    expect(getWikiId('https://qux.chronicle.wiki/')).toBe('qux-chronicle');
  });

  it('extracts wiki id from playing.wiki subdomain', () => {
    expect(getWikiId('https://quux.playing.wiki/')).toBe('quux-playing');
  });

  it('handles http (not https) scheme', () => {
    expect(getWikiId('http://seesaawiki.jp/example/d/SomePage')).toBe('example');
  });

  it('returns null for unrecognized domain', () => {
    expect(getWikiId('https://example.com/foo/bar')).toBeNull();
  });
});

describe('makeGetWikiPageUrl', () => {
  it('returns a function that builds a page URL', () => {
    const getUrl = makeGetWikiPageUrl('example');
    const url = getUrl('SomePage');
    expect(url.startsWith('https://seesaawiki.jp/example/d/')).toBe(true);
  });

  it('percent-encodes every byte (including ASCII) via EUC-JP', () => {
    const getUrl = makeGetWikiPageUrl('example');
    expect(getUrl('Foo')).toBe('https://seesaawiki.jp/example/d/%46%6F%6F');
  });

  it('encodes Japanese characters as EUC-JP percent escapes', () => {
    const getUrl = makeGetWikiPageUrl('example');
    expect(getUrl('あ')).toBe('https://seesaawiki.jp/example/d/%A4%A2');
  });

  it('escapes characters outside the non-escaped charset as numeric refs', () => {
    const getUrl = makeGetWikiPageUrl('example');
    const url = getUrl('𠮷');
    expect(url).toMatch(/^https:\/\/seesaawiki\.jp\/example\/d\//);
    expect(url).not.toContain('𠮷');
  });
});
