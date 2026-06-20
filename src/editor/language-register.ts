import type * as monacoNs from 'monaco-editor';
import {
  setupSeesaawikiLanguageConfig,
  setupSeesaawikiTokens,
  setupSeesaawikiTheme,
} from './language-config.js';
import { SeesaaWikiDocumentSymbolProvider } from './symbol-provider.js';
import { SeesaaWikiFoldingRangeProvider } from './folding-range-provider.js';
import { setupSeesaawikiColorProvider } from './color-provider.js';
import { setupSeesaawikiLinkProvider } from './link-provider.js';
import { setupSeesaawikiHoverProvider } from './hover-provider.js';
import { setupSeesaawikiCompletionProvider } from './completion-provider.js';

type MonacoNamespace = typeof monacoNs;

export function registerSeesaaWikiLanguage(monaco: MonacoNamespace): void {
  setupSeesaawikiLanguageConfig(monaco);
  setupSeesaawikiTokens(monaco);
  setupSeesaawikiTheme(monaco);
  monaco.languages.registerDocumentSymbolProvider(
    'seesaawiki',
    new SeesaaWikiDocumentSymbolProvider(monaco)
  );
  monaco.languages.registerFoldingRangeProvider(
    'seesaawiki',
    new SeesaaWikiFoldingRangeProvider(monaco)
  );
  setupSeesaawikiColorProvider(monaco);
  setupSeesaawikiLinkProvider(monaco);
  setupSeesaawikiHoverProvider(monaco);
  setupSeesaawikiCompletionProvider(monaco);
}
