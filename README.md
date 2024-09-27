# Seesaa Wiki Enhancer
[Seesaa Wiki]([text](https://wiki.seesaa.jp))の機能を強化するUserScriptです。

## 注意事項
**※本UserScriptは非公式です。**<br>
**※本UserScriptを使用することにより生じた損害について、作者は一切の責任を負いません。自己責任で使用してください。**<br>
**※本UserScriptを使用することにより何らかの異常が発生した場合、直ちに使用を中止してください。**

## 機能
- **[Monaco Editor](https://microsoft.github.io/monaco-editor/)の導入**
  - 編集画面のエディターを、Monaco Editorで置き換えます。これにより、高度な検索機能などが利用可能になります。
  - 差分画面もMonaco Editorで表示されます。
- **シンタックスハイライト**
- **アウトライン表示**
  - 見出しの一覧をツリー表示し、クリックすることでその見出しにジャンプできます。
- **キーボードショートカット**
  - 編集画面
    - `Ctrl+B`: 太字を挿入
    - `Ctrl+I`: 斜体を挿入
    - `Ctrl+U`: 下線を挿入
    - `Ctrl+K`: リンクを挿入
    - `Ctrl+D`: 打ち消し線を挿入
    - `Enter`: 画像ファイル検索のフォーム送信を実行
    - `Esc`: ポップアップウィンドウを閉じる
- その他
  - 編集画面でログインした際、部分編集が保たれるようにします。

## 使用方法
[Tampermonkey](https://www.tampermonkey.net)に、Releasesの最新の(`seesaawiki-enhancer.user.js`)をインストールしてください。

## 使用環境
PC版のみ対応します。モバイル版では動作しません。

ブラウザはChromium系(Google Chrome, Microsoft Edge等)を推奨します。それ以外のブラウザでの動作は確認していません。
