import { describe, it, expect } from 'bun:test';
import { renderSeesaawikiToHtml } from '../../src/preview/renderer.js';

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
    expect(yt).toContain('<div class="link_youtube">');
    expect(yt).toContain('youtube.com/embed/dQw4w9WgXcQ');
    expect(yt).toContain('width="560" height="315"');
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
    expect(yt).toContain('width="200"');
    expect(yt).toContain('height="162"');
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
});
