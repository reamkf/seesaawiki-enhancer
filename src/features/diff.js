import { waitForIframeReady } from '../utils/iframe.js';
import { buildIframeHtml } from '../iframe/build.js';

function extractDiffContent(decodeHTMLEntities) {
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

export async function setupDiffPage({ decodeHTMLEntities }) {
  const diffBox = document.querySelector('.diff-box');
  if (!diffBox) return;

  diffBox.style.display = 'none';
  const infoBox = document.getElementsByClassName('information-box')[0];
  if (infoBox) infoBox.style.display = 'none';

  const diffContent = extractDiffContent(decodeHTMLEntities);
  if (!diffContent) return;

  const iframe = document.createElement('iframe');
  iframe.style.width = '100%';
  iframe.style.height = 'max(calc(100vh - 350px), 500px)';
  iframe.style.border = '1px solid #ccc';
  iframe.style.marginBottom = '20px';
  diffBox.parentNode.insertBefore(iframe, diffBox);

  const iframeWindow = iframe.contentWindow;
  const iframeDocument = iframe.contentDocument || iframe.contentWindow.document;

  const readyPromise = waitForIframeReady(iframeWindow);
  iframeDocument.open();
  iframeDocument.write(buildIframeHtml('diff'));
  iframeDocument.close();

  await readyPromise;

  const api = iframeWindow.__seesaawikiApi;
  const diffEditor = api.createDiffEditor(diffContent.oldContent, diffContent.newContent);

  diffEditor.addCommand(api.monaco.KeyMod.Alt | api.monaco.KeyCode.DownArrow, () =>
    diffEditor.goToDiff('next')
  );
  diffEditor.addCommand(api.monaco.KeyMod.Alt | api.monaco.KeyCode.UpArrow, () =>
    diffEditor.goToDiff('previous')
  );
}
