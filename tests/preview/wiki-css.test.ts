import { describe, it, expect, afterEach } from 'bun:test';
import {
  buildPreviewHtml,
  documentStylesheetHrefs,
  getPreviewStylesheets,
  LIGHTBOX_CSS_URL,
  previewStylesheetsFromDocument,
} from '../../src/preview/wiki-css.js';

afterEach(() => {
  document.querySelectorAll('link[rel="stylesheet"]').forEach((el) => el.remove());
});

describe('documentStylesheetHrefs', () => {
  it('文書内のlinkを返す', () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://example.test/doc.css';
    document.head.appendChild(link);
    expect(documentStylesheetHrefs()).toContain('https://example.test/doc.css');
  });
});

describe('previewStylesheetsFromDocument', () => {
  it('編集画面専用CSSを除きlightboxを補う', () => {
    expect(
      previewStylesheetsFromDocument([
        'https://static.seesaawiki.jp/css/usr/common.css?0.8.6',
        'https://image01.seesaawiki.jp/k/h/mywiki/site.css?t=1',
        'https://static.seesaawiki.jp/css/usr/uploader.css?0.8.6',
        'https://static.seesaawiki.jp/css/usr/edit.css?0.8.6',
      ])
    ).toEqual([
      'https://static.seesaawiki.jp/css/usr/common.css?0.8.6',
      'https://image01.seesaawiki.jp/k/h/mywiki/site.css?t=1',
      LIGHTBOX_CSS_URL,
    ]);
  });

  it('lightboxがあれば重複させない', () => {
    expect(previewStylesheetsFromDocument([LIGHTBOX_CSS_URL])).toEqual([
      LIGHTBOX_CSS_URL,
    ]);
  });
});

describe('getPreviewStylesheets', () => {
  it('編集中ページから同期取得する(通信なし)', () => {
    for (const href of [
      'https://static.seesaawiki.jp/css/usr/common.css?0.8.6',
      'https://image01.seesaawiki.jp/k/h/mywiki/site.css?t=1',
      'https://static.seesaawiki.jp/css/usr/edit.css?0.8.6',
    ]) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }
    expect(getPreviewStylesheets()).toEqual([
      'https://static.seesaawiki.jp/css/usr/common.css?0.8.6',
      'https://image01.seesaawiki.jp/k/h/mywiki/site.css?t=1',
      LIGHTBOX_CSS_URL,
    ]);
  });
});

describe('buildPreviewHtml', () => {
  it('CSSリンクと本文構造を含む', () => {
    const doc = new DOMParser().parseFromString(
      buildPreviewHtml(
        ['https://example.test/a.css', 'https://example.test/b.css'],
        '<p>本文</p>'
      ),
      'text/html'
    );
    expect(
      Array.from(doc.querySelectorAll('link[rel="stylesheet"]'), (link) =>
        link.getAttribute('href')
      )
    ).toEqual(['https://example.test/a.css', 'https://example.test/b.css']);
    expect(doc.querySelector('#main > .user-area > p')?.textContent).toBe('本文');
  });
});
