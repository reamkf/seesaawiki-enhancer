import { defineConfig } from 'vite';
import monkey from 'vite-plugin-monkey';

export default defineConfig({
  plugins: [
    monkey({
      entry: 'src/main.js',
      userscript: {
        name: 'Seesaa Wiki Enhancer',
        namespace: 'https://github.com/reamkf/seesaawiki-enhancer',
        version: '0.11.0',
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
