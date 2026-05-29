import { WikiPageType } from './constants.js';
import { getWikiPageType, getWikiId, getWikiPageUrl } from './utils/url.js';
import { decodeHTMLEntities } from './utils/encoding.js';
import { setupEditPage } from './features/edit.js';
import { setupDiffPage } from './features/diff.js';

const url = location.href;
const pageType = getWikiPageType(url);
const wikiId = getWikiId(url);

window.wikiId = wikiId;
window.getWikiPageUrl = getWikiPageUrl;
window.decodeHTMLEntities = decodeHTMLEntities;

if (pageType === WikiPageType.EDIT) {
  setupEditPage(url);
} else if (pageType === WikiPageType.DIFF) {
  setupDiffPage();
}
