function getSeesaawikiSnippets(monaco) {
  const Snippet = monaco.languages.CompletionItemKind.Snippet;
  const Keyword = monaco.languages.CompletionItemKind.Keyword;
  const insertAsSnippet = monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet;

  return [
    {
      label: '&ref',
      kind: Snippet,
      insertText: '&ref(${1:画像URL})',
      insertTextRules: insertAsSnippet,
      documentation: '画像を挿入',
    },
    {
      label: '&ref (with title, alt)',
      kind: Snippet,
      insertText: '&ref(${1:画像URL}){${2:タイトル}}',
      insertTextRules: insertAsSnippet,
      documentation: '画像を挿入',
    },
    {
      label: '&attach',
      kind: Snippet,
      insertText: '&attach(${1:})',
      insertTextRules: insertAsSnippet,
      documentation: '画像添付を挿入',
    },
    {
      label: '&attachref',
      kind: Snippet,
      insertText: '&attachref(${1:})',
      insertTextRules: insertAsSnippet,
      documentation: '画像添付と表示を挿入',
    },
    {
      label: '&video',
      kind: Snippet,
      insertText: '&video(${1:動画URL})',
      insertTextRules: insertAsSnippet,
      documentation: '動画を挿入',
    },
    {
      label: '&youtube',
      kind: Snippet,
      insertText: '&youtube(${1:URL})',
      insertTextRules: insertAsSnippet,
      documentation: 'YouTube動画を挿入',
    },
    {
      label: '&nicovideo',
      kind: Snippet,
      insertText: '&nicovideo(${1:URL})',
      insertTextRules: insertAsSnippet,
      documentation: 'ニコニコ動画を挿入',
    },
    {
      label: '&video (size)',
      kind: Snippet,
      insertText: '&video(${1:動画URL}){${2:size}}',
      insertTextRules: insertAsSnippet,
      documentation: '動画を挿入',
    },
    {
      label: '&youtube (size)',
      kind: Snippet,
      insertText: '&youtube(${1:URL}){${2:size}}',
      insertTextRules: insertAsSnippet,
      documentation: 'YouTube動画を挿入',
    },
    {
      label: '&nicovideo (size)',
      kind: Snippet,
      insertText: '&nicovideo(${1:URL}){${2:size}}',
      insertTextRules: insertAsSnippet,
      documentation: 'ニコニコ動画を挿入',
    },
    {
      label: '&audio',
      kind: Snippet,
      insertText: '&audio(${1:音声URL})',
      insertTextRules: insertAsSnippet,
      documentation: '音声を挿入',
    },
    {
      label: '&twitter',
      kind: Snippet,
      insertText:
        '&twitter(${1:${TM_SELECTED_TEXT/(?:https?:\\/\\/)?(?:www\\.)?(?:x|twitter)\\.com\\/(?:#!\\/)?(\\w+)\\/status\\/(\\d+).*/$2/}})',
      insertTextRules: insertAsSnippet,
      documentation: 'ツイートを挿入',
    },
    {
      label: '&twitter (options)',
      kind: Snippet,
      insertText:
        '&twitter(${1:${TM_SELECTED_TEXT/(?:https?:\\/\\/)?(?:www\\.)?(?:x|twitter)\\.com\\/(?:#!\\/)?(\\w+)\\/status\\/(\\d+).*/$2/}}){${2|theme:dark,[width],right|}}',
      insertTextRules: insertAsSnippet,
      documentation: 'ツイートを挿入',
    },
    {
      label: '&twitter_profile',
      kind: Snippet,
      insertText:
        '&twitter_profile(${1:${TM_SELECTED_TEXT/(?:https?:\\/\\/)?(?:www\\.)?(?:x|twitter)\\.com\\/(?:#!\\/)?(\\w+).*/$1/}})',
      insertTextRules: insertAsSnippet,
      documentation: 'Twitterプロフィールを挿入',
    },
    {
      label: '&twitter_profile (options)',
      kind: Snippet,
      insertText:
        '&twitter_profile(${1:${TM_SELECTED_TEXT/(?:https?:\\/\\/)?(?:www\\.)?(?:x|twitter)\\.com\\/(?:#!\\/)?(\\w+).*/$1/}}){${2|noheader,nofooter,noborders,noscrollbar,transparent,dark,light,[width]|}}',
      insertTextRules: insertAsSnippet,
      documentation: 'Twitterプロフィールを挿入',
    },
    {
      label: '#contents',
      kind: Snippet,
      insertText: '#contents',
      insertTextRules: insertAsSnippet,
      documentation: '目次を挿入',
    },
    {
      label: '&contents',
      kind: Snippet,
      insertText: '#contents',
      insertTextRules: insertAsSnippet,
      documentation: '目次を挿入',
    },
    {
      label: '#contents()',
      kind: Snippet,
      insertText: '#contents(${1|1,2|})',
      insertTextRules: insertAsSnippet,
      documentation: '目次を挿入',
    },
    {
      label: '&contents()',
      kind: Snippet,
      insertText: '#contents(${1|1,2|})',
      insertTextRules: insertAsSnippet,
      documentation: '目次を挿入',
    },
    {
      label: '&RecentUpdate',
      kind: Snippet,
      insertText:
        '&RecentUpdate(${1|0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44,45,46,47,48,49,50|})',
      insertTextRules: insertAsSnippet,
      documentation: '目次を挿入',
    },
    {
      label: '&aname',
      kind: Snippet,
      insertText: '&aname(${1:anchor_name})',
      insertTextRules: insertAsSnippet,
      documentation: '&anameを挿入',
    },
    {
      label: '&size',
      kind: Snippet,
      insertText: '&size(${1:size}){${2:$TM_SELECTED_TEXT}}',
      insertTextRules: insertAsSnippet,
      documentation: '&sizeを挿入',
    },
    {
      label: '&color',
      kind: Snippet,
      insertText: '&color(${1:red}){${2:$TM_SELECTED_TEXT}}',
      insertTextRules: insertAsSnippet,
      documentation: '&colorを挿入',
    },
    {
      label: '&sup',
      kind: Snippet,
      insertText: '&sup{${1:$TM_SELECTED_TEXT}}',
      insertTextRules: insertAsSnippet,
      documentation: '上付き文字を挿入',
    },
    {
      label: '&sub',
      kind: Snippet,
      insertText: '__${1:$TM_SELECTED_TEXT}__',
      insertTextRules: insertAsSnippet,
      documentation: '下付き文字を挿入',
    },
    {
      label: '&ruby',
      kind: Snippet,
      insertText: '&ruby(${1:ルビ}){${2:$TM_SELECTED_TEXT}}',
      insertTextRules: insertAsSnippet,
      documentation: 'ルビを挿入',
    },
    {
      label: '&align',
      kind: Snippet,
      insertText: '&align(${1|left,center,right|}){${2:$TM_SELECTED_TEXT}}',
      insertTextRules: insertAsSnippet,
      documentation: '&alignを挿入',
    },
    {
      label: '&fukidashi',
      kind: Snippet,
      insertText: '&fukidashi(${1:}){${2:$TM_SELECTED_TEXT}}',
      insertTextRules: insertAsSnippet,
      documentation: '&fukidashiを挿入',
    },
    {
      label: '&hukidashi',
      kind: Snippet,
      insertText: '&fukidashi(${1:}){${2:$TM_SELECTED_TEXT}}',
      insertTextRules: insertAsSnippet,
      documentation: '&fukidashiを挿入',
    },
    {
      label: '&fukidashi (right)',
      kind: Snippet,
      insertText: '&fukidashi(${1:},right){${2:$TM_SELECTED_TEXT}}',
      insertTextRules: insertAsSnippet,
      documentation: '&fukidashiを挿入',
    },
    {
      label: '&hukidashi (right)',
      kind: Snippet,
      insertText: '&fukidashi(${1:},right){${2:$TM_SELECTED_TEXT}}',
      insertTextRules: insertAsSnippet,
      documentation: '&fukidashiを挿入',
    },
    {
      label: 'bold',
      kind: Snippet,
      insertText: "''${1:$TM_SELECTED_TEXT}''",
      insertTextRules: insertAsSnippet,
      documentation: '太字を挿入',
    },
    {
      label: 'underline',
      kind: Snippet,
      insertText: '%%%${1:$TM_SELECTED_TEXT}%%%',
      insertTextRules: insertAsSnippet,
      documentation: '下線を挿入',
    },
    {
      label: 'deleted',
      kind: Snippet,
      insertText: '%%${1:$TM_SELECTED_TEXT}%%',
      insertTextRules: insertAsSnippet,
      documentation: '取り消し線を挿入',
    },
    {
      label: 'strikethrough',
      kind: Snippet,
      insertText: '%%${1:$TM_SELECTED_TEXT}%%',
      insertTextRules: insertAsSnippet,
      documentation: '取り消し線を挿入',
    },
    {
      label: 'italic',
      kind: Snippet,
      insertText: "'''${1:$TM_SELECTED_TEXT}'''",
      insertTextRules: insertAsSnippet,
      documentation: 'イタリックを挿入',
    },
    {
      label: 'pre-formatted',
      kind: Snippet,
      insertText:
        '=|${1|BOX,AA,AAS,AUTO,CC,CPP,CS,CYC,JAVA,BSH,CSH,SH,CV,PY,PERL,PL,PM,RB,JS,HTML,XHTML,XML,XSL,LUA,ERLANG,GO,LISP,R,SCALA,SQL,SWIFT,TEX,YAML|}|\n${2:$TM_SELECTED_TEXT}\n||=\n',
      insertTextRules: insertAsSnippet,
      documentation: '整形済みテキストを挿入',
    },
    {
      label: 'plus-end',
      kind: Snippet,
      insertText: '[+]${1:}\n${2:$TM_SELECTED_TEXT}\n[END]\n',
      insertTextRules: insertAsSnippet,
      documentation: 'デフォルトで閉じた折りたたみを挿入',
    },
    {
      label: 'minus-end',
      kind: Snippet,
      insertText: '[-]${1:}\n${2:$TM_SELECTED_TEXT}\n[END]\n',
      insertTextRules: insertAsSnippet,
      documentation: 'デフォルトで開いた折りたたみを挿入',
    },
    {
      label: 'link',
      kind: Snippet,
      insertText: '[[${1:$TM_SELECTED_TEXT}]]',
      insertTextRules: insertAsSnippet,
      documentation: 'リンクを挿入',
    },
    {
      label: 'link (with link text)',
      kind: Snippet,
      insertText: '[[${1:}${2|>,>>,>>>|}${3:$TM_SELECTED_TEXT}]]',
      insertTextRules: insertAsSnippet,
      documentation: 'リンクテキスト付きリンクを挿入',
    },
    {
      label: 'definition',
      kind: Snippet,
      insertText: ':${1:定義語}|${2:説明文}',
      insertTextRules: insertAsSnippet,
      documentation: '定義リストを挿入',
    },
    {
      label: 'annotation',
      kind: Snippet,
      insertText: '((${1:注釈}))',
      insertTextRules: insertAsSnippet,
      documentation: '注釈を挿入',
    },
    {
      label: 'horizon',
      kind: Snippet,
      insertText: '----',
      insertTextRules: insertAsSnippet,
      documentation: '水平線を挿入',
    },
    { label: 'no_link', kind: Keyword, insertText: 'no_link', insertTextRules: insertAsSnippet, documentation: 'no_link' },
    { label: 'right', kind: Keyword, insertText: 'right', insertTextRules: insertAsSnippet, documentation: 'right' },
    { label: 'center', kind: Keyword, insertText: 'center', insertTextRules: insertAsSnippet, documentation: 'center' },
    { label: 'left', kind: Keyword, insertText: 'left', insertTextRules: insertAsSnippet, documentation: 'left' },
    { label: 'bottom', kind: Keyword, insertText: 'bottom', insertTextRules: insertAsSnippet, documentation: 'bottom' },
    { label: 'top', kind: Keyword, insertText: 'top', insertTextRules: insertAsSnippet, documentation: 'top' },
    {
      label: 'color',
      kind: Keyword,
      insertText: 'color(${1:色})',
      insertTextRules: insertAsSnippet,
      documentation: 'color',
    },
    {
      label: 'bgcolor',
      kind: Keyword,
      insertText: 'bgcolor(${1:色})',
      insertTextRules: insertAsSnippet,
      documentation: 'bgcolor',
    },
  ];
}

export function setupSeesaawikiCompletionProvider(monaco) {
  const seesaawikiSnippets = getSeesaawikiSnippets(monaco);

  monaco.languages.registerCompletionItemProvider('seesaawiki', {
    triggerCharacters: ['&', '#'],
    provideCompletionItems: function (model, position) {
      const textUntilPosition = model.getValueInRange({
        startLineNumber: position.lineNumber,
        startColumn: 1,
        endLineNumber: position.lineNumber,
        endColumn: position.column,
      });

      const match = textUntilPosition.match(/[&#]|[&#]?[\w]+$/g);
      const prefix = match ? match[match.length - 1] : null;
      if (prefix === null) return null;

      const filteredSnippets = seesaawikiSnippets.filter((snippet) =>
        snippet.label.toLowerCase().startsWith(prefix.toLowerCase())
      );

      const suggestions = filteredSnippets.map((snippet) => ({
        ...snippet,
        range: {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: position.column - prefix.length,
          endColumn: position.column,
        },
      }));

      return { suggestions };
    },
  });
}
