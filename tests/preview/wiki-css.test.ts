import { describe, it, expect, afterEach } from 'bun:test';
import {
  buildPreviewSrcdoc,
  documentStylesheetHrefs,
  getPreviewStylesheets,
  LIGHTBOX_CSS_URL,
  PREVIEW_CONTENT_CSS,
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

describe('PREVIEW_CONTENT_CSS', () => {
  it('ペイン全体のパディングは上下左右均等', () => {
    // common.cssの body{padding-top:36px!important} に勝つ必要がある
    expect(PREVIEW_CONTENT_CSS).toMatch(/body\{[^}]*padding:16px!important[^}]*\}/);
  });

  it('先頭・末尾要素のマージンで見かけの余白が増えない', () => {
    expect(PREVIEW_CONTENT_CSS).toContain(':first-child{margin-top:0}');
    expect(PREVIEW_CONTENT_CSS).toContain(':last-child{margin-bottom:0}');
  });
});

describe('buildPreviewSrcdoc', () => {
  it('CSSリンクと本文構造を含む文書を組み立てる', () => {
    const doc = buildPreviewSrcdoc(
      ['https://example.test/a.css', 'https://example.test/b.css'],
      '<p>本文</p>'
    );
    expect(doc).toContain('<meta charset="utf-8">');
    expect(doc).toContain('<link rel="stylesheet" type="text/css" media="all" href="https://example.test/a.css">');
    expect(doc).toContain('<link rel="stylesheet" type="text/css" media="all" href="https://example.test/b.css">');
    expect(doc).toContain('<div id="main"><div class="user-area">');
    expect(doc).toContain('<p>本文</p>');
  });
});
