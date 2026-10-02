import { describe, it, expect } from 'bun:test';
import {
  createPreviewDom,
  getScrollPosition,
  postProcessPreviewDocument,
  setScrollPosition,
  setupPreviewPane,
  type SetupPreviewPaneArgs,
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

describe('setupPreviewPane', () => {
  function makeEditor(source: { value: string }): SetupPreviewPaneArgs['editor'] {
    return {
      getModel: () => ({ getValue: () => source.value }),
      onDidChangeModelContent: () => ({ dispose: () => undefined }),
    } as unknown as SetupPreviewPaneArgs['editor'];
  }

  function eventConstructor(): new (type: string, init?: Record<string, unknown>) => Event {
    const happyWindow = (globalThis as unknown as { window: Record<string, unknown> }).window;
    return happyWindow['Event'] as new (
      type: string,
      init?: Record<string, unknown>
    ) => Event;
  }

  it('初回load前の変更は最新内容に収束し、iframeを再利用する', () => {
    const source = { value: '初期本文' };
    const { wrapper, frame } = createPreviewDom();
    document.body.append(wrapper);
    const pane = setupPreviewPane({
      editor: makeEditor(source),
      rightPane: wrapper,
      frame,
      debounceMs: 0,
    });
    const EventCtor = eventConstructor();

    try {
      source.value = '最新本文';
      pane.update();
      frame.dispatchEvent(new EventCtor('load'));

      expect(wrapper.querySelectorAll('iframe')).toHaveLength(1);
      expect(frame.contentDocument?.body.innerHTML).toContain('最新本文');
      expect(frame.contentDocument?.body.innerHTML).not.toContain('初期本文');
    } finally {
      pane.dispose();
      wrapper.remove();
    }
  });

  it('差分更新で画像・折り畳み状態・リンク属性を保持する', () => {
    const source = {
      value: '[+]折り畳み\n中身\n[END]\n[[外部>>https://example.com/a]]\n&ref(https://example.com/image.png)',
    };
    const { wrapper, frame } = createPreviewDom();
    document.body.append(wrapper);
    const pane = setupPreviewPane({
      editor: makeEditor(source),
      rightPane: wrapper,
      frame,
      debounceMs: 0,
    });
    const EventCtor = eventConstructor();

    try {
      frame.dispatchEvent(new EventCtor('load'));
      const doc = frame.contentDocument;
      if (!doc) throw new Error('初回プレビュー文書がありません');
      doc.documentElement.scrollTop = 321;
      doc.documentElement.scrollLeft = 12;
      const image = doc.querySelector('img[src="https://example.com/image.png"]');
      const toggle = doc.querySelector('[data-swe-toggle]') as HTMLElement;
      const paneElement = doc.getElementById(
        toggle.getAttribute('data-swe-toggle') ?? ''
      ) as HTMLElement;
      const link = doc.querySelector('a[href="https://example.com/a"]') as HTMLAnchorElement;
      expect(image).not.toBeNull();
      toggle.dispatchEvent(new EventCtor('click', { bubbles: true }));
      expect(paneElement.style.display).toBe('');

      source.value =
        '先頭に追加\n[+]折り畳み\n中身\n[END]\n[[外部>>https://example.com/a]]\n&ref(https://example.com/image.png)';
      pane.update();

      expect(wrapper.querySelectorAll('iframe')).toHaveLength(1);
      expect(getScrollPosition(doc)).toEqual({ top: 321, left: 12 });
      expect(frame.contentDocument?.querySelector('img[src="https://example.com/image.png"]')).toBe(image);
      const nextToggle = doc.querySelector('[data-swe-toggle]') as HTMLElement;
      const nextPane = doc.getElementById(
        nextToggle.getAttribute('data-swe-toggle') ?? ''
      ) as HTMLElement;
      expect(nextPane).toBe(paneElement);
      expect(nextPane.style.display).toBe('');
      expect(nextToggle.classList.contains('toggle-link-open')).toBe(true);
      expect(link.target).toBe('_blank');
      expect(link.rel).toBe('noopener');

      source.value =
        'さらに追加\n先頭に追加\n[+]折り畳み\n中身\n[END]\n[[外部>>https://example.com/a]]\n&ref(https://example.com/image.png)';
      pane.update();
      const finalToggle = doc.querySelector('[data-swe-toggle]') as HTMLElement;
      const finalPane = doc.getElementById(
        finalToggle.getAttribute('data-swe-toggle') ?? ''
      ) as HTMLElement;
      expect(finalPane).toBe(paneElement);
      expect(finalPane.style.display).toBe('');
      expect(finalToggle.classList.contains('toggle-link-open')).toBe(true);

      finalToggle.dispatchEvent(new EventCtor('click', { bubbles: true }));
      expect(nextPane.style.display).toBe('none');
    } finally {
      pane.dispose();
      wrapper.remove();
    }
  });

  it('連続更新では最後の内容だけを表示する', () => {
    const source = { value: '初期' };
    const { wrapper, frame } = createPreviewDom();
    document.body.append(wrapper);
    const pane = setupPreviewPane({
      editor: makeEditor(source),
      rightPane: wrapper,
      frame,
      debounceMs: 0,
    });
    const EventCtor = eventConstructor();

    try {
      frame.dispatchEvent(new EventCtor('load'));
      source.value = '挿入';
      pane.update();
      source.value = '削除後の最新';
      pane.update();

      expect(wrapper.querySelectorAll('iframe')).toHaveLength(1);
      expect(frame.contentDocument?.body.innerHTML).toContain('削除後の最新');
      expect(frame.contentDocument?.body.innerHTML).not.toContain('挿入');
    } finally {
      pane.dispose();
      wrapper.remove();
    }
  });

  it('欠落ページの古い非同期応答は新しいリンクを上書きしない', async () => {
    const originalFetch = globalThis.fetch;
    const resolvers: ((response: Response) => void)[] = [];
    globalThis.fetch = (() =>
      new Promise<Response>((resolve) => {
        resolvers.push(resolve);
      })) as unknown as typeof fetch;

    const source = { value: '[[古いページ]]' };
    const { wrapper, frame } = createPreviewDom();
    document.body.append(wrapper);
    const pane = setupPreviewPane({
      editor: makeEditor(source),
      rightPane: wrapper,
      frame,
      debounceMs: 0,
      wikiId: 'test-wiki',
      pageUrl: 'https://test.seesaawiki.jp/test-wiki/e/edit',
      getWikiPageUrl: (name) => `https://test.seesaawiki.jp/test-wiki/${name}`,
    });
    const EventCtor = eventConstructor();
    const missingResponse = {
      ok: false,
      url: 'https://test.seesaawiki.jp/test-wiki/e/add',
    } as Response;

    try {
      frame.dispatchEvent(new EventCtor('load'));
      source.value = '[[新しいページ]]';
      pane.update();
      expect(resolvers).toHaveLength(2);

      resolvers[0](missingResponse);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(frame.contentDocument?.body.innerHTML).toContain('新しいページ');
      expect(frame.contentDocument?.body.innerHTML).not.toContain('color:gray');

      resolvers[1](missingResponse);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(frame.contentDocument?.body.innerHTML).toContain('color:gray');
      expect(frame.contentDocument?.body.innerHTML).toContain('新しいページ');
      expect(frame.contentDocument?.body.innerHTML).not.toContain('古いページ');
    } finally {
      globalThis.fetch = originalFetch;
      pane.dispose();
      wrapper.remove();
    }
  });
});
