import type * as monacoNs from 'monaco-editor';
import {
  setupSeesaawikiLanguageConfig,
  setupSeesaawikiTokens,
  setupSeesaawikiTheme,
} from './language-config';
import { SeesaaWikiDocumentSymbolProvider } from './symbol-provider';
import { SeesaaWikiFoldingRangeProvider } from './folding-range-provider';
import { setupSeesaawikiDiagnostics } from './diagnostics';
import { setupSeesaawikiColorProvider } from './color-provider';
import { setupSeesaawikiLinkProvider } from './link-provider';
import { setupSeesaawikiHoverProvider } from './hover-provider';
import { setupSeesaawikiCompletionProvider } from './completion-provider';

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
  setupSeesaawikiDiagnostics(monaco);
}
