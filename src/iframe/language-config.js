function setupSeesaawikiLanguageConfig() {
  monaco.languages.register({
    id: 'seesaawiki',
    extensions: ['.seesaawiki'],
    aliases: ['Seesaa Wiki', 'ssw'],
  });

  monaco.languages.setLanguageConfiguration('seesaawiki', {
    comments: {
      lineComment: '//',
    },
    brackets: [
      ['{', '}'],
      ['[', ']'],
      ['(', ')'],
      ['[[', ']]'],
    ],
    autoClosingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '[[', close: ']]' },
      { open: "'", close: "'", notIn: ['string', 'comment'] },
      { open: "'''", close: "'''", notIn: ['string', 'comment'] },
      { open: '%%', close: '%%', notIn: ['string', 'comment'] },
      { open: '%%%', close: '%%%', notIn: ['string', 'comment'] },
    ],
    surroundingPairs: [
      { open: '{', close: '}' },
      { open: '[', close: ']' },
      { open: '(', close: ')' },
      { open: '[[', close: ']]' },
      { open: "'", close: "'" },
      { open: "'''", close: "'''" },
      { open: '%%', close: '%%' },
      { open: '%%%', close: '%%' },
      { open: '|', close: '|' },
    ],
  });
}

function setupSeesaawikiTokens() {
  monaco.languages.setMonarchTokensProvider('seesaawiki', {
    anchorName: /[a-zA-Z0-9\-_\.:]+/,
    tableParams: /(?:center|left|right|(?:color|bgcolor|size|w|h)\(.*?\)):?/,
    tokenizer: {
      root: [
        // Comment
        [/^\/\/.*$/, 'comment'],

        // Headings
        [/^(\*)(?!\*)(.*)$/, ['keyword', 'markup.heading.3']],
        [/^(\*{2})(?!\*)(.*)$/, ['keyword', 'markup.heading.4']],
        [/^(\*{3})(?!\*)(.*)$/, ['keyword', 'markup.heading.5']],

        // Links
        [/\[\[/, { token: 'delimiter.square', bracket: '@open', next: '@links' }],

        // Refs
        [/(&|#)(ref|attachref)(\()/, [
          'keyword.control',
          'keyword',
          { token: 'delimiter.curly', bracket: '@open', next: '@ref' },
        ]],

        // Video, Audio
        [/(&|#)(video|audio)(\()(.*?)(\))/, [
          'keyword.control',
          'keyword',
          { token: 'delimiter.curly', bracket: '@open' },
          'string.url',
          { token: 'delimiter.curly', bracket: '@close' },
        ]],

        // Bold
        [/('')([^']*?)('')/, [
          'keyword',
          { token: 'markup.bold', next: '@root' },
          'keyword',
        ]],

        // Underline
        [/(%%%)([^%]*?)(%%%)/, [
          'keyword',
          { token: 'markup.underline', next: '@root' },
          'keyword',
        ]],

        // Italic
        [/(''')([^']*?)(''')/, [
          'keyword',
          { token: 'markup.italic', next: '@root' },
          'keyword',
        ]],

        // Strike
        [/(%%)([^%]*?)(%%)/, [
          'keyword',
          { token: 'markup.deleted', next: '@root' },
          'keyword',
        ]],

        // Font size
        [/(&|#)(size)(\()(\d+)(\))(\{)/, [
          'keyword.control',
          'keyword',
          { token: 'delimiter.parenthesis', bracket: '@open' },
          'number',
          { token: 'delimiter.parenthesis', bracket: '@close' },
          { token: 'delimiter.curly', bracket: '@open', next: '@root' },
        ]],

        // Font color
        [/(&|#)(color)(\()/, [
          'keyword.control',
          'keyword',
          { token: 'delimiter.parenthesis', bracket: '@open', next: '@color' },
        ]],

        // Foldings
        [/^\[(?:\+|-)\]/, { token: 'keyword.control', bracket: '@open', next: '@root' }],
        [/^\[END\]/, { token: 'keyword.control', bracket: '@close', next: '@pop' }],

        // Table of contents
        [/^(#)(contents)(\()(1|2)(\))/, [
          'keyword.control',
          'keyword',
          { token: 'delimiter.parenthesis', bracket: '@open' },
          'number',
          { token: 'delimiter.parenthesis', bracket: '@close' },
        ]],
        [/^(#)(contents)/, ['keyword.control', 'keyword']],

        // New Line
        [/~~(?:~~~)*/, 'keyword.control'],

        // Table
        [/^\|/, { token: 'keyword.control', bracket: '@open', next: '@table' }],

        // Email
        [/\w+@\w+\.\w+/, 'markup.underline.link'],

        // List
        [/^(\+{1,3})(?!\+)/, ['keyword']],
        [/^(\-{1,3})(?!\-)/, ['keyword']],

        // Horizon
        [/^----$/, 'keyword.control'],

        // Anchor
        [/(&|#)(aname)(\()(@anchorName)(\))/, [
          'keyword.control',
          'keyword',
          { token: 'delimiter.parenthesis', bracket: '@open' },
          'support.variable.italic',
          { token: 'delimiter.parenthesis', bracket: '@close' },
        ]],

        // HTML Entities
        [/&(?:\w+|#\d+);/, 'constant.character.escape'],

        // Others
        [/(&|#)(twitter_profile|twitter|RecentUpdate|sub|ruby|align|fukidashi|youtube|niconico|)/, [
          'keyword.control',
          'keyword',
        ]],

        // Sub
        [/(__)(.*)(__)/, ['keyword.control', '', 'keyword.control']],
      ],
      rootCloseCurlyBracket: [
        [/\}/, { token: 'delimiter.curly', bracket: '@close', next: '@pop' }],
        { include: '@root' },
      ],
      rootCloseTable: [
        [/\|$/, { token: 'keyword.control', bracket: '@close', next: '@pop' }],
        [/\|/, { token: 'keyword.control', bracket: '@close', next: '@pop' }],
        { include: '@root' },
      ],
      links: [
        [/\]\]/, { token: 'delimiter.square', bracket: '@close', next: '@pop' }],
        [/>{1,3}/, 'delimiter.angle'],
        [/https?:\/\/[^\s>\]]+/, 'string.url'],
        [/&(?:\w+|#\d+);/, 'constant.character.escape'],
        [/#@anchorName/, 'support.variable.italic'],
        [/[^#>\]]+?/, 'markup.underline.link'],
      ],
      ref: [
        [/\)/, { token: 'delimiter.curly', bracket: '@close', next: '@pop' }],
        [/,/, 'delimiter'],
        [/(\d+%?)/, 'number'],
        [/(https?:\/\/[^\s,)]+)/, 'string.url'],
        [/(left|right|no_link)/, 'keyword.parameter'],
      ],
      color: [
        [/#[0-9A-Fa-f]{3}|#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{8}|[a-zA-Z]+/, 'contant.other.colorcode'],
        [/\)/, { token: 'delimiter.curly', bracket: '@close' }],
        [/\{/, { token: 'delimiter.curly', bracket: '@open', next: '@root' }],
        [/,/, 'delimiter'],
        [/\s+/, ''],
      ],
      table: [
        [/\|c?$/, { token: 'keyword.control', bracket: '@close', next: '@pop' }],
        [/\|/, { token: 'keyword.control', bracket: '@close' }],
        [/@tableParams/, 'keyword.parameter'],
        [/(r)(\[)/, [
          'keyword.control',
          { token: 'keyword.control', next: '@tableRowCondig' },
        ]],
        [/!|~|>|\^/, 'keyword.parameter'],
        { include: '@rootCloseTable' },
      ],
      tableRowCondig: [
        [/\]:?/, { token: 'keyword.control', bracket: '@close', next: '@pop' }],
        [/@tableParams/, 'keyword.parameter'],
      ],
    },
  });
}

function setupSeesaawikiTheme() {
  monaco.editor.defineTheme('seesaawikiTheme', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: 'markup.heading.3', foreground: '569CD6', fontStyle: 'bold' },
      { token: 'markup.heading.4', foreground: '569CD6', fontStyle: 'bold' },
      { token: 'markup.heading.5', foreground: '569CD6', fontStyle: 'bold' },
      { token: 'markup.underline.link', fontStyle: 'underline' },
      { token: 'keyword.control', foreground: 'C586C0' },
      { token: 'keyword', foreground: '569CD6' },
      { token: 'table', background: 'FF0000' },
      { token: 'table.c', foreground: 'C586C0' },
      { token: 'markup.bold', fontStyle: 'bold', foreground: '569CD6' },
      { token: 'markup.italic', fontStyle: 'italic' },
      { token: 'markup.underline', fontStyle: 'underline' },
      { token: 'markup.deleted', fontStyle: 'strikethrough' },
      { token: 'constant.numeric', foreground: 'B5CEA8' },
      { token: 'constant.character.escape', foreground: 'D7BA7D' },
      { token: 'support.variable', foreground: 'FF0000' },
      { token: 'support.variable.italic', foreground: '569CD6', fontStyle: 'italic' },
      { token: 'constant.other.colorcode', foreground: 'CE9178' },
      { token: 'markup.underline.link.image', foreground: '4EC9B0', fontStyle: 'underline' },
      { token: 'entity.name.function', foreground: 'DCDCAA' },
      { token: 'support.function', foreground: 'DCDCAA' },
      { token: 'variable.other.constant', foreground: '4FC1FF' },
      { token: 'variable.other.enummember', foreground: '4FC1FF' },
      { token: 'entity.name.type', foreground: '4EC9B0' },
      { token: 'entity.name.class', foreground: '4EC9B0' },
      { token: 'support.type', foreground: '4EC9B0' },
      { token: 'support.class', foreground: '4EC9B0' },
      { token: 'variable.other', foreground: '9CDCFE' },
    ],
    colors: {
      'editorStickyScroll.background': '#332765',
      'editorStickyScrollHover.background': '#504083',
    },
  });
}
