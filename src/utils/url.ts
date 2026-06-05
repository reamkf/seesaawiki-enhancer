import { WikiPageType } from '../constants.js';
import { convertCharRef, encodeEUCJP } from './encoding.js';

export function getWikiPageType(url: string): WikiPageType | null {
  const parsedUrl = new URL(url);
  const path = parsedUrl.pathname;
  const searchParams = parsedUrl.searchParams;

  if (path.includes('/d/')) {
    return WikiPageType.PAGE;
  } else if (path.includes('/l/')) {
    return WikiPageType.LIST;
  } else if (
    path.includes('/e/add') ||
    (path.includes('/e/edit') && searchParams.has('id'))
  ) {
    return WikiPageType.EDIT;
  } else if (path.includes('/e/attachment')) {
    return WikiPageType.ATTACHMENT;
  } else if (path.includes('/diff/')) {
    return WikiPageType.DIFF;
  } else if (path.includes('/hist/')) {
    return WikiPageType.HISTORY;
  } else if (path.includes('/search') && searchParams.has('keywords')) {
    return WikiPageType.SEARCH;
  } else if (path === '/' || path.endsWith('/')) {
    return WikiPageType.PAGE;
  }

  return null;
}

export function getWikiId(url: string): string | null {
  let match;

  match = url.match(/^https?:\/\/seesaawiki\.jp\/((?:w\/)?[^\/]+)/);
  if (match && match[1]) {
    return match[1];
  }

  match = url.match(/^https?:\/\/([^\.]+)\.(memo|game-info|sokuhou|chronicle|playing)\.wiki\//);
  if (match && match[1] && match[2]) {
    return match[1] + '-' + match[2];
  }

  return null;
}

export type GetWikiPageUrlFn = (pageName: string) => string;

export function makeGetWikiPageUrl(wikiId: string): GetWikiPageUrlFn {
  return (pageName) =>
    `https://seesaawiki.jp/${wikiId}/d/${encodeEUCJP(convertCharRef(pageName))}`;
}
