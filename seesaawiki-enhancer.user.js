// ==UserScript==
// @name         Seesaa Wiki Enhancer
// @version      0.0.1
// @author       @_ream_kf
// @namespace    https://seesaawiki.jp/
// @match        https://seesaawiki.jp/*
// @match        https://cms.wiki.seesaa.jp/cms/*
// @icon         https://www.google.com/s2/favicons?domain=seesaawiki.jp
// @updateURL    https://github.com/reamkf/seesaawiki-enhancer/releases/latest/download/seesaawiki-enhancer.meta.js
// @downloadURL  https://github.com/reamkf/seesaawiki-enhancer/releases/latest/download/seesaawiki-enhancer.user.js
// @grant        none
// @license      MIT
// ==/UserScript==

(function () {
	// DOMContentLoadedより後に実行される

	class SeesaaWikiDocumentSymbolProvider {
		constructor(monaco) {
            this.monaco = monaco;
        }

		provideDocumentSymbols(model, token) {
			const documentSymbols = [];
			let symbol;
			const lastUnclosedHeadingSymbol = [null, null, null];
			const headingRegex = /^\*{0,3}/;

			for (let lineIndex = 1; lineIndex <= model.getLineCount(); lineIndex++) {
				const lineContent = model.getLineContent(lineIndex);
				const headingMatch = lineContent.match(headingRegex);
				const headingLevel = headingMatch && headingMatch[0].length || 0;

				if (headingLevel) {
					const range = {
						startLineNumber: lineIndex,
						startColumn: 1,
						endLineNumber: lineIndex,
						endColumn: lineContent.length + 1
					};

					symbol = {
						name: lineContent,
						detail: "Heading " + String(headingLevel),
						kind: this.monaco.languages.SymbolKind.String,
						range: range,
						selectionRange: range,
						children: []
					};

					// Close opened deeper headings
					for (let level = headingLevel; level <= 3; level++) {
						if (lastUnclosedHeadingSymbol[level - 1] !== null) {
							lastUnclosedHeadingSymbol[level - 1].range.endLineNumber = lineIndex - 1;
							lastUnclosedHeadingSymbol[level - 1].range.endColumn = model.getLineMaxColumn(lineIndex - 1);
							lastUnclosedHeadingSymbol[level - 1] = null;
						}
					}

					// append child or push to documentSymbols
					let childFlag = false;
					for (let j = headingLevel - 1; j > 0; j--) {
						if (lastUnclosedHeadingSymbol[j - 1] !== null) {
							lastUnclosedHeadingSymbol[j - 1].children.push(symbol);
							childFlag = true;
							break;
						}
					}
					if (!childFlag) {
						documentSymbols.push(symbol);
					}
					lastUnclosedHeadingSymbol[headingLevel - 1] = symbol;
				}
			}

			// Close any remaining open headings
			const lastLineNum = model.getLineCount();
			for (const level of [1, 2, 3]) {
				if (lastUnclosedHeadingSymbol[level - 1] !== null) {
					lastUnclosedHeadingSymbol[level - 1].range.endLineNumber = lastLineNum;
					lastUnclosedHeadingSymbol[level - 1].range.endColumn = model.getLineMaxColumn(lastLineNum);
				}
			}

			return documentSymbols;
		}
	}

	const WikiPageType = {
		TOP: "TOP",
		PAGE: "PAGE",
		EDIT: "EDIT",
		ATTACHMENT: "ATTACHMENT",
		LIST: "LIST",
		DIFF: "DIFF",
		HISTORY: "HISTORY",
		SEARCH: "SEARCH",
	};

	// URLからWikiPageTypeを判定する関数
	function getWikiPageType(url) {
		const parsedUrl = new URL(url);
		const path = parsedUrl.pathname;
		const searchParams = parsedUrl.searchParams;

		if (path.includes("/d/")) {
			return WikiPageType.PAGE;
		} else if (path.includes("/l/")) {
			return WikiPageType.LIST;
		} else if (
			path.includes("/e/add") ||
			(path.includes("/e/edit") && searchParams.has("id"))
		) {
			return WikiPageType.EDIT;
		} else if (path.includes("/e/attachment")) {
			return WikiPageType.ATTACHMENT;
		} else if (path.includes("/diff/")) {
			return WikiPageType.DIFF;
		} else if (path.includes("/hist/")) {
			return WikiPageType.HISTORY;
		} else if (path.includes("/search") && searchParams.has("keywords")) {
			return WikiPageType.SEARCH;
		} else if (path === "/" || path.endsWith("/")) {
			return WikiPageType.PAGE;
		}

		return null; // 未知のURL形式の場合
	}

	const url = location.href;
	const pageType = getWikiPageType(url);

	if (pageType == WikiPageType.EDIT) {
		/* ********************************************************************************
			Replace with Monaco Editor
		/* ******************************************************************************** */
		initMonacoEditor();

		/* ********************************************************************************
			Keep partial edit on login
		/* ******************************************************************************** */
		const login = document.getElementsByClassName("login");
		if (login && login[0]) {
			let elem = login[0].firstChild;
			if (elem && elem.href && !elem.href.includes("&return_to="))
				elem.href += "&return_to=" + encodeURIComponent(url);
		}

		/* ********************************************************************************
			Search file on Enter key press
		/* ******************************************************************************** */
		const input = document.getElementById("search-description");
		const button = input.nextElementSibling;

		input.addEventListener("keypress", (e) => {
			switch (e.keyCode) {
				case 13:
					button.click();
					break;
			}
		});

		/* ********************************************************************************
			Press Esc to hide item_search
		/* ******************************************************************************** */
		document.addEventListener("keydown", (e) => {
			if (e.keyCode == 27) {
				editor.item_search.hide(editor.item_search);
			}
		});

		/* ********************************************************************************
			Adjust editor height
		/* ******************************************************************************** */
		addCSS(`
			#content, .user-area { /* editor window, preview-window */
				height: max(calc(100vh - 800px), 500px) !important;
			}

			#page-body {
				margin-bottom: 0 !important;
			}
			#page-footer, #page-footer-inner {
				display: none !important;
			}

			/*
			#page-body {
				margin: 0 !important;
			}

			#rule-area {
				margin: 0 !important;
			}

			.edit-line-1.clearfix {
				margin: 0 !important;
				padding: 5px !important;
			}
			*/
		`);

	} else if (pageType == WikiPageType.DIFF) {
		/* ********************************************************************************
			Replace with Monaco Diff Editor
		/* ******************************************************************************** */
		initMonacoDiffEditor();
	}

	function addCSS(css){
		const style = document.createElement("style");
		style.innerHTML = css;
		document.head.append(style);
	}

	function decodeHTMLEntities(text) {
		const textarea = document.createElement("textarea");
		textarea.innerHTML = text;
		return textarea.value;
	}

	const _sleep = (time /* in millisec */) =>
		new Promise((resolve) => setTimeout(resolve, time));
	const sleep = async (time /* in millisec */) => await _sleep(time);

	function addScript(src, innerHTML) {
		const script = document.createElement("script");
		if (script) script.src = src;
		if (innerHTML) script.innerHTML = innerHTML;
		document.head.appendChild(script);
	}

	function loadMonacoEditor(ver="0.52.0") {
		return new Promise((resolve) => {
			const link = document.createElement("link");
			link.rel = "stylesheet";
			link.setAttribute("data-name", "vs/editor/editor.main");
			link.href = `https://cdn.jsdelivr.net/npm/monaco-editor@${ver}/min/vs/editor/editor.main.css`;
			document.head.appendChild(link);

			const script = document.createElement("script");
			script.src = `https://cdn.jsdelivr.net/npm/monaco-editor@${ver}/min/vs/loader.js`;
			script.onload = () => {
				require.config({
					paths: {
						vs: `https://cdn.jsdelivr.net/npm/monaco-editor@${ver}/min/vs`,
					},
				});
				require(["vs/editor/editor.main"], resolve);
			};
			document.head.appendChild(script);
		});
	}

	function registerSeesaaWikiLanguage() {
		seesaaWikiLanguage = {
			tokenizer: {
				root: [
				  [/^\/\/.*$/, 'comment'],
				  [/^(\*)([^*].*)?$/, ['keyword', 'markup.heading.3']],
				  [/^(\*{2})([^*].*)?$/, ['keyword', 'markup.heading.4']],
				  [/^(\*{3})([^*].*)?$/, ['keyword', 'markup.heading.5']],
				  [/(\[\[)([^>]*?)(>{0,3})([^>]*?)(#\w+)?(\]\])/, [
					'keyword',
					'markup.underline.link',
					'keyword',
					'markup.underline.link',
					'support.variable',
					'keyword'
				  ]],
				  [/^(\[)(\+|-)(\])(.*)$/, [
					'keyword',
					'keyword',
					'keyword',
					'markup.bold'
				  ]],
				  [/^(\[END\])/, 'keyword'],
				  [/^(#)(contents)(?:(\()(1|2)(\)))?/, [
					'keyword.control',
					'support.variable',
					'keyword',
					'constant.numeric',
					'keyword'
				  ]],
				  [/(~~)(~~~)*/, 'keyword.control'],
				  [/^(=\|)(BOX|AA|AAS|CC|CPP|CS|CYC|JAVA|BSH|CSH|SH|CV|PY|PERL|PL|PM|RB|JS|HTML|XHTML|XML|XSL|LUA|ERLANG|GO|LISP|R|SCALA|SQL|SWIFT|TEX|YAML|AUTO|\(box=(?:textarea|div)\))?(\|)$/, [
					'keyword',
					'keyword',
					'keyword'
				  ]],
				  [/^(\|\|=)$/, 'keyword'],
				  [/(&)(fukidashi)(\()([^,)]*?)(?:(,)(s*)(right))?(\))(\{)([^}]*)(\})/, [
					'keyword.control',
					'support.variable',
					'keyword',
					'constant.other',
					'keyword',
					'keyword',
					'keyword.control',
					'keyword',
					'keyword',
					{ token: '', next: '@fukidashiContent' },
					'keyword'
				  ]],
				  [/\w+@\w+\.\w+/, 'markup.underline.link'],
				  [/^(\+{1,3})([^\+].*)?$/, ['keyword', '']],
				  [/^(\-{1,3})([^\-].*)?$/, ['keyword', '']],
				  [/(&|#)(ref|attach|attachref)(\()([^,)]*?)(?:(,\s*)(\d*%?)){0,2}(?:(,\s*)(left|right|no_link)){0,2}(\))(?:(\{)([^}]*?)(\}))?/, [
					'keyword.control',
					'support.variable',
					'keyword.control',
					'markup.underline.link.image',
					'keyword.control',
					'constant.numeric',
					'keyword.control',
					'keyword.control',
					'keyword.control',
					'keyword.control',
					'',
					'keyword.control'
				  ]],
				  [/^(----)$/, 'keyword.control'],
				  [/(&)(aname)(\()([^\)]*)(\))/, [
					'keyword.control',
					'support.variable',
					'keyword.control',
					'constant.other',
					'keyword.control'
				  ]],
				  [/&(\w+|#\d+|#x[\da-fA-F]+);/, 'constant.character.escape'],
				  [/('')([^']*?)('')/, [
					'keyword',
					'markup.bold',
					'keyword'
				  ]],
				  [/(''')([^']*?)(''')/, [
					'keyword',
					'markup.italic',
					'keyword'
				  ]],
				  [/(%%%)([^%]*?)(%%%)/, [
					'keyword',
					'markup.underline',
					'keyword'
				  ]],
				  [/(%%)([^%]*?)(%%)/, [
					'keyword',
					'markup.deleted',
					'keyword'
				  ]],
				  [/(&)(size)(\()(\d+)(\))(\{)([^}]*)(\})/, [
					'keyword.control',
					'support.variable',
					'keyword',
					'constant.numeric',
					'keyword',
					'keyword',
					{ token: '', next: '@sizeContent' },
					'keyword'
				  ]],
				  [/(&)(color)(\()([^,)]*?)(,?)(s*)([^,)]*?)(\))(\{)([^}]*)(\})/, [
					'keyword.control',
					'support.variable',
					'keyword',
					'constant.other.colorcode',
					'keyword',
					'',
					'constant.other.colorcode',
					'keyword',
					'keyword',
					{ token: '', next: '@colorContent' },
					'keyword'
				  ]],
				  [/(&)(sup)(\{)([^}]*)(\})/, [
					'keyword.control',
					'support.variable',
					'keyword',
					{ token: '', next: '@supContent' },
					'keyword'
				  ]],
				  [/(__)(.*)(__)/,
					['keyword', '', 'keyword']
				  ],
				  [/(&)(ruby)(\()([^)]*?)(\))(\{)([^}]*)(\})/, [
					'keyword.control',
					'support.variable',
					'keyword',
					{ token: '', next: '@rubyBase' },
					'keyword',
					'keyword',
					{ token: '', next: '@rubyText' },
					'keyword'
				  ]],
				],
				fukidashiContent: [
				  [/[^}]+/, ''],
				  [/\}/, { token: 'keyword', next: '@pop' }]
				],
				sizeContent: [
				  [/[^}]+/, ''],
				  [/\}/, { token: 'keyword', next: '@pop' }]
				],
				colorContent: [
				  [/[^}]+/, ''],
				  [/\}/, { token: 'keyword', next: '@pop' }]
				],
				supContent: [
				  [/[^}]+/, ''],
				  [/\}/, { token: 'keyword', next: '@pop' }]
				],
				rubyBase: [
				  [/[^)]+/, ''],
				  [/\)/, { token: 'keyword', next: '@pop' }]
				],
				rubyText: [
				  [/[^}]+/, ''],
				  [/\}/, { token: 'keyword', next: '@pop' }]
				]
			  }
			};

		// Monaco Editorに言語を登録
		monaco.languages.register({
			id: "seesaawiki",
			extensions: [".seesaawiki"],
			aliases: ["Seesaa Wiki", "ssw"],
		});

		languageConfiguration = {
			comments: {
				lineComment: "//",
			},
			brackets: [
				["{", "}"],
				["[", "]"],
				["(", ")"],
				["[[", "]]"],  // WikiのリンクのブラケットRef
				["&", ";"],    // HTMLエンティティのための疑似的な括弧
			],
			autoClosingPairs: [
				{ open: "{", close: "}" },
				{ open: "[", close: "]" },
				{ open: "(", close: ")" },
				{ open: "[[", close: "]]" },
				{ open: "'", close: "'", notIn: ["string", "comment"] },
				{ open: "'''", close: "'''", notIn: ["string", "comment"] },
				{ open: "%%", close: "%%", notIn: ["string", "comment"] },
				{ open: "%%%", close: "%%%", notIn: ["string", "comment"] },
			],
			surroundingPairs: [
				{ open: "{", close: "}" },
				{ open: "[", close: "]" },
				{ open: "(", close: ")" },
				{ open: "[[", close: "]]" },
				{ open: "'", close: "'" },
				{ open: "'''", close: "'''" },
				{ open: "%%", close: "%%" },
				{ open: "%%%", close: "%%" },
			]
		};
		monaco.languages.setLanguageConfiguration("seesaawiki", languageConfiguration);

		// シンタックスハイライトの定義を設定
		// const oldInclude = Array.prototype.include;
		// @ts-ignore
		// delete Array.prototype.include;
		monaco.languages.setMonarchTokensProvider("seesaawiki", seesaaWikiLanguage);
		// Array.prototype.include = oldInclude;

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
				{ token: 'markup.bold', fontStyle: 'bold', foreground: '569CD6' },
				{ token: 'markup.italic', fontStyle: 'italic' },
				{ token: 'markup.underline', fontStyle: 'underline' },
				{ token: 'markup.deleted', fontStyle: 'line-through' },
				{ token: 'constant.numeric', foreground: '0000FF' },
				{ token: 'constant.character.escape', foreground: 'FF00FF' },
				{ token: 'support.variable', foreground: '569CD6' },
				{ token: 'constant.other.colorcode', foreground: '2E8B57' },
				{ token: 'markup.underline.link.image', foreground: '4169E1', fontStyle: 'underline' },
			],
			colors: {
                'editorStickyScroll.background': '#332765',
                'editorStickyScrollHover.background': '#504083',
            }
		});

		monaco.languages.registerDocumentSymbolProvider('seesaawiki', new SeesaaWikiDocumentSymbolProvider(monaco));


		// 色名をRGB値に変換する関数
		function colorNameToRGB(colorName) {
			const canvas = document.createElement('canvas');
			canvas.width = canvas.height = 1;
			const ctx = canvas.getContext('2d');
			ctx.fillStyle = colorName;
			ctx.fillRect(0, 0, 1, 1);
			const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
			return { red: r / 255, green: g / 255, blue: b / 255, alpha: 1 };
		}

		// 16進数の色コードをRGB値に変換する関数
		function hexToRGB(hex) {
			hex = hex.replace(/^#/, '');
			let alpha = 1;

			if (hex.length === 3) {
				hex = hex.split('').map(char => char + char).join('');
			} else if (hex.length === 8) {
				alpha = parseInt(hex.slice(6, 8), 16) / 255;
				hex = hex.slice(0, 6);
			}

			const bigint = parseInt(hex, 16);
			const r = (bigint >> 16) & 255;
			const g = (bigint >> 8) & 255;
			const b = bigint & 255;

			return { red: r / 255, green: g / 255, blue: b / 255, alpha: alpha };
		}

		// 色文字列をRGB値に変換する関数
		function parseColor(color) {
			if (!color) return null;
			color = color.trim();
			if (color.startsWith('#')) {
				return hexToRGB(color);
			} else {
				return colorNameToRGB(color);
			}
		}

		function rgbToHex(r, g, b) {
			return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
		}

		// カラープロバイダーの定義
		const seesaaWikiColorProvider = {
			provideDocumentColors: function(model, token) {
				const text = model.getValue();
				const colorRepresentationRegex = "#[0-9A-Fa-f]{3}|#[0-9A-Fa-f]{6}|#[0-9A-Fa-f]{8}|[a-zA-Z]+";
				const colorRegex = new RegExp(`(&color\\(|#color\\(|color\\(|bgcolor\\()\\s*(${colorRepresentationRegex})?\\s*,?\\s*(${colorRepresentationRegex})?\\s*\\)`, 'g');
				let match;
				const colors = [];

				while ((match = colorRegex.exec(text)) !== null) {
					const fullMatch = match[0];
					const prefix = match[1];
					const firstColor = match[2];
					const secondColor = match[3];

					if (prefix === '&color(' || prefix === '#color(') {
						if (firstColor) {
							const firstColorStart = match.index + prefix.length;
							const firstColorEnd = firstColorStart + firstColor.length;
							colors.push({
								range: {
									startLineNumber: model.getPositionAt(firstColorStart).lineNumber,
									startColumn: model.getPositionAt(firstColorStart).column,
									endLineNumber: model.getPositionAt(firstColorEnd).lineNumber,
									endColumn: model.getPositionAt(firstColorEnd).column
								},
								color: parseColor(firstColor)
							});
						}
						if (secondColor) {
							const secondColorStart = fullMatch.lastIndexOf(secondColor);
							const secondColorEnd = secondColorStart + secondColor.length;
							colors.push({
								range: {
									startLineNumber: model.getPositionAt(match.index + secondColorStart).lineNumber,
									startColumn: model.getPositionAt(match.index + secondColorStart).column,
									endLineNumber: model.getPositionAt(match.index + secondColorEnd).lineNumber,
									endColumn: model.getPositionAt(match.index + secondColorEnd).column
								},
								color: parseColor(secondColor)
							});
						}
					} else {
						// color() or bgcolor()
						const colorValue = firstColor || secondColor;
						if (colorValue) {
							const colorStart = fullMatch.indexOf(colorValue);
							const colorEnd = colorStart + colorValue.length;
							colors.push({
								range: {
									startLineNumber: model.getPositionAt(match.index + colorStart).lineNumber,
									startColumn: model.getPositionAt(match.index + colorStart).column,
									endLineNumber: model.getPositionAt(match.index + colorEnd).lineNumber,
									endColumn: model.getPositionAt(match.index + colorEnd).column
								},
								color: parseColor(colorValue)
							});
						}
					}
				}

				return colors;
			},

			provideColorPresentations: function(model, colorInfo, token) {
				const newColor = rgbToHex(
					Math.round(colorInfo.color.red * 255),
					Math.round(colorInfo.color.green * 255),
					Math.round(colorInfo.color.blue * 255)
				);

				return [{ label: newColor }];
			}
		};

		// カラープロバイダーの登録
		monaco.languages.registerColorProvider('seesaawiki', seesaaWikiColorProvider);
	}


	function replaceTextareaWithMonaco(_w=window, value="") {
		const monacoEditor = _w.monaco.editor.create(_w.document.getElementById('monaco-editor-container'), {
			value: value,
			language: 'seesaawiki',
			theme: 'seesaawikiTheme',
			wordWrap: "on",
			// minimap: { enabled: false },
			automaticLayout: true,
			bracketPairColorization: { enabled: true },
			renderLineHighlight: "all",
			unicodeHighlight: {
				ambiguousCharacters: true,
				invisibleCharacters: false,
				nonBasicASCII: false
			},
			'find': { return: false }
		});
		_w.monacoEditor = monacoEditor;

		// カスタムキーバインディングの設定
		const focusContextKey = monacoEditor.createContextKey('editorFocus', false);

		function updateFocusContext() {
			const hasFocus = monacoEditor.hasTextFocus();
			focusContextKey.set(hasFocus);
			console.log('Editor focus state:', hasFocus);
		}

		monacoEditor.onDidFocusEditorText(() => {
			updateFocusContext();
		});

		monacoEditor.onDidBlurEditorText(() => {
			updateFocusContext();
		});

		updateFocusContext();

		_w.monacoEditor.addCommand(_w.monaco.KeyMod.CtrlCmd | _w.monaco.KeyCode.KeyB, () => {
			wrapSelectedText(_w.monaco, _w.monacoEditor, "''", "''");
		});

		_w.monacoEditor.addCommand(_w.monaco.KeyMod.CtrlCmd | _w.monaco.KeyCode.KeyI, () => {
			wrapSelectedText(_w.monaco, _w.monacoEditor, "'''", "'''");
		});

		_w.monacoEditor.addCommand(_w.monaco.KeyMod.CtrlCmd | _w.monaco.KeyCode.KeyU, () => {
			wrapSelectedText(_w.monaco, _w.monacoEditor, "%%%", "%%%");
		});

		_w.monacoEditor.addCommand(_w.monaco.KeyMod.CtrlCmd | _w.monaco.KeyCode.KeyD, () => {
			wrapSelectedText(_w.monaco, _w.monacoEditor, "%%", "%%");
		});

		_w.monacoEditor.addCommand(_w.monaco.KeyMod.CtrlCmd | _w.monaco.KeyCode.KeyK, () => {
			wrapSelectedText(_w.monaco, _w.monacoEditor, "[[", "]]");
		});


		function getTableCellRanges(_w=window, lineNumber) {
			const model = _w.monacoEditor.getModel();
			const lineContent = model.getLineContent(lineNumber);

			const tableMatch = lineContent.match(/^\|([^|]*\|)+c?$/);
			if (tableMatch) {
				const cellContents = lineContent.split('|'); // 先頭の左と末尾の右もセルとして扱う
				const cellRanges = [];

				let cellStart = 1;  // '|' の左から開始
				let cellEnd;

				for (let i = 0; i < cellContents.length; i++) {
					cellEnd = cellStart + cellContents[i].length  // 次の '|' の前まで

					cellRanges.push(new _w.monaco.Range(
						lineNumber,
						cellStart,
						lineNumber,
						cellEnd
					));

					cellStart = cellEnd + 1;  // 次のセルの開始位置（'|' の位置）
				}

				return cellRanges;
			} else return null;
		}

		_w.monacoEditor.addCommand(_w.monaco.KeyCode.Enter, () => {
			const model = _w.monacoEditor.getModel();
			const position = _w.monacoEditor.getPosition();
			const lineContent = model.getLineContent(position.lineNumber);

			// 箇条書きの処理
			const bulletMatch = lineContent.match(/^((?:-|\+){1,3})(?!-)(.*)$/);
			if (bulletMatch) {
				const [, bullet, content] = bulletMatch;
				if (content.trim() != '') {
					// 次の行に同じ箇条書きを追加
					const nextLineContent = bullet;
					_w.monacoEditor.executeEdits('', [{
						range: new _w.monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
						text: '\n' + nextLineContent
					}]);
					_w.monacoEditor.setPosition({
						lineNumber: position.lineNumber + 1,
						column: nextLineContent.length + 1
					});
				} else {
					// 空の箇条書きの場合、箇条書きを削除
					_w.monacoEditor.executeEdits('', [{
						range: new _w.monaco.Range(position.lineNumber, 1, position.lineNumber, position.column),
						text: ''
					}]);
				}
				return;
			}


			// テーブルの処理
			const cellRanges = getTableCellRanges(_w, position.lineNumber);

			if (cellRanges) {
				if(position.column === lineContent.length + 1){ // カーソルが末尾の場合
					// 次の行に新しい行を追加
					const nextLineContent = '|'.repeat(cellRanges.length - 1);

					if(nextLineContent != lineContent){ // 行が空ではない場合
						// 次の行に新しい行を追加
						_w.monacoEditor.executeEdits('', [{
							range: new _w.monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
							text: '\n' + nextLineContent
						}]);
						_w.monacoEditor.setPosition({
							lineNumber: position.lineNumber + 1,
							column: 2
						});
					} else { // 空の行の場合
						// テーブルを削除
						_w.monacoEditor.executeEdits('', [{
							range: new _w.monaco.Range(position.lineNumber, 1, position.lineNumber, position.column),
							text: ''
						}]);
					}
				} else {
					// 下のセルを選択
					const nextLineNumber = position.lineNumber + 1;
					if (nextLineNumber <= model.getLineCount()) {
						const nextCellRanges = getTableCellRanges(_w, nextLineNumber);
						const currentCellIndex = cellRanges.findIndex((cell) => cell.containsPosition(position)); // 見つからなかった場合は-1
						if(nextCellRanges && nextCellRanges.length - 1 >= currentCellIndex){
							const targetRange = nextCellRanges[currentCellIndex];
							_w.monacoEditor.setSelection(targetRange);
							_w.monacoEditor.revealPositionInCenterIfOutsideViewport(targetRange.getStartPosition());
						}
					}
				}
				return;
			}

			// 引用の処理
			if(lineContent.startsWith('>') || lineContent.startsWith(' ')){
				const content = lineContent.slice(1).trim();
				if(content != ''){
					// 次の行に新しい行を追加
					_w.monacoEditor.executeEdits('', [{
						range: new _w.monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
						text: '\n' + lineContent[0]
					}]);
					_w.monacoEditor.setPosition({
						lineNumber: position.lineNumber + 1,
						column: 2
					});
				} else {
					_w.monacoEditor.executeEdits('', [{
						range: new _w.monaco.Range(position.lineNumber, 1, position.lineNumber, position.column),
						text: ''
					}]);
				}

				return;
			}

			// 通常の改行
			_w.monacoEditor.trigger('keyboard', 'type', { text: '\n' });
		}, 'editorFocus');

		_w.monacoEditor.addCommand(_w.monaco.KeyMod.Shift | _w.monaco.KeyCode.Enter, () => {
			const position = _w.monacoEditor.getPosition();

			// テーブルの処理
			const cellRanges = getTableCellRanges(_w, position.lineNumber);

			if (cellRanges) {
				// 上のセルを選択
				const prevLineNumber = position.lineNumber - 1;
				if (prevLineNumber > 0) {
					const prevCellRanges = getTableCellRanges(_w, prevLineNumber);
					const currentCellIndex = cellRanges.findIndex((cell) => cell.containsPosition(position)); // 見つからなかった場合は-1
					if(prevCellRanges && prevCellRanges.length - 1 >= currentCellIndex){
						const targetRange = prevCellRanges[currentCellIndex];
						_w.monacoEditor.setSelection(targetRange);
						_w.monacoEditor.revealPositionInCenterIfOutsideViewport(targetRange.getStartPosition());
					}
				}
				return;
			}

			// 通常の改行
			_w.monacoEditor.trigger('keyboard', 'type', { text: '\n' });
		}, 'editorFocus');

		 // Tabキーの機能
		_w.monacoEditor.addCommand(_w.monaco.KeyCode.Tab, () => {
			const model = _w.monacoEditor.getModel();
			const position = _w.monacoEditor.getPosition();
			const lineContent = model.getLineContent(position.lineNumber);

			// 箇条書きの処理
			const bulletMatch = lineContent.match(/^((?:-|\+){1,3})(?!-)(.*)$/);
			if (bulletMatch) {
				const [, bullet, content] = bulletMatch;
				if(bullet.length < 3){
					// インデントを増やす
					_w.monacoEditor.executeEdits('', [{
						range: new _w.monaco.Range(position.lineNumber, 1, position.lineNumber, 1),
						text: bullet[0]
					}]);
				}
				return;
			}

			// テーブルの処理
			const cellRanges = getTableCellRanges(_w, position.lineNumber);
			if (cellRanges) {
				const currentCellIndex = cellRanges.findIndex((cell) => cell.containsPosition(position)); // 見つからなかった場合は-1

				if (currentCellIndex !== -1) {
					let targetRange;
					if (currentCellIndex < cellRanges.length - 1) {
						// 次のセルが同じ行にある場合
						targetRange = cellRanges[currentCellIndex + 1];
					} else {
						// 次の行の最初のセルに移動
						const nextLineNumber = position.lineNumber + 1;
						if (nextLineNumber <= model.getLineCount()) {
							const nextCellRanges = getTableCellRanges(_w, nextLineNumber);
							if(nextCellRanges){
								targetRange = nextCellRanges[0];
							}
						}
					}

					if (targetRange) {
						_w.monacoEditor.setSelection(targetRange);
						_w.monacoEditor.revealPositionInCenterIfOutsideViewport(targetRange.getStartPosition());
					}
				}
				return;
			}

			// 通常のタブ挿入
			_w.monacoEditor.trigger('keyboard', 'tab', {});
		}, 'editorFocus');

		_w.monacoEditor.addCommand(_w.monaco.KeyMod.Shift | _w.monaco.KeyCode.Tab, () => {
			const model = _w.monacoEditor.getModel();
			const position = _w.monacoEditor.getPosition();
			const lineContent = model.getLineContent(position.lineNumber);

			// 箇条書きの処理
			const bulletMatch = lineContent.match(/^((?:-|\+){1,3})(\s*)([^-]*)$/);
			if (bulletMatch) {
				const [, bullet, space, content] = bulletMatch;
				if (bullet.length > 1) {
					// インデントを減らす
					_w.monacoEditor.executeEdits('', [{
						range: new _w.monaco.Range(position.lineNumber, 1, position.lineNumber, 2),
						text: ''
					}]);
				}
				return;
			}

			// テーブルの処理
			const cellRanges = getTableCellRanges(_w, position.lineNumber);
			if (cellRanges) {
				const currentCellIndex = cellRanges.findIndex((cell) => cell.containsPosition(position)); // 見つからなかった場合は-1

				if (currentCellIndex !== -1) {
					let targetRange;
					if (currentCellIndex > 0) {
						// 前のセルが同じ行にある場合
						targetRange = cellRanges[currentCellIndex - 1];
					} else {
						// 前の行の最後のセルに移動
						const prevLineNumber = position.lineNumber - 1;
						if (prevLineNumber > 0) {
							const prevCellRanges = getTableCellRanges(_w, prevLineNumber);
							if(prevCellRanges){
								targetRange = prevCellRanges[prevCellRanges.length - 1];
							}
						}
					}

					if (targetRange) {
						_w.monacoEditor.setSelection(targetRange);
						_w.monacoEditor.revealPositionInCenterIfOutsideViewport(targetRange.getStartPosition());
					}
				}
				return;
			}

			// 通常の逆タブ
			_w.monacoEditor.trigger('keyboard', 'outdent', {});
		}, 'editorFocus');


		// 既存のボタンの機能を実装
		const parentWindow = window.parent;
		const parentDocument = window.parent.document;
		const closeItemSearch = () => parentWindow.editor.item_search.hide(parentWindow.editor.item_search);;

		// Undo
		parentDocument.getElementsByClassName('bt-undo')[0].addEventListener('click', () => {
			_w.monacoEditor.trigger('source', 'undo');
		});

		// Redo
		parentDocument.getElementsByClassName('bt-redo')[0].addEventListener('click', () => {
			_w.monacoEditor.trigger('source', 'redo');
		});

		// const fontSizeForm = parentDocument.querySelector('#font_size_box > div.itemsearch_footer > div > div > form');
		// if(fontSizeForm){
		// 	fontSizeForm.removeAttribute('onsubmit');
		// 	fontSizeForm.addEventListener('submit', (e) => {
		// 		e.preventDefault();
		// 		const fontSize = fontSizeForm.fontSizeText.value;
		// 		if(fontSize.match(/\d+/)){
		// 			wrapSelectedText(_w.monaco, _w.monacoEditor, "&size(" + fontSize + "){", "}");
		// 			closeItemSearch();
		// 		} else {

		// 		}
		// 	});
		// }

		// Bold
		parentDocument.getElementById('bold').addEventListener('click', () => {
			wrapSelectedText(_w.monaco, _w.monacoEditor, "''", "''");
		});

		// Italic
		parentDocument.getElementById('italic').addEventListener('click', () => {
			wrapSelectedText(_w.monaco, _w.monacoEditor, "'''", "'''");
		});

		// Underline
		parentDocument.getElementById('underline').addEventListener('click', () => {
			wrapSelectedText(_w.monaco, _w.monacoEditor, "%%%", "%%%");
		});

		// List
		parentDocument.getElementById('ul').addEventListener('click', () => {
			insertAtBeginningOfLine(_w.monaco, _w.monacoEditor, "-", maxLevel=3);
		});

		// Ordered list
		parentDocument.getElementById('ol').addEventListener('click', () => {
			insertAtBeginningOfLine(_w.monaco, _w.monacoEditor, "+", maxLevel=3);
		});

		// Heading
		parentDocument.getElementById('h2').addEventListener('click', () => {
			insertAtBeginningOfLine(_w.monaco, _w.monacoEditor, "+", maxLevel=3);
		});

		// Strike
		parentDocument.getElementById('strike').addEventListener('click', () => {
			wrapSelectedText(_w.monaco, _w.monacoEditor, "%%", "%%");
		});

		// Folding (closed)
		parentDocument.getElementById('toggle_open').addEventListener('click', () => {
			wrapSelectedText(_w.monaco, _w.monacoEditor, "[+]\n", "\n[END]");
		});

		// Folding (opened)
		parentDocument.getElementById('toggle_close').addEventListener('click', () => {
			wrapSelectedText(_w.monaco, _w.monacoEditor, "[-]\n", "\n[END]");
		});

		// Quote
		parentDocument.getElementById('blockquote').addEventListener('click', () => {
			insertAtBeginningOfLine(_w.monaco, _w.monacoEditor, ">", maxLevel=1);
		});


		// Annotation
		parentDocument.getElementById('annotation').addEventListener('click', () => {
			wrapSelectedText(_w.monaco, _w.monacoEditor, "((", "))");
		});
	}

	// 選択されたテキストを指定の文字列で囲む関数
	function wrapSelectedText(monaco, editor, prefix, suffix) {
		const selection = editor.getSelection();
		const selectedText = editor.getModel().getValueInRange(selection);

		if (selectedText) {
			if(selectedText.startsWith(prefix) && selectedText.endsWith(suffix)){
				editor.executeEdits('', [{
					range: selection,
					text: selectedText.slice(prefix.length, selectedText.length-suffix.length),
				}]);
			} else {
				editor.executeEdits('', [{
					range: selection,
					text: prefix + selectedText + suffix,
				}]);
			}
		} else {
			const position = editor.getPosition();
			editor.executeEdits('', [{
				range: new monaco.Range(
					position.lineNumber,
					position.column,
					position.lineNumber,
					position.column
				),
				text: prefix + suffix,
			}]);
			// カーソルを suffix の前に移動
			editor.setPosition({
				lineNumber: position.lineNumber,
				column: position.column + prefix.length
			});
		}
	}

	// 行の先頭に文字列を挿入する関数
	function insertAtBeginningOfLine(monaco, editor, prefix, maxLevel=1) {
		const selection = editor.getSelection();
		const position = selection.getStartPosition();
		const line = editor.getModel().getLineContent(position.lineNumber);
		const regex = new RegExp(`^\\${prefix}{0,${maxLevel}}`);
		const currentLevel = line.match(regex)[0].length;
		if(currentLevel < maxLevel){
			editor.executeEdits('', [{
				range: new monaco.Range(
					position.lineNumber,
					1,
					position.lineNumber,
					1
				),
				text: prefix,
			}]);
		}
	}

	// メイン処理
	async function initMonacoEditor() {

		const textarea = document.getElementById("content");
		if (!textarea) return;
		textarea.style.display = "none";
		textarea.readOnly = true;

		const iframe = document.createElement('iframe');
		iframe.style.width = '100%';
		iframe.style.height = 'max(calc(100vh - 500px), 500px)';

		// Maximize editor
		document.getElementById('wide_area_button').addEventListener('click', () => {
			if(editor.wide_area_mode.is_wide){
				iframe.style.height = 'max(calc(100vh - 500px), 500px)';
			} else {
				iframe.style.height = 'max(calc(100vh - 150px), 500px)';
			}
		})

		iframe.style.border = 'none';
		textarea.parentNode.insertBefore(iframe, textarea);
		textarea.style.display = 'none';

		const iframeWindow = iframe.contentWindow;
		const iframeDocument = iframe.contentDocument || iframe.contentWindow.document;

		iframeDocument.open();
		iframeDocument.write(`
			<!DOCTYPE html>
			<html lang="ja">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<title>Seesaa Wiki Enhancer</title>
				<style>
					body, html {
						margin: 0;
						padding: 0;
						height: 100%;
						overflow: hidden;
						background-color: #1e1e1e;
						color: #d4d4d4;
						font-family: Consolas, 'Courier New', monospace;
						font-size: 14px;
					}
					#container {
						display: flex;
						height: 100%;
					}
					#outline-container {
						width: 250px;
						min-width: 250px;
						height: 100%;
						overflow-y: auto;
						border-right: 1px solid #333;
						box-sizing: border-box;
						background-color: #252526;
						display: flex;
						flex-direction: column;
					}
					#outline-label {
						padding: 10px 10px 5px;
						font-weight: bold;
						border-bottom: 1px solid #333;
						background-color: #2d2d2d;
						font-size: 14px;
					}
					#outline-content {
						flex-grow: 1;
						overflow-y: auto;
						padding: 5px 10px 10px;
					}
					#monaco-editor-container {
						flex-grow: 1;
						height: 100%;
						min-width: 0;
					}
					.monaco-editor .current-line {
						border: 2px solid #1073cfff !important;
						background-color: #1073cf50 !important;
					}
					.outline-item {
						cursor: pointer;
						padding: 4px 8px 4px 10px;
						border: 1px solid transparent;
						border-radius: 3px;
						position: relative;
					}
					.outline-item:hover {
						border-color: #007acc;
					}
					.outline-item.active {
						border-color: #007acc;
						background-color: #094771;
					}
					.outline-children {
						padding-left: 10px;
						border-left: 1px solid #808080;
						margin-left: 20px;
					}
					/* Add a custom scrollbar for the outline view */
					#outline-content::-webkit-scrollbar {
						width: 8px;
					}
					#outline-content::-webkit-scrollbar-track {
						background: #1e1e1e;
					}
					#outline-content::-webkit-scrollbar-thumb {
						background-color: #424242;
						border-radius: 4px;
					}
					#outline-content::-webkit-scrollbar-thumb:hover {
						background-color: #4f4f4f;
					}
			</style>
			</head>
			<body>
				<div id="container">
					<div id="outline-container">
						<div id="outline-label">OUTLINE</div>
						<div id="outline-content"></div>
					</div>
					<div id="monaco-editor-container"></div>
				</div>
				<script>
					(async () => {
						await (${loadMonacoEditor.toString()})();
						window.monaco = monaco;

						${SeesaaWikiDocumentSymbolProvider.toString()}

						(${registerSeesaaWikiLanguage.toString()})();

						${wrapSelectedText.toString()}
						${insertAtBeginningOfLine.toString()}

						(${replaceTextareaWithMonaco.toString()})(window, \`${textarea.value}\`);

						window.parent.postMessage('monacoReady', '*');
					})();
				</script>
			</body>
			</html>
		`);
		iframeDocument.close();

		// Wait for Monaco init
		await new Promise((resolve) => {
			const checkMonaco = () => {
				if (iframeWindow.monaco) {
					resolve();
				} else {
					setTimeout(checkMonaco, 100);
				}
			};

			// Listen for the 'monacoReady' message
			window.addEventListener('message', (event) => {
				if (event.data === 'monacoReady') {
					resolve();
				}
			}, { once: true });

			checkMonaco();
		});

		const monaco = iframeWindow.monaco;
		const monacoEditor = iframeWindow.monacoEditor;
		window.monaco = monaco;
		window.monacoEditor = monacoEditor;

		const symbolProvider = new SeesaaWikiDocumentSymbolProvider(monaco);

		function updateOutlineView(editor) {
			const model = editor.getModel();

			// CancellationTokenを使用せずにシンボルを取得
			let symbols;
			try {
				symbols = symbolProvider.provideDocumentSymbols(model);
			} catch (error) {
				console.error('Error retrieving document symbols:', error);
				return;
			}

			// シンボルが配列でない場合（おそらくPromise）、then メソッドを使用
			if (symbols && typeof symbols.then === 'function') {
				symbols.then(renderSymbols).catch(error => {
					console.error('Error retrieving document symbols:', error);
				});
			} else {
				renderSymbols(symbols, editor);
			}
		}

		function renderSymbols(symbols, editor) {
			const outlineContent = iframeDocument.getElementById('outline-content');
			outlineContent.innerHTML = '';

			function renderSymbolsRecursive(symbols, container) {
				symbols.forEach(symbol => {
					const item = iframeDocument.createElement('div');
					item.className = 'outline-item';
					item.textContent = symbol.name;
					item.onclick = (e) => {
						e.stopPropagation();
						// Remove 'active' class from all items
						outlineContent.querySelectorAll('.outline-item').forEach(el => el.classList.remove('active'));
						// Add 'active' class to clicked item
						item.classList.add('active');
						editor.revealPositionInCenter({ lineNumber: symbol.range.startLineNumber, column: symbol.range.startColumn });
						editor.setPosition({ lineNumber: symbol.range.startLineNumber, column: symbol.range.startColumn });
						editor.focus();
					};
					container.appendChild(item);

					if (symbol.children && symbol.children.length > 0) {
						const childrenContainer = iframeDocument.createElement('div');
						childrenContainer.className = 'outline-children';
						renderSymbolsRecursive(symbol.children, childrenContainer);
						container.appendChild(childrenContainer);
					}
				});
			}

			renderSymbolsRecursive(symbols, outlineContent);
		}

		monacoEditor.onDidChangeModelContent(() => {
			updateOutlineView(monacoEditor);
		});

		// 初期アウトラインビューの更新
		updateOutlineView(monacoEditor);

		// Override form submission
		const form = textarea.closest('form');
		form.addEventListener('submit', e => {
			e.preventDefault();
			textarea.value = iframeWindow.monacoEditor.getModel().getValue();
			form.submit();
		});

		// Override preview button
		document.querySelectorAll('.preview > a').forEach((preview) => {
			preview.addEventListener('click', e => {
				e.preventDefault();
				textarea.value = iframeWindow.monacoEditor.getModel().getValue();
				if (window.editor && window.editor.tools && window.editor.tools.toPreview) {
					window.editor.tools.toPreview();
				} else {
					console.warn('editor.tools.toPreview is not available');
					// Fallback: submit the form
					form.submit();
				}
			});
		});
	}

	function extractDiffContent() {
		const diffBox = document.querySelector(".diff-box");
		if (!diffBox) return null;

		let innerHTML = diffBox.innerHTML;
		innerHTML = innerHTML.replace(/<br>/g, "");
		innerHTML = decodeHTMLEntities(innerHTML);

		const lines = innerHTML.split("\n");
		let oldContent = "";
		let newContent = "";
		const changes = [];
		let oldLineNumber = 1;
		let newLineNumber = 1;
		let currentChangeStart = null;
		let currentChangeType = null;

		function pushChange() {
			if (currentChangeStart !== null) {
				changes.push({
					startLine: currentChangeStart,
					endLine:
						currentChangeType === "add"
							? newLineNumber - 1
							: oldLineNumber - 1,
					type: currentChangeType,
				});
				currentChangeStart = null;
				currentChangeType = null;
			}
		}

		for (const line of lines) {
			if (line.includes('class="line-add"')) {
				const cleanLine = line.replace(/<span class="line-add">|<\/span>/g, "");
				newContent += cleanLine + "\n";
				if (currentChangeType !== "add") {
					pushChange();
					currentChangeStart = newLineNumber;
					currentChangeType = "add";
				}
				newLineNumber++;
			} else if (line.includes('class="line-delete"')) {
				const cleanLine = line.replace(/<span class="line-delete">|<\/span>/g, "");
				oldContent += cleanLine + "\n";
				if (currentChangeType !== "delete") {
					pushChange();
					currentChangeStart = oldLineNumber;
					currentChangeType = "delete";
				}
				oldLineNumber++;
			} else {
				oldContent += line + "\n";
				newContent += line + "\n";
				pushChange();
				oldLineNumber++;
				newLineNumber++;
			}
		}
		pushChange();

		return { oldContent, newContent, changes };
	}

	function createMonacoDiffEditor(container, oldContent, newContent) {
		const diffEditor = monaco.editor.createDiffEditor(container, {
			readOnly: true,
			renderSideBySide: false,
			automaticLayout: true,
			// minimap: { enabled: false },
			theme: "seesaawikiTheme",
			wordWrap: "on",
			scrollBeyondLastLine: false,
			unicodeHighlight: {
				ambiguousCharacters: true,
				invisibleCharacters: false,
				nonBasicASCII: false
			}
		});

		const originalModel = monaco.editor.createModel(oldContent, "seesaawiki");
		const modifiedModel = monaco.editor.createModel(newContent, "seesaawiki");

		diffEditor.setModel({
			original: originalModel,
			modified: modifiedModel,
		});

		return diffEditor;
	}

	function createDiffEditorContainer() {
		const container = document.createElement("div");
		container.id = "monaco-editor-container";
		container.style.width = "100%";
		container.style.height = "max(calc(100vh - 350px), 500px)";
		container.style.marginBottom = "20px";
		container.style.position = "relative";
		container.style.border = "1px solid #ccc";

		return container;
	}

	function createJumpButtons(diffEditor, changes) {
		const buttonContainer = document.createElement("div");
		buttonContainer.style.position = "absolute";
		buttonContainer.style.top = "10px";
		buttonContainer.style.right = "10px";
		buttonContainer.style.zIndex = "1000";

		const nextDiffButton = document.createElement("button");
		nextDiffButton.textContent = "↓";
		nextDiffButton.style.marginLeft = "5px";
		nextDiffButton.onclick = () => jumpToNextDiff(diffEditor, changes);

		const prevDiffButton = document.createElement("button");
		prevDiffButton.textContent = "↑";
		prevDiffButton.onclick = () => jumpToPrevDiff(diffEditor, changes);

		buttonContainer.appendChild(prevDiffButton);
		buttonContainer.appendChild(nextDiffButton);

		return buttonContainer;
	}

	function jumpToDiff(diffEditor, changes, forward=true) {
		const modifiedEditor = diffEditor.getModifiedEditor();
		const currentPosition = modifiedEditor.getPosition();

		let targetChange;
		if (forward) {
			targetChange = changes.find(change =>
				(change.type === "add" && change.startLine > currentPosition.lineNumber) ||
				(change.type === "delete" && change.startLine >= currentPosition.lineNumber)
			);
		} else {
			targetChange = changes.slice().reverse().find(change =>
				(change.type === "add" && change.endLine < currentPosition.lineNumber) ||
				(change.type === "delete" && change.startLine < currentPosition.lineNumber)
			);
		}

		if (targetChange) {
			const jumpLine = targetChange.type === "add" ? targetChange.startLine : targetChange.startLine + 1;
			modifiedEditor.setPosition({ lineNumber: jumpLine, column: 1 });
			modifiedEditor.revealLineNearTop(jumpLine);
		}
	}

	async function initMonacoDiffEditor() {
		const diffBox = document.querySelector(".diff-box");

		// Hide the original diff box
		diffBox.style.display = "none";
		document.getElementsByClassName("information-box")[0].style.display = "none";

		await loadMonacoEditor();

		const diffContent = extractDiffContent();
		if (!diffContent) return;

		registerSeesaaWikiLanguage();

		const container = createDiffEditorContainer();
		diffBox.parentNode.insertBefore(container, diffBox);

		const diffEditor = createMonacoDiffEditor(
			container,
			diffContent.oldContent,
			diffContent.newContent
		);

		// const buttonContainer = createJumpButtons(diffEditor, diffContent.changes);
		// container.appendChild(buttonContainer);

		diffEditor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.DownArrow, () => {
			jumpToDiff(diffEditor, diffContent.changes, true);
		});

		diffEditor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.UpArrow, () => {
			jumpToDiff(diffEditor, diffContent.changes, false);
		});
	}

})();