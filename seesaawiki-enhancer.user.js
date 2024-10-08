// ==UserScript==
// @name         Seesaa Wiki Enhancer
// @version      0.8.3
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

					// 前の見出しを閉じる
					for (let level = headingLevel; level <= 3; level++) {
						if (lastUnclosedHeadingSymbol[level - 1] !== null) {
							lastUnclosedHeadingSymbol[level - 1].range.endLineNumber = lineIndex - 1;
							lastUnclosedHeadingSymbol[level - 1].range.endColumn = model.getLineMaxColumn(lineIndex - 1);
							lastUnclosedHeadingSymbol[level - 1] = null;
						}
					}

					// 親子関係を調べ、子なら親にpush
					let childFlag = false;
					for (let j = headingLevel - 1; j > 0; j--) {
						if (lastUnclosedHeadingSymbol[j - 1] !== null) {
							lastUnclosedHeadingSymbol[j - 1].children.push(symbol);
							childFlag = true;
							break;
						}
					}
					// 子でない場合はdocumentSymbolsに追加
					if (!childFlag) {
						documentSymbols.push(symbol);
					}
					lastUnclosedHeadingSymbol[headingLevel - 1] = symbol;
				}
			}

			// 残ってる全ての見出しを閉じる
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
		const searchDescriptionInput = document.getElementById("search-description");

		if(searchDescriptionInput){
			searchDescriptionInput.addEventListener("keydown", (e) => {
				if(e.key === 'Enter'){
					searchDescriptionInput.nextElementSibling.click();
				}
			});
		}

		/* ********************************************************************************
			Press Esc to hide item_search
		/* ******************************************************************************** */
		document.addEventListener("keydown", (e) => {
			if (e.key === "Escape") {
				editor.item_search.hide(editor.item_search);
			}
		});

		/* ********************************************************************************
			Adjust editor width, height, margin
		/* ******************************************************************************** */
		const wikiContainer = document.getElementById('wiki-container');
		const wikiContent = document.getElementById('wiki-content');

		const originalWidth = wikiContent.style.getPropertyValue('width');
		const originalMargin0 = wikiContainer.style.getPropertyValue('margin');
		const originalMargin1 = wikiContent.style.getPropertyValue('margin');
		function widen(){
			wikiContent.style.setProperty('width', `max(calc(100vw - 100px), ${originalWidth})`, 'important');
			wikiContainer.style.setProperty('margin', '0', 'important');
			wikiContent.style.setProperty('margin', '10px 20px 0', 'important');
		}
		function narrow(){
			wikiContent.style.setProperty('width', originalWidth);
			wikiContainer.style.setProperty('margin', originalMargin0);
			wikiContent.style.setProperty('margin', originalMargin1);
		}
		widen();

		// プレビュー時、元の幅に戻す
		const previewContainer = document.getElementById('preview-container');
		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
					narrow();
					break;
				}
			}
		});

		// 編集ボタンクリック時、再度幅を拡げる
		document.querySelectorAll('.edit > a').forEach((edit) => {
			edit.addEventListener('click', widen);
		});


		observer.observe(previewContainer, { childList: true, subtree: true });

		addCSS(`
			/* 高さを増やす */
			#content, .user-area { /* editor window, preview-window */
				height: max(calc(100vh - 500px), 500px) !important;
			}

			.user-area { /* preview-window */
			}

			/* 余白を減らす */
			#page-body {
				margin-bottom: 0 !important;
			}
			#page-footer, #page-footer-inner {
				display: none !important;
			}
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

	const nonEscapedCharSet = new Set("!\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~…†‡‰‘’“”§¨°±´¶×÷ΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩαβγδεζηθικλμνξοπρστυφχψωЁАБВГДЕЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдежзийклмнопрстуфхцчшщъыьэюяё‐―‘’“”†‡‥…‰′″※~℃№℡ÅⅠⅡⅢⅣⅤⅥⅦⅧⅨⅩⅰⅱⅲⅳⅴⅵⅶⅷⅸⅹ←↑→↓⇒⇔∀∂∃∇∈∋∑－√∝∞∟∠∥∧∨∩∪∫∬∮∴∵∽≒≠≡≦≧≪≫⊂⊃⊆⊇⊥⊿⌒①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳─━│┃┌┏┐┓└┗┘┛├┝┠┣┤┥┨┫┬┯┰┳┴┷┸┻┼┿╂╋■□▲△▼▽◆◇○◎●◯★☆♀♂♪♭♯、。〃々〆〇〈〉《》「」『』【】〒〓〔〕～〝〟ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざしじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷへべぺほぼぽまみむめもゃやゅゆょよらりるれろゎわゐゑをん゛゜ゝゞァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプヘベペホボポマミムメモャヤュユョヨラリルレロヮワヰヱヲンヴヵヶ・ーヽヾ㈱㈲㈹㊤㊥㊦㊧㊨㌃㌍㌔㌘㌢㌣㌦㌧㌫㌶㌻㍉㍊㍍㍑㍗㍻㍼㍽㍾㎎㎏㎜㎝㎞㎡㏄㏍一丁七万丈三上下不与丐丑且丕世丗丘丙丞両並丨个中丱串丶丸丹主丼丿乂乃久之乍乎乏乕乖乗乘乙九乞也乢乱乳乾亀亂亅了予争亊事二于云互五井亘亙些亜亞亟亠亡亢交亥亦亨享京亭亮亰亳亶人什仁仂仄仆仇今介仍从仏仔仕他仗付仙仝仞仟仡代令以仭仮仰仲件价任仼伀企伃伉伊伍伎伏伐休会伜伝伯估伴伶伸伹伺似伽佃但佇位低住佐佑体何佖佗余佚佛作佝佞佩佯佰佳併佶佻佼使侃來侈侊例侍侏侑侒侔侖侘侚供依侠価侫侭侮侯侵侶便係促俄俉俊俍俎俐俑俔俗俘俚俛保俟信俣俤俥修俯俳俵俶俸俺俾俿倅倆倉個倍倏們倒倔倖候倚倞借倡倢倣値倥倦倨倩倪倫倬倭倶倹偀偂偃偆假偈偉偏偐偕偖做停健偬偰偲側偵偶偸偽傀傅傍傑傔傘備傚催傭傲傳傴債傷傾僂僅僉僊働像僑僕僖僘僚僞僣僥僧僭僮僴僵價僻儀儁儂億儉儒儔儕儖儘儚償儡優儲儷儺儻儼儿兀允元兄充兆兇先光兊克兌免兎児兒兔党兜兢兤入全兩兪八公六兮共兵其具典兼冀冂内円冉冊册再冏冐冑冒冓冕冖冗写冝冠冢冤冥冦冨冩冪冫冬冰冱冲决冴况冶冷冽冾凄凅准凉凋凌凍凖凛凜凝几凡処凧凩凪凬凭凰凱凵凶凸凹出函凾刀刃刄分切刈刊刋刎刑刔刕列初判別刧利刪刮到刳制刷券刹刺刻剃剄則削剋剌前剏剔剖剛剞剣剤剥剩剪副剰剱割剳剴創剽剿劃劇劈劉劍劑劒劔力劜功加劣劦助努劫劬劭劯励労劵効劼劾勀勁勃勅勇勉勍勒動勗勘務勛勝勞募勠勢勣勤勦勧勲勳勵勸勹勺勾勿匀匁匂包匆匇匈匍匏匐匕化北匙匚匝匠匡匣匤匪匯匱匳匸匹区医匿區十千卅卆升午卉半卍卑卒卓協南単博卜卞占卦卩卮卯印危卲即却卵卷卸卻卿厂厄厓厖厘厚原厠厥厦厨厩厭厮厰厲厳厶去参參又叉及友双反収叔取受叙叛叝叟叡叢口古句叨叩只叫召叭叮可台叱史右叶号司叺吁吃各合吉吊吋同名后吏吐向君吝吟吠否吩含听吭吮吶吸吹吻吼吽吾呀呂呆呈呉告呎呑呟周呪呰呱味呵呶呷呻呼命咀咄咆咊咋和咎咏咐咒咜咢咤咥咨咩咫咬咯咲咳咸咼咽咾哀品哂哄哇哈哉哘員哢哥哦哨哩哭哮哲哺哽哿唄唆唇唏唐唔唖售唯唱唳唸唹唾啀啄啅商啌問啓啖啗啜啝啣啻啼啾喀喃善喆喇喉喊喋喘喙喚喜喝喞喟喧喨喩喪喫喬單喰営嗄嗅嗇嗔嗚嗜嗟嗣嗤嗷嗹嗽嗾嘆嘉嘔嘖嘗嘘嘛嘩嘯嘱嘲嘴嘶嘸噂噌噎噐噛噤器噪噫噬噴噸噺嚀嚆嚇嚊嚏嚔嚠嚢嚥嚮嚴嚶嚼囀囁囂囃囈囎囑囓囗囘囚四回因団囮困囲図囹固国囿圀圃圄圈圉國圍圏園圓圖團圜土圦圧在圭地圷圸圻址坂均坊坎坏坐坑坙坡坤坥坦坩坪坿垂垈垉型垓垠垢垣垤垪垬垰垳埀埃埆埇埈埋城埒埓埔埖埜域埠埣埴執培基埼堀堂堅堆堊堋堕堙堝堡堤堪堯堰報場堵堺堽塀塁塊塋塑塒塔塗塘塙塚塞塢塩填塰塲塵塹塾境墅墓増墜增墟墨墫墮墲墳墸墹墺墻墾壁壅壇壊壌壑壓壕壗壘壙壜壞壟壤壥士壬壮壯声壱売壷壹壺壻壼壽夂変夊夋夏夐夕外夘夙多夛夜夢夥大天太夫夬夭央失夲夷夸夾奄奇奈奉奎奏奐契奓奔奕套奘奚奛奝奠奢奣奥奧奨奩奪奬奮女奴奸好妁如妃妄妊妍妓妖妙妛妝妣妤妥妨妬妲妹妺妻妾姆姉始姐姑姓委姙姚姜姥姦姨姪姫姶姻姿威娃娉娑娘娚娜娟娠娥娩娯娵娶娼婀婁婆婉婚婢婦婪婬婿媒媚媛媼媽媾嫁嫂嫉嫋嫌嫐嫖嫗嫡嫣嫦嫩嫺嫻嬉嬋嬌嬖嬢嬪嬬嬰嬲嬶嬾孀孃孅子孑孔孕孖字存孚孛孜孝孟季孤孥学孩孫孰孱孳孵學孺宀它宅宇守安宋完宍宏宕宗官宙定宛宜宝実客宣室宥宦宮宰害宴宵家宸容宿寀寂寃寄寅密寇寉富寐寒寓寔寘寛寝寞察寡寢寤寥實寧寨審寫寬寮寰寳寵寶寸寺対寿封専射尅将將專尉尊尋對導小少尓尖尚尞尠尢尤尨尭就尸尹尺尻尼尽尾尿局屁居屆屈届屋屍屎屏屐屑屓展属屠屡層履屬屮屯山屶屹岌岐岑岔岡岦岨岩岫岬岱岳岶岷岸岺岻岼岾峅峇峙峠峡峨峩峪峭峯峰峵島峺峻峽崇崋崎崑崔崕崖崗崘崙崚崛崟崢崧崩嵂嵋嵌嵎嵐嵒嵓嵜嵩嵬嵭嵯嵳嵶嶂嶄嶇嶋嶌嶐嶝嶢嶬嶮嶷嶸嶹嶺嶼嶽巉巌巍巐巒巓巖巛川州巡巣工左巧巨巫差己已巳巴巵巷巻巽巾市布帆帋希帑帖帙帚帛帝帥師席帯帰帳帶帷常帽幀幃幄幅幇幌幎幔幕幗幟幡幢幣幤干平年幵并幸幹幺幻幼幽幾广庁広庄庇床序底庖店庚府庠度座庫庭庵庶康庸廁廂廃廈廉廊廏廐廓廖廚廛廝廟廠廡廢廣廨廩廬廰廱廳廴延廷廸建廻廼廾廿弁弃弄弉弊弋弌弍式弐弑弓弔引弖弗弘弛弟弡弥弦弧弩弭弯弱弴張強弸弼弾彁彅彈彊彌彎彑当彖彗彙彜彝彡形彦彧彩彪彫彬彭彰影彳彷役彼彿往征徂徃径待徇很徊律後徐徑徒従得徘徙從徠御徨復循徭微徳徴德徹徼徽心必忌忍忖志忘忙応忝忞忠忤快忰忱念忸忻忽忿怎怏怐怒怕怖怙怛怜思怠怡急怦性怨怩怪怫怯怱怺恁恂恃恆恊恋恍恐恒恕恙恚恝恟恠恢恣恤恥恨恩恪恫恬恭息恰恵恷悁悃悄悅悉悊悋悌悍悒悔悖悗悚悛悟悠患悦悧悩悪悲悳悴悵悶悸悼悽情惆惇惑惓惕惘惚惜惞惟惠惡惣惧惨惰惱惲想惴惶惷惹惺惻愀愁愃愆愈愉愍愎意愑愕愚愛感愠愡愧愨愬愰愴愷愼愽愾愿慂慄慇慈慊態慌慍慎慓慕慘慙慚慝慟慢慣慥慧慨慫慮慯慰慱慳慴慵慶慷慾憂憇憊憎憐憑憔憖憘憙憚憤憧憩憫憬憮憲憶憺憾懃懆懇懈應懊懋懌懍懐懣懦懲懴懶懷懸懺懼懽懾懿戀戈戉戊戌戍戎成我戒戓戔或戚戛戝戞戟戡戦截戮戯戰戲戳戴戸戻房所扁扇扈扉手才扎打払托扛扞扠扣扨扮扱扶批扼找承技抂抃抄抉把抑抒抓抔投抖抗折抛抜択抦披抬抱抵抹抻押抽拂担拆拇拈拉拊拌拍拏拐拑拒拓拔拗拘拙招拜拝拠拡括拭拮拯拱拳拵拶拷拾拿持挂指挈按挌挑挙挟挧挨挫振挺挽挾挿捉捌捍捏捐捕捗捜捧捨捩捫据捲捶捷捺捻掀掃授掉掌掎掏排掖掘掛掟掠採探掣接控推掩措掫掬掲掴掵掻掾揀揃揄揆揉描提插揖揚換握揣揩揮援揵揶揺搆損搏搓搖搗搜搦搨搬搭搴搶携搾摂摎摘摠摧摩摯摶摸摺撃撈撒撓撕撚撝撞撤撥撩撫播撮撰撲撹撻撼擁擂擅擇操擎擒擔擘據擠擡擢擣擦擧擬擯擱擲擴擶擺擽擾攀攅攘攜攝攣攤攪攫攬支攴攵收攷攸改攻放政故效敍敎敏救敕敖敗敘教敝敞敢散敦敬数敲整敵敷數斂斃文斈斉斌斎斐斑斗料斛斜斟斡斤斥斧斫斬断斯新斷方於施旁旃旄旅旆旋旌族旒旗旙旛无旡既日旦旧旨早旬旭旱旺旻昀昂昃昆昇昉昊昌明昏易昔昕昜昞星映昤春昧昨昭昮是昱昴昵昶昻昼昿晁時晃晄晉晋晏晒晗晙晝晞晟晢晤晥晦晧晨晩普景晰晳晴晶智暁暃暄暇暈暉暎暑暖暗暘暙暝暠暢暦暫暮暲暴暸暹暼暾暿曁曄曇曉曖曙曚曜曝曠曦曩曰曲曳更曵曷書曹曺曻曼曽曾替最會月有朋服朎朏朔朕朖朗望朝朞期朦朧木未末本札朮朱朴朶朷朸机朽朿杁杆杉李杏材村杓杖杙杜杞束杠条杢杣杤来杦杪杭杯杰東杲杳杵杷杼松板枅枇枉枋枌析枕林枚果枝枠枡枢枦枩枯枳枴架枷枸枹枻柀柁柄柆柊柎柏某柑染柔柘柚柝柞柢柤柧柩柬柮柯柱柳柴柵査柾柿栁栂栃栄栓栖栗栞校栢栩株栫栲栴核根格栽桀桁桂桃桄框案桍桎桐桑桒桓桔桙桜桝桟档桧桴桶桷桾桿梁梃梅梍梏梓梔梗梛條梟梠梢梦梧梨梭梯械梱梳梵梶梹梺梼棄棆棈棉棊棋棍棏棒棔棕棗棘棚棟棠棡棣棧森棯棲棹棺椀椁椄椅椈椋椌植椎椏椒椙椚椛検椡椢椣椥椦椨椪椰椴椶椹椽椿楊楓楔楕楙楚楜楝楞楠楡楢楨楪楫業楮楯楳楴極楷楸楹楼楽楾榁概榊榎榑榔榕榘榛榜榠榧榮榱榲榴榻榾榿槁槃槇槊構槌槍槎槐槓様槙槝槞槢槧槨槫槭槲槹槻槽槿樂樅樊樋樌樒樓樔樗標樛樞樟模樢樣権横樫樮樰樵樶樸樹樺樽橄橆橇橈橋橘橙機橡橢橦橫橲橳橸橾橿檀檄檍檎檐檗檜檠檢檣檪檬檮檳檸檻櫁櫂櫃櫑櫓櫚櫛櫞櫟櫢櫤櫨櫪櫺櫻欄欅權欒欖欝欟欠次欣欧欲欷欸欹欺欽款歃歇歉歌歎歐歓歔歙歛歟歡止正此武歩歪歯歳歴歸歹死歿殀殃殄殆殉殊残殍殕殖殘殞殤殪殫殯殱殲殳殴段殷殺殻殼殿毀毅毆毋母毎毒毓比毖毘毛毟毫毬毯毳氈氏民氓气気氛氣氤水氷永氾氿汀汁求汎汐汕汗汚汜汝汞江池汢汨汪汯汰汲汳決汽汾沁沂沃沆沈沌沍沐沒沓沖沙沚沛没沢沫沮沱河沸油沺治沼沽沾沿況泄泅泉泊泌泓法泗泙泚泛泝泡波泣泥注泪泯泰泱泳洄洋洌洒洗洙洛洞洟津洩洪洫洲洳洵洶洸活洽派流浄浅浙浚浜浣浤浦浩浪浬浮浯浴海浸浹涅涇消涌涎涓涕涖涙涛涜涬涯液涵涸涼淀淅淆淇淋淌淏淑淒淕淘淙淞淡淤淦淨淪淫淬淮深淲淳淵混淸淹淺添淼清渇済渉渊渋渓渕渙渚減渝渟渠渡渣渤渥渦渧温渫測渭渮港游渹渺渼渾湃湊湍湎湖湘湛湜湟湧湫湮湯湲湶湾湿満溂溌溏源準溘溜溝溟溢溥溪溯溲溶溷溺溽溿滂滄滅滉滋滌滑滓滔滕滝滞滬滯滲滴滷滸滾滿漁漂漆漉漏漑漓演漕漠漢漣漫漬漱漲漸漾漿潁潅潔潘潛潜潟潤潦潭潮潯潰潴潸潺潼澀澁澂澄澆澈澎澑澗澡澣澤澪澱澳澵澹激濁濂濃濆濔濕濘濛濟濠濡濤濫濬濮濯濱濳濵濶濺濾瀁瀅瀇瀉瀋瀏瀑瀕瀘瀚瀛瀝瀞瀟瀦瀧瀨瀬瀰瀲瀾灌灑灘灣火灯灰灸灼災炅炉炊炎炒炙炫炬炭炮炯炳炸点為炻烈烋烏烙烝烟烱烹烽焄焉焏焔焙焚焜無焦然焼煆煇煉煌煎煕煖煙煜煢煤煥煦照煩煬煮煽熄熈熊熏熔熕熙熟熨熬熱熹熾燁燃燈燉燎燐燒燔燕燗營燠燥燦燧燬燭燮燵燹燻燼燾燿爆爍爐爛爨爪爬爭爰爲爵父爺爻爼爽爾爿牀牆片版牋牌牒牘牙牛牝牟牡牢牧物牲牴特牽牾犀犁犂犇犒犖犠犢犧犬犯犱犲状犹犾狂狃狄狆狎狐狒狗狙狛狠狡狢狩独狭狷狸狹狼狽猊猖猗猛猜猝猟猤猥猩猪猫献猯猴猶猷猾猿獄獅獎獏獗獣獨獪獰獲獵獷獸獺獻玄率玉王玖玩玲玳玻玽珀珂珈珉珊珍珎珒珖珞珠珣珥珪班珮珱珵珸現球琅理琇琉琢琥琦琩琪琮琲琳琴琵琶琺琿瑁瑕瑙瑚瑛瑜瑞瑟瑠瑢瑣瑤瑩瑪瑯瑰瑳瑶瑾璃璉璋璞璟璢璧環璽瓊瓏瓔瓜瓠瓢瓣瓦瓧瓩瓮瓰瓱瓲瓶瓷瓸甁甃甄甅甌甍甎甑甓甕甘甚甜甞生産甥甦用甫甬甯田由甲申男甸町画甼畄畆畉畊畋界畍畏畑畔留畚畛畜畝畠畢畤略畦畧畩番畫畭畯異畳畴當畷畸畿疂疆疇疉疊疋疎疏疑疔疚疝疣疥疫疱疲疳疵疸疹疼疽疾痂痃病症痊痍痒痔痕痘痙痛痞痢痣痩痰痲痳痴痺痼痾痿瘁瘉瘋瘍瘟瘠瘡瘢瘤瘧瘰瘴瘻療癆癇癈癌癒癖癘癜癡癢癧癨癩癪癬癰癲癶癸発登發白百皀皂皃的皆皇皈皋皎皐皓皖皙皚皛皜皞皦皮皰皴皷皸皹皺皿盂盃盆盈益盍盒盖盗盛盜盞盟盡監盤盥盧盪目盲直相盻盾省眄眇眈眉看県眛眞真眠眤眥眦眩眷眸眺眼着睆睇睚睛睡督睥睦睨睫睹睾睿瞋瞎瞑瞞瞠瞥瞬瞭瞰瞳瞶瞹瞻瞼瞽瞿矇矍矗矚矛矜矢矣知矧矩短矮矯石矼砂砌砒研砕砠砡砥砦砧砲破砺砿硅硎硝硤硫硬硯硲硴硺硼碁碆碇碌碍碎碑碓碕碗碚碣碧碩碪碯碵確碼碾磁磅磆磊磋磐磑磔磚磧磨磬磯磴磽礁礇礎礑礒礙礦礪礫礬礰示礼社祀祁祇祈祉祐祓祕祖祗祚祝神祟祠祢祥票祭祷祺祿禀禁禄禅禊禍禎福禔禛禝禦禧禪禮禰禳禹禺禽禾禿秀私秉秋科秒秕秘租秡秣秤秦秧秩秬称移稀稈程稍税稔稗稘稙稚稜稟稠種稱稲稷稻稼稽稾稿穀穂穃穆穉積穎穏穐穗穡穢穣穩穫穰穴究穹空穽穿突窃窄窈窒窓窕窖窗窘窟窩窪窮窯窰窶窺窿竃竄竅竇竈竊立竍竏竑竒竓竕站竚竜竝竟章竡竢竣童竦竧竪竫竭端竰競竸竹竺竿笂笄笆笈笊笋笏笑笘笙笛笞笠笥符笨第笳笵笶笹筅筆筈等筋筌筍筏筐筑筒答策筝筥筧筬筮筰筱筴筵筺箆箇箋箍箏箒箔箕算箘箙箚箜箝箞箟管箪箭箱箴箸節篁範篆篇築篋篌篏篝篠篤篥篦篩篭篳篶篷簀簇簍簑簒簓簔簗簟簡簣簧簪簫簷簸簽簾簿籀籃籌籍籏籐籔籖籘籟籠籤籥籬米籵籾粁粂粃粉粋粍粐粒粕粗粘粛粟粡粢粤粥粧粨粫粭粮粱粲粳粹粽精糀糂糅糊糎糒糖糘糜糞糟糠糢糧糯糲糴糶糸糺系糾紀紂約紅紆紊紋納紐純紕紗紘紙級紛紜素紡索紫紬紮累細紲紳紵紹紺紿終絃組絅絆絈絋経絎絏結絖絛絜絞絡絢絣給絨絮統絲絳絵絶絹絽綉綏經継続綛綜綟綠綢綣綫綬維綮綯綰綱網綴綵綷綸綺綻綽綾綿緇緊緋総緑緒緕緖緘線緜緝緞締緡緤編緩緬緯緲練緻縁縄縅縉縊縋縒縛縞縟縡縢縣縦縫縮縱縲縵縷縹縺縻總績繁繃繆繊繋繍繒織繕繖繙繚繝繞繦繧繩繪繭繰繹繻繼繽繿纂纃纈纉纊續纎纏纐纒纓纔纖纛纜缶缸缺罅罇罌罍罎罐网罔罕罘罟罠罧罨罩罪罫置罰署罵罷罸罹羂羃羅羆羇羈羊羌美羔羚羝羞羡羣群羨義羮羯羲羶羸羹羽翁翅翆翊翌習翔翕翠翡翦翩翫翰翳翹翻翼耀老考耄者耆耋而耐耒耕耗耘耙耜耡耨耳耶耻耽耿聆聊聒聖聘聚聞聟聡聢聨聯聰聲聳聴聶職聹聽聾聿肄肅肆肇肉肋肌肓肖肘肚肛肝股肢肥肩肪肬肭肯肱育肴肺胃胄胆背胎胖胙胚胛胝胞胡胤胥胯胱胴胸胼能脂脅脆脇脈脉脊脚脛脣脩脯脱脳脹脾腆腋腎腐腑腓腔腕腟腥腦腫腮腰腱腴腸腹腺腿膀膂膃膈膊膏膓膕膚膜膝膠膣膤膨膩膰膳膵膸膺膽膾膿臀臂臆臈臉臍臑臓臘臙臚臟臠臣臥臧臨自臭至致臺臻臼臾舁舂舅與興舉舊舌舍舎舐舒舖舗舘舛舜舞舟舩航舫般舮舳舵舶舷舸船艀艇艘艙艚艝艟艢艤艦艨艪艫艮良艱色艶艷艸艾芋芍芒芙芝芟芥芦芫芬芭芯花芳芸芹芻芽苅苑苒苓苔苗苙苛苜苞苟苡苣若苦苧苫英苳苴苹苺苻茁茂范茄茅茆茉茎茖茗茘茜茣茨茫茯茱茲茴茵茶茸茹荀荅草荊荏荐荒荘荢荳荵荷荻荼荿莅莇莉莊莎莓莖莚莞莟莠莢莨莪莫莱莵莽菁菅菇菊菌菎菓菖菘菜菟菠菩菫華菰菱菲菴菶菷菻菽萃萄萇萋萌萍萎萓萠萢萩萪萬萱萵萸萼落葆葈葉葎著葛葡葢董葦葩葫葬葭葮葯葱葵葷葹葺蒂蒄蒋蒐蒔蒙蒜蒟蒡蒭蒲蒴蒸蒹蒻蒼蒿蓁蓄蓆蓉蓊蓋蓍蓐蓑蓖蓙蓚蓜蓬蓮蓴蓼蓿蔀蔆蔑蔓蔔蔕蔗蔘蔚蔟蔡蔦蔬蔭蔵蔽蕀蕁蕃蕈蕉蕊蕋蕎蕓蕕蕗蕘蕙蕚蕣蕨蕩蕪蕫蕭蕷蕾薀薄薇薈薊薐薑薔薗薙薛薜薤薦薨薩薪薫薬薮薯薰薹薺藁藉藍藏藐藕藜藝藤藥藩藪藷藹藺藻藾蘂蘆蘇蘊蘋蘓蘖蘗蘚蘢蘭蘯蘰蘿虍虎虐虔處虚虜虞號虧虫虱虹虻蚊蚋蚌蚓蚕蚣蚤蚩蚪蚫蚯蚰蚶蛄蛆蛇蛉蛋蛍蛎蛔蛙蛛蛞蛟蛤蛩蛬蛭蛮蛯蛸蛹蛻蛾蜀蜂蜃蜆蜈蜉蜊蜍蜑蜒蜘蜚蜜蜥蜩蜴蜷蜻蜿蝉蝋蝌蝎蝓蝕蝗蝙蝟蝠蝣蝦蝨蝪蝮蝴蝶蝸蝿螂融螟螢螫螯螳螺螻螽蟀蟄蟆蟇蟋蟐蟒蟠蟯蟲蟶蟷蟹蟻蟾蠅蠇蠍蠎蠏蠑蠕蠖蠡蠢蠣蠧蠱蠶蠹蠻血衂衄衆行衍衒術街衙衛衝衞衡衢衣表衫衰衲衵衷衽衾衿袁袂袈袋袍袒袖袗袙袞袢袤被袮袰袱袴袵袷袿裁裂裃裄装裏裔裕裘裙補裝裟裡裨裲裳裴裵裸裹裼製裾褂褄複褊褌褐褒褓褜褝褞褥褪褫褶褸褻襁襃襄襌襍襖襞襟襠襤襦襪襭襯襲襴襷襾西要覃覆覇覈覊見規覓視覗覘覚覡覦覧覩親覬覯覲観覺覽覿觀角觚觜觝解触觧觴觸言訂訃計訊訌討訐訒訓訖託記訛訝訟訣訥訪設許訳訴訶訷診註証詁詆詈詐詑詒詔評詛詞詠詢詣試詩詫詬詭詮詰話該詳詹詼誂誄誅誇誉誌認誑誓誕誘誚語誠誡誣誤誥誦誧誨説読誰課誹誼誾調諂諄談請諌諍諏諒論諚諛諜諞諟諠諡諢諤諦諧諫諭諮諱諳諶諷諸諺諾謀謁謂謄謇謌謎謐謔謖謗謙謚講謝謠謡謦謨謫謬謳謹謾譁證譌譎譏譓譖識譚譛譜譟警譫譬譯議譱譲譴護譽譿讀讃變讌讎讐讒讓讖讙讚谷谺谿豁豆豈豊豌豎豐豕豚象豢豪豫豬豸豹豺豼貂貅貉貊貌貍貎貔貘貝貞負財貢貧貨販貪貫責貭貮貯貰貲貳貴貶買貸費貼貽貿賀賁賂賃賄資賈賊賍賎賑賓賚賛賜賞賠賢賣賤賦質賭賰賴賺賻購賽贄贅贇贈贊贋贍贏贐贒贓贔贖赤赦赧赫赭走赱赳赴赶起趁超越趙趣趨足趺趾跂跋跌跏跖跚跛距跟跡跣跨跪跫路跳践跼跿踈踉踊踏踐踝踞踟踪踰踴踵蹂蹄蹇蹈蹉蹊蹌蹐蹕蹙蹟蹠蹣蹤蹲蹴蹶蹼躁躄躅躇躊躋躍躑躓躔躙躡躪身躬躯躰躱躾軅軆軈車軋軌軍軏軒軛軟転軣軫軸軻軼軽軾較輅載輊輌輒輓輔輕輙輛輜輝輟輦輩輪輯輳輸輹輻輾輿轂轄轅轆轉轌轍轎轗轜轟轡轢轣轤辛辜辞辟辣辧辨辭辮辯辰辱農辷辺辻込辿迂迄迅迎近返迚迢迥迦迩迪迫迭迯述迴迷迸迹迺追退送逃逅逆逋逍逎透逐逑逓途逕逖逗這通逝逞速造逡逢連逧逮週進逵逶逸逹逼逾遁遂遅遇遉遊運遍過遏遐遑遒道達違遖遘遙遜遞遠遡遣遥遧遨適遭遮遯遲遵遶遷選遺遼遽避邀邁邂邃還邇邉邊邏邑那邦邨邪邯邱邵邸郁郊郎郛郞郡郢郤部郭郵郷都鄂鄒鄕鄙鄧鄭鄰鄲酉酊酋酌配酎酒酔酖酘酢酣酥酩酪酬酲酳酵酷酸醂醇醉醋醍醐醒醗醜醢醤醪醫醯醴醵醸醺釀釁釆采釈釉釋里重野量釐金釖釗釘釚釛釜針釞釟釡釣釤釥釦釧釭釮釵釶釼釿鈆鈊鈍鈎鈐鈑鈔鈕鈞鈩鈬鈴鈷鈹鈺鈼鈿鉀鉄鉅鉈鉉鉋鉎鉐鉑鉗鉙鉚鉛鉞鉢鉤鉦鉧鉱鉷鉸鉾銀銃銅銈銑銓銕銖銘銚銛銜銧銭銷銹鋏鋐鋒鋓鋕鋗鋙鋠鋤鋧鋩鋪鋭鋲鋳鋸鋹鋺鋻鋼鋿錂錆錏錐錘錙錚錝錞錠錡錢錣錥錦錨錫錬錮錯録錵錺錻鍄鍈鍋鍍鍔鍖鍗鍛鍜鍠鍬鍮鍰鍵鍼鍾鎌鎔鎖鎗鎚鎤鎧鎬鎭鎮鎰鎹鏃鏆鏈鏐鏑鏖鏗鏘鏝鏞鏡鏤鏥鏨鏸鐃鐇鐐鐓鐔鐘鐙鐚鐡鐫鐱鐵鐶鐸鐺鑁鑄鑅鑈鑑鑒鑓鑚鑛鑞鑠鑢鑪鑰鑵鑷鑼鑽鑾鑿钁長門閂閃閇閉閊開閏閑閒間閔閖閘閙閠関閣閤閥閧閨閭閲閹閻閼閾闃闇闊闌闍闔闕闖闘關闡闢闥阜阡阨阪阮阯防阻阿陀陂附陋陌降陏限陛陜陝陞陟院陣除陥陦陪陬陰陲陳陵陶陷陸険陽隅隆隈隊隋隍階随隔隕隗隘隙際障隝隠隣隧隨險隯隰隱隲隴隶隷隸隹隻隼雀雁雄雅集雇雉雋雌雍雎雑雕雖雙雛雜離難雨雪雫雰雲零雷雹電需霄霆震霈霊霍霎霏霑霓霖霙霜霞霤霧霪霰露霳霸霹霻霽霾靂靃靄靆靈靉靍靏靑青靕靖静靜非靠靡面靤靦靨革靫靭靱靴靹靺靼鞁鞄鞅鞆鞋鞍鞏鞐鞘鞜鞠鞣鞦鞨鞫鞭鞳鞴韃韆韈韋韓韜韭韮韲音韵韶韻響頁頂頃項順須頌頏預頑頒頓頗領頚頡頤頬頭頴頷頸頻頼頽顆顋題額顎顏顔顕顗願顛類顥顧顫顯顰顱顳顴風颪颯颱颶飃飄飆飛飜食飢飩飫飭飮飯飲飴飼飽飾餃餅餉養餌餐餒餓餔餘餝餞餠餡餤餧館餬餮餽餾饂饅饉饋饌饐饑饒饕饗首馗馘香馞馥馨馬馭馮馳馴馼駁駄駅駆駈駐駑駒駕駘駛駝駟駢駭駮駱駲駸駻駿騁騅騎騏騒験騙騨騫騰騷騾驀驂驃驅驍驎驕驗驚驛驟驢驤驥驩驪驫骨骭骰骸骼髀髄髏髑髓體高髙髜髞髟髢髣髦髪髫髭髮髯髱髴髷髻鬆鬘鬚鬟鬢鬣鬥鬧鬨鬩鬪鬮鬯鬱鬲鬻鬼魁魂魃魄魅魍魎魏魑魔魘魚魯魲魴魵鮃鮎鮏鮑鮒鮓鮖鮗鮟鮠鮨鮪鮫鮭鮮鮱鮴鮹鮻鯀鯆鯉鯊鯏鯑鯒鯔鯖鯛鯡鯢鯣鯤鯨鯰鯱鯲鯵鰀鰄鰆鰈鰉鰊鰌鰍鰐鰒鰓鰔鰕鰛鰡鰤鰥鰭鰮鰯鰰鰲鰹鰺鰻鰾鱆鱇鱈鱒鱗鱚鱠鱧鱶鱸鳥鳧鳩鳫鳬鳰鳳鳴鳶鴃鴆鴇鴈鴉鴎鴒鴕鴛鴟鴣鴦鴨鴪鴫鴬鴻鴾鴿鵁鵄鵆鵈鵐鵑鵙鵜鵝鵞鵠鵡鵤鵫鵬鵯鵰鵲鵺鶇鶉鶏鶚鶤鶩鶫鶯鶲鶴鶸鶺鶻鷁鷂鷄鷆鷏鷓鷙鷦鷭鷯鷲鷸鷹鷺鷽鸙鸚鸛鸞鹵鹸鹹鹽鹿麁麈麋麌麑麒麓麕麗麝麟麥麦麩麪麭麸麹麺麻麼麾麿黄黌黍黎黏黐黑黒黔默黙黛黜黝點黠黥黨黯黴黶黷黹黻黼黽鼇鼈鼎鼓鼕鼠鼡鼬鼻鼾齊齋齎齏齒齔齟齠齡齢齣齦齧齪齬齲齶齷龍龕龜龝龠朗隆﨎﨏塚﨑晴﨓﨔凞猪益礼神祥福靖精羽﨟蘒﨡諸﨣﨤逸都﨧﨨﨩飯飼館鶴！＂＃＄％＆＇（）＊＋，－．／０１２３４５６７８９：；＜＝＞？＠ＡＢＣＤＥＦＧＨＩＪＫＬＭＮＯＰＱＲＳＴＵＶＷＸＹＺ［＼］＾＿｀ａｂｃｄｅｆｇｈｉｊｋｌｍｎｏｐｑｒｓｔｕｖｗｘｙｚ｛｜｝～｡｢｣､･ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝﾞﾟ￠￡￢￣￤￥");

	function convertCharRef(s) {
		return s
			.split('')
			.map(char =>
				nonEscapedCharSet.has(char)
					? char
					: `&#${char.charCodeAt(0)};`
			)
			.join('');
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


		/* --------------------------------------------------------------------------------
			Language Configuration
		/* -------------------------------------------------------------------------------- */
		monaco.languages.setLanguageConfiguration("seesaawiki", {
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
		});

		/* --------------------------------------------------------------------------------
			Tokens Provider
		/* -------------------------------------------------------------------------------- */
		monaco.languages.setMonarchTokensProvider("seesaawiki", {
			anchorName: /[a-zA-Z0-9\-_\.:]+/,
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

					// Video, Audio
					[/(&|#)(video|audio)(\()(.*?)(\))/, ['keyword.control', 'keyword', { token: 'delimiter.curly', bracket: '@open'}, 'string.url', { token: 'delimiter.curly', bracket: '@close'}]],

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
		});

		/* --------------------------------------------------------------------------------
			Theme
		/* -------------------------------------------------------------------------------- */
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

		/* --------------------------------------------------------------------------------
			Document Symbol Provider
		/* -------------------------------------------------------------------------------- */
		monaco.languages.registerDocumentSymbolProvider('seesaawiki', new SeesaaWikiDocumentSymbolProvider(monaco));

		/* --------------------------------------------------------------------------------
			Color Provider
		/* -------------------------------------------------------------------------------- */
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

		monaco.languages.registerColorProvider('seesaawiki', {
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
		});

		/* --------------------------------------------------------------------------------
			Link Provider
		/* -------------------------------------------------------------------------------- */
		const linkRegex = /\[\[(?:.+?>)??([^>]+?)\]\]|(?:&|#)include\(([^)]+)\)/g;
		const ancorNameRegex = /^(#[a-zA-Z0-9\-_\.:]+)$/;
		const pageNameWithAncorRegex = /^(.*?)(#[a-zA-Z0-9\-_\.:]+)$/;

		monaco.languages.registerLinkProvider('seesaawiki', {
			provideLinks: (model) => {
				const links = [];
				const text = model.getValue();
				const matches = text.matchAll(linkRegex);

				for (const match of matches) {
					const targetText = match[1] || match[2];
					if(!targetText) continue;

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
					const _getWikiPageUrl = window.parent && window.parent.getWikiPageUrl || getWikiPageUrl;
					if(anchorMatch){
						return { url: _getWikiPageUrl(anchorMatch[1]) + anchorMatch[2] };
					} else {
						return { url: _getWikiPageUrl(target) };
					}
				}

				return null;
			}
		});


		/* --------------------------------------------------------------------------------
			Definition Provider
		/* -------------------------------------------------------------------------------- */
		// monaco.languages.registerDefinitionProvider('seesaawiki', {
			// provideDefinition: function(model, position, token) {
				// const wordInfo = model.getWordAtPosition(position);
				// if (!wordInfo) return;

				// const line = model.getLineContent(position.lineNumber);
				// // const lineUntilCursor = line.substring(0, position.column);
				// const lineUntilCursor = line

				// const lastLinkMatch = lineUntilCursor.match(anchorLinkRegex);
				// if (!lastLinkMatch) return;

				// const anchorName = lastLinkMatch[1] || lastLinkMatch[2];
				// console.log(1);
				// const text = model.getValue();
				// const anchorMatch = text.match(new RegExp(`&aname\\(${anchorName}\\)`));

				// if (anchorMatch) {
				// 	const anchorIndex = anchorMatch.index;
				// 	const anchorPosition = model.getPositionAt(anchorIndex);

				// 	const uri = model.uri.with({
				// 		fragment: `${anchorPosition.lineNumber},${anchorPosition.column}`
				// 	});

				// 	return {
				// 		uri: uri,
				// 		range: { // 定義のrange
				// 			startLineNumber: anchorPosition.lineNumber,
				// 			startColumn: anchorPosition.column,
				// 			endLineNumber: anchorPosition.lineNumber,
				// 			endColumn: anchorPosition.column + anchorMatch[0].length
				// 		}
				// 	};
				// }
			// }
		// });

		/* --------------------------------------------------------------------------------
			Hover Provider
		/* -------------------------------------------------------------------------------- */
		// 画像URLを検出する正規表現
		const imageUrlRegex = /(https?:\/\/.*?\.(?:png|jpg|jpeg|gif|webp))/gi;

		// ホバープロバイダーを登録
		monaco.languages.registerHoverProvider('seesaawiki', {
			provideHover: function (model, position) {
				// 1. positionの行全体のlineContentを取得する
				const lineContent = model.getLineContent(position.lineNumber);

				// 2. lineContentに対してimageUrlRegexでマッチするか確かめる。複数のマッチがある場合全て確かめる
				let match;
				imageUrlRegex.lastIndex = 0;
				while ((match = imageUrlRegex.exec(lineContent)) !== null) {
					const startIndex = match.index + 1;
					const endIndex = startIndex + match[0].length;

					// 4. マッチ範囲とpositionが被っているか確認
					if (position.column >= startIndex && position.column <= endIndex) {
						// 6. 被っていれば、マッチ範囲で結果のrangeとcontentsのオブジェクトをreturnする
						return {
							range: new monaco.Range(
								position.lineNumber, startIndex,
								position.lineNumber, endIndex
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


		/* --------------------------------------------------------------------------------
			Completion Provider
		/* -------------------------------------------------------------------------------- */
		const seesaawikiSnippets = [
			{
				label: '&ref',
				kind: monaco.languages.CompletionItemKind.Snippet,
				insertText: '&ref(${1:画像URL})',
				insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
				documentation: '画像を挿入'
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
				label: '&video',
				kind: monaco.languages.CompletionItemKind.Snippet,
				insertText: '&video(${1:動画URL}){$2}',
				insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
				documentation: '動画を挿入'
			},
			{
				label: '&audio',
				kind: monaco.languages.CompletionItemKind.Snippet,
				insertText: '&audio(${1:音声URL})',
				insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
				documentation: '音声を挿入'
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
				insertText: '=|${1|BOX,AA,AAS|}|\n${2:$TM_SELECTED_TEXT}\n||=\n',
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
				label: 'definition',
				kind: monaco.languages.CompletionItemKind.Snippet,
				insertText: ':${1:定義語}|${2:説明文}',
				insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
				documentation: '定義リストを挿入'
			},
			{
				label: 'horizon',
				kind: monaco.languages.CompletionItemKind.Snippet,
				insertText: '----',
				insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
				documentation: '水平線を挿入'
			},
		];

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
				const prefix = match ? match[0] : null;

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

		// キーボードショートカットはeditorに付与するのでreplaceTextareaWithMonacoで定義
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
		iframe.style.height = 'max(calc(100vh - 500px), 750px)';

		// Maximize editor
		document.getElementById('wide_area_button').addEventListener('click', () => {
			if(editor.wide_area_mode.is_wide){
				iframe.style.height = 'max(calc(100vh - 500px), 750px)';
			} else {
				iframe.style.height = 'max(calc(100vh - 150px), 750px)';
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


		let lastSavedVersionId;
		function updateLastSavedVersionId() {
			const model = monacoEditor.getModel();
			if (model) {
				lastSavedVersionId = model.getAlternativeVersionId();
			}
		}

		updateLastSavedVersionId();

		function isDirty() {
			const model = monacoEditor.getModel();
			if (model) {
				const currentVersionId = model.getAlternativeVersionId();
				return currentVersionId !== lastSavedVersionId;
			}
			return false;
		}

		window.addEventListener('beforeunload', (event) => {
			if (isDirty()) {
				event.preventDefault();
				event.returnValue = '';
			}
		});

		// Override form submission
		const form = textarea.closest('form');
		form.addEventListener('submit', e => {
			e.preventDefault();
			updateLastSavedVersionId();
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
		// innerHTML = convertCharRef(innerHTML, reverse=true)

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
		registerSeesaaWikiLanguage();

		const diffContent = extractDiffContent();
		if (!diffContent) return;

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