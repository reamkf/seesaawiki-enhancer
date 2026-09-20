import { addCSS } from '../utils/dom.js';
import { api } from '../editor/api.js';
import { diffStyles } from '../editor/styles.js';
import { extractDiffContent } from './diff-content.js';
import type { DecodeHTMLEntitiesFn } from '../utils/encoding.js';
import type { GetWikiPageUrlFn } from '../utils/url.js';

export interface SetupDiffPageDeps {
  decodeHTMLEntities: DecodeHTMLEntitiesFn;
  getWikiPageUrl: GetWikiPageUrlFn | null;
}

export function setupDiffPage({ decodeHTMLEntities, getWikiPageUrl }: SetupDiffPageDeps): void {
  const diffBox = document.querySelector<HTMLElement>('.diff-box');
  if (!diffBox) return;

  diffBox.style.display = 'none';
  const infoBox = document.getElementsByClassName('information-box')[0] as HTMLElement | undefined;
  if (infoBox) infoBox.style.display = 'none';

  const diffContent = extractDiffContent(diffBox.innerHTML, decodeHTMLEntities);

  api.setContext({ getWikiPageUrl, decodeHTMLEntities });

  addCSS(diffStyles);

  const container = document.createElement('div');
  container.className = 'swe-diff-container';
  container.style.width = '100%';
  container.style.height = 'max(calc(100vh - 350px), 500px)';
  container.style.border = '1px solid #ccc';
  container.style.marginBottom = '20px';
  diffBox.parentNode!.insertBefore(container, diffBox);

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
