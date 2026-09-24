import { describe, it, expect } from 'bun:test';
import { previewStyles } from '../../src/preview/styles.js';

function ruleBody(css: string, selector: string): string | null {
  const match = css.match(new RegExp(`${selector}\\s*\\{([^}]*)\}`, 's'));
  return match ? match[1] : null;
}

describe('previewStyles', () => {
  it('プレビュー枠はテーマ色を強制しない(黒背景テーマ対応)', () => {
    // 配色・フォントはiframe内のテーマCSSに委ねる
    const wrapper = ruleBody(previewStyles, '\\.swe-preview-wrapper');
    expect(wrapper).not.toBeNull();
    expect(wrapper).not.toMatch(/(^|[;\s])color\s*:/i);
    expect(wrapper).not.toMatch(/background/i);
    expect(wrapper).not.toMatch(/font-family/i);
  });

  it('プレビューフレームのレイアウト規則を持つ', () => {
    const frame = ruleBody(previewStyles, '\\.swe-preview-frame');
    expect(frame).not.toBeNull();
    expect(frame).toMatch(/flex\s*:\s*1/);
    expect(frame).toMatch(/border\s*:\s*0/);
  });

  it('非表示時はラッパーごと消しFABで開き直す(幅を消費し続けない)', () => {
    expect(
      ruleBody(previewStyles, '\\.swe-edit-container\\.swe-hide-preview \\.swe-preview-wrapper')
    ).toMatch(/display\s*:\s*none/);
    const fab = ruleBody(previewStyles, '\\.swe-preview-fab');
    expect(fab).not.toBeNull();
    expect(fab).toMatch(/display\s*:\s*none/);
    // 開くボタンは右上配置・非表示ボタンと同スタイル
    expect(fab).toMatch(/top\s*:\s*\d+px/);
    expect(fab).toMatch(/right\s*:\s*\d+px/);
    expect(fab).not.toMatch(/bottom\s*:/);
    expect(fab).toMatch(/border-radius\s*:\s*3px/);
    expect(
      ruleBody(previewStyles, '\\.swe-edit-container\\.swe-hide-preview \\.swe-preview-fab')
    ).toMatch(/display\s*:\s*block/);
  });

  it('表示中は左右1:1の分割表示', () => {
    const wrapper = ruleBody(previewStyles, '\\.swe-preview-wrapper');
    expect(wrapper).not.toBeNull();
    expect(wrapper).not.toMatch(/position\s*:\s*absolute/);
    expect(wrapper).toMatch(/flex\s*:\s*1\s+1\s+50%/);
    const split = ruleBody(previewStyles, '\\.swe-main-split');
    expect(split).toMatch(/position\s*:\s*relative/);
  });
});
