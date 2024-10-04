// ==UserScript==
// @name         Seesaa Wiki Enhancer
// @version      0.0.1
// @author       @_ream_kf
// @match        https://seesaawiki.jp/*
// @match        https://*.memo.wiki/*
// @match        https://*.game-info.wiki/*
// @match        https://*.sokuhou.wiki/*
// @match        https://*.chronicle.wiki/*
// @match        https://*.playing.wiki/*
// //@match        https://cms.wiki.seesaa.jp/cms/*
// @icon         https://www.google.com/s2/favicons?domain=seesaawiki.jp
// @updateURL    https://github.com/reamkf/seesaawiki-enhancer/releases/latest/download/seesaawiki-enhancer.meta.js
// @downloadURL  https://github.com/reamkf/seesaawiki-enhancer/releases/latest/download/seesaawiki-enhancer.user.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/encoding-japanese/2.0.0/encoding.min.js
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

	const url = location.href;
	const pageType = getWikiPageType(url);
	const wikiId = getWikiId(url);
	window.wikiId = wikiId;
	window.getWikiPageUrl = getWikiPageUrl;

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

	function addScript(src, innerHTML) {
		const script = document.createElement("script");
		if (script) script.src = src;
		if (innerHTML) script.innerHTML = innerHTML;
		document.head.appendChild(script);
	}



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

	function getWikiId(url){
		let match;

		match = url.match(/^https:\/\/seesaawiki\.jp\/((?:w\/)?[^\/]+)/);
		if (match && match[1]) {
			return match[1];
		}

		match = url.match(/^https:\/\/([^\.]+)\.(memo|game-info|sokuhou|chronicle|playing)\.wiki\//);
		if(match && match[1] && match[2]){
			return match[1] + '-' + match[2];
		}

		return null;
	}

	function convertCharRef(str, reverse=false){
		const charRefTable = [
			['\u2474', '&#9332;'],
			['\u2475', '&#9333;'],
			['\u2476', '&#9334;'],
			['\u2477', '&#9335;'],
			['\u2478', '&#9336;'],
			['\u2479', '&#9337;'],
			['\u247A', '&#9338;'],
			['\u247B', '&#9339;'],
			['\u247C', '&#9340;'],
			['\u247D', '&#9341;'],
			['\u247E', '&#9342;'],
			['\u247F', '&#9343;'],
			['\u2480', '&#9344;'],
			['\u2481', '&#9345;'],
			['\u2482', '&#9346;'],
			['\u2483', '&#9347;'],
			['\u2484', '&#9348;'],
			['\u2485', '&#9349;'],
			['\u2486', '&#9350;'],
			['\u2487', '&#9351;'],
			['\u2488', '&#9352;'],
			['\u2489', '&#9353;'],
			['\u248A', '&#9354;'],
			['\u248B', '&#9355;'],
			['\u248C', '&#9356;'],
			['\u248D', '&#9357;'],
			['\u248E', '&#9358;'],
			['\u248F', '&#9359;'],
			['\u2490', '&#9360;'],
			['\u2491', '&#9361;'],
			['\u2492', '&#9362;'],
			['\u2493', '&#9363;'],
			['\u2494', '&#9364;'],
			['\u2495', '&#9365;'],
			['\u2496', '&#9366;'],
			['\u2497', '&#9367;'],
			['\u2498', '&#9368;'],
			['\u2499', '&#9369;'],
			['\u249A', '&#9370;'],
			['\u249B', '&#9371;'],
			['\u249C', '&#9372;'],
			['\u249D', '&#9373;'],
			['\u249E', '&#9374;'],
			['\u249F', '&#9375;'],
			['\u24A0', '&#9376;'],
			['\u24A1', '&#9377;'],
			['\u24A2', '&#9378;'],
			['\u24A3', '&#9379;'],
			['\u24A4', '&#9380;'],
			['\u24A5', '&#9381;'],
			['\u24A6', '&#9382;'],
			['\u24A7', '&#9383;'],
			['\u24A8', '&#9384;'],
			['\u24A9', '&#9385;'],
			['\u24AA', '&#9386;'],
			['\u24AB', '&#9387;'],
			['\u24AC', '&#9388;'],
			['\u24AD', '&#9389;'],
			['\u24AE', '&#9390;'],
			['\u24AF', '&#9391;'],
			['\u24B0', '&#9392;'],
			['\u24B1', '&#9393;'],
			['\u24B2', '&#9394;'],
			['\u24B3', '&#9395;'],
			['\u24B4', '&#9396;'],
			['\u24B5', '&#9397;'],
			['\u24B6', '&#9398;'],
			['\u24B7', '&#9399;'],
			['\u24B8', '&#9400;'],
			['\u24B9', '&#9401;'],
			['\u24BA', '&#9402;'],
			['\u24BB', '&#9403;'],
			['\u24BC', '&#9404;'],
			['\u24BD', '&#9405;'],
			['\u24BE', '&#9406;'],
			['\u24BF', '&#9407;'],
			['\u24C0', '&#9408;'],
			['\u24C1', '&#9409;'],
			['\u24C2', '&#9410;'],
			['\u24C3', '&#9411;'],
			['\u24C4', '&#9412;'],
			['\u24C5', '&#9413;'],
			['\u24C6', '&#9414;'],
			['\u24C7', '&#9415;'],
			['\u24C8', '&#9416;'],
			['\u24C9', '&#9417;'],
			['\u24CA', '&#9418;'],
			['\u24CB', '&#9419;'],
			['\u24CC', '&#9420;'],
			['\u24CD', '&#9421;'],
			['\u24CE', '&#9422;'],
			['\u24CF', '&#9423;'],
			['\u24D0', '&#9424;'],
			['\u24D1', '&#9425;'],
			['\u24D2', '&#9426;'],
			['\u24D3', '&#9427;'],
			['\u24D4', '&#9428;'],
			['\u24D5', '&#9429;'],
			['\u24D6', '&#9430;'],
			['\u24D7', '&#9431;'],
			['\u24D8', '&#9432;'],
			['\u24D9', '&#9433;'],
			['\u24DA', '&#9434;'],
			['\u24DB', '&#9435;'],
			['\u24DC', '&#9436;'],
			['\u24DD', '&#9437;'],
			['\u24DE', '&#9438;'],
			['\u24DF', '&#9439;'],
			['\u24E0', '&#9440;'],
			['\u24E1', '&#9441;'],
			['\u24E2', '&#9442;'],
			['\u24E3', '&#9443;'],
			['\u24E4', '&#9444;'],
			['\u24E5', '&#9445;'],
			['\u24E6', '&#9446;'],
			['\u24E7', '&#9447;'],
			['\u24E8', '&#9448;'],
			['\u24E9', '&#9449;'],
			['\u24EA', '&#9450;'],
			['\u24EB', '&#9451;'],
			['\u24EC', '&#9452;'],
			['\u24ED', '&#9453;'],
			['\u24EE', '&#9454;'],
			['\u24EF', '&#9455;'],
			['\u24F0', '&#9456;'],
			['\u24F1', '&#9457;'],
			['\u24F2', '&#9458;'],
			['\u24F3', '&#9459;'],
			['\u24F4', '&#9460;'],
			['\u24F5', '&#9461;'],
			['\u24F6', '&#9462;'],
			['\u24F7', '&#9463;'],
			['\u24F8', '&#9464;'],
			['\u24F9', '&#9465;'],
			['\u24FA', '&#9466;'],
			['\u24FB', '&#9467;'],
			['\u24FC', '&#9468;'],
			['\u24FD', '&#9469;'],
			['\u24FE', '&#9470;'],
			['\u2660', '&#9824;'],
			['\u2661', '&#9825;'],
			['\u2662', '&#9826;'],
			['\u2663', '&#9827;'],
			['\u2664', '&#9828;'],
			['\u2665', '&#9829;'],
			['\u2666', '&#9830;'],
			['\u2667', '&#9831;'],
			['\u2668', '&#9832;'],
			['\u2669', '&#9833;'],
			['\u266B', '&#9835;'],
			['\u266C', '&#9836;'],
			['\u266E', '&#9838;'],
			['\u2776', '&#10102;'],
			['\u2777', '&#10103;'],
			['\u2778', '&#10104;'],
			['\u2779', '&#10105;'],
			['\u277A', '&#10106;'],
			['\u277B', '&#10107;'],
			['\u277C', '&#10108;'],
			['\u277D', '&#10109;'],
			['\u277E', '&#10110;'],
			['\u277F', '&#10111;'],
			['\u2781', '&#10113;'],
			['\u2782', '&#10114;'],
			['\u2783', '&#10115;'],
			['\u2784', '&#10116;'],
			['\u2785', '&#10117;'],
			['\u2786', '&#10118;'],
			['\u2787', '&#10119;'],
			['\u2788', '&#10120;'],
			['\u2789', '&#10121;'],
			['\u278A', '&#10122;'],
			['\u278B', '&#10123;'],
			['\u278C', '&#10124;'],
			['\u278D', '&#10125;'],
			['\u278E', '&#10126;'],
			['\u278F', '&#10127;'],
			['\u2790', '&#10128;'],
			['\u2791', '&#10129;'],
			['\u2792', '&#10130;'],
			['\u2793', '&#10131;'],
		]
		if(reverse){
			for(let [to, from] of charRefTable){
				from = new RegExp(from, 'g')
				str = str.replace(from, to)
			}
		} else {
			for(let [from, to] of charRefTable){
				from = new RegExp(from, 'g')
				str = str.replace(from, to)
			}
		}
		return str
	}

	function getWikiPageUrl(pageName){
		return `https://seesaawiki.jp/${wikiId}/d/${encodeEUCJP(convertCharRef(pageName))}`
	}

	function decodeHTMLEntities(text) {
		const textarea = document.createElement("textarea");
		textarea.innerHTML = text;
		return textarea.value;
	}

	const _sleep = (time /* in millisec */) =>
		new Promise((resolve) => setTimeout(resolve, time));
	const sleep = async (time /* in millisec */) => await _sleep(time);


	function encodeEUCJP(str) {
		const Encoding = window.parent && window.parent.Encoding || Encoding;
        const eucjpArray = Encoding.convert(Encoding.stringToCode(str), 'EUCJP', 'UNICODE');
        let result = '';
        for (let i = 0; i < eucjpArray.length; i++) {
            result += '%' + eucjpArray[i].toString(16).padStart(2, '0').toUpperCase();
        }
        return result;
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
				["[[", "]]"],
				// ["|", "|"],
				// ["&", ";"],    // HTMLエンティティのための疑似的な括弧
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
				{ open: "|", close: "|" },
			],
			// wordPattern: /(-?\d*\.\d\w*%?)|(https?:\/\/.*?\.(?:png|jpg|jpeg|gif|webp))|([^\`\~\!\@\#\%\^\&\*\(\)\=\+\[\{\]\}\\\|\;\:\'\"\,\.\<\>\/\?\s]+)/g
		};

		monaco.languages.setLanguageConfiguration("seesaawiki", languageConfiguration);

		seesaaWikiLanguage = {
			anchorName: /[a-zA-Z0-1\-_\.:]+/,
			tableParams: /(?:center|left|right|(?:color|bgcolor|size|w|h)\(.*?\)):?/,
			tokenizer: {
				root: [
					// Comment
					[/^\/\/.*$/, 'comment'],

					// Headings
					[/^(\*)(?!\*)(.*)$/,    ['keyword', 'markup.heading.3']],
					[/^(\*{2})(?!\*)(.*)$/, ['keyword', 'markup.heading.4']],
					[/^(\*{3})(?!\*)(.*)$/, ['keyword', 'markup.heading.5']],

					// Links
					[/\[\[/, {token: 'delimiter.square', bracket: '@open', next: '@links'}],

					// Refs
					[/(&|#)(ref|attachref)(\()/, ['keyword.control', 'keyword', { token: 'delimiter.curly', bracket: '@open', next: '@ref' }]],

					// Bold
					[/('')([^']*?)('')/, ['keyword', {token: 'markup.bold', next: '@root'}, 'keyword']],

					// Underline
					[/(%%%)([^%]*?)(%%%)/, ['keyword', {token: 'markup.underline', next: '@root'}, 'keyword']],

					// Italic
					[/(''')([^']*?)(''')/, ['keyword', {token: 'markup.italic', next: '@root'}, 'keyword']],

					// Strike
					[/(%%)([^%]*?)(%%)/, ['keyword', {token: 'markup.deleted', next: '@root'}, 'keyword']],

					// Font size
					[/(&|#)(size)(\()(\d+)(\))(\{)/, [
						'keyword.control', 'keyword',
						{ token: 'delimiter.parenthesis', bracket: '@open'},
						'number',
						{ token: 'delimiter.parenthesis', bracket: '@close'},
						{ token: 'delimiter.curly', bracket: '@open', next: '@root'},
					]],

					// Font color
					[/(&|#)(color)(\()/, ['keyword.control', 'keyword', { token: 'delimiter.parenthesis', bracket: '@open', next: '@color'}]],

					// Foidings
					[/^\[(?:\+|-)\]/, { token: 'keyword.control', bracket: '@open', next: '@root'}],
					[/^\[END\]/, { token: 'keyword.control', bracket: '@close', next: '@pop'}],

					// Table of contents
					[/^(#)(contents)(\()(1|2)(\))/, ['keyword.control', 'keyword', {token: 'delimiter.parenthesis', bracket: '@open'}, 'number', {token: 'delimiter.parenthesis', bracket: '@close'}]],
					[/^(#)(contents)/, ['keyword.control', 'keyword']],

					// New Line
					[/~~(?:~~~)*/, 'keyword.control'],

					// Table
					// [/^\|(?=.*\|c?$)/, 'keyword.control', '@root'],
					[/^\|/, {token: 'keyword.control', bracket: '@open', next: '@table'}],

					// // Code block
					// [/^(=\|)(BOX|AA|AAS|CC|CPP|CS|CYC|JAVA|BSH|CSH|SH|CV|PY|PERL|PL|PM|RB|JS|HTML|XHTML|XML|XSL|LUA|ERLANG|GO|LISP|R|SCALA|SQL|SWIFT|TEX|YAML|AUTO|\(box=(?:textarea|div)\))?(\|)$/, [
					// 	'keyword',
					// 	'keyword',
					// 	'keyword'
					// ]],

					// 	// Pre
					// 	[/^(\|\|=)$/, 'keyword'],

					// Email
					[/\w+@\w+\.\w+/, 'markup.underline.link'],

					// List
					[/^(\+{1,3})(?!\+)/, ['keyword']],
					[/^(\-{1,3})(?!\-)/, ['keyword']],


					// Horizon
					[/^----$/, 'keyword.control'],

					// Anchor
					[/(&|#)(aname)(\()(@anchorName)(\))/, [
						'keyword.control', 'keyword',
						{token: 'delimiter.parenthesis', bracket: '@open'}, 'support.variable.italic', {token: 'delimiter.parenthesis', bracket: '@close'}
					]],

					// HTML Entities
					[/&(?:\w+|#\d+|#x[\da-fA-F]+);/, 'constant.character.escape'],

				// 	// Super
				// 	[/(&)(sup)(\{)([^}]*)(\})/, [
				// 		'keyword.control',
				// 		'support.variable',
				// 		'keyword',
				// 		{ token: '', next: '@supContent' },
				// 		'keyword'
				// 	]],

				// 	// Sub
				// 	[/(__)(.*)(__)/,
				// 		['keyword', '', 'keyword']
				// 	],

				// 	// Fukidashi
				// 	[/(&)(fukidashi)(\()([^,)]*?)(?:(,)(s*)(right))?(\))(\{)([^}]*)(\})/, [
				// 		'keyword.control',
				// 		'support.variable',
				// 		'keyword',
				// 		'constant.other',
				// 		'keyword',
				// 		'keyword',
				// 		'keyword.control',
				// 		'keyword',
				// 		'keyword',
				// 		{ token: '', next: '@fukidashiContent' },
				// 		'keyword'
				// 	]],

				// 	// Ruby
				// 	[/(&)(ruby)(\()([^)]*?)(\))(\{)([^}]*)(\})/, [
				// 		'keyword.control',
				// 		'support.variable',
				// 		'keyword',
				// 		{ token: '', next: '@rubyBase' },
				// 		'keyword',
				// 		'keyword',
				// 		{ token: '', next: '@rubyText' },
				// 		'keyword'
				// 	]],
				],
				rootCloseCurlyBracket: [
					[/\}/, {token: 'delimiter.curly', bracket: '@close', next: '@pop'}],
					{include: '@root'}
				],
				rootCloseTable: [
					[/\|$/, {token: 'keyword.control', bracket: '@close', next: '@pop'}],
					[/\|/, {token: 'keyword.control', bracket: '@close', next: '@pop'}],
					{include: '@root'}
				],
				links: [
					[/\]\]/, { token: 'delimiter.square', bracket: '@close', next: '@pop'}],
					[/>{1,3}/, 'delimiter.angle'],
					[/https?:\/\/[^\s>\]]+/, 'string.url'],
					[/#@anchorName/, 'support.variable.italic'],
					[/[^#>\]]+/, 'markup.underline.link']
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
					[/\{/, { token: 'delimiter.curly', bracket: '@open', next: '@root'}],
					[/,/, 'delimiter'],
					[/\s+/, ''],
				],
				table: [
					[/\|c?$/, {token: 'keyword.control', bracket: '@close', next: '@pop'}],
					[/\|/, {token: 'keyword.control', bracket: '@close'}],
					[/@tableParams/, 'keyword.parameter'],
					[/(r)(\[)/, ['keyword.control', {token: 'keyword.control',  next: '@tableRowCondig'}]],
					[/!|~|>|\^/, 'keyword.parameter'],
					{include: '@rootCloseTable'}
				],
				tableRowCondig: [
					[/\]:?/, {token: 'keyword.control', bracket: '@close', next: '@pop'}],
					[/@tableParams/, 'keyword.parameter'],
				]
			}
		};

		monaco.languages.setMonarchTokensProvider("seesaawiki", seesaaWikiLanguage);

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
				{ token: 'table', background: 'FF0000',  },
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
			}
		});

		monaco.languages.registerDocumentSymbolProvider('seesaawiki', new SeesaaWikiDocumentSymbolProvider(monaco));


		// 色名をRGB値に変換する関数
		// Using canvas
		// function colorNameToRGB(colorName) {
		// 	const canvas = document.createElement('canvas');
		// 	canvas.width = canvas.height = 1;
		// 	const ctx = canvas.getContext('2d');
		// 	ctx.fillStyle = colorName;
		// 	ctx.fillRect(0, 0, 1, 1);
		// 	const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
		// 	return { red: r / 255, green: g / 255, blue: b / 255, alpha: 1 };
		// }
		// Using getComputedStyle
		const colorTestElement = document.createElement('div');
		colorTestElement.id = 'color-test';
		colorTestElement.style.display = 'none';
		document.body.appendChild(colorTestElement);

		function colorNameToRGB(colorName) {
			colorTestElement.style.color = colorName;
			const color = window.getComputedStyle(colorTestElement).getPropertyValue('color');

			const match = color.match(/\d+/g);
			if (match) {
				const [r, g, b] = match.map(Number);
				const a = colorName == 'transparent' ? 0 : 1;
				return { red: r / 255, green: g / 255, blue: b / 255, alpha: a };
			}
			return null;
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
				const hexRegex = '[0-9A-Fa-f]';
				const colorRepresentationRegex = `#${hexRegex}{8}|#${hexRegex}{6}|#${hexRegex}{3}|[a-zA-Z]+`;
				const colorRegex = new RegExp(`(&color\\(|#color\\(|color\\(|bgcolor\\()\\s*(${colorRepresentationRegex})?\\s*(?:,\\s*(${colorRepresentationRegex})\\s*)?\\)`, 'g');
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

		monaco.languages.registerColorProvider('seesaawiki', seesaaWikiColorProvider);

		const linkRegex = /\[\[(?:.+?>)??([^>]+?)\]\]/g;
		const ancorNameRegex = /^(#[a-zA-Z0-9\-_\.:]+)$/;
		const pageNameWithAncorRegex = /^(.*?)(#[a-zA-Z0-9\-_\.:]+)$/;

		// DocumentLinkProviderを定義
		const linkProvider = {
			provideLinks: (model) => {
				const links = [];
				const text = model.getValue();
				const matches = text.matchAll(linkRegex);

				for (const match of matches) {
					const targetText = match[1];
					const range = {
						startLineNumber: model.getPositionAt(match.index).lineNumber,
						startColumn: model.getPositionAt(match.index).column,
						endLineNumber: model.getPositionAt(match.index + match[0].length).lineNumber,
						endColumn: model.getPositionAt(match.index + match[0].length).column
					};

					if(targetText.startsWith('http')){
						links.push({
							range: range,
							url: targetText,
							tooltip: `Open ${targetText}`,
							type: 'url'
						});
					} else if(targetText.match(ancorNameRegex)){
						const anchorName = targetText.substring(1);
						links.push({
							range: range,
							tooltip: `Jump to &aname(${anchorName})`,
							type: 'anchor',
							target: anchorName,
						});
					} else {
						links.push({
							range: range,
							tooltip: `Open ${targetText}`,
							type: 'page',
							target: targetText
						});
					}
				}

				return { links };
			},
			resolveLink: function(link, token) {
				const type = link.type;
				if(type === 'url'){
					return { url: link.url };
				} else if(type === 'anchor'){
					const anchorName = link.target;

					const editors = monaco.editor.getEditors();
					const editor = editors.length === 1 ? editors[0] : editors[1];
					const model = editor.getModel();
					const text = model.getValue();
					const anchorMatch = text.match(new RegExp(`(?:&|#)aname\\(${anchorName}\\)`));

					if (anchorMatch) {
						const anchorIndex = anchorMatch.index;
						const anchorPosition = model.getPositionAt(anchorIndex);

						// URIにフラグメント識別子を追加して位置を指定
						const uri = model.uri.with({
							fragment: `${anchorPosition.lineNumber},${anchorPosition.column}`
						});

						return {
							range: {
								startLineNumber: anchorPosition.lineNumber,
								startColumn: anchorPosition.column,
								endLineNumber: anchorPosition.lineNumber,
								endColumn: anchorPosition.column + anchorMatch[0].length
							},
							url: uri
						};
					}
				} else if(type === 'page'){
					const target = link.target;

					const anchorMatch = target.match(pageNameWithAncorRegex);
					if(anchorMatch){
						return { url: getWikiPageUrl(anchorMatch[1]) + anchorMatch[2] };
					} else {
						return { url: getWikiPageUrl(target) };
					}
				}

				return null;
			}
		};

		// // DocumentLinkProviderを登録
		monaco.languages.registerLinkProvider('seesaawiki', linkProvider);


		// Definition Providerを登録
		// monaco.languages.registerDefinitionProvider('seesaawiki', {
			// provideDefinition: function(model, position, token) {
				// // const wordInfo = model.getWordAtPosition(position);
				// // if (!wordInfo) return;

				// // const line = model.getLineContent(position.lineNumber);
				// // // const lineUntilCursor = line.substring(0, position.column);
				// // const lineUntilCursor = line

				// // const lastLinkMatch = lineUntilCursor.match(anchorLinkRegex);
				// // if (!lastLinkMatch) return;

				// // const anchorName = lastLinkMatch[1] || lastLinkMatch[2];
				// // console.log(1);
				// // const text = model.getValue();
				// // const anchorMatch = text.match(new RegExp(`&aname\\(${anchorName}\\)`));

				// // if (anchorMatch) {
				// // 	const anchorIndex = anchorMatch.index;
				// // 	const anchorPosition = model.getPositionAt(anchorIndex);

				// // 	const uri = model.uri.with({
				// // 		fragment: `${anchorPosition.lineNumber},${anchorPosition.column}`
				// // 	});

				// // 	return {
				// // 		uri: uri,
				// // 		range: { // 定義のrange
				// // 			startLineNumber: anchorPosition.lineNumber,
				// // 			startColumn: anchorPosition.column,
				// // 			endLineNumber: anchorPosition.lineNumber,
				// // 			endColumn: anchorPosition.column + anchorMatch[0].length
				// // 		}
				// // 	};
				// // }
			// }
		// });

		// アンカーリンクにホバー効果を追加
		// monaco.languages.registerHoverProvider('seesaawiki', {
		// 	provideHover: function(model, position, token) {
		// 		const wordInfo = model.getWordAtPosition(position);
		// 		if (!wordInfo) return;

		// 		const line = model.getLineContent(position.lineNumber);
		// 		const lineUntilCursor = line.substring(0, position.column);

		// 		const lastLinkMatch = lineUntilCursor.match(anchorLinkRegex);
		// 		if (!lastLinkMatch) return;

		// 		const anchorName = lastLinkMatch[1] || lastLinkMatch[2];

		// 		return {
		// 			contents: [
		// 				{ value: `Jump to anchor: #${anchorName}` }
		// 			]
		// 		};
		// 	}
		// });

		// 画像URLを検出する正規表現
		const imageUrlRegex = /(https?:\/\/.*?\.(?:png|jpg|jpeg|gif|webp))/gi;

		// ホバープロバイダーを登録
		monaco.languages.registerHoverProvider('seesaawiki', {
			provideHover: function (model, position) {
				// 1. positionの行全体のlineContentを取得する
				const lineContent = model.getLineContent(position.lineNumber);

				// 2. lineContentに対してimageUrlRegexでマッチするか確かめる。複数のマッチがある場合全て確かめる
				let match;
				while ((match = imageUrlRegex.exec(lineContent)) !== null) {
					const startIndex = match.index;
					const endIndex = startIndex + match[0].length;

					// 4. マッチ範囲とpositionが被っているか確認
					if (position.column >= startIndex || position.column <= endIndex) {
						// 6. 被っていれば、マッチ範囲で結果のrangeとcontentsのオブジェクトをreturnする
						return {
							range: new monaco.Range(
								position.lineNumber,
								startIndex + 1,
								position.lineNumber,
								endIndex + 1
							),
							contents: [
								{ value: '**Image Preview**' },
								{
									value: `<img src="${match[0]}" alt="Image preview" height=200>`,
									supportHtml: true,
									isTrusted: true
								}
							]
						};
					}
				}

				// 3. マッチしなければ、何もしない
				// 5. 被っていない場合、何もしない
				return null;
			}
		});
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
				ambiguousCharacters: false,
				invisibleCharacters: false,
				nonBasicASCII: false
			},
			'find': { return: false },
			"wordSeparators": "./\\()\"'-:,.;<>~!@#$%^&*|+=[]{}`~?。．、，　：；（）「」［］｛｝《》！？＜＞てにをはがのともへでや",
		});
		_w.monacoEditor = monacoEditor;

		// カスタムキーバインディングの設定
		// const focusContextKey = monacoEditor.createContextKey('editorFocus', false);

		// function updateFocusContext() {
		// 	const hasFocus = monacoEditor.hasTextFocus();
		// 	focusContextKey.set(hasFocus);
		// 	console.log('Editor focus state:', hasFocus);
		// }

		// monacoEditor.onDidFocusEditorText(() => {
		// 	updateFocusContext();
		// });

		// monacoEditor.onDidBlurEditorText(() => {
		// 	updateFocusContext();
		// });

		// updateFocusContext();

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
					// 通常の改行
					_w.monacoEditor.trigger('keyboard', 'type', { text: '\n' });
					// 次の行に新しい行を追加
					/*
					const nextLineContent = '|'.repeat(cellRanges.length - 1);

					if(nextLineContent != lineContent){ // 行が空ではない場合
						// 次の行に新しい行を追加
						_w.monacoEditor.executeEdits('', [{
							range: new _w.monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column),
							text: '\n' + nextLineContent
						}]);
						// _w.monacoEditor.setPosition({
						// 	lineNumber: position.lineNumber + 1,
						// 	column: 2
						// });
					} else { // 空の行の場合
						// テーブルを削除
						_w.monacoEditor.executeEdits('', [{
							range: new _w.monaco.Range(position.lineNumber, 1, position.lineNumber, position.column),
							text: ''
						}]);
					}
					*/
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
		}, 'editorTextFocus && !editorReadonly && !editorTabMovesFocus && !suggestWidgetHasFocusedSuggestion && !suggestWidgetVisible && !hasNextTabstop && !inSnippetMode');

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
		}, 'editorTextFocus && !editorReadonly && !editorTabMovesFocus && !suggestWidgetHasFocusedSuggestion && !suggestWidgetVisible');

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
		}, 'editorTextFocus && !editorReadonly && !editorTabMovesFocus && !suggestWidgetHasFocusedSuggestion && !suggestWidgetVisible && !hasNextTabstop && !inSnippetMode');

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
		}, 'editorTextFocus && !editorReadonly && !editorTabMovesFocus && !suggestWidgetHasFocusedSuggestion && !suggestWidgetVisible && !hasNextTabstop && !inSnippetMode');


		// モナコエディタのseesaawiki言語用スニペットを定義
		const seesaawikiSnippets = [
			{
				label: '&ref',
				kind: monaco.languages.CompletionItemKind.Snippet,
				insertText: '&ref(${1:画像URL})',
				insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
				documentation: '画像表示を挿入'
			},
			{
				label: '&attach',
				kind: monaco.languages.CompletionItemKind.Snippet,
				insertText: '&attach(${1:})',
				insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
				documentation: '画像添付を挿入'
			},
			{
				label: '&attachref',
				kind: monaco.languages.CompletionItemKind.Snippet,
				insertText: '&attachref(${1:})',
				insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
				documentation: '画像添付と表示を挿入'
			},
			{
				label: '&aname',
				kind: monaco.languages.CompletionItemKind.Snippet,
				insertText: '&aname(${1:anchor_name})',
				insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
				documentation: '&anameを挿入'
			},
			{
				label: '&size',
				kind: monaco.languages.CompletionItemKind.Snippet,
				insertText: '&size(${1:size}){${2:$TM_SELECTED_TEXT}}',
				insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
				documentation: '&sizeを挿入'
			},
			{
				label: '&color',
				kind: monaco.languages.CompletionItemKind.Snippet,
				insertText: '&color(${1:red}){${2:$TM_SELECTED_TEXT}}',
				insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
				documentation: '&colorを挿入'
			},
			{
				label: '&sup',
				kind: monaco.languages.CompletionItemKind.Snippet,
				insertText: '&sup{${1:$TM_SELECTED_TEXT}}',
				insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
				documentation: '上付き文字を挿入'
			},
			{
				label: '&sub',
				kind: monaco.languages.CompletionItemKind.Snippet,
				insertText: '__${1:$TM_SELECTED_TEXT}__',
				insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
				documentation: '下付き文字を挿入'
			},
			{
				label: '&align',
				kind: monaco.languages.CompletionItemKind.Snippet,
				insertText: '&align(${1|left,center,right|}){${2:$TM_SELECTED_TEXT}}',
				insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
				documentation: '&alignを挿入'
			},
			{
				label: '&fukidashi',
				kind: monaco.languages.CompletionItemKind.Snippet,
				insertText: '&fukidashi(${1:){${2:$TM_SELECTED_TEXT}}',
				insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
				documentation: '&fukidashiを挿入'
			},
			{
				label: '&hukidashi',
				kind: monaco.languages.CompletionItemKind.Snippet,
				insertText: '&fukidashi(${1:}){${2:$TM_SELECTED_TEXT}}',
				insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
				documentation: '&fukidashiを挿入'
			},
			{
				label: 'bold',
				kind: monaco.languages.CompletionItemKind.Snippet,
				insertText: '\'\'${1:$TM_SELECTED_TEXT}\'\'',
				insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
				documentation: '太字を挿入'
			},
			{
				label: 'underline',
				kind: monaco.languages.CompletionItemKind.Snippet,
				insertText: '%%%${1:$TM_SELECTED_TEXT}%%%',
				insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
				documentation: '下線を挿入'
			},
			{
				label: 'deleted',
				kind: monaco.languages.CompletionItemKind.Snippet,
				insertText: '%%${1:$TM_SELECTED_TEXT}%%',
				insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
				documentation: '取り消し線を挿入'
			},
			{
				label: 'strikethrough',
				kind: monaco.languages.CompletionItemKind.Snippet,
				insertText: '%%${1:$TM_SELECTED_TEXT}%%',
				insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
				documentation: '取り消し線を挿入'
			},
			{
				label: 'italic',
				kind: monaco.languages.CompletionItemKind.Snippet,
				insertText: '\'\'\'${1:$TM_SELECTED_TEXT}\'\'\'',
				insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
				documentation: 'イタリックを挿入'
			},
			{
				label: 'pre-formatted',
				kind: monaco.languages.CompletionItemKind.Snippet,
				insertText: '=|${1|BOX,AA,AAS|}\n${2:$TM_SELECTED_TEXT}\n||=\n',
				insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
				documentation: '整形済みテキストを挿入'
			},
			{
				label: 'plus-end',
				kind: monaco.languages.CompletionItemKind.Snippet,
				insertText: '[+]${1:}\n${2:$TM_SELECTED_TEXT}\n[END]\n',
				insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
				documentation: 'デフォルトで閉じた折りたたみを挿入'
			},
			{
				label: 'minus-end',
				kind: monaco.languages.CompletionItemKind.Snippet,
				insertText: '[-]${1:}\n${2:$TM_SELECTED_TEXT}\n[END]\n',
				insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
				documentation: 'デフォルトで開いた折りたたみを挿入'
			},
			{
				label: 'link',
				kind: monaco.languages.CompletionItemKind.Snippet,
				insertText: '[[${1:$TM_SELECTED_TEXT}]]',
				insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
				documentation: 'リンクを挿入'
			},
			{
				label: 'link (with link text)',
				kind: monaco.languages.CompletionItemKind.Snippet,
				insertText: '[[${1:}${2|>,>>,>>>|}${3:$TM_SELECTED_TEXT}]]',
				insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
				documentation: 'リンクテキスト付きリンクを挿入'
			},
			{
				label: 'horizon',
				kind: monaco.languages.CompletionItemKind.Snippet,
				insertText: '----',
				insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
				documentation: '水平線を挿入'
			}
		];

		// Monaco Editorにスニペットを登録する関数
		monaco.languages.registerCompletionItemProvider('seesaawiki', {
			triggerCharacters: ['&', '#'],
			provideCompletionItems: function(model, position) {
				const textUntilPosition = model.getValueInRange({
					startLineNumber: position.lineNumber,
					startColumn: 1,
					endLineNumber: position.lineNumber,
					endColumn: position.column
				});

				const match = textUntilPosition.match(/[\w&]+$/);
				const prefix = match ? match[0] : '';

				const filteredSnippets = seesaawikiSnippets.filter(snippet =>
					snippet.label.toLowerCase().startsWith(prefix.toLowerCase())
				);

				const suggestions = filteredSnippets.map(snippet => ({
					...snippet,
					range: {
						startLineNumber: position.lineNumber,
						endLineNumber: position.lineNumber,
						startColumn: position.column - prefix.length,
						endColumn: position.column
					}
				}));

				return { suggestions };
			}
		});

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

						${convertCharRef.toString()};
						${getWikiPageUrl.toString()};

						const wikiId = '${wikiId}';

						${wrapSelectedText.toString()}
						${insertAtBeginningOfLine.toString()}
						${encodeEUCJP.toString()}

						(${replaceTextareaWithMonaco.toString()})(window);

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

		monacoEditor.setValue(textarea.value);

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

		window.monacoInsertString = (str, selected=true) => {
			const monacoEditor = window.monacoEditor;
			const position = monacoEditor.getPosition();
			const range = new monaco.Range(position.lineNumber, position.column, position.lineNumber, position.column);
			monacoEditor.executeEdits('', [{
				range: selected ? monacoEditor.getSelection() : range,
				text: str,
			}]);
		};

		const itemSearchTemplateTextArea = document.querySelector('textarea#itemsearch_results.template');
		if (itemSearchTemplateTextArea) {
			// 現在の値を取得
			let content = itemSearchTemplateTextArea.value;

			// editor.buffer.savePoint(); を削除
			content = content.replace(/editor\.buffer\.savePoint\(\);/g, '');

			// editor.item_search.insertString(*); を window.monacoInsertString(*) に置換
			content = content.replace(/editor\.item_search\.insertString\((.*?)\);/g, 'window.monacoInsertString($1);');

			// 修正した内容をテキストエリアに設定
			itemSearchTemplateTextArea.value = content;
		}
	}

	function extractDiffContent() {
		const diffBox = document.querySelector(".diff-box");
		if (!diffBox) return null;

		let innerHTML = diffBox.innerHTML;
		innerHTML = innerHTML.replace(/<br>|<\/span>/g, "");
		innerHTML = decodeHTMLEntities(innerHTML);
		innerHTML = convertCharRef(innerHTML, reverse=true)

		const oldContent = innerHTML.replace(/<span class="line-add">.*?\n|<span class="line-delete">/g, "")
		const newContent = innerHTML.replace(/<span class="line-delete">.*?\n|<span class="line-add">/g, "")

		return { oldContent, newContent };
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
				ambiguousCharacters: false,
				invisibleCharacters: false,
				nonBasicASCII: false
			},
			"wordSeparators": "./\\()\"'-:,.;<>~!@#$%^&*|+=[]{}`~?。．、，　：；（）「」［］｛｝《》！？＜＞てにをはがのともへでや",
		});

		const originalModel = monaco.editor.createModel(oldContent, "seesaawiki");
		const modifiedModel = monaco.editor.createModel(newContent, "seesaawiki");

		diffEditor.setModel({
			original: originalModel,
			modified: modifiedModel,
		});

		return diffEditor;
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

		window.monacoEditor = diffEditor;


		diffEditor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.DownArrow, () => diffEditor.goToDiff('next'));
		diffEditor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.UpArrow, () => diffEditor.goToDiff('previous'));
	}

})();