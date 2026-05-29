function registerSeesaaWikiLanguage() {
  setupSeesaawikiLanguageConfig();
  setupSeesaawikiTokens();
  setupSeesaawikiTheme();
  monaco.languages.registerDocumentSymbolProvider(
    'seesaawiki',
    new SeesaaWikiDocumentSymbolProvider(monaco)
  );
  setupSeesaawikiColorProvider();
  setupSeesaawikiLinkProvider();
  setupSeesaawikiHoverProvider();
  setupSeesaawikiCompletionProvider();
}
