import type * as monacoNs from 'monaco-editor';
import { renderMissingPageHtml, renderSeesaawikiToHtml } from './renderer.js';
import {
  buildPreviewSrcdoc,
  getPreviewStylesheets,
  wikiTopPageUrl,
} from './wiki-css.js';
import { encodeEUCJP } from '../utils/encoding.js';

export const PREVIEW_DEBOUNCE_MS = 400;

export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  waitMs: number
): { run: (...args: A) => void; dispose: () => void } {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return {
    run(...args: A): void {
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        fn(...args);
      }, waitMs);
    },
    dispose(): void {
      if (timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
      }
    },
  };
}

export interface SetupPreviewPaneArgs {
  editor: monacoNs.editor.IStandaloneCodeEditor;
  rightPane: HTMLElement;
  frame: HTMLIFrameElement;
  getWikiPageUrl?: ((pageName: string) => string) | null;
  debounceMs?: number;
  /** 未存在ページの赤リンク補正に使う。省略時は補正しない。 */
  wikiId?: string | null;
  pageUrl?: string | null;
}

export interface PreviewPane {
  update: () => void;
  dispose: () => void;
}

function frameDocument(frame: HTMLIFrameElement): Document | null {
  try {
    return frame.contentDocument ?? null;
  } catch {
    return null;
  }
}

export interface ScrollPosition {
  top: number;
  left: number;
}

export function getScrollPosition(doc: Document | null | undefined): ScrollPosition {
  const el = doc?.scrollingElement ?? doc?.documentElement ?? null;
  if (!el) return { top: 0, left: 0 };
  return { top: el.scrollTop, left: el.scrollLeft };
}

export function setScrollPosition(
  doc: Document | null | undefined,
  pos: ScrollPosition
): void {
  const el = doc?.scrollingElement ?? doc?.documentElement ?? null;
  if (!el) return;
  el.scrollTop = pos.top;
  el.scrollLeft = pos.left;
}

/** プレビュー文書内のリンク・トグルを整える(iframe文書・テスト文書の両対応) */
export function postProcessPreviewDocument(doc: Document): void {
  const anchors = doc.querySelectorAll('a[href]');
  anchors.forEach((a) => {
    const el = a as HTMLAnchorElement;
    const href = el.getAttribute('href') ?? '';
    if (href.startsWith('#')) return;
    el.target = '_blank';
    el.rel = 'noopener';
  });

  doc.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    const toggle = target?.closest?.('[data-swe-toggle]') as HTMLElement | null;
    if (toggle && doc.contains(toggle)) {
      const paneId = toggle.getAttribute('data-swe-toggle');
      if (paneId) {
        const pane = doc.getElementById(paneId);
        if (pane) {
          e.preventDefault();
          const hidden = pane.style.display === 'none';
          pane.style.display = hidden ? '' : 'none';
          toggle.classList.toggle('toggle-link-open', hidden);
          toggle.classList.toggle('toggle-link-close', !hidden);
          return;
        }
      }
    }
    // ページ内リンク(#断片)はiframeの遷移に任せず、プレビュー内へスクロールするだけにする
    const button = (e as MouseEvent).button ?? 0;
    if (
      button !== 0 ||
      e.ctrlKey ||
      e.metaKey ||
      e.shiftKey ||
      e.altKey
    ) {
      return;
    }
    const anchor = target?.closest?.('a[href^="#"]') as HTMLAnchorElement | null;
    if (!anchor || !doc.contains(anchor)) return;
    const rawId = (anchor.getAttribute('href') ?? '').slice(1);
    if (!rawId) return;
    const dest =
      doc.getElementById(rawId) ?? doc.getElementById(safeDecodeFragment(rawId));
    if (!dest) return;
    e.preventDefault();
    scrollElementIntoView(doc, dest);
  });
}

/** iframe文書内だけで完結するスクロール。外側ページは動かさない。 */
export function scrollElementIntoView(doc: Document, dest: Element): void {
  const scroller = doc.scrollingElement ?? doc.documentElement;
  if (!scroller) return;
  const scrollerTop = scroller.getBoundingClientRect().top;
  const destTop = dest.getBoundingClientRect().top;
  scroller.scrollTop += destTop - scrollerTop;
}

function safeDecodeFragment(rawId: string): string {
  try {
    return decodeURIComponent(rawId);
  } catch {
    return rawId;
  }
}

export function buildWikiAddUrl(
  wikiId: string | null | undefined,
  pageUrl: string | null | undefined,
  pageName: string
): string | null {
  const top = wikiTopPageUrl(wikiId, pageUrl);
  if (!top) return null;
  return `${top}e/add?pagename=${encodeEUCJP(pageName)}`;
}

const pageExistsCache = new Map<string, boolean>();
const pageCheckPending = new Set<string>();

async function checkPageExists(viewUrl: string): Promise<boolean> {
  const cached = pageExistsCache.get(viewUrl);
  if (cached !== undefined) return cached;
  if (pageCheckPending.has(viewUrl)) return true;
  pageCheckPending.add(viewUrl);
  try {
    const res = await fetch(viewUrl, { method: 'HEAD', redirect: 'follow' });
    const exists = res.ok && !res.url.includes('/e/add');
    pageExistsCache.set(viewUrl, exists);
    return exists;
  } catch {
    return true;
  } finally {
    pageCheckPending.delete(viewUrl);
  }
}

