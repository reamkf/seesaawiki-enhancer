import { addCSS } from '../utils/dom.js';
import { api } from '../editor/api.js';
import { editStyles } from '../editor/styles.js';

function setupLoginReturn(url) {
  const login = document.getElementsByClassName('login');
  if (login && login[0]) {
    const elem = login[0].firstChild;
    if (elem && elem.href && !elem.href.includes('&return_to=')) {
      elem.href += '&return_to=' + encodeURIComponent(url);
    }
  }
}

function setupSearchFile() {
  const searchDescriptionInput = document.getElementById('search-description');
  if (searchDescriptionInput) {
    searchDescriptionInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        searchDescriptionInput.nextElementSibling.click();
      }
    });
  }
}

function setupItemSearchEscape() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && globalThis.editor?.item_search) {
      globalThis.editor.item_search.hide(globalThis.editor.item_search);
    }
  });
}

function setupEditorWidth() {
  const wikiContainer = document.getElementById('wiki-container');
  const wikiContent = document.getElementById('wiki-content');
  if (!wikiContainer || !wikiContent) return;

  const originalWidth = wikiContent.style.getPropertyValue('width');
  const originalMargin0 = wikiContainer.style.getPropertyValue('margin');
  const originalMargin1 = wikiContent.style.getPropertyValue('margin');

  const widen = () => {
    wikiContent.style.setProperty(
      'width',
      `max(calc(100vw - 100px), ${originalWidth})`,
      'important'
    );
    wikiContainer.style.setProperty('margin', '0', 'important');
    wikiContent.style.setProperty('margin', '10px 20px 0', 'important');
  };
  const narrow = () => {
    wikiContent.style.setProperty('width', originalWidth);
    wikiContainer.style.setProperty('margin', originalMargin0);
    wikiContent.style.setProperty('margin', originalMargin1);
  };
  widen();

  const previewContainer = document.getElementById('preview-container');
  if (previewContainer) {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          narrow();
          break;
        }
      }
    });
    observer.observe(previewContainer, { childList: true, subtree: true });
  }

  document.querySelectorAll('.edit > a').forEach((edit) => {
    edit.addEventListener('click', widen);
  });

  addCSS(`
    /* 高さを増やす */
    #content, .user-area { /* editor window, preview-window */
      height: max(calc(100vh - 500px), 500px) !important;
    }

    /* 余白を減らす */
    #page-body {
      margin-bottom: 0 !important;
    }
    #page-footer, #page-footer-inner {
      display: none !important;
    }
  `);
}

function bindToolbar(api, editor) {
  const click = (selector, handler, byClass = false) => {
    const el = byClass
      ? document.getElementsByClassName(selector)[0]
      : document.getElementById(selector);
    if (el) el.addEventListener('click', handler);
  };

  click('bt-undo', () => editor.trigger('source', 'undo'), true);
  click('bt-redo', () => editor.trigger('source', 'redo'), true);
  click('bold', () => api.wrapSelectedText(editor, "''", "''"));
  click('italic', () => api.wrapSelectedText(editor, "'''", "'''"));
  click('underline', () => api.wrapSelectedText(editor, '%%%', '%%%'));
  click('ul', () => api.insertAtBeginningOfLine(editor, '-', 3));
  click('ol', () => api.insertAtBeginningOfLine(editor, '+', 3));
  click('h2', () => api.insertAtBeginningOfLine(editor, '+', 3));
  click('strike', () => api.wrapSelectedText(editor, '%%', '%%'));
  click('toggle_open', () => api.wrapSelectedText(editor, '[+]\n', '\n[END]'));
  click('toggle_close', () => api.wrapSelectedText(editor, '[-]\n', '\n[END]'));
  click('blockquote', () => api.insertAtBeginningOfLine(editor, '>', 1));
  click('annotation', () => api.wrapSelectedText(editor, '((', '))'));
}

function setupOutlineView({ outlineContent, editor }) {
  const symbolProvider = new api.SymbolProvider(api.monaco);
  if (!outlineContent) return;

  const renderSymbols = (symbols) => {
    outlineContent.innerHTML = '';

    const renderSymbolsRecursive = (symbols, container) => {
      symbols.forEach((symbol) => {
        const item = document.createElement('div');
        item.className = 'swe-outline-item';
        item.textContent = symbol.name;
        item.onclick = (e) => {
          e.stopPropagation();
          outlineContent
            .querySelectorAll('.swe-outline-item')
            .forEach((el) => el.classList.remove('is-active'));
          item.classList.add('is-active');
          editor.revealPositionInCenter({
            lineNumber: symbol.range.startLineNumber,
            column: symbol.range.startColumn,
          });
          editor.setPosition({
            lineNumber: symbol.range.startLineNumber,
            column: symbol.range.startColumn,
          });
          editor.focus();
        };
        container.appendChild(item);

        if (symbol.children && symbol.children.length > 0) {
          const childrenContainer = document.createElement('div');
          childrenContainer.className = 'swe-outline-children';
          renderSymbolsRecursive(symbol.children, childrenContainer);
          container.appendChild(childrenContainer);
        }
      });
    };

    renderSymbolsRecursive(symbols, outlineContent);
  };

  const update = () => {
    let symbols;
    try {
      symbols = symbolProvider.provideDocumentSymbols(editor.getModel());
    } catch (error) {
      console.error('Error retrieving document symbols:', error);
      return;
    }
    if (symbols && typeof symbols.then === 'function') {
      symbols.then(renderSymbols).catch((error) => {
        console.error('Error retrieving document symbols:', error);
      });
    } else {
      renderSymbols(symbols);
    }
  };

  editor.onDidChangeModelContent(update);
  update();
}

