import { defineConfig } from 'vite';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

export default defineConfig({
  plugins: [cssInjectedByJsPlugin({ relativeCSSInjection: true })],
  build: {
    target: 'esnext',
    outDir: 'dist-iframe',
    emptyOutDir: true,
    lib: {
      entry: 'src/iframe/entry.js',
      name: 'SeesaaWikiIframe',
      formats: ['iife'],
      fileName: () => 'iframe.iife.js',
    },
    cssCodeSplit: false,
    minify: 'esbuild',
  },
});
