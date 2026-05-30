import { addCSS } from '../utils/dom.js';
import { api } from '../editor/api.js';
import { diffStyles } from '../editor/styles.js';

function extractDiffContent(decodeHTMLEntities) {
  const diffBox = document.querySelector('.diff-box');
  if (!diffBox) return null;

  let innerHTML = diffBox.innerHTML;
  innerHTML = innerHTML.replace(/<br>|<\/span>/g, '');
  innerHTML = decodeHTMLEntities(innerHTML, { stripAnchors: true });

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

export function setupDiffPage({ decodeHTMLEntities }) {
  const diffBox = document.querySelector('.diff-box');
  if (!diffBox) return;

  diffBox.style.display = 'none';
  const infoBox = document.getElementsByClassName('information-box')[0];
  if (infoBox) infoBox.style.display = 'none';

  const diffContent = extractDiffContent(decodeHTMLEntities);
  if (!diffContent) return;

  addCSS(diffStyles);

  const container = document.createElement('div');
  container.className = 'swe-diff-container';
  container.style.width = '100%';
  container.style.height = 'max(calc(100vh - 350px), 500px)';
  container.style.border = '1px solid #ccc';
  container.style.marginBottom = '20px';
  diffBox.parentNode.insertBefore(container, diffBox);

  const diffEditor = api.createDiffEditor(
    container,
    diffContent.oldContent,
    diffContent.newContent
  );

  diffEditor.addCommand(api.monaco.KeyMod.Alt | api.monaco.KeyCode.DownArrow, () =>
    diffEditor.goToDiff('next')
  );
  diffEditor.addCommand(api.monaco.KeyMod.Alt | api.monaco.KeyCode.UpArrow, () =>
    diffEditor.goToDiff('previous')
  );
}