function setupFormSubmit({ textarea, editor }) {
  let lastSavedVersionId = editor.getModel().getAlternativeVersionId();

  const isDirty = () =>
    editor.getModel().getAlternativeVersionId() !== lastSavedVersionId;

  window.addEventListener('beforeunload', (event) => {
    if (isDirty()) {
      event.preventDefault();
      event.returnValue = '';
    }
  });

  const form = textarea.closest('form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      lastSavedVersionId = editor.getModel().getAlternativeVersionId();
      textarea.value = editor.getModel().getValue();
      form.submit();
    });
  }

  document.querySelectorAll('.preview > a').forEach((preview) => {
    preview.addEventListener('click', (e) => {
      e.preventDefault();
      textarea.value = editor.getModel().getValue();
      if (globalThis.editor?.tools?.toPreview) {
        globalThis.editor.tools.toPreview();
      } else {
        console.warn('editor.tools.toPreview is not available');
        if (form) form.submit();
      }
    });
  });
}

function setupItemSearchTemplate(api, editor) {
  const insertEventName = 'seesaawiki:insertFromItemSearch';

  window.addEventListener(insertEventName, (event) => {
    const { text, selected = true } = event.detail || {};
    if (typeof text !== 'string') return;
    const position = editor.getPosition();
    const range = new api.monaco.Range(
      position.lineNumber,
      position.column,
      position.lineNumber,
      position.column
    );
    editor.executeEdits('', [
      {
        range: selected ? editor.getSelection() : range,
        text,
      },
    ]);
  });

  const itemSearchTemplateTextArea = document.querySelector(
    'textarea#itemsearch_results.template'
  );
  if (!itemSearchTemplateTextArea) return;

  let content = itemSearchTemplateTextArea.value;
  content = content.replace(/editor\.buffer\.savePoint\(\);/g, '');
  content = content.replace(
    /editor\.item_search\.insertString\((.*?)\);/g,
    `window.dispatchEvent(new CustomEvent('${insertEventName}',{detail:{text:$1}}));`
  );
  itemSearchTemplateTextArea.value = content;
}

function initMonacoEditor({ getWikiPageUrl, decodeHTMLEntities }) {
  const textarea = document.getElementById('content');
  if (!textarea) return;
  textarea.style.display = 'none';
  textarea.readOnly = true;

  addCSS(editStyles);

  const root = document.createElement('div');
  root.className = 'swe-edit-container';
  root.style.width = '100%';
  root.style.height = 'max(calc(100vh - 500px), 750px)';

  const outlineContainer = document.createElement('div');
  outlineContainer.className = 'swe-outline-container';

  const outlineLabel = document.createElement('div');
  outlineLabel.className = 'swe-outline-label';
  outlineLabel.textContent = 'OUTLINE';

  const outlineContent = document.createElement('div');
  outlineContent.className = 'swe-outline-content';

  outlineContainer.append(outlineLabel, outlineContent);

  const container = document.createElement('div');
  container.className = 'swe-monaco-container';

  root.append(outlineContainer, container);

  const wideAreaButton = document.getElementById('wide_area_button');
  if (wideAreaButton) {
    wideAreaButton.addEventListener('click', () => {
      if (globalThis.editor?.wide_area_mode?.is_wide) {
        root.style.height = 'max(calc(100vh - 500px), 750px)';
      } else {
        root.style.height = 'max(calc(100vh - 150px), 750px)';
      }
    });
  }

  textarea.parentNode.insertBefore(root, textarea);

  api.setContext({ getWikiPageUrl, decodeHTMLEntities });

  const editor = api.createEditor(container, { value: textarea.value });

  bindToolbar(api, editor);
  setupOutlineView({ outlineContent, editor });
  setupFormSubmit({ textarea, editor });
  setupItemSearchTemplate(api, editor);
}

export function setupEditPage({ url, getWikiPageUrl, decodeHTMLEntities }) {
  initMonacoEditor({ getWikiPageUrl, decodeHTMLEntities });
  setupLoginReturn(url);
  setupSearchFile();
  setupItemSearchEscape();
  setupEditorWidth();
}
