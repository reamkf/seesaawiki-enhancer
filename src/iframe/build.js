import iframeBundle from '../../dist-iframe/iframe.iife.js?raw';
import { editIframeStyles, diffIframeStyles } from './styles.js';

export function buildIframeHtml(mode) {
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
      : `<div id="monaco-editor-container"></div>`;

  const styles = mode === 'edit' ? editIframeStyles : diffIframeStyles;

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
      <script>${iframeBundle}<\/script>
    </body>
    </html>
  `;
}
