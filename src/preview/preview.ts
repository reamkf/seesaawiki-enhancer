import type * as monacoNs from 'monaco-editor';
import {
  createIncrementalWikiRenderer,
  renderMissingPageHtml,
} from './renderer.js';
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

interface ToggleState {
  sourceOpen: boolean;
  open: boolean;
}

const processedPreviewDocuments = new WeakSet<Document>();
const toggleStates = new WeakMap<Element, ToggleState>();

function isToggleLink(element: Element): boolean {
  return element.hasAttribute('data-swe-toggle');
}

function isTogglePane(element: Element): boolean {
  return element.classList.contains('toggle-display');
}

function getTogglePane(doc: Document, toggle: Element): HTMLElement | null {
  const paneId = toggle.getAttribute('data-swe-toggle');
  return paneId ? (doc.getElementById(paneId) as HTMLElement | null) : null;
}

function rememberToggleState(toggle: Element, pane: HTMLElement): ToggleState {
  const state = toggleStates.get(toggle) ?? toggleStates.get(pane);
  if (!state) {
    const sourceOpen = pane.style.display !== 'none';
    const created = { sourceOpen, open: sourceOpen };
    toggleStates.set(toggle, created);
    toggleStates.set(pane, created);
    return created;
  }
  toggleStates.set(toggle, state);
  toggleStates.set(pane, state);
  return state;
}

