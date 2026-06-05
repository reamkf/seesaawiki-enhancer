import type { GetWikiPageUrlFn } from '../utils/url.js';
import type { DecodeHTMLEntitiesFn } from '../utils/encoding.js';

// 外部から注入される依存をエディタ関連モジュールで参照するためのモジュールスコープ
export interface EditorContext {
  getWikiPageUrl: GetWikiPageUrlFn | null;
  decodeHTMLEntities: DecodeHTMLEntitiesFn | null;
}

export const context: EditorContext = {
  getWikiPageUrl: null,
  decodeHTMLEntities: null,
};
