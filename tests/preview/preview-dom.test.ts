import { describe, it, expect } from 'bun:test';
import {
  createPreviewDom,
  getScrollPosition,
  postProcessPreviewDocument,
  setScrollPosition,
} from '../../src/preview/preview.js';

function makeDoc(): Document {
  const happyWindow = (globalThis as unknown as { window: Record<string, unknown> }).window;
  const doc = (happyWindow['document'] as Document).implementation.createHTMLDocument('preview');
  doc.body.innerHTML = [
    '<a href="https://example.test/page">外</a>',
    '<a href="#frag">内</a>',
    '<div class="toggle-title"><a data-swe-toggle="pane1" class="toggle-link-open">開</a></div>',
    '<div id="pane1" class="toggle-display">中</div>',
  ].join('');
  postProcessPreviewDocument(doc);
  return doc;
}

describe('postProcessPreviewDocument', () => {
  it('#以外のリンクを新規タブ化する', () => {
    const doc = makeDoc();
    const outer = doc.querySelector('a[href^="https"]') as HTMLAnchorElement;
    expect(outer.target).toBe('_blank');
    expect(outer.rel).toBe('noopener');
    const inner = doc.querySelector('a[href^="#"]') as HTMLAnchorElement;
    expect(inner.target).toBe('');
  });

  it('トグルの開閉ができる', () => {
    const doc = makeDoc();
    const happyWindow = (globalThis as unknown as { window: Record<string, unknown> }).window;
    const EventCtor = happyWindow['Event'] as new (type: string, init?: Record<string, unknown>) => Event;
    const toggle = doc.querySelector('[data-swe-toggle]') as HTMLElement;
    const pane = doc.getElementById('pane1') as HTMLElement;
    toggle.dispatchEvent(new EventCtor('click', { bubbles: true }));
    expect(pane.style.display).toBe('none');
    expect(toggle.classList.contains('toggle-link-close')).toBe(true);
    toggle.dispatchEvent(new EventCtor('click', { bubbles: true }));
    expect(pane.style.display).toBe('');
    expect(toggle.classList.contains('toggle-link-open')).toBe(true);
  });
});

describe('createPreviewDom', () => {  it('閉じてもFABで開き直せる', () => {
    const happyWindow = (globalThis as unknown as { window: Record<string, unknown> }).window;
    const EventCtor = happyWindow['Event'] as new (type: string, init?: Record<string, unknown>) => Event;
    const root = document.createElement('div');
    root.className = 'swe-edit-container';
    const { wrapper, toggleButton, fabButton } = createPreviewDom();
    const split = document.createElement('div');
    split.className = 'swe-main-split';
    split.append(wrapper, fabButton);
    root.appendChild(split);
    document.body.appendChild(root);
    try {
      expect(toggleButton.textContent).toBe('非表示');
      toggleButton.dispatchEvent(new EventCtor('click', { bubbles: true }));
      expect(root.classList.contains('swe-hide-preview')).toBe(true);
      expect(toggleButton.textContent).toBe('表示');
      // FABはラッパーの外にあるため消えずに残る = 開き直す手段がある
      expect(fabButton.isConnected).toBe(true);
      fabButton.dispatchEvent(new EventCtor('click', { bubbles: true }));
      expect(root.classList.contains('swe-hide-preview')).toBe(false);
      expect(toggleButton.textContent).toBe('非表示');
    } finally {
      root.remove();
    }
  });
});

describe('scroll position', () => {
  function makeScrollableDoc(): Document {
    const happyWindow = (globalThis as unknown as { window: Record<string, unknown> }).window;
    return (happyWindow['document'] as Document).implementation.createHTMLDocument('scroll');
  }

  it('保存と復元ができる', () => {
    const from = makeScrollableDoc();
    from.documentElement.scrollTop = 123;
    from.documentElement.scrollLeft = 45;
    const pos = getScrollPosition(from);
    expect(pos).toEqual({ top: 123, left: 45 });

    const to = makeScrollableDoc();
    setScrollPosition(to, pos);
    expect(getScrollPosition(to)).toEqual({ top: 123, left: 45 });
  });

  it('文書が無ければゼロ位置になる', () => {
    expect(getScrollPosition(null)).toEqual({ top: 0, left: 0 });
    expect(getScrollPosition(undefined)).toEqual({ top: 0, left: 0 });
    expect(() => setScrollPosition(null, { top: 10, left: 10 })).not.toThrow();
  });
});

describe('ページ内リンク', () => {
  function makeAnchorDoc(): {
    doc: Document;
    EventCtor: new (type: string, init?: Record<string, unknown>) => Event;
  } {
    const happyWindow = (globalThis as unknown as { window: Record<string, unknown> }).window;
    const doc = (happyWindow['document'] as Document).implementation.createHTMLDocument(
      'anchor'
    );
    doc.body.innerHTML = [
      '<a href="#sec1">目次</a>',
      '<h3 id="sec1">見出し</h3>',
      '<a href="#missing">不明</a>',
      '<a href="https://example.test/page">外部</a>',
    ].join('');
    postProcessPreviewDocument(doc);
    return {
      doc,
      EventCtor: happyWindow['Event'] as new (
        type: string,
        init?: Record<string, unknown>
      ) => Event,
    };
  }

  it('#リンクは遷移せず対象へスクロールする', () => {
    const { doc } = makeAnchorDoc();
    const happyWindow = (globalThis as unknown as { window: Record<string, unknown> }).window;
    const EventCtor = happyWindow['Event'] as new (
      type: string,
      init?: Record<string, unknown>
    ) => Event;
    const link = doc.querySelector('a[href="#sec1"]') as HTMLAnchorElement;
    const scroller = (doc.scrollingElement ?? doc.documentElement) as HTMLElement;
    const rect = (top: number): DOMRect =>
      ({
        top,
        left: 0,
        right: 0,
        bottom: 0,
        x: 0,
        y: top,
        width: 0,
        height: 0,
        toJSON: () => ({}),
      }) as unknown as DOMRect;
    scroller.getBoundingClientRect = () => rect(0);
    const dest = doc.getElementById('sec1') as HTMLElement;
    dest.getBoundingClientRect = () => rect(250);
    scroller.scrollTop = 100;
    const event = new EventCtor('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(scroller.scrollTop).toBe(350);
  });

  it('対象が無い#リンクはそのままにする', () => {
    const { doc, EventCtor } = makeAnchorDoc();
    const link = doc.querySelector('a[href="#missing"]') as HTMLAnchorElement;
    const event = new EventCtor('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('修飾キー付きクリックはそのままにする', () => {
    const { doc } = makeAnchorDoc();
    const happyWindow = (globalThis as unknown as { window: Record<string, unknown> }).window;
    const MouseEventCtor = happyWindow['MouseEvent'] as new (
      type: string,
      init?: Record<string, unknown>
    ) => Event;
    const link = doc.querySelector('a[href="#sec1"]') as HTMLAnchorElement;
    const event = new MouseEventCtor('click', { bubbles: true, cancelable: true, ctrlKey: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });

  it('外部リンクのクリックは妨げない', () => {
    const { doc, EventCtor } = makeAnchorDoc();
    const link = doc.querySelector('a[href^="https"]') as HTMLAnchorElement;
    const event = new EventCtor('click', { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});
