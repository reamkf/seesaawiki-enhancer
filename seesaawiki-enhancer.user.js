// ==UserScript==
// @name         Seesaa Wiki Enhancer
// @version 0.0.1-test5
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
	// DOMContentLoadedより後に実行されるっぽいのでDOMContentLoadedは不要

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

	const addCSS = (css) => {
		const style = document.createElement("style");
		style.innerHTML = css;
		document.head.append(style);
	};

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
	// function loadMonacoEditor() {
	//     return new Promise((resolve) => {
	// 		const link = document.createElement('link');
	// 		link.rel = 'stylesheet';
	// 		link.setAttribute('data-name', 'vs/editor/editor.main');
	// 		link.href = 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs/editor/editor.main.css';
	// 		document.head.appendChild(link);

	// 		addScript('', "var require = { paths: { 'vs': 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.50.0/min/vs' } }")
	//         addScript('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.51.0/min/vs/loader.js');
	//         addScript('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.51.0/min/vs/editor/editor.main.nls.js');
	// 		addScript('https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.51.0/min/vs/editor/editor.main.js');

	// 		setTimeout(() => {
	// 			resolve();
	// 		}, 2000);
	//     });
	// }
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

	class SeesaaWikiDocumentSymbolProvider {
		constructor(monaco) {
            this.monaco = monaco;
        }

		provideDocumentSymbols(model, token) {
			const documentSymbols = [];
			let symbol;
			const lastUnclosedHeadingSymbol = [null, null, null];

			for (let lineNum = 0; lineNum < model.getLineCount(); lineNum++) {
				const lineContent = model.getLineContent(lineNum + 1);
				const headingMatch = lineContent.match(/^\*{0,3}/);
				const headingLevel = headingMatch && headingMatch[0].length || 0;

				if (headingLevel) {
					const range = {
						startLineNumber: lineNum + 1,
						startColumn: 1,
						endLineNumber: lineNum + 1,
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
							lastUnclosedHeadingSymbol[level - 1].range.endLineNumber = lineNum;
							lastUnclosedHeadingSymbol[level - 1].range.endColumn = model.getLineMaxColumn(lineNum);
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
	}


	const url = location.href;
	const pageType = getWikiPageType(url);

	if (pageType == WikiPageType.EDIT) {
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

		addCSS(`
			/*  Notes:
				- #content : editor window
				- .user-area : preview-window
			*/
			#content, .user-area {
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

		/* ********************************************************************************
			Replace with Monaco Editor
		/* ******************************************************************************** */

		function replaceTextareaWithMonaco(_window=window, value="") {
			_window.monacoEditor = _window.monaco.editor.create(_window.document.getElementById('monaco-editor-container'), {
                value: value,
                language: 'seesaawiki',
                theme: 'seesaawikiTheme',
				wordWrap: "on",
                // minimap: { enabled: false },
                automaticLayout: true,
				bracketPairColorization: { enabled: true },
				renderLineHighlight: "all",
            });

			// カスタムキーバインディングの設定
			_window.monacoEditor.addCommand(_window.monaco.KeyMod.CtrlCmd | _window.monaco.KeyCode.KeyB, () => {
				wrapSelectedText(_window.monaco, _window.monacoEditor, "''", "''");
			});

			_window.monacoEditor.addCommand(_window.monaco.KeyMod.CtrlCmd | _window.monaco.KeyCode.KeyI, () => {
				wrapSelectedText(_window.monaco, _window.monacoEditor, "'''", "'''");
			});

			_window.monacoEditor.addCommand(_window.monaco.KeyMod.CtrlCmd | _window.monaco.KeyCode.KeyU, () => {
				wrapSelectedText(_window.monaco, _window.monacoEditor, "%%%", "%%%");
			});

			_window.monacoEditor.addCommand(_window.monaco.KeyMod.CtrlCmd | _window.monaco.KeyCode.KeyD, () => {
				wrapSelectedText(_window.monaco, _window.monacoEditor, "%%", "%%");
			});

			_window.monacoEditor.addCommand(_window.monaco.KeyMod.CtrlCmd | _window.monaco.KeyCode.KeyK, () => {
				wrapSelectedText(_window.monaco, _window.monacoEditor, "[[", "]]");
			});


			// 既存のボタンの機能を実装
			const parentWindow = window.parent;
			const parentDocument = window.parent.document;
			const closeItemSearch = () => parentWindow.editor.item_search.hide(parentWindow.editor.item_search);;

			// Undo
			parentDocument.getElementsByClassName('bt-undo')[0].addEventListener('click', () => {
				_window.monacoEditor.trigger('source', 'undo');
			});

			// Redo
			parentDocument.getElementsByClassName('bt-redo')[0].addEventListener('click', () => {
				_window.monacoEditor.trigger('source', 'redo');
			});

			// const fontSizeForm = parentDocument.querySelector('#font_size_box > div.itemsearch_footer > div > div > form');
			// if(fontSizeForm){
			// 	fontSizeForm.removeAttribute('onsubmit');
			// 	fontSizeForm.addEventListener('submit', (e) => {
			// 		e.preventDefault();
			// 		const fontSize = fontSizeForm.fontSizeText.value;
			// 		if(fontSize.match(/\d+/)){
			// 			wrapSelectedText(_window.monaco, _window.monacoEditor, "&size(" + fontSize + "){", "}");
			// 			closeItemSearch();
			// 		} else {

			// 		}
			// 	});
			// }

			// Bold
			parentDocument.getElementById('bold').addEventListener('click', () => {
				wrapSelectedText(_window.monaco, _window.monacoEditor, "''", "''");
			});

			// Italic
			parentDocument.getElementById('italic').addEventListener('click', () => {
				wrapSelectedText(_window.monaco, _window.monacoEditor, "'''", "'''");
			});

			// Underline
			parentDocument.getElementById('underline').addEventListener('click', () => {
				wrapSelectedText(_window.monaco, _window.monacoEditor, "%%%", "%%%");
			});

			// List
			parentDocument.getElementById('ul').addEventListener('click', () => {
				insertAtBeginningOfLine(_window.monaco, _window.monacoEditor, "-", maxLevel=3);
			});

			// Ordered list
			parentDocument.getElementById('ol').addEventListener('click', () => {
				insertAtBeginningOfLine(_window.monaco, _window.monacoEditor, "+", maxLevel=3);
			});

			// Heading
			parentDocument.getElementById('h2').addEventListener('click', () => {
				insertAtBeginningOfLine(_window.monaco, _window.monacoEditor, "+", maxLevel=3);
			});

			// Strike
			parentDocument.getElementById('strike').addEventListener('click', () => {
				wrapSelectedText(_window.monaco, _window.monacoEditor, "%%", "%%");
			});

			// Folding (closed)
			parentDocument.getElementById('toggle_open').addEventListener('click', () => {
				wrapSelectedText(_window.monaco, _window.monacoEditor, "[+]\n", "\n[END]");
			});

			// Folding (opened)
			parentDocument.getElementById('toggle_close').addEventListener('click', () => {
				wrapSelectedText(_window.monaco, _window.monacoEditor, "[-]\n", "\n[END]");
			});

			// Quote
			parentDocument.getElementById('blockquote').addEventListener('click', () => {
				insertAtBeginningOfLine(_window.monaco, _window.monacoEditor, ">", maxLevel=1);
			});


			// Annotation
			parentDocument.getElementById('annotation').addEventListener('click', () => {
				wrapSelectedText(_window.monaco, _window.monacoEditor, "((", "))");
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

		initMonacoEditor();

	} else if (pageType == WikiPageType.DIFF) {
		/* ********************************************************************************
			Replace with Monaco Diff Editor
		/* ******************************************************************************** */
		function extractDiffContent() {
			const diffBox = document.querySelector(".diff-box");
			if (!diffBox) return null;

			const lines = diffBox.innerHTML.split("\n");
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
					const cleanLine = decodeHTMLEntities(
						line
							.replace(/<span class="line-add">|<\/span>/g, "")
							.replace(/<br>/g, "")
					);
					newContent += cleanLine + "\n";
					if (currentChangeType !== "add") {
						pushChange();
						currentChangeStart = newLineNumber;
						currentChangeType = "add";
					}
					newLineNumber++;
				} else if (line.includes('class="line-delete"')) {
					const cleanLine = decodeHTMLEntities(
						line
							.replace(/<span class="line-delete">|<\/span>/g, "")
							.replace(/<br>/g, "")
					);
					oldContent += cleanLine + "\n";
					if (currentChangeType !== "delete") {
						pushChange();
						currentChangeStart = oldLineNumber;
						currentChangeType = "delete";
					}
					oldLineNumber++;
				} else {
					const cleanLine = decodeHTMLEntities(line.replace(/<br>/g, ""));
					oldContent += cleanLine + "\n";
					newContent += cleanLine + "\n";
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

		function jumpToNextDiff(diffEditor, changes) {
			const modifiedEditor = diffEditor.getModifiedEditor();
			const currentPosition = modifiedEditor.getPosition();
			const nextChange = changes.find(
				(change) =>
					(change.type === "add" &&
						change.startLine > currentPosition.lineNumber) ||
					(change.type === "delete" &&
						change.startLine >= currentPosition.lineNumber)
			);
			if (nextChange) {
				const jumpLine =
					nextChange.type === "add"
						? nextChange.startLine
						: nextChange.startLine + 1;
				modifiedEditor.setPosition({ lineNumber: jumpLine, column: 1 });
				modifiedEditor.revealLineInCenter(jumpLine);
			}
		}

		function jumpToPrevDiff(diffEditor, changes) {
			const modifiedEditor = diffEditor.getModifiedEditor();
			const currentPosition = modifiedEditor.getPosition();
			const prevChange = changes
				.slice()
				.reverse()
				.find(
					(change) =>
						(change.type === "add" &&
							change.endLine < currentPosition.lineNumber) ||
						(change.type === "delete" &&
							change.startLine < currentPosition.lineNumber)
				);
			if (prevChange) {
				const jumpLine =
					prevChange.type === "add"
						? prevChange.startLine
						: prevChange.startLine + 1;
				modifiedEditor.setPosition({ lineNumber: jumpLine, column: 1 });
				modifiedEditor.revealLineInCenter(jumpLine);
			}
		}

		async function initMonacoDiffEditor() {
			await loadMonacoEditor();

			const diffContent = extractDiffContent();
			if (!diffContent) return;

			registerSeesaaWikiLanguage();

			const container = createDiffEditorContainer();
			const diffBox = document.querySelector(".diff-box");
			diffBox.parentNode.insertBefore(container, diffBox);

			const diffEditor = createMonacoDiffEditor(
				container,
				diffContent.oldContent,
				diffContent.newContent
			);

			// const buttonContainer = createJumpButtons(diffEditor, diffContent.changes);
			// container.appendChild(buttonContainer);

			// diffEditor.addCommand(monaco.KeyCode.RightArrow, () => jumpToNextDiff(diffEditor, changes));
			// diffEditor.addCommand(monaco.KeyCode.LeftArrow, () => jumpToPrevDiff(diffEditor, changes));

			// Hide the original diff box
			diffBox.style.display = "none";
			document.getElementsByClassName("information-box")[0].style.display = "none";
		}

		initMonacoDiffEditor();
	}
})();