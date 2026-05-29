import { decodeHTMLEntities } from '../utils/encoding.js';
import { buildIframeHtml } from '../iframe/build.js';

function extractDiffContent() {
  const diffBox = document.querySelector('.diff-box');
  if (!diffBox) return null;

  let innerHTML = diffBox.innerHTML;
  innerHTML = innerHTML.replace(/<br>|<\/span>/g, '');
  innerHTML = decodeHTMLEntities(innerHTML);

  const oldContent = innerHTML.replace(
    /<span class="line-add">.*?\n|<span class="line-delete">/g,
    ''
  );
  const newContent = innerHTML.replace(
    /<span class="line-delete">.*?\n|<span class="line-add">/g,
    ''
  );

  return { oldContent, newContent };
}

function createDiffEditorContainer() {
  const container = document.createElement('div');
  container.id = 'monaco-editor-container';
  container.style.width = '100%';
  container.style.height = 'max(calc(100vh - 350px), 500px)';
  container.style.marginBottom = '20px';
  container.style.position = 'relative';
  container.style.border = '1px solid #ccc';
  return container;
}

export async function setupDiffPage() {
  const diffBox = document.querySelector('.diff-box');
  if (!diffBox) return;

  diffBox.style.display = 'none';
  const infoBox = document.getElementsByClassName('information-box')[0];
  if (infoBox) infoBox.style.display = 'none';

  const diffContent = extractDiffContent();
  if (!diffContent) return;

  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.height = 'max(calc(100vh - 350px), 500px)';
  iframe.style.border = '1px solid #ccc';
  iframe.style.marginBottom = '20px';

  diffBox.parentNode.insertBefore(iframe, diffBox);

  const iframeWindow = iframe.contentWindow;
  const iframeDocument = iframe.contentDocument || iframe.contentWindow.document;

  iframeDocument.open();
  iframeDocument.write(buildIframeHtml({ mode: 'diff', wikiId: window.wikiId }));
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
      if (iframeWindow.monaco && iframeWindow.__seesaawikiDiffReady) {
        window.removeEventListener('message', onMessage);
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });

  const monaco = iframeWindow.monaco;
  const diffEditor = iframeWindow.createSeesaawikiDiffEditor(
    diffContent.oldContent,
    diffContent.newContent
  );
  window.monacoEditor = diffEditor;

  diffEditor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.DownArrow, () =>
    diffEditor.goToDiff('next')
  );
  diffEditor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.UpArrow, () =>
    diffEditor.goToDiff('previous')
  );
}
