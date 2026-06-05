/** `import.meta.hot`が持つ送信APIの最小型。 */
interface HotSender {
  send(event: string, data?: unknown): void;
}

/**
 * dev時のみ、UserScriptの実行時エラーをviteのHMR WebSocket経由でdevサーバーへ転送し、
 * ブラウザのコンソールだけでなく`bun dev`のターミナルにも出力させる。
 *
 * `import.meta.hot`は`vite build`ではundefinedになり、このブロックごとtree-shakeされるため、
 * 配布する`.user.js`には一切含まれない。
 */
export function setupDevErrorBridge(): void {
  // `@types/bun`と`vite/client`の両方が`import.meta.hot`を宣言し型が衝突するため、
  // 実際にvite devで使えるsend APIだけを最小型で取り出す。
  const hot = import.meta.hot as unknown as HotSender | undefined;
  if (!hot) return;

  // 自分のコードはdevサーバー（localhost）から配信される。
  // この起点と一致するエラーだけを拾い、Seesaa本体やPrototype.js由来のエラーは無視する。
  const devOrigin = new URL(import.meta.url).origin;

  const send = (kind: string, message: string, stack?: string) => {
    hot.send('seesaa:error', { kind, message, stack });
  };

  window.addEventListener('error', (event) => {
    if (!event.filename?.startsWith(devOrigin)) return;
    send('error', event.message, event.error?.stack);
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    const stack = reason instanceof Error ? reason.stack : undefined;
    // スタックがあり、かつdevサーバー由来でなければ他スクリプトのrejectionとみなして無視する。
    if (stack && !stack.includes(devOrigin)) return;
    const message = reason instanceof Error ? reason.message : String(reason);
    send('unhandledrejection', message, stack);
  });
}
