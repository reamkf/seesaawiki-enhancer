// 実ページ(HTML)と記法ソースのセットを使った回帰テスト。
// fixtureは https://seesaawiki.jp/kemono_friends3_5ch/ の実ページから取得。
import { describe, it, expect } from 'bun:test';
import { renderSeesaawikiToHtml } from '../../src/preview/renderer.js';
import { makeGetWikiPageUrl } from '../../src/utils/url.js';
import { encodeEUCJP } from '../../src/utils/encoding.js';
import { normalizePreviewHtml } from './normalize.js';

const WIKI_ID = 'kemono_friends3_5ch';
const getWikiPageUrl = makeGetWikiPageUrl(WIKI_ID);
// フィクスチャ中の唯一の未存在ページ(実ページで赤リンク表示)
const MISSING_PAGES = new Set(['その手を握って']);

async function loadFixture(name: string): Promise<{ src: string; expected: string }> {
  const base = new URL('./fixtures/', import.meta.url);
  const src = await Bun.file(new URL(`${name}.src.txt`, base)).text();
  const expected = await Bun.file(new URL(`${name}.expected.html`, base)).text();
  return { src, expected };
}

function firstDiffIndex(a: string, b: string): number {
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    if (a[i] !== b[i]) return i;
  }
  return len;
}

function assertSameStructure(name: string, actual: string, expected: string): void {
  // 実運用ではプレビュー本文が user-area クラスを持つため同条件で比較する
  const a = normalizePreviewHtml(`<div class="user-area">${actual}</div>`);
  const e = normalizePreviewHtml(expected);
  if (a === e) return;
  const at = firstDiffIndex(a, e);
  const context = (s: string): string =>
    JSON.stringify(s.slice(Math.max(0, at - 200), at + 300));
  throw new Error(
    `${name}: normalized HTML mismatch at ${at} (actual ${a.length} chars, expected ${e.length} chars)\nactual  : ${context(a)}\nexpected: ${context(e)}`
  );
}

describe('実ページフィクスチャ', () => {
  it('用語集ページを実ページと同形に変換する', async () => {
    const { src, expected } = await loadFixture('yogo');
    const actual = renderSeesaawikiToHtml(src, {
      getWikiPageUrl,
      isExistingPage: (name) => !MISSING_PAGES.has(name),
      getWikiAddUrl: (name) => `https://seesaawiki.jp/${WIKI_ID}/e/add?pagename=${encodeEUCJP(name)}`,
    });
    assertSameStructure('yogo', actual, expected);
  });

  it('ちからくらべページを実ページと同形に変換する', async () => {
    const { src, expected } = await loadFixture('chikara');
    const actual = renderSeesaawikiToHtml(src, {
      getWikiPageUrl,
      isExistingPage: (name) => !MISSING_PAGES.has(name),
      getWikiAddUrl: (name) => `https://seesaawiki.jp/${WIKI_ID}/e/add?pagename=${encodeEUCJP(name)}`,
    });
    assertSameStructure('chikara', actual, expected);
  });
});
