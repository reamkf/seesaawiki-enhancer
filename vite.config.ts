import { defineConfig, type Plugin } from 'vite';
import monkey from 'vite-plugin-monkey';
import pkg from './package.json' with { type: 'json' };

/**
 * UserScriptがHMR WebSocket経由で送ってくる実行時エラーを受け取り、
 * `bun dev`のターミナルに出力する（dev時のみ）。送信側は`src/dev/errorBridge.ts`。
 */
function userscriptErrorBridge(): Plugin {
  return {
    name: 'seesaa:error-bridge',
    apply: 'serve',
    configureServer(server) {
      server.ws.on(
        'seesaa:error',
        (data: { kind?: string; message?: string; stack?: string }) => {
          const { kind = 'error', message = '', stack } = data ?? {};
          server.config.logger.error(
            `\x1b[31m[userscript:${kind}]\x1b[0m ${message}${stack ? `\n${stack}` : ''}`,
          );
        },
      );
    },
  };
}

export default defineConfig({
  plugins: [
    userscriptErrorBridge(),
    monkey({
      entry: 'src/main.ts',
      userscript: {
        name: 'Seesaa Wiki Enhancer',
        namespace: 'https://github.com/reamkf/seesaawiki-enhancer',
        version: pkg.version,
        author: '@_ream_kf',
        license: 'MIT',
        icon: 'https://www.google.com/s2/favicons?domain=seesaawiki.jp',
        match: [
          'https://seesaawiki.jp/*',
          'https://*.memo.wiki/*',
          'https://*.game-info.wiki/*',
          'https://*.sokuhou.wiki/*',
          'https://*.chronicle.wiki/*',
          'https://*.playing.wiki/*',
        ],
        updateURL:
          'https://github.com/reamkf/seesaawiki-enhancer/releases/latest/download/seesaawiki-enhancer.meta.js',
        downloadURL:
          'https://github.com/reamkf/seesaawiki-enhancer/releases/latest/download/seesaawiki-enhancer.user.js',
        grant: 'none',
      },
      build: {
        fileName: 'seesaawiki-enhancer.user.js',
        metaFileName: 'seesaawiki-enhancer.meta.js',
      },
    }),
  ],
});