function applyToggleState(toggle: Element, pane: HTMLElement, state: ToggleState): void {
  pane.style.display = state.open ? '' : 'none';
  toggle.classList.toggle('toggle-link-open', !state.open);
  toggle.classList.toggle('toggle-link-close', state.open);
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

  const toggles = doc.querySelectorAll('[data-swe-toggle]');
  toggles.forEach((element) => {
    const toggle = element as HTMLElement;
    const pane = getTogglePane(doc, toggle);
    if (pane) applyToggleState(toggle, pane, rememberToggleState(toggle, pane));
  });

  if (processedPreviewDocuments.has(doc)) return;
  processedPreviewDocuments.add(doc);
  doc.addEventListener('click', (e) => {
    const target = e.target as HTMLElement | null;
    const toggle = target?.closest?.('[data-swe-toggle]') as HTMLElement | null;
    if (toggle && doc.contains(toggle)) {
      const pane = getTogglePane(doc, toggle);
      if (pane) {
        e.preventDefault();
        const state = rememberToggleState(toggle, pane);
        state.open = !state.open;
        applyToggleState(toggle, pane, state);
        return;
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
    // 脚注の移動先はidではなくname属性で生成されるため、name付きアンカーも探す
    const decodedId = safeDecodeFragment(rawId);
    const dest =
      doc.getElementById(rawId) ??
      (decodedId !== rawId ? doc.getElementById(decodedId) : null) ??
      findAnchorByName(doc, rawId) ??
      (decodedId !== rawId ? findAnchorByName(doc, decodedId) : null);
    if (!dest) return;
    e.preventDefault();
    scrollElementIntoView(doc, dest);
  });
}

/** name属性で生成されたアンカー(a[name])を探す。脚注の移動先用。 */
function findAnchorByName(doc: Document, name: string): Element | null {
  const byName = (
    doc as Document & {
      getElementsByName?: (name: string) => HTMLCollectionOf<Element>;
    }
  ).getElementsByName?.(name)?.[0];
  if (byName) return byName;
  try {
    const escaped =
      typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
        ? CSS.escape(name)
        : name.replace(/["\\]/g, '\\$&');
    return doc.querySelector(`a[name="${escaped}"]`);
  } catch {
    return null;
  }
}

/** iframe文書内だけで完結するスクロール。外側ページは動かさない。 */
export function scrollElementIntoView(doc: Document, dest: Element): void {
  const scroller = doc.scrollingElement ?? doc.documentElement;
  if (!scroller) return;
  // 文書のスクロール要素のrect.topはスクロール分だけ負になるため差し引かない。
  // destのviewport相対位置をそのまま加算すれば移動先の絶対位置になる。
  scroller.scrollTop += dest.getBoundingClientRect().top;
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
const pageCheckPending = new Map<string, Promise<boolean>>();

function checkPageExists(viewUrl: string): Promise<boolean> {
  const cached = pageExistsCache.get(viewUrl);
  if (cached !== undefined) return Promise.resolve(cached);
  const pending = pageCheckPending.get(viewUrl);
  if (pending) return pending;

  const request = fetch(viewUrl, { method: 'HEAD', redirect: 'follow' })
    .then((res) => {
      const exists = res.ok && !res.url.includes('/e/add');
      pageExistsCache.set(viewUrl, exists);
      return exists;
    })
    .catch(() => true)
    .finally(() => {
      pageCheckPending.delete(viewUrl);
    });
  pageCheckPending.set(viewUrl, request);
  return request;
}

function isDynamicPreviewId(id: string): boolean {
  return /^(?:content_block_\d+(?:-(?:inside|body))?|content_\d+(?:_\d+)*|region_plugin_content_\d+)$/.test(
    id
  );
}

function stableElementKey(element: Element): string | null {
  const tagName = element.tagName.toLowerCase();
  const pageName = element.getAttribute('data-wiki-page');
  if (pageName) return `wiki:${pageName}`;
  if (isTogglePane(element)) return 'toggle-pane';
  if (isToggleLink(element)) return 'toggle-link';
  if (tagName === 'a') {
    const href = element.getAttribute('href');
    if (href) return `a:${href}`;
  }
  if (tagName === 'img' || tagName === 'video' || tagName === 'audio') {
    const src = element.getAttribute('src');
    if (src) return `${tagName}:src:${src}`;
  }
  const toggleTitle = Array.from(element.children).find((child) =>
    child.classList.contains('toggle-title')
  );
  if (toggleTitle) return `toggle:${toggleTitle.textContent ?? ''}`;
  const id = element.getAttribute('id');
  if (id && !isDynamicPreviewId(id)) return `id:${id}`;
  return null;
}

function elementKey(node: Node): string | null {
  return node.nodeType === 1 ? stableElementKey(node as Element) : null;
}

function canPatchNode(oldNode: Node, newNode: Node): boolean {
  if (oldNode.nodeType !== newNode.nodeType) return false;
  if (oldNode.nodeType !== 1) return true;
  return (oldNode as Element).tagName === (newNode as Element).tagName;
}

function shouldPreserveLinkAttribute(
  oldElement: Element,
  newElement: Element,
  name: string
): boolean {
  if (name !== 'target' && name !== 'rel') return false;
  if (newElement.tagName.toLowerCase() !== 'a') return false;
  const href = newElement.getAttribute('href') ?? '';
  return !href.startsWith('#') && oldElement.tagName.toLowerCase() === 'a';
}

function syncElementAttributes(oldElement: Element, newElement: Element): void {
  const oldToggleState = isTogglePane(oldElement) ? toggleStates.get(oldElement) : undefined;
  const sourceOpen = oldToggleState
    ? (newElement as HTMLElement).style.display !== 'none'
    : null;
  if (oldToggleState && sourceOpen !== null && oldToggleState.sourceOpen !== sourceOpen) {
    oldToggleState.sourceOpen = sourceOpen;
    oldToggleState.open = sourceOpen;
  }

  for (const attribute of Array.from(oldElement.attributes)) {
    if (
      !newElement.hasAttribute(attribute.name) &&
      !shouldPreserveLinkAttribute(oldElement, newElement, attribute.name) &&
      !(isToggleLink(oldElement) && isToggleLink(newElement) && attribute.name === 'class')
    ) {
      oldElement.removeAttribute(attribute.name);
    }
  }
  for (const attribute of Array.from(newElement.attributes)) {
    if (
      (isToggleLink(oldElement) && isToggleLink(newElement) && attribute.name === 'class') ||
      shouldPreserveLinkAttribute(oldElement, newElement, attribute.name)
    ) {
      continue;
    }
    if (oldElement.getAttribute(attribute.name) !== attribute.value) {
      oldElement.setAttribute(attribute.name, attribute.value);
    }
  }

  if (oldToggleState && isTogglePane(newElement)) {
    (oldElement as HTMLElement).style.display = oldToggleState.open ? '' : 'none';
  }
}

interface NodePool {
  nodes: Node[];
  next: number;
}

interface NodePools {
  keyed: Map<string, NodePool>;
  unkeyed: Map<string, NodePool>;
}

function nodeShape(node: Node): string {
  return node.nodeType === 1
    ? `element:${(node as Element).tagName}`
    : `node:${node.nodeType}`;
}

function addToPool(pools: Map<string, NodePool>, key: string, node: Node): void {
  const pool = pools.get(key);
  if (pool) {
    pool.nodes.push(node);
  } else {
    pools.set(key, { nodes: [node], next: 0 });
  }
}

function makeNodePools(oldChildren: Node[]): NodePools {
  const pools: NodePools = { keyed: new Map(), unkeyed: new Map() };
  oldChildren.forEach((oldNode) => {
    const key = elementKey(oldNode);
    addToPool(key === null ? pools.unkeyed : pools.keyed, key ?? nodeShape(oldNode), oldNode);
  });
  return pools;
}

function takeFromPool(
  pools: Map<string, NodePool>,
  key: string,
  newNode: Node,
  used: Set<Node>
): Node | null {
  const pool = pools.get(key);
  if (!pool) return null;
  while (pool.next < pool.nodes.length) {
    const oldNode = pool.nodes[pool.next++];
    if (!used.has(oldNode) && canPatchNode(oldNode, newNode)) return oldNode;
  }
  return null;
}

function findReusableNode(
  newNode: Node,
  oldChildren: Node[],
  pools: NodePools,
  used: Set<Node>,
  index: number
): Node | null {
  const newKey = elementKey(newNode);
  if (newKey !== null) return takeFromPool(pools.keyed, newKey, newNode, used);

  const atIndex = oldChildren[index];
  if (
    atIndex &&
    !used.has(atIndex) &&
    elementKey(atIndex) === null &&
    canPatchNode(atIndex, newNode)
  ) {
    return atIndex;
  }
  return takeFromPool(pools.unkeyed, nodeShape(newNode), newNode, used);
}

function morphNode(oldNode: Node, newNode: Node): void {
  if (oldNode.nodeType === 3 || oldNode.nodeType === 4) {
    if (oldNode.nodeValue !== newNode.nodeValue) oldNode.nodeValue = newNode.nodeValue;
    return;
  }
  if (oldNode.nodeType !== 1 || newNode.nodeType !== 1) return;
  const oldElement = oldNode as Element;
  const newElement = newNode as Element;
  syncElementAttributes(oldElement, newElement);
  morphChildren(oldElement, Array.from(newElement.childNodes));
}

function morphChildren(parent: Node, newChildren: Node[]): void {
  const oldChildren = Array.from(parent.childNodes);
  const pools = makeNodePools(oldChildren);
  const used = new Set<Node>();
  let cursor = parent.firstChild;

  newChildren.forEach((newNode, index) => {
    const reusable = findReusableNode(newNode, oldChildren, pools, used, index);
    if (!reusable) {
      parent.insertBefore(newNode, cursor);
      cursor = newNode.nextSibling;
      return;
    }
    used.add(reusable);
    if (reusable !== cursor) parent.insertBefore(reusable, cursor);
    morphNode(reusable, newNode);
    cursor = reusable.nextSibling;
  });

  oldChildren.forEach((oldNode) => {
    if (!used.has(oldNode) && oldNode.parentNode === parent) parent.removeChild(oldNode);
  });
}

function patchPreviewBody(doc: Document, bodyHtml: string): void {
  const userArea = doc.querySelector('#main .user-area') ?? doc.querySelector('.user-area');
  if (!userArea) return;
  const template = doc.createElement('div');
  template.innerHTML = bodyHtml;
  morphChildren(userArea, Array.from(template.childNodes));
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
    const expectedPageName = pageName;
    const expectedViewUrl = viewUrl;
    void checkPageExists(viewUrl).then((exists) => {
      if (exists) return;
      if (!el.isConnected) return;
      if (el.getAttribute('data-wiki-page') !== expectedPageName) return;
      if (el.href !== expectedViewUrl) return;
      const addUrl = buildWikiAddUrl(wikiId, pageUrl, expectedPageName);
      const template = doc.createElement('div');
      template.innerHTML = renderMissingPageHtml(el.innerHTML, addUrl);
      // 非同期で挿入するためpostProcessPreviewDocumentの対象外。新規タブ化はここで行う。
      template.querySelectorAll('a[href]').forEach((n) => {
        const link = n as HTMLAnchorElement;
        if ((link.getAttribute('href') ?? '').startsWith('#')) return;
        link.target = '_blank';
        link.rel = 'noopener';
      });
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
  const wikiRenderer = createIncrementalWikiRenderer({
    getWikiPageUrl: getWikiPageUrl ?? undefined,
  });
  let disposed = false;
  let initialLoadStarted = false;
  let documentReady = false;
  let latestBodyHtml = '';
  let savedScroll: ScrollPosition = { top: 0, left: 0 };

  const processInitialFrame = (): void => {
    if (disposed) return;
    const doc = frameDocument(frame);
    if (!doc) return;
    documentReady = true;
    patchPreviewBody(doc, latestBodyHtml);
    postProcessPreviewDocument(doc);
    refreshMissingPageMarks(doc, wikiId, pageUrl);
    setScrollPosition(doc, savedScroll);
  };

  const writeFrame = (bodyHtml: string): void => {
    latestBodyHtml = bodyHtml;
    if (!initialLoadStarted) {
      initialLoadStarted = true;
      savedScroll = getScrollPosition(frameDocument(frame));
      frame.addEventListener('load', processInitialFrame, { once: true });
      frame.srcdoc = buildPreviewSrcdoc(stylesheets, bodyHtml);
      return;
    }
    if (!documentReady) return;
    const doc = frameDocument(frame);
    if (!doc) return;
    patchPreviewBody(doc, bodyHtml);
    postProcessPreviewDocument(doc);
    refreshMissingPageMarks(doc, wikiId, pageUrl);
  };

  const update = (): void => {
    const model = editor.getModel();
    if (!model) return;
    try {
      const html = wikiRenderer.render(model.getValue());
      writeFrame(html);
    } catch (error) {
      console.error('プレビューの更新に失敗しました:', error);
    }
  };

  const debounced = debounce(update, debounceMs);
  const disposable = editor.onDidChangeModelContent(() => debounced.run());

  update();

  return {
    update,
    dispose(): void {
      disposed = true;
      debounced.dispose();
      disposable.dispose();
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
