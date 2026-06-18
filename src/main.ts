import { WikiPageType } from './constants.js';
import { getWikiPageType, getWikiId, makeGetWikiPageUrl } from './utils/url.js';
import { decodeHTMLEntities } from './utils/encoding.js';
import { setupEditPage } from './features/edit.js';
import { setupDiffPage } from './features/diff.js';
import { setupDevErrorBridge } from './dev/errorBridge.js';

setupDevErrorBridge();

const url = location.href;
const pageType = getWikiPageType(url);
const wikiId = getWikiId(url);
const getWikiPageUrl = wikiId ? makeGetWikiPageUrl(wikiId) : null;

if (pageType === WikiPageType.EDIT) {
  setupEditPage({ url, getWikiPageUrl, decodeHTMLEntities });
} else if (pageType === WikiPageType.DIFF) {
  setupDiffPage({ decodeHTMLEntities });
} else if (pageType === WikiPageType.PAGE) {
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
      const editLink = document.querySelector<HTMLAnchorElement>('a.nav-edit');
      if (!editLink) return;
      e.preventDefault();
      location.href = editLink.href;
    }
  });
}
