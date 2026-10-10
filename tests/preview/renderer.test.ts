import { describe, it, expect } from 'bun:test';
import {
  createIncrementalWikiRenderer,
  renderSeesaawikiToHtml,
} from '../../src/preview/renderer';

describe('renderSeesaawikiToHtml', () => {
  it('見出しをh3/h4/h5に変換する', () => {
    const html = renderSeesaawikiToHtml('*大\n**中\n***小');
    expect(html).toContain('<h3 id="content_1">大</h3>');
    expect(html).toContain('<h4 id="content_1_1">中</h4>');
    expect(html).toContain('<h5 id="content_1_1_1">小</h5>');
    expect(html).toContain('class="wiki-section-1"');
    expect(html).toContain('class="title-2"');
  });

  it('トグル内のh5にはidを付けない(実ページ通り)', () => {
    const html = renderSeesaawikiToHtml('[+]折\n***小\n[END]');
    expect(html).toContain('<h5>小</h5>');
    expect(html).not.toContain('<h5 id=');
  });

  it('太字・斜体・下線・取消線を変換する', () => {
    const html = renderSeesaawikiToHtml("''太字''\n'''斜体'''\n%%%下線%%%\n%%取消%%");
    expect(html).toContain('<b>太字</b>');
    expect(html).toContain('<em>斜体</em>');
    expect(html).toContain('<u>下線</u>');
    expect(html).toContain('<del>取消</del>');
  });

  it('箇条書きと番号付きリストを変換する', () => {
    const html = renderSeesaawikiToHtml('-a\n--b\n+c\n++d');
    expect(html).toContain('<ul id="content_block_1" class="list-1">');
    expect(html).toContain('<ul class="list-2">');
    expect(html).toContain('<ol');
  });

  it('表をtableに変換する', () => {
    const html = renderSeesaawikiToHtml('|a|b|\n|c|d|');
    expect(html).toContain('<table id="content_block_1">');
    expect(html).toContain('<td>a</td>');
  });

  it('表のヘッダと配置指定を反映する', () => {
    const html = renderSeesaawikiToHtml('|!h|center:x|');
    expect(html).toContain('<th>h</th>');
    expect(html).toContain('text-align:center');
  });

  it('リンク記法をaタグに変換する', () => {
    const html = renderSeesaawikiToHtml('[[表示>ページ名]]', {
      getWikiPageUrl: (name) => `https://example.test/${name}`,
    });
    expect(html).toContain('<a href="https://example.test/ページ名"');
    expect(html).toContain('>表示</a>');
  });

  it('外部URLは別ウィンドウ指定を付与する', () => {
    const html = renderSeesaawikiToHtml('[[表示>>https://example.com]]');
    expect(html).toContain('href="https://example.com"');
    expect(html).toContain('target="_blank"');
  });

  it('引用と整形済みテキストを変換する', () => {
    const html = renderSeesaawikiToHtml('>引用\n=|BOX|\ncode\n||=');
    expect(html).toContain('<blockquote id="content_block_1">');
    expect(html).toContain('<pre id="content_block_2" class="BOX">');
  });

  it('折りたたみをトグル構造に変換する', () => {
    const closed = renderSeesaawikiToHtml('[+]タイトル\n中身\n[END]');
    expect(closed).toContain('class="toggle-link-open"');
    expect(closed).toContain('style="display:none"');
    expect(closed).toContain('<p>タイトル</p>');
    expect(closed).toContain('data-swe-toggle="content_block_1-inside"');
    const open = renderSeesaawikiToHtml('[-]タイトル\n中身\n[END]');
    expect(open).toContain('class="toggle-link-close"');
    expect(open).not.toContain('style="display:none"');
  });

  it('水平線と注釈・ルビ・サイズ・色を変換する', () => {
    const html = renderSeesaawikiToHtml('----\n((注釈))\n&ruby(るび){漢字}\n&size(20){大}\n&__下__');
    expect(html).toContain('<hr />');
    expect(html).toContain('<rt>るび</rt>');
    expect(html).toContain('<span class="fsize" style="font-size:20px;">大</span>');
    expect(html).toContain('<sub>下</sub>');
  });

  it('&colorは実ページ形式で出力する', () => {
    expect(renderSeesaawikiToHtml('&color(#d9d9d9){灰}')).toContain(
      '<span style="color:#d9d9d9;">灰</span>'
    );
    expect(renderSeesaawikiToHtml('&color(red,white){x}')).toContain(
      '<span style="color:red;background-color:white;">x</span>'
    );
  });

  it('&colorは空文字を「指定なし」として位置で判定する', () => {
    expect(renderSeesaawikiToHtml('&color(,#ff0000){x}')).toContain(
      '<span style="background-color:#ff0000;">x</span>'
    );
    expect(renderSeesaawikiToHtml('&color(red,){x}')).toContain(
      '<span style="color:red;">x</span>'
    );
  });

  it('画像・動画・YouTubeを埋め込む', () => {
    const img = renderSeesaawikiToHtml('&ref(https://example.com/a.png)');
    expect(img).toContain('<img src="https://example.com/a.png" border="0"');
    const video = renderSeesaawikiToHtml('&video(https://example.com/a.mp4)');
    expect(video).toContain('<video');
    const yt = renderSeesaawikiToHtml('&youtube(https://www.youtube.com/watch?v=dQw4w9WgXcQ)');
    // sandboxにallow-scriptsがなく子iframeにも継承されるためiframe化しない
    expect(yt).toContain('swe-preview-embed');
    expect(yt).toContain('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    expect(yt).not.toContain('<iframe');
  });

  it('画像サイズ指定をwidth/height属性に反映する', () => {
    const w = renderSeesaawikiToHtml('&ref(https://example.com/a.png,300)');
    expect(w).toContain('width="300"');
    expect(w).not.toContain('height=');
    const wh = renderSeesaawikiToHtml('&ref(https://example.com/a.png,450,105)');
    expect(wh).toContain('width="450"');
    expect(wh).toContain('height="105"');
    const h = renderSeesaawikiToHtml('&ref(https://example.com/a.png,,200)');
    expect(h).toContain('height="200"');
    expect(h).not.toContain('width="');
    const pct = renderSeesaawikiToHtml('&ref(https://example.com/a.png,100%)');
    expect(pct).toContain('max-width:100%');
    expect(pct).not.toContain('width="100%"');
  });

  it('attachrefのサイズ指定を画像と添付プレースホルダに反映する', () => {
    const image = renderSeesaawikiToHtml('&attachref(https://example.com/a.png,200x100)');
    expect(image).toContain('width="200"');
    expect(image).toContain('height="100"');

    const local = renderSeesaawikiToHtml('&attachref(a.png,120,80)');
    expect(local).toContain('class="swe-preview-attach"');
    expect(local).toContain('width:120px;');
    expect(local).toContain('height:80px;');

    const percent = renderSeesaawikiToHtml('&attachref(a.png,50%)');
    expect(percent).toContain('width:50%;');
    expect(percent).not.toContain('width:50px;');
  });

  it('画像未添付のattachrefはサイズ指定があっても添付ボタンを表示する', () => {
    for (const source of ['&attachref()', '&attachref(50%)', '&attachref(200,200)']) {
      const html = renderSeesaawikiToHtml(source);
      expect(html).toContain('<div class="attachref"><a>添付する</a></div>');
      expect(html).not.toContain('[attachref:');
      expect(html).not.toContain('width:');
    }
  });

  it('画像サイズと配置の混在、および高さのみの指定を扱う', () => {
    const aligned = renderSeesaawikiToHtml('&attachref(https://example.com/a.png,left,200,100)');
    expect(aligned).toContain('width="200"');
    expect(aligned).toContain('height="100"');
    expect(aligned).toContain('align="left"');

    const heightOnly = renderSeesaawikiToHtml('&attachref(a.png,,100)');
    expect(heightOnly).toContain('height:100px;');
    expect(heightOnly).not.toContain('width:');
  });

  it('画像の配置とtitle/altを実ページ形式で反映する', () => {
    const left = renderSeesaawikiToHtml('&ref(https://example.com/a.png,left)');
    expect(left).toContain('align="left"');
    const titled = renderSeesaawikiToHtml('&ref(https://example.com/a.png){図}');
    expect(titled).toContain('alt="図"');
    expect(titled).toContain('title="図"');
    expect(titled).not.toContain('swe-preview-imgtitle');
  });

  it('拡張子URLは画像として表示する', () => {
    const html = renderSeesaawikiToHtml('https://example.com/a.jpg');
    expect(html).toContain('<img src="https://example.com/a.jpg"');
    expect(html).toContain('border="0"');
  });

  it('動画・YouTubeのサイズ指定を反映する', () => {
    const v = renderSeesaawikiToHtml('&video(https://example.com/a.mp4){200,162}');
    expect(v).toContain('width="200"');
    expect(v).toContain('height="162"');
    const yt = renderSeesaawikiToHtml(
      '&youtube(https://www.youtube.com/watch?v=dQw4w9WgXcQ){200,162}'
    );
    // YouTubeはリンク代替のためサイズ属性を持たず、指定分は消費される
    expect(yt).toContain('swe-preview-embed');
    expect(yt).not.toContain('<iframe');
    expect(yt).not.toContain('{200,162}');
  });

  it('HTMLをエスケープしjavascript:リンクを無効化する', () => {
    const html = renderSeesaawikiToHtml('<script>alert(1)</script>\n[[x>javascript:alert(1)]]');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('javascript:alert');
  });

  it('目次とアンカーを変換する', () => {
    const html = renderSeesaawikiToHtml('*見出し\n#contents\n&aname(test)');
    expect(html).toContain('class="toc"');
    expect(html).toContain('class="wiki-catalog-inner"');
    expect(html).toContain('href="#content_1"');
    expect(html).toContain('id="content_1"');
    expect(html).toContain('<a class="anchor" id="test" name="test" title="test"></a>');
  });

  it('#contents(1)は大見出しのみを列挙する', () => {
    const html = renderSeesaawikiToHtml('*大\n**中\n#contents(1)');
    expect(html).toContain('<a href="#content_1">大</a>');
    expect(html).not.toContain('<a href="#content_1_1">');
  });

  it('注釈を実ページ形式の脚注に変換する', () => {
    const html = renderSeesaawikiToHtml('本文((注釈文))です');
    expect(html).toContain(
      '<a href="#footer-footnote1" name="footnote1" title="注釈文">*1</a>'
    );
    expect(html).toContain('<div class="footer-footnote">');
    expect(html).toContain('<a href="#footnote1" name="footer-footnote1">*1 </a> : 注釈文');
  });

  it('外部リンクにoutlinkを付与する', () => {
    const single = renderSeesaawikiToHtml('[[表示>https://example.com]]');
    expect(single).toContain('class="outlink"');
    expect(single).toContain('rel="nofollow"');
    expect(single).not.toContain('target=');
    const multi = renderSeesaawikiToHtml('[[表示>>https://example.com]]');
    expect(multi).toContain('target="_blank"');
    expect(multi).toContain('class="outlink"');
  });

  it('画像リンクは入れ子aタグにならない', () => {
    const html = renderSeesaawikiToHtml(
      '[[&ref(https://example.com/a.png,80,no_link)>ページ名]]',
      { getWikiPageUrl: (name) => `https://example.test/${name}` }
    );
    expect(html).toContain('<a href="https://example.test/ページ名"><img');
    expect(html).not.toContain('</a></a>');
    expect(html).toContain('width="80"');
  });

  it('画像のみのリンク先が外部URLならWiki内URLにしない', () => {
    const html = renderSeesaawikiToHtml(
      '[[&ref(https://example.com/image.png)>https://example.com/target]]',
      { getWikiPageUrl: (name) => `https://example.test/${name}` }
    );
    expect(html).toContain('<a href="https://example.com/target"');
    expect(html).toContain('class="outlink"');
    expect(html).not.toContain('example.test');
  });

  it('折り畳み内と同名の外側見出しにidが付く', () => {
    const html = renderSeesaawikiToHtml('#contents\n[+]fold\n*Same\n[END]\n*Same');
    expect(html).toContain('<a href="#content_1">Same</a>');
    expect(html).toContain('<h3 id="content_1">Same</h3>');
  });

  it('&alignはdivラッパーで出力する', () => {
    const html = renderSeesaawikiToHtml('&align(center){中央}');
    expect(html).toContain('<div style="text-align:center;">中央</div>');
  });

  it('行末の<br />は吸収ルールに従う', () => {
    // 先頭見出し(セクション未生成)の前は吸収されない
    expect(renderSeesaawikiToHtml('本文\n*見出し')).toBe(
      '本文<br />\n<div id="content_block_1" class="wiki-section-1"><div class="title-1"><h3 id="content_1">見出し</h3></div>\n<div id="content_block_1-body" class="wiki-section-body-1">\n</div></div>\n'
    );
    // セクション内では見出し前に1つ吸収される
    expect(renderSeesaawikiToHtml('*a\n本文\n\n*見出し')).toContain('本文<br />\n</div></div>');
    // 表・トグル前では残る
    expect(renderSeesaawikiToHtml('本文\n\n|a|')).toContain('本文<br />\n<br />\n<table');
    expect(renderSeesaawikiToHtml('本文\n\n[+]t\nx\n[END]')).toContain('本文<br />\n<br />\n<div');
    // 行末~~は改行を兼ねるため重ねない
    expect(renderSeesaawikiToHtml('>a~~\n>b')).toContain('a<br />\nb');
    expect(renderSeesaawikiToHtml('>a~~\n>b')).not.toContain('<br /><br />');
  });

  it('行末~~~~~はフロートクリア+改行になる', () => {
    const html = renderSeesaawikiToHtml('>前文~~~~~\n>後文');
    expect(html).toContain('前文<br clear="all" /><br />\n後文');
  });

  it('引用内の素行はスペース連結する', () => {
    const html = renderSeesaawikiToHtml('>あ\n>い');
    expect(html).toContain('<blockquote id="content_block_1">\nあ い</blockquote>');
  });

  it('>は右結合で次のセルにcolspanが付く', () => {
    const html = renderSeesaawikiToHtml('|>|!a|>|!b|');
    expect(html).toContain('<th colspan="2">a</th>');
    expect(html).toContain('<th colspan="2">b</th>');
    expect(html).not.toContain('<td>></td>');
  });

  it('横結合後のセルも^で縦結合できる', () => {
    const html = renderSeesaawikiToHtml('|>|A|B|\n|x|y|^|');
    expect(html).toContain('<td colspan="2">A</td>');
    expect(html).toContain('<td rowspan="2">B</td>');
  });

  it('コロン無し連結の列書式(w(110px)left)を解釈する', () => {
    const html = renderSeesaawikiToHtml(
      '|bgcolor(#b0b0b0):w(110px)left|w(80px)center|c\n|!a|b|'
    );
    expect(html).toContain(
      '<th style="background-color:#b0b0b0;width:110px;text-align:left;">a</th>'
    );
    expect(html).toContain('<td style="width:80px;text-align:center;">b</td>');
    expect(html).not.toContain('w(110px)left');
    expect(html).not.toContain('w(80px)center</td>');
  });

  it('書式指定行の!付きセルは列書式のみ残して非表示にする', () => {
    const html = renderSeesaawikiToHtml('|bgcolor(#b0b0b0):!left|left|c\n|!x|y|');
    expect(html).not.toContain('!left');
    expect(html).toContain('<th style="background-color:#b0b0b0;">x</th>');
    expect(html).toContain('<td style="text-align:left;">y</td>');
  });

  it('内容が空のr[...]:~行は行全体をヘッダにする', () => {
    const html = renderSeesaawikiToHtml(
      '|bgcolor(#b0b0b0):w(110px)left|w(80px)center|c\n|r[bgcolor(#b0b0b0)]:~|t|'
    );
    expect(html).toContain(
      '<th style="background-color:#b0b0b0;width:110px;text-align:left;"></th>'
    );
    expect(html).toContain(
      '<th style="background-color:#b0b0b0;width:80px;text-align:center;">t</th>'
    );
    expect(html).not.toContain('<td');
  });

  it('右結合セルは結合範囲末尾列の列書式を使う', () => {
    const html = renderSeesaawikiToHtml(
      '|bgcolor(#b0b0b0):left|center|c\n|>|!bgcolor(#b0b0b0):&size(18){x}|'
    );
    expect(html).toContain(
      '<th colspan="2" style="background-color:#b0b0b0;text-align:center;">'
    );
    expect(html).not.toContain('background-color:#b0b0b0;background-color');
  });

  it('未存在ページは赤リンク+?で描画する', () => {
    const html = renderSeesaawikiToHtml('[[あるページ]]と[[ないページ]]', {
      getWikiPageUrl: (name) => `https://example.test/${name}`,
      isExistingPage: (name) => name !== 'ないページ',
      getWikiAddUrl: (name) => `https://example.test/e/add?pagename=${name}`,
    });
    expect(html).toContain('<a href="https://example.test/あるページ"');
    expect(html).toContain(
      '<span style="color:gray;background-color:yellow">ないページ</span><small><a href="https://example.test/e/add?pagename=ないページ" rel="nofollow">?</a></small>'
    );
  });

  it('素URLの長い表示テキストは50字で省略する', () => {
    const long = `https://example.com/${'x'.repeat(60)}`;
    const html = renderSeesaawikiToHtml(long);
    expect(html).toContain(`${long.slice(0, 50)}...</a>`);
    expect(html).toContain(`href="${long}"`);
    // 明示テキストは省略しない
    const explicit = renderSeesaawikiToHtml(`[[${'あ'.repeat(54)}>https://example.com]]`);
    expect(explicit).toContain(`${'あ'.repeat(54)}</a>`);
    expect(explicit).not.toContain('...</a>');
  });

  it('差分レンダラーは変更していない行のHTML生成を再利用する', () => {
    const renderer = createIncrementalWikiRenderer();
    const initial = '一行目\n二行目\n三行目';
    expect(renderer.render(initial)).toBe(renderSeesaawikiToHtml(initial));
    expect(renderer.getLastStats()).toMatchObject({
      renderedBlocks: 3,
      reusedBlocks: 0,
      totalBlocks: 3,
      fullRender: true,
    });

    const next = '一行目\n変更行\n三行目';
    expect(renderer.render(next)).toBe(renderSeesaawikiToHtml(next));
    expect(renderer.getLastStats()).toMatchObject({
      renderedBlocks: 1,
      reusedBlocks: 2,
      totalBlocks: 3,
      fullRender: false,
    });
  });

  it('複数行ブロックと見出し依存を保ったまま差分を再利用する', () => {
    const options = {
      getWikiPageUrl: (name: string) => `https://example.test/${name}`,
    };
    const renderer = createIncrementalWikiRenderer(options);
    const initial = [
      '前置き',
      '*一つ目',
      '[+]折り畳み',
      '内部((脚注))',
      '[END]',
      '#contents',
      '*二つ目',
      '|a|b|',
      '|c|d|',
    ].join('\n');
    expect(renderer.render(initial)).toBe(renderSeesaawikiToHtml(initial, options));

    const next = initial.replace('内部((脚注))', '変更内部((脚注))');
    expect(renderer.render(next)).toBe(renderSeesaawikiToHtml(next, options));
    expect(renderer.getLastStats().reusedBlocks).toBeGreaterThan(0);

    const final = next.replace('*二つ目', '*二つ目\n本文');
    expect(renderer.render(final)).toBe(renderSeesaawikiToHtml(final, options));
    expect(renderer.getLastStats().reusedBlocks).toBeGreaterThan(0);
  });

  it('引用内の目次も見出し変更で更新される', () => {
    const renderer = createIncrementalWikiRenderer();
    const initial = '*A\n>#contents\n*B\ntext';
    expect(renderer.render(initial)).toBe(renderSeesaawikiToHtml(initial));
    const next = '*A\n>#contents\n*C\ntext';
    expect(renderer.render(next)).toBe(renderSeesaawikiToHtml(next));
  });

  it('脚注番号と連続編集を毎回全文レンダーと一致させる', () => {
    const renderer = createIncrementalWikiRenderer();
    const sources = [
      '*見出し\n本文((一))\n*次\n後((二))',
      '*見出し\n変更((一))\n*次\n後((二))',
      '*見出し\n変更((一))\n*次\n追加\n後((二))',
      '*見出し\n変更\n*次\n追加\n後((二))',
    ];
    for (const source of sources) {
      expect(renderer.render(source)).toBe(renderSeesaawikiToHtml(source));
    }
  });

  it('明示表内の見出し風行を表の境界内に保つ', () => {
    const renderer = createIncrementalWikiRenderer();
    const source = '{|class="wide"\n*表の本文\n|a|b|\n|}\n*見出し\n本文';
    expect(renderer.render(source)).toBe(renderSeesaawikiToHtml(source));

    const next = source.replace('表の本文', '変更した表の本文');
    expect(renderer.render(next)).toBe(renderSeesaawikiToHtml(next));
    expect(renderer.getLastStats().reusedBlocks).toBe(1);
  });
});