function refreshMissingPageMarks(
  doc: Document,
  wikiId: string | null | undefined,
  pageUrl: string | null | undefined
): void {
  if (!wikiId || !pageUrl) return;
  const anchors = doc.querySelectorAll('a[data-wiki-page]');
  anchors.forEach((a) => {
    const el = a as HTMLAnchorElement;
    const pageName = el.getAttribute('data-wiki-page');
    if (!pageName) return;
    const viewUrl = el.href;
    if (!viewUrl || viewUrl.endsWith('#')) return;
    void checkPageExists(viewUrl).then((exists) => {
      if (exists) return;
      if (!el.isConnected) return;
      const addUrl = buildWikiAddUrl(wikiId, pageUrl, pageName);
      const template = doc.createElement('div');
      template.innerHTML = renderMissingPageHtml(el.innerHTML, addUrl);
      el.replaceWith(...Array.from(template.childNodes));
    });
  });
}

export function setupPreviewPane({
  editor,
  rightPane: _rightPane,
  frame,
  getWikiPageUrl = null,
  debounceMs = PREVIEW_DEBOUNCE_MS,
  wikiId = null,
  pageUrl = null,
}: SetupPreviewPaneArgs): PreviewPane {
  void _rightPane;
  const stylesheets: string[] = getPreviewStylesheets();
  let disposed = false;
  let savedScroll: ScrollPosition = { top: 0, left: 0 };

  const writeFrame = (bodyHtml: string): void => {
    savedScroll = getScrollPosition(frameDocument(frame));
    frame.srcdoc = buildPreviewSrcdoc(stylesheets, bodyHtml);
  };

  const onFrameLoad = (): void => {
    if (disposed) return;
    const doc = frameDocument(frame);
    if (!doc) return;
    postProcessPreviewDocument(doc);
    refreshMissingPageMarks(doc, wikiId, pageUrl);
    setScrollPosition(doc, savedScroll);
  };

  const update = (): void => {
    const model = editor.getModel();
    if (!model) return;
    try {
      const html = renderSeesaawikiToHtml(model.getValue(), {
        getWikiPageUrl: getWikiPageUrl ?? undefined,
      });
      writeFrame(html);
    } catch (error) {
      console.error('プレビューの更新に失敗しました:', error);
    }
  };

  frame.addEventListener('load', onFrameLoad);

  const debounced = debounce(update, debounceMs);
  const disposable = editor.onDidChangeModelContent(() => debounced.run());

  update();

  return {
    update,
    dispose(): void {
      disposed = true;
      debounced.dispose();
      disposable.dispose();
      frame.removeEventListener('load', onFrameLoad);
    },
  };
}

export interface CreatePreviewDomResult {
  wrapper: HTMLElement;
  frame: HTMLIFrameElement;
  toggleButton: HTMLButtonElement;
  fabButton: HTMLButtonElement;
}

export function createPreviewDom(onToggle?: (hidden: boolean) => void): CreatePreviewDomResult {
  const wrapper = document.createElement('div');
  wrapper.className = 'swe-preview-wrapper';

  const label = document.createElement('div');
  label.className = 'swe-preview-label';

  const title = document.createElement('span');
  title.className = 'swe-preview-title';
  title.textContent = 'PREVIEW';

  const toggleButton = document.createElement('button');
  toggleButton.className = 'swe-preview-toggle';
  toggleButton.type = 'button';
  toggleButton.textContent = '非表示';

  const fabButton = document.createElement('button');
  fabButton.className = 'swe-preview-fab';
  fabButton.type = 'button';
  fabButton.textContent = 'プレビュー';

  const setHidden = (hidden: boolean): void => {
    const root = wrapper.closest('.swe-edit-container') ?? fabButton.closest('.swe-edit-container');
    if (!root) return;
    root.classList.toggle('swe-hide-preview', hidden);
    toggleButton.textContent = hidden ? '表示' : '非表示';
    onToggle?.(hidden);
  };
  const isHidden = (): boolean =>
    wrapper.closest('.swe-edit-container')?.classList.contains('swe-hide-preview') ?? false;

  toggleButton.addEventListener('click', () => setHidden(!isHidden()));
  fabButton.addEventListener('click', () => setHidden(false));

  label.append(title, toggleButton);

  const frame = document.createElement('iframe');
  frame.className = 'swe-preview-frame';
  // target=_blank の通常リンク(直リンク・wiki内ページリンク)を新規タブで開くため
  // allow-popups (+サンドボックス引き継ぎ解除)が必要。無しだとクリックが無視される。
  // ページ内アンカー(#)は postProcessPreviewDocument 側でスクロール処理するため影響なし。
  frame.setAttribute(
    'sandbox',
    'allow-same-origin allow-popups allow-popups-to-escape-sandbox'
  );
  frame.title = 'Seesaa Wiki プレビュー';

  wrapper.append(label, frame);
  return { wrapper, frame, toggleButton, fabButton };
}
