import { addCSS } from '../utils/dom.js';
import { buildIframeHtml } from '../iframe/build.js';

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
    if (e.key === 'Escape') {
      // eslint-disable-next-line no-undef
      editor.item_search.hide(editor.item_search);
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

async function initMonacoEditor() {
  const textarea = document.getElementById('content');
  if (!textarea) return;
  textarea.style.display = 'none';
  textarea.readOnly = true;

  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.height = 'max(calc(100vh - 500px), 750px)';
  iframe.style.border = 'none';

  const wideAreaButton = document.getElementById('wide_area_button');
  if (wideAreaButton) {
    wideAreaButton.addEventListener('click', () => {
      // eslint-disable-next-line no-undef
      if (editor.wide_area_mode.is_wide) {
        iframe.style.height = 'max(calc(100vh - 500px), 750px)';
      } else {
        iframe.style.height = 'max(calc(100vh - 150px), 750px)';
      }
    });
  }

  textarea.parentNode.insertBefore(iframe, textarea);
  textarea.style.display = 'none';

  const iframeWindow = iframe.contentWindow;
  const iframeDocument = iframe.contentDocument || iframe.contentWindow.document;

  iframeDocument.open();
  iframeDocument.write(buildIframeHtml({ mode: 'edit', wikiId: window.wikiId }));
  iframeDocument.close();

  await new Promise((resolve) => {
    const onMessage = (event) => {
      if (event.data === 'monacoReady') {
        window.removeEventListener('message', onMessage);
        resolve();
      }
    };
    window.addEventListener('message', onMessage);
    const check = () => {
      if (iframeWindow.monaco && iframeWindow.monacoEditor) {
        window.removeEventListener('message', onMessage);
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });

  const monaco = iframeWindow.monaco;
  const monacoEditor = iframeWindow.monacoEditor;
  window.monaco = monaco;
  window.monacoEditor = monacoEditor;

  monacoEditor.setValue(textarea.value);

  const SeesaaWikiDocumentSymbolProvider = iframeWindow.SeesaaWikiDocumentSymbolProvider;
  const symbolProvider = new SeesaaWikiDocumentSymbolProvider(monaco);

  function renderSymbols(symbols, editor) {
    const outlineContent = iframeDocument.getElementById('outline-content');
    outlineContent.innerHTML = '';

    function renderSymbolsRecursive(symbols, container) {
      symbols.forEach((symbol) => {
        const item = iframeDocument.createElement('div');
        item.className = 'outline-item';
        item.textContent = symbol.name;
        item.onclick = (e) => {
          e.stopPropagation();
          outlineContent
            .querySelectorAll('.outline-item')
            .forEach((el) => el.classList.remove('active'));
          item.classList.add('active');
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
          const childrenContainer = iframeDocument.createElement('div');
          childrenContainer.className = 'outline-children';
          renderSymbolsRecursive(symbol.children, childrenContainer);
          container.appendChild(childrenContainer);
        }
      });
    }

    renderSymbolsRecursive(symbols, outlineContent);
  }

  function updateOutlineView(editor) {
    const model = editor.getModel();
    let symbols;
    try {
      symbols = symbolProvider.provideDocumentSymbols(model);
    } catch (error) {
      console.error('Error retrieving document symbols:', error);
      return;
    }
    if (symbols && typeof symbols.then === 'function') {
      symbols
        .then((resolved) => renderSymbols(resolved, editor))
        .catch((error) => {
          console.error('Error retrieving document symbols:', error);
        });
    } else {
      renderSymbols(symbols, editor);
    }
  }

  monacoEditor.onDidChangeModelContent(() => {
    updateOutlineView(monacoEditor);
  });
  updateOutlineView(monacoEditor);

  let lastSavedVersionId;
  function updateLastSavedVersionId() {
    const model = monacoEditor.getModel();
    if (model) {
      lastSavedVersionId = model.getAlternativeVersionId();
    }
  }
  updateLastSavedVersionId();

  function isDirty() {
    const model = monacoEditor.getModel();
    if (model) {
      const currentVersionId = model.getAlternativeVersionId();
      return currentVersionId !== lastSavedVersionId;
    }
    return false;
  }

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
      updateLastSavedVersionId();
      textarea.value = iframeWindow.monacoEditor.getModel().getValue();
      form.submit();
    });
  }

  document.querySelectorAll('.preview > a').forEach((preview) => {
    preview.addEventListener('click', (e) => {
      e.preventDefault();
      textarea.value = iframeWindow.monacoEditor.getModel().getValue();
      if (window.editor && window.editor.tools && window.editor.tools.toPreview) {
        window.editor.tools.toPreview();
      } else {
        console.warn('editor.tools.toPreview is not available');
        if (form) form.submit();
      }
    });
  });

  window.monacoInsertString = (str, selected = true) => {
    const ed = window.monacoEditor;
    const position = ed.getPosition();
    const range = new monaco.Range(
      position.lineNumber,
      position.column,
      position.lineNumber,
      position.column
    );
    ed.executeEdits('', [
      {
        range: selected ? ed.getSelection() : range,
        text: str,
      },
    ]);
  };

  const itemSearchTemplateTextArea = document.querySelector(
    'textarea#itemsearch_results.template'
  );
  if (itemSearchTemplateTextArea) {
    let content = itemSearchTemplateTextArea.value;
    content = content.replace(/editor\.buffer\.savePoint\(\);/g, '');
    content = content.replace(
      /editor\.item_search\.insertString\((.*?)\);/g,
      'window.monacoInsertString($1);'
    );
    itemSearchTemplateTextArea.value = content;
  }
}

export function setupEditPage(url) {
  initMonacoEditor();
  setupLoginReturn(url);
  setupSearchFile();
  setupItemSearchEscape();
  setupEditorWidth();
}
