# Seesaa Wiki Enhancer
[Seesaa Wiki]([text](https://wiki.seesaa.jp))の編集機能を強化するUserScriptです。

## 注意事項
**※本UserScriptは非公式です。**<br>
**※本UserScriptを使用することにより生じた損害について、作者は一切の責任を負いません。自己責任で使用してください。**<br>
**※本UserScriptを使用することにより何らかの異常が発生した場合、直ちに使用を中止してください。**

## 機能
- **[Monaco Editor](https://microsoft.github.io/monaco-editor/)の導入**
  - 編集画面のエディターを、Monaco Editorで置き換えます。これにより、検索・置換機能をはじめとする高度な編集機能が利用可能になります。
  - 差分画面もMonaco Editorで表示されます。
- **シンタックスハイライト**
- **アウトライン表示**
  - エディターの横に見出しの一覧がツリー表示され、クリックするとその見出しにジャンプできます。
- **キーボードショートカット**
  - 編集画面
    - `Ctrl+B`: 太字を挿入
    - `Ctrl+I`: 斜体を挿入
    - `Ctrl+U`: 下線を挿入
    - `Ctrl+K`: リンクを挿入
    - `Ctrl+D`: 打ち消し線を挿入
    - `Enter`: 画像ファイル検索のフォーム送信を実行
    - `Esc`: ポップアップウィンドウを閉じる
    - `Enter`:
      - 箇条書き記法/引用記法を新しい行に自動追加。さらにEnterを押すと記法を削除
      - 表の最後の場合、箇条書きと同様
      - 表の途中の場合、次の行の同じ列のセルへ移動
    - `Tab`:
      - 箇条書きの階層を下げる
      - 表の次のセルへ移動
    - `Shift+Enter`, `Shift+Tab`: 逆の動作
  - 差分画面
    - `Alt+↓`: 次の変更点へジャンプ
    - `Alt+↑`: 前の変更点へジャンプ
- その他
  - Color Decolation: 色を指定する記法において、色表現の左にその色を示す小さい四角を表示します。
  - Color Picker: Color Decorationをクリックすると表示され、色を選択できます。
  - 編集画面でログインした際、部分編集が保たれるようにします。

## 使用環境
PC版のみ対応します。モバイル版では動作しません。

ブラウザはChromium系(Google Chrome, Microsoft Edge等)を推奨します。それ以外のブラウザでの動作は確認していません。

## インストール方法
1. [Tampermonkey](https://www.tampermonkey.net)をインストールする
2. [最新のRelease](https://github.com/reamkf/seesaawiki-enhancer/releases/latest)の`seesaawiki-enhancer.user.js` [[直リンク]](https://github.com/reamkf/seesaawiki-enhancer/releases/latest/download/seesaawiki-enhancer.user.js) をクリックする
3. Tampermonkeyのインストール画面が表示されるので、インストールをクリックする

※ブラウザの開発者モードを有効化する必要がある可能性があります。詳しくは[こちら](https://www.tampermonkey.net/faq.php?locale=ja#Q209)を参照

## 更新方法
Tampermonkeyの更新機能に対応しているため、Tampermonkeyの自動更新機能を用いる(推奨)か、スクリプト設定画面から更新を行ってください。

## 既知の問題
- 元のエディターのツールバーの一部が機能しない
  - → 現状対応予定なし。人力で書いてください。
- ファイルが大きい場合に途中からシンタックスハイライトやColor Decoratorが効かなくなる
  - → これはMonaco Editorの(デフォルト設定での)仕様です。処理が重くなるのを避けるために、解析する量に上限を設けています。

## 今後実装したい機能
- より多くのシンタックスへのシンタックスハイライト対応
- Snippet機能
- 画像コピペ機能
- Completion機能
- ページ参照(`[[ページ名]]`)やアンカー(`[[#anchor]]`)をCtrl+クリックしてジャンプする機能
- 画像プレビュー機能
- テーマ変更機能
- 一時的に元のエディターに戻す機能
- 差分画面→編集画面へのリンク追加
- アンカーのリネーム機能

## 実装予定のない機能
- Folding Range
  - 実際あんまり使わない割に重くなる気がするので
- ページをまたいだ連携