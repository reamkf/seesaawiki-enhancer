export const LIGHTBOX_CSS_URL =
  'https://static.seesaawiki.jp/css/lightbox.min.css?0.8.6';

/** 編集画面専用でプレビューに混ぜてはいけないCSS(ファイル名部分一致) */
const EDIT_ONLY_CSS_MARKERS = ['uploader.css', 'edit.css'];

export function wikiTopPageUrl(
  wikiId: string | null | undefined,
  pageUrl: string | null | undefined
): string | null {
  if (!pageUrl) return null;
  try {
    const u = new URL(pageUrl);
    if (u.hostname.endsWith('seesaawiki.jp')) {
      if (!wikiId) return null;
      return `${u.origin}/${wikiId}/`;
    }
    return `${u.origin}/`;
  } catch {
    return null;
  }
}

/** 編集中ページ(document)の stylesheet の href 一覧 */
export function documentStylesheetHrefs(): string[] {
  return Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
    .map((el) => (el as HTMLLinkElement).href)
    .filter((href) => href.length > 0);
}

/**
 * 編集中ページのCSS一覧からプレビュー用の一覧を作る。
 * 編集ページは閲覧用CSS一式(テーマ・site.css)を順序通り持つため、
 * 編集画面専用CSSを除き、閲覧側にあって編集ページに無い分を補うだけで足りる。
 */
export function previewStylesheetsFromDocument(hrefs: string[]): string[] {
  const filtered = hrefs.filter(
    (h) => !EDIT_ONLY_CSS_MARKERS.some((m) => h.includes(m))
  );
  if (!filtered.some((h) => h.includes('lightbox'))) {
    filtered.push(LIGHTBOX_CSS_URL);
  }
  return filtered;
}

/** プレビュー用のCSS一式。編集中ページから同期取得するため通信しない。 */
export function getPreviewStylesheets(): string[] {
  return previewStylesheetsFromDocument(documentStylesheetHrefs());
}

/** 独自記法由来の要素向けの最小CSS(テーマに依存しない部品のみ) */
export const PREVIEW_CONTENT_CSS = [
  // common.cssが固定ヘッダー用に body{padding-top:36px!important} を指定するため、
  // プレビュー(ヘッダー無し)では !important で上書きして均等パディングに戻す
  'body{margin:0!important;padding:16px!important;box-sizing:border-box}',
  '#main,#main .user-area{margin:0;padding:0}',
  '#main .user-area>:first-child{margin-top:0}',
  '#main .user-area>:last-child{margin-bottom:0}',
  '.swe-preview-fukidashi{border:1px solid #ccc;border-radius:8px;padding:8px 12px;margin:.8em 0}',
  '.swe-preview-placeholder,.swe-preview-embed,.swe-preview-special,.swe-preview-attach{margin:.4em 0}',
].join('\n');

/** iframe文書全体を組み立てる(ピュア関数) */
export function buildPreviewSrcdoc(stylesheets: string[], bodyHtml: string): string {
  const links = stylesheets
    .map((href) => `<link rel="stylesheet" type="text/css" media="all" href="${href}">`)
    .join('\n');
  return [
    '<!DOCTYPE html>',
    '<html>',
    '<head>',
    '<meta charset="utf-8">',
    links,
    `<style>${PREVIEW_CONTENT_CSS}</style>`,
    '</head>',
    '<body>',
    '<div id="main"><div class="user-area">',
    bodyHtml,
    '</div></div>',
    '</body>',
    '</html>',
  ].join('\n');
}
