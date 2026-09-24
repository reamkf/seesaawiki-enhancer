export const previewStyles = `
  .swe-main-split {
    display: flex;
    flex: 1;
    min-width: 0;
    min-height: 0;
    position: relative;
  }
  .swe-monaco-container {
    flex: 1 1 50%;
    min-width: 0;
  }
  .swe-preview-wrapper {
    flex: 1 1 50%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    border-left: 1px solid #333;
  }
  .swe-preview-label {
    padding: 10px 12px 6px;
    font-weight: bold;
    font-size: 14px;
    background: #2d2d2d;
    color: #d4d4d4;
    border-bottom: 1px solid #333;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }
  .swe-preview-toggle {
    font-size: 12px;
    font-weight: normal;
    padding: 2px 8px;
    border: 1px solid #555;
    border-radius: 3px;
    background: #3c3c3c;
    color: #d4d4d4;
    cursor: pointer;
  }
  .swe-preview-toggle:hover {
    background: #094771;
    border-color: #007acc;
  }
  /* 本文はiframe内の独立文書で描画し、wikiのテーマCSSをそのまま適用する。
     ここではレイアウトのみ指定する。 */
  .swe-preview-frame {
    flex: 1;
    min-height: 0;
    width: 100%;
    border: 0;
    padding: 0;
  }
  .swe-preview-toc {
    border: 1px solid #ccc;
    padding: 8px 12px;
    margin: 0.8em 0;
  }
  .swe-preview-toc-title {
    font-weight: bold;
    margin-bottom: 4px;
  }
  .swe-preview-fold {
    border: 1px solid #ccc;
    padding: 4px 8px;
    margin: 0.8em 0;
  }
  .swe-preview-fukidashi {
    border: 1px solid #ccc;
    border-radius: 8px;
    padding: 8px 12px;
    margin: 0.8em 0;
  }
  .swe-preview-footnotes {
    font-size: 0.9em;
  }
  .swe-preview-placeholder,
  .swe-preview-embed,
  .swe-preview-special,
  .swe-preview-attach {
    margin: 0.4em 0;
  }
  /* 非表示時はラッパーごと消し、再表示用のフローティングボタンを残す */
  .swe-edit-container.swe-hide-preview .swe-preview-wrapper {
    display: none;
  }
  .swe-edit-container.swe-hide-preview .swe-monaco-container {
    flex-basis: 100%;
  }
  /* 開くボタンはペイン内の非表示ボタンと同スタイルで右上に配置。
     minimapと縦スクロールバーに重ならないよう右端から逃がす。 */
  .swe-preview-fab {
    position: absolute;
    top: 10px;
    right: 130px;
    z-index: 60;
    display: none;
    font-size: 12px;
    font-weight: normal;
    padding: 2px 8px;
    border: 1px solid #555;
    border-radius: 3px;
    background: #3c3c3c;
    color: #d4d4d4;
    cursor: pointer;
  }
  .swe-preview-fab:hover {
    background: #094771;
    border-color: #007acc;
  }
  .swe-edit-container.swe-hide-preview .swe-preview-fab {
    display: block;
  }
`;
