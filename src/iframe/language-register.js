import {
  setupSeesaawikiLanguageConfig,
  setupSeesaawikiTokens,
  setupSeesaawikiTheme,
} from './language-config.js';
import { SeesaaWikiDocumentSymbolProvider } from './symbol-provider.js';
import { setupSeesaawikiColorProvider } from './color-provider.js';
import { setupSeesaawikiLinkProvider } from './link-provider.js';
import { setupSeesaawikiHoverProvider } from './hover-provider.js';
import { setupSeesaawikiCompletionProvider } from './completion-provider.js';

export function registerSeesaaWikiLanguage(monaco) {
  setupSeesaawikiLanguageConfig(monaco);
  setupSeesaawikiTokens(monaco);
  setupSeesaawikiTheme(monaco);
  monaco.languages.registerDocumentSymbolProvider(
    'seesaawiki',
    new SeesaaWikiDocumentSymbolProvider(monaco)
  );
  setupSeesaawikiColorProvider(monaco);
  setupSeesaawikiLinkProvider(monaco);
  setupSeesaawikiHoverProvider(monaco);
  setupSeesaawikiCompletionProvider(monaco);
}
