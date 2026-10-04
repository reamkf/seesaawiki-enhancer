import { WikiPageType } from './constants';
import { getWikiPageType, getWikiId, makeGetWikiPageUrl } from './utils/url';
import { decodeHTMLEntities } from './utils/encoding';
import { setupEditPage } from './features/edit';
import { setupDiffPage } from './features/diff';
import { setupDevErrorBridge } from './dev/errorBridge';

setupDevErrorBridge();

const url = location.href;
const pageType = getWikiPageType(url);
const wikiId = getWikiId(url);
const getWikiPageUrl = wikiId ? makeGetWikiPageUrl(wikiId) : null;

if (pageType === WikiPageType.EDIT) {
  setupEditPage({ url, wikiId, getWikiPageUrl, decodeHTMLEntities });
} else if (pageType === WikiPageType.DIFF) {
  setupDiffPage({ decodeHTMLEntities, getWikiPageUrl });
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
