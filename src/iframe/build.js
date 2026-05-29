import loadMonacoSrc from './load-monaco.js?raw';
import symbolProviderSrc from './symbol-provider.js?raw';
import helpersSrc from './helpers.js?raw';
import languageConfigSrc from './language-config.js?raw';
import colorProviderSrc from './color-provider.js?raw';
import linkProviderSrc from './link-provider.js?raw';
import hoverProviderSrc from './hover-provider.js?raw';
import completionProviderSrc from './completion-provider.js?raw';
import languageRegisterSrc from './language-register.js?raw';
import editorSrc from './editor.js?raw';
import diffEditorSrc from './diff-editor.js?raw';
import { editIframeStyles, diffIframeStyles } from './styles.js';

const iframeScriptParts = [
  loadMonacoSrc,
  symbolProviderSrc,
  helpersSrc,
  languageConfigSrc,
  colorProviderSrc,
  linkProviderSrc,
  hoverProviderSrc,
  completionProviderSrc,
  languageRegisterSrc,
  editorSrc,
  diffEditorSrc,
];

function buildBootstrap({ mode, wikiId }) {
  if (mode === 'edit') {
    return `
      (async () => {
        await loadMonacoEditor();
        window.monaco = monaco;
        window.SeesaaWikiDocumentSymbolProvider = SeesaaWikiDocumentSymbolProvider;
        registerSeesaaWikiLanguage();
        window.wikiId = ${JSON.stringify(wikiId)};
        replaceTextareaWithMonaco(window);
        window.parent.postMessage('monacoReady', '*');
      })();
    `;
  }
  return `
    (async () => {
      await loadMonacoEditor();
      window.monaco = monaco;
      window.SeesaaWikiDocumentSymbolProvider = SeesaaWikiDocumentSymbolProvider;
      registerSeesaaWikiLanguage();
      window.wikiId = ${JSON.stringify(wikiId)};
      window.createSeesaawikiDiffEditor = createSeesaawikiDiffEditor;
      window.__seesaawikiDiffReady = true;
      window.parent.postMessage('monacoReady', '*');
    })();
  `;
}

export function buildIframeHtml({ mode, wikiId }) {
  const body =
    mode === 'edit'
      ? `
        <div id="container">
          <div id="outline-container">
            <div id="outline-label">OUTLINE</div>
            <div id="outline-content"></div>
          </div>
          <div id="monaco-editor-container"></div>
        </div>
      `
      : `
        <div id="monaco-editor-container"></div>
      `;

  const styles = mode === 'edit' ? editIframeStyles : diffIframeStyles;
  const bootstrap = buildBootstrap({ mode, wikiId });

  return `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Seesaa Wiki Enhancer</title>
      <style>${styles}</style>
    </head>
    <body>
      ${body}
      <script>
        ${iframeScriptParts.join('\n')}
        ${bootstrap}
      </script>
    </body>
    </html>
  `;
}
