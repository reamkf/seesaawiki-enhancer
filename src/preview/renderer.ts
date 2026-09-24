export interface PreviewRenderOptions {
  getWikiPageUrl?: ((pageName: string) => string) | null;
  /** 未存在ページ判定フック。falseを返したページは赤リンク描画する。省略時は存在扱い。 */
  isExistingPage?: ((pageName: string) => boolean) | null;
  /** 新規作成ページURLの生成。未存在時マークに使う。省略時は?リンクなし。 */
  getWikiAddUrl?: ((pageName: string) => string) | null;
}

/** 未存在ページの赤リンクHTML(実ページ形式)。preview.tsの非同期補正と共用する。 */
export function renderMissingPageHtml(textHtml: string, addUrl: string | null): string {
  const q =
    addUrl !== null
      ? `<small><a href="${escapeAttr(addUrl)}" rel="nofollow">?</a></small>`
      : '';
  return `<span style="color:gray;background-color:yellow">${textHtml}</span>${q}`;
}

interface HeadingEntry {
  level: 1 | 2 | 3;
  raw: string;
  id: string | null;
}

interface FootnoteEntry {
  html: string;
  raw: string;
}

interface RenderContext {
  getWikiPageUrl?: ((pageName: string) => string) | null;
  isExistingPage?: ((pageName: string) => boolean) | null;
  getWikiAddUrl?: ((pageName: string) => string) | null;
  footnotes: FootnoteEntry[];
  headings: HeadingEntry[];
  headingIds: Map<string, (string | null)[]>;
  h3ord: number;
  h4seq: number;
  h5seq: number;
  lastH3: number;
  lastH4: number;
  blockNum: number;
  regionNum: number;
  inToggle: number;
  fallbackSeq: number;
}

export const SPACER_GIF_URL =
  'https://static.seesaawiki.jp/formatter-storage/images/common/spacer.gif';

function escapeHtmlBasic(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(text: string): string {
  return escapeHtmlBasic(text);
}

function sanitizeHref(url: string): string | null {
  const trimmed = url.trim();
  if (/^(https?:\/\/|ftp:\/\/|mailto:)/i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('#')) return trimmed;
  return null;
}

function sanitizeImgSrc(url: string): string | null {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return null;
}

function sanitizeId(text: string): string {
  const cleaned = text.trim().replace(/\s+/g, '_');
  if (/^[A-Za-z0-9\-_\.:]+$/.test(cleaned)) return cleaned;
  return cleaned.replace(/[^A-Za-z0-9\-_\.:]/g, '_') || 'anchor';
}

function isSeesaawikiUrl(url: string): boolean {
  try {
    return /(^|\.)seesaawiki\.jp$/i.test(new URL(url).hostname);
  } catch {
    return false;
  }
}

function matchBrace(text: string, braceStart: number): { inner: string; end: number } | null {
  if (text[braceStart] !== '{') return null;
  let depth = 0;
  for (let i = braceStart; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') {
      depth--;
      if (depth === 0) {
        return { inner: text.slice(braceStart + 1, i), end: i + 1 };
      }
    }
  }
  return null;
}

function toFontSize(value: string): string {
  const v = value.trim();
  if (/^\d+$/.test(v)) return `${v}px`;
  return v;
}

function parseDimension(value: string): { px: string } | { percent: string } | null {
  const v = value.trim();
  let m = v.match(/^(\d+(?:\.\d+)?)px$/i);
  if (m) return { px: m[1] };
  m = v.match(/^(\d+(?:\.\d+)?)%$/);
  if (m) return { percent: m[1] };
  m = v.match(/^(\d+(?:\.\d+)?)$/);
  if (m) return { px: m[1] };
  return null;
}

function truncateLinkText(text: string): string {
  return text.length > 50 ? text.slice(0, 50) + '...' : text;
}

function isBareImageUrl(url: string): boolean {
  const path = url.split(/[?#]/)[0];
  return /\.(gif|jpe?g|png)$/i.test(path);
}

function extractYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host.includes('youtu.be')) {
      const id = u.pathname.replace(/\//g, '');
      return id || null;
    }
    if (host.includes('youtube.com') || host.includes('youtube-nocookie.com')) {
      const v = u.searchParams.get('v');
      if (v) return v;
      const m = u.pathname.match(/\/(embed|shorts|live)\/([^/?#]+)/);
      if (m) return m[2];
    }
  } catch {
    return null;
  }
  return null;
}

function parseParenArgs(text: string, start: number): { args: string; end: number } | null {
  if (text[start] !== '(') return null;
  const close = text.indexOf(')', start + 1);
  if (close === -1) return null;
  return { args: text.slice(start + 1, close), end: close + 1 };
}

/** 画像のみで構成されたリンクテキストなら、リンク無しのimg HTMLを返す */
function tryRenderImageToken(src: string, ctx: RenderContext): string | null {
  const t = src.trim();
  let m = t.match(/^[&#](ref|attachref)\(([^)]*)\)(\{([\s\S]*)\})?$/);
  if (m) {
    const html = renderRefImage(m[2], m[4] ?? null, true, ctx);
    return html;
  }
  if (/^https?:\/\/[^\s<>"')\]]+$/.test(t) && isBareImageUrl(t.replace(/[.,;:!?]+$/, ''))) {
    const url = t.replace(/[.,;:!?]+$/, '');
    const trail = t.slice(url.length);
    return (
      `<img src="${escapeAttr(url)}" border="0" loading="lazy" style="max-width:100%;" />` +
      escapeHtmlBasic(trail)
    );
  }
  return null;
}

function renderRefImage(
  argsStr: string,
  title: string | null,
  noLink: boolean,
  _ctx: RenderContext
): string | null {
  void _ctx;
  const rawArgs = argsStr.split(',').map((s) => s.trim());
  const first = rawArgs[0] ?? '';
  const opts = rawArgs.slice(1);
  const imgSrc = sanitizeImgSrc(first);
  if (!imgSrc) return null;
  let widthPx: string | null = null;
  let heightPx: string | null = null;
  let heightPercent: string | null = null;
  let alignAttr = '';
  let centerWrap = false;
  opts.forEach((o, index) => {
    if (!o) return;
    if (o === 'left' || o === 'right') {
      alignAttr = o;
      return;
    }
    if (o === 'center') {
      centerWrap = true;
      return;
    }
    if (o === 'no_link') return;
    const dim = parseDimension(o);
    if (!dim) return;
    if (index === 0) {
      if ('px' in dim) widthPx = dim.px;
    } else if (heightPx === null && heightPercent === null) {
      if ('px' in dim) heightPx = dim.px;
      else heightPercent = dim.percent;
    }
  });
  if (opts.includes('no_link')) noLink = true;
  let imgTag = `<img src="${escapeAttr(imgSrc)}" border="0"`;
  if (title != null) {
    imgTag += ` alt="${escapeAttr(title)}" title="${escapeAttr(title)}"`;
  }
  imgTag += ' loading="lazy"';
  if (widthPx !== null) imgTag += ` width="${escapeAttr(widthPx)}"`;
  if (heightPx !== null) imgTag += ` height="${escapeAttr(heightPx)}"`;
  if (heightPercent !== null) imgTag += ` height="${escapeAttr(heightPercent)}%"`;
  if (alignAttr) imgTag += ` align="${alignAttr}"`;
  imgTag += ' style="max-width:100%;" />';
  const linked = noLink ? imgTag : `<a href="${escapeAttr(imgSrc)}">${imgTag}</a>`;
  if (centerWrap && !alignAttr) {
    return `<div style="text-align:center;">${linked}</div>`;
  }
  return linked;
}

export function renderInline(src: string, ctx?: Partial<RenderContext>): string {
  const context: RenderContext = {
    getWikiPageUrl: ctx?.getWikiPageUrl ?? null,
    isExistingPage: ctx?.isExistingPage ?? null,
    getWikiAddUrl: ctx?.getWikiAddUrl ?? null,
    footnotes: ctx?.footnotes ?? [],
    headings: ctx?.headings ?? [],
    headingIds: ctx?.headingIds ?? new Map(),
    h3ord: ctx?.h3ord ?? 0,
    h4seq: ctx?.h4seq ?? 0,
    h5seq: ctx?.h5seq ?? 0,
    lastH3: ctx?.lastH3 ?? 0,
    lastH4: ctx?.lastH4 ?? 0,
    blockNum: ctx?.blockNum ?? 0,
    regionNum: ctx?.regionNum ?? 0,
    inToggle: ctx?.inToggle ?? 0,
    fallbackSeq: ctx?.fallbackSeq ?? 0,
  };
  let out = '';
  let i = 0;

  while (i < src.length) {
    const rest = src.slice(i);

    const entityMatch = rest.match(/^&(?:\w+|#\d+);/);
    if (entityMatch) {
      out += entityMatch[0];
      i += entityMatch[0].length;
      continue;
    }

    if (rest.startsWith("'''")) {
      const close = src.indexOf("'''", i + 3);
      if (close !== -1) {
        const inner = src.slice(i + 3, close);
        out += `<em>${renderInline(inner, context)}</em>`;
        i = close + 3;
        continue;
      }
    }
    if (rest.startsWith("''")) {
      const close = src.indexOf("''", i + 2);
      if (close !== -1) {
        const inner = src.slice(i + 2, close);
        out += `<b>${renderInline(inner, context)}</b>`;
        i = close + 2;
        continue;
      }
    }
    if (rest.startsWith('%%%')) {
      const close = src.indexOf('%%%', i + 3);
      if (close !== -1) {
        const inner = src.slice(i + 3, close);
        out += `<u>${renderInline(inner, context)}</u>`;
        i = close + 3;
        continue;
      }
    }
    if (rest.startsWith('%%')) {
      const close = src.indexOf('%%', i + 2);
      if (close !== -1) {
        const inner = src.slice(i + 2, close);
        out += `<del>${renderInline(inner, context)}</del>`;
        i = close + 2;
        continue;
      }
    }
    if (rest.startsWith('__')) {
      const close = src.indexOf('__', i + 2);
      if (close !== -1) {
        const inner = src.slice(i + 2, close);
        out += `<sub>${renderInline(inner, context)}</sub>`;
        i = close + 2;
        continue;
      }
    }

    const cmdMatch = rest.match(/^[&#]([A-Za-z_]+)/);
    if (cmdMatch) {
      const name = cmdMatch[1];
      const afterName = i + cmdMatch[0].length;
      const handled = tryRenderCommand(src, afterName, name, context);
      if (handled) {
        out += handled.html;
        i = handled.end;
        continue;
      }
      if (
        name === 'sup' ||
        name === 'sub' ||
        name === 'size' ||
        name === 'color' ||
        name === 'ruby' ||
        name === 'align' ||
        name === 'fukidashi' ||
        name === 'hukidashi' ||
        name === 'aname' ||
        name === 'ref' ||
        name === 'attach' ||
        name === 'attachref' ||
        name === 'video' ||
        name === 'audio' ||
        name === 'youtube' ||
        name === 'niconico' ||
        name === 'nicovideo' ||
        name === 'twitter' ||
        name === 'twitter_profile' ||
        name === 'RecentUpdate' ||
        name === 'include'
      ) {
        out += escapeHtmlBasic(src[i]);
        i += 1;
        continue;
      }
    }

    if (rest.startsWith('[[')) {
      const close = src.indexOf(']]', i + 2);
      if (close !== -1) {
        const inner = src.slice(i + 2, close);
        out += renderWikiLink(inner, context);
        i = close + 2;
        continue;
      }
    }

    if (rest.startsWith('((')) {
      const close = src.indexOf('))', i + 2);
      if (close !== -1) {
        const raw = src.slice(i + 2, close);
        const num = context.footnotes.length + 1;
        context.footnotes.push({ html: renderInline(raw, context), raw });
        // 注釈原文が素URLの場合は50字で省略する(実ページ通り)
        const titleText = /^https?:\/\/\S+$/.test(raw) ? truncateLinkText(raw) : raw;
        out += `<a href="#footer-footnote${num}" name="footnote${num}" title="${escapeAttr(titleText)}">*${num}</a>`;
        i = close + 2;
        continue;
      }
    }

    const tilde5 = rest.match(/^~~~~~(?![~])(?=[ \t]*$)/);
    if (tilde5) {
      // 行末~~~~~はフロートクリア+改行(実ページ通り)
      out += '<br clear="all" /><br />';
      i += 5;
      continue;
    }

    const tildeMatch = rest.match(/^~~/);
    if (tildeMatch) {
      out += '<br />';
      i += 2;
      continue;
    }

    const urlMatch = rest.match(/^https?:\/\/[^\s<>"')\]]+/);
    if (urlMatch) {
      const url = urlMatch[0].replace(/[.,;:!?]+$/, '');
      const trail = urlMatch[0].slice(url.length);
      if (isBareImageUrl(url)) {
        out += `<a href="${escapeAttr(url)}"><img src="${escapeAttr(url)}" border="0" loading="lazy" style="max-width:100%;" /></a>${escapeHtmlBasic(trail)}`;
      } else {
        // 素URLの表示テキストは50字で省略する(実ページ通り)。hrefは全体を保つ。
        const display = truncateLinkText(url);
        out += `<a href="${escapeAttr(url)}" class="outlink">${escapeHtmlBasic(display)}</a>${escapeHtmlBasic(trail)}`;
      }
      i += urlMatch[0].length;
      continue;
    }

    const mailMatch = rest.match(/^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/);
    if (mailMatch) {
      const mail = mailMatch[0];
      out += `<a href="mailto:${escapeAttr(mail)}">${escapeHtmlBasic(mail)}</a>`;
      i += mail.length;
      continue;
    }

    out += escapeHtmlBasic(src[i]);
    i += 1;
  }

  return out;
}

function tryRenderCommand(
  src: string,
  pos: number,
  name: string,
  ctx: RenderContext
): { html: string; end: number } | null {
  const needBraceWithParen = (
    allowNoParen: boolean
  ): { args: string; inner: string; end: number } | null => {
    let p = pos;
    let args = '';
    if (src[p] === '(') {
      const parsed = parseParenArgs(src, p);
      if (!parsed) return null;
      args = parsed.args;
      p = parsed.end;
    } else if (!allowNoParen) {
      return null;
    }
    if (src[p] !== '{') return null;
    const brace = matchBrace(src, p);
    if (!brace) return null;
    return { args, inner: brace.inner, end: brace.end };
  };

  switch (name) {
    case 'sup':
    case 'sub': {
      const tag = name === 'sup' ? 'sup' : 'sub';
      const parsed = needBraceWithParen(true);
      if (!parsed) return null;
      return {
        html: `<${tag}>${renderInline(parsed.inner, ctx)}</${tag}>`,
        end: parsed.end,
      };
    }
    case 'size': {
      if (src[pos] !== '(') return null;
      const parsed = needBraceWithParen(false);
      if (!parsed) return null;
      return {
        html: `<span class="fsize" style="font-size:${escapeAttr(toFontSize(parsed.args))};">${renderInline(parsed.inner, ctx)}</span>`,
        end: parsed.end,
      };
    }
    case 'color': {
      if (src[pos] !== '(') return null;
      const parsed = needBraceWithParen(false);
      if (!parsed) return null;
      // 空文字は「指定なし」を表すため位置で判定する(&color(,bg) → 背景色のみ)
      const parts = parsed.args.split(',');
      const fg = (parts[0] ?? '').trim();
      const bg = (parts[1] ?? '').trim();
      let style = '';
      if (fg) style += `color:${fg};`;
      if (bg) style += `background-color:${bg};`;
      return {
        html: `<span style="${escapeAttr(style)}">${renderInline(parsed.inner, ctx)}</span>`,
        end: parsed.end,
      };
    }
    case 'ruby': {
      if (src[pos] !== '(') return null;
      const parsed = needBraceWithParen(false);
      if (!parsed) return null;
      return {
        html: `<ruby>${renderInline(parsed.inner, ctx)}<rt>${escapeHtmlBasic(parsed.args)}</rt></ruby>`,
        end: parsed.end,
      };
    }
    case 'align': {
      if (src[pos] !== '(') return null;
      const parsed = needBraceWithParen(false);
      if (!parsed) return null;
      const dir = parsed.args.trim();
      const safe = dir === 'left' || dir === 'center' || dir === 'right' ? dir : 'left';
      return {
        html: `<div style="text-align:${safe};">${renderInline(parsed.inner, ctx)}</div>`,
        end: parsed.end,
      };
    }
    case 'fukidashi':
    case 'hukidashi': {
      if (src[pos] !== '(') return null;
      const parsed = needBraceWithParen(false);
      if (!parsed) return null;
      const right = /,right\b/.test(`,${parsed.args}`);
      const cls = right
        ? 'swe-preview-fukidashi swe-preview-fukidashi-right'
        : 'swe-preview-fukidashi';
      return {
        html: `<div class="${cls}">${renderInline(parsed.inner, ctx)}</div>`,
        end: parsed.end,
      };
    }
    case 'aname': {
      const parsed = parseParenArgs(src, pos);
      if (!parsed) return null;
      const id = sanitizeId(parsed.args);
      return {
        html: `<a class="anchor" id="${escapeAttr(id)}" name="${escapeAttr(id)}" title="${escapeAttr(id)}"></a>`,
        end: parsed.end,
      };
    }
    case 'ref':
    case 'attachref':
    case 'attach': {
      const parsed = parseParenArgs(src, pos);
      if (!parsed) return null;
      let p = parsed.end;
      let title: string | null = null;
      if (src[p] === '{') {
        const brace = matchBrace(src, p);
        if (brace) {
          title = brace.inner;
          p = brace.end;
        }
      }
      if (name === 'attach') {
        const first = parsed.args.split(',')[0]?.trim() ?? '';
        return {
          html: `<span class="swe-preview-attach">[添付:${escapeHtmlBasic(first)}]</span>`,
          end: p,
        };
      }
      const html = renderRefImage(parsed.args, title, false, ctx);
      if (html === null) {
        const first = parsed.args.split(',')[0]?.trim() ?? '';
        return {
          html: `<span class="swe-preview-attach">[${escapeHtmlBasic(name)}:${escapeHtmlBasic(first)}]</span>`,
          end: p,
        };
      }
      return { html, end: p };
    }
    case 'video':
    case 'audio': {
      const parsed = parseParenArgs(src, pos);
      if (!parsed) return null;
      let p = parsed.end;
      let sizeW: string | null = null;
      let sizeH: string | null = null;
      if (src[p] === '{') {
        const brace = matchBrace(src, p);
        if (brace) {
          const parts = brace.inner.split(',').map((s) => s.trim());
          const w = parts[0] ? parseDimension(parts[0]) : null;
          const h = parts[1] ? parseDimension(parts[1]) : null;
          if (w && 'px' in w) sizeW = w.px;
          if (h && 'px' in h) sizeH = h.px;
          p = brace.end;
        }
      }
      const mediaUrl = parsed.args.split(',')[0]?.trim() ?? '';
      if (!sanitizeImgSrc(mediaUrl)) {
        return {
          html: `<span>[${escapeHtmlBasic(name)}:${escapeHtmlBasic(mediaUrl)}]</span>`,
          end: p,
        };
      }
      if (name === 'video') {
        let tag = `<video controls src="${escapeAttr(mediaUrl)}" preload="metadata"`;
        if (sizeW !== null) tag += ` width="${escapeAttr(sizeW)}"`;
        if (sizeH !== null) tag += ` height="${escapeAttr(sizeH)}"`;
        tag += ' style="max-width:100%;"></video>';
        return { html: tag, end: p };
      }
      return {
        html: `<audio controls src="${escapeAttr(mediaUrl)}"></audio>`,
        end: p,
      };
    }
    case 'youtube':
    case 'niconico':
    case 'nicovideo': {
      const parsed = parseParenArgs(src, pos);
      if (!parsed) return null;
      let p = parsed.end;
      let sizeW: string | null = null;
      let sizeH: string | null = null;
      if (src[p] === '{') {
        const brace = matchBrace(src, p);
        if (brace) {
          const parts = brace.inner.split(',').map((s) => s.trim());
          const w = parts[0] ? parseDimension(parts[0]) : null;
          const h = parts[1] ? parseDimension(parts[1]) : null;
          if (w && 'px' in w) sizeW = w.px;
          if (h && 'px' in h) sizeH = h.px;
          p = brace.end;
        }
      }
      const mediaUrl = parsed.args.split(',')[0]?.trim() ?? '';
      if (name === 'youtube') {
        const id = extractYouTubeId(mediaUrl);
        if (id) {
          const w = sizeW ?? '560';
          const h = sizeH ?? '315';
          return {
            html: `<div class="link_youtube">\n<iframe width="${escapeAttr(w)}" height="${escapeAttr(h)}" src="https://www.youtube.com/embed/${escapeAttr(id)}" allowfullscreen></iframe>\n</div>`,
            end: p,
          };
        }
      }
      const href = sanitizeHref(mediaUrl) ?? '#';
      return {
        html: `<div class="swe-preview-embed"><a href="${escapeAttr(href)}" target="_blank" rel="noopener">${escapeHtmlBasic(`${name}:${mediaUrl}`)}</a></div>`,
        end: p,
      };
    }
    case 'twitter':
    case 'twitter_profile': {
      const parsed = parseParenArgs(src, pos);
      if (!parsed) return null;
      let p = parsed.end;
      if (src[p] === '{') {
        const brace = matchBrace(src, p);
        if (brace) p = brace.end;
      }
      const id = parsed.args.trim();
      const href =
        name === 'twitter'
          ? `https://x.com/_/status/${encodeURIComponent(id)}`
          : `https://x.com/${encodeURIComponent(id)}`;
      return {
        html: `<div class="swe-preview-embed"><a href="${escapeAttr(href)}" target="_blank" rel="noopener">${escapeHtmlBasic(`${name}:${id}`)}</a></div>`,
        end: p,
      };
    }
    case 'RecentUpdate':
    case 'include': {
      if (src[pos] === '(') {
        const parsed = parseParenArgs(src, pos);
        if (parsed) {
          return {
            html: `<div class="swe-preview-placeholder">[${escapeHtmlBasic(name)}]</div>`,
            end: parsed.end,
          };
        }
      }
      return null;
    }
    default:
      return null;
  }
}

function renderWikiLink(inner: string, ctx: RenderContext): string {
  const trimmed = inner.trim();
  if (/^:(Posting|Feed|Tags|Include):/i.test(trimmed) || /^:(Posting|Feed|Tags)\b/i.test(trimmed)) {
    return `<span class="swe-preview-special">[${escapeHtmlBasic(trimmed)}]</span>`;
  }
  let textPart = trimmed;
  let arrows = '>';
  let target = trimmed;
  const sepIdx = trimmed.indexOf('>');
  if (sepIdx !== -1) {
    let runEnd = sepIdx;
    while (trimmed[runEnd] === '>') runEnd++;
    const runLen = runEnd - sepIdx;
    if (runLen >= 1 && runLen <= 3) {
      textPart = trimmed.slice(0, sepIdx) || trimmed.slice(runEnd).trim();
      arrows = trimmed.slice(sepIdx, runEnd);
      target = trimmed.slice(runEnd).trim();
    }
  }
  if (!target) {
    textPart = textPart || trimmed;
    target = trimmed;
    arrows = '>';
  }

  const openInNew = arrows.length >= 2;
  const extra = openInNew ? ' target="_blank"' : '';

  // 画像のみのリンクテキストは外側リンクで包んだimgにする(入れ子a防止)。
  // 外部URL直指定のときのみoutlinkを付与し、wiki内ページは素のaにする。
  const imageOnly = tryRenderImageToken(textPart, ctx);
  if (imageOnly !== null) {
    const href = resolveLinkTarget(target, ctx);
    if (href === null) return `<span class="swe-preview-special">${imageOnly}</span>`;
    const external = /^(https?:\/\/|ftp:\/\/)/i.test(target.trim())
      ? ' class="outlink" rel="nofollow"'
      : '';
    return `<a href="${escapeAttr(href)}"${external}${extra}>${imageOnly}</a>`;
  }

  // リンクテキスト自体が素URLの場合はプレーンテキスト化し(入れ子a防止)、
  // 50字超は省略する(実ページ通り)
  const textIsBareUrl = /^https?:\/\/\S+$/.test(textPart);
  const textHtml = textIsBareUrl
    ? escapeHtmlBasic(truncateLinkText(textPart))
    : renderInline(textPart, ctx);

  if (/^https?:\/\//i.test(target) || /^ftp:\/\//i.test(target)) {
    const href = sanitizeHref(target) ?? '#';
    // seesaawiki.jp内のURLは内部リンクとして素のaにする(実ページ通り)
    if (isSeesaawikiUrl(href)) {
      return `<a href="${escapeAttr(href)}"${extra}>${textHtml}</a>`;
    }
    return `<a href="${escapeAttr(href)}"${extra} class="outlink" rel="nofollow">${textHtml}</a>`;
  }
  if (target.startsWith('mailto:')) {
    return `<a href="${escapeAttr(target)}">${textHtml}</a>`;
  }
  if (target.startsWith('#')) {
    return `<a href="${escapeAttr(target)}">${textHtml}</a>`;
  }
  if (/^:(Feed|Tags|Posting):/i.test(target) || /^:(Feed|Tags)\b/i.test(target)) {
    return `<span class="swe-preview-special">${textHtml}[${escapeHtmlBasic(target)}]</span>`;
  }
  const href = resolveLinkTarget(target, ctx);
  if (href === null) {
    return `<span class="swe-preview-special">${textHtml}</span>`;
  }
  const pageName = splitPageAnchor(target).pageName;
  if (pageName && ctx.isExistingPage && !ctx.isExistingPage(pageName)) {
    const addUrl = ctx.getWikiAddUrl ? ctx.getWikiAddUrl(pageName) : null;
    return renderMissingPageHtml(textHtml, addUrl);
  }
  // 非同期の存在確認(preview.ts)用にページ名を付与する。比較時は無視される。
  const dataAttr = pageName ? ` data-wiki-page="${escapeAttr(pageName)}"` : '';
  return `<a href="${escapeAttr(href)}"${extra}${dataAttr}>${textHtml}</a>`;
}

function splitPageAnchor(target: string): { pageName: string; anchor: string } {
  const hashIdx = target.indexOf('#');
  if (hashIdx === -1) return { pageName: target, anchor: '' };
  return { pageName: target.slice(0, hashIdx), anchor: target.slice(hashIdx) };
}

function resolveLinkTarget(target: string, ctx: RenderContext): string | null {
  if (/^\s*(javascript|data|vbscript|file):/i.test(target)) return null;
  const { pageName, anchor } = splitPageAnchor(target);
  if (/^\s*(javascript|data|vbscript|file):/i.test(pageName)) return null;
  if (ctx.getWikiPageUrl && pageName) {
    try {
      return ctx.getWikiPageUrl(pageName) + anchor;
    } catch {
      return '#';
    }
  }
  if (!pageName && anchor) return anchor;
  return '#';
}

interface SplitCell {
  header: boolean;
  marker: '~' | '!' | null;
  format: string;
  rowFormat: string;
  content: string;
}

const CELL_PREFIX_RE =
  /^(left|center|right|top|middle|bottom|color\([^)]*\)|bgcolor\([^)]*\)|size\([^)]*\)|w\([^)]*\)|h\([^)]*\)):/;

const BARE_CELL_TOKEN_RE =
  /^(left|center|right|top|middle|bottom|color\([^)]*\)|bgcolor\([^)]*\)|size\([^)]*\)|w\([^)]*\)|h\([^)]*\))$/;

function splitCell(raw: string): SplitCell {
  let s = raw.trim();
  // r[...] 行書式(複数可)を先に取り出す
  let rowFormat = '';
  for (;;) {
    const m = s.match(/^r\[(.*?)\]:?/);
    if (!m) break;
    rowFormat += m[1].endsWith(':') ? m[1] : `${m[1]}:`;
    s = s.slice(m[0].length);
  }
  let header = false;
  let marker: '~' | '!' | null = null;
  if (s.startsWith('~') || s.startsWith('!')) {
    header = true;
    marker = s[0] as '~' | '!';
    s = s.slice(1);
  }
  let format = '';
  for (;;) {
    const m = s.match(CELL_PREFIX_RE);
    if (!m) break;
    format += m[0];
    s = s.slice(m[0].length);
  }
  // 末尾に残った単独トークン(|left| 等)も書式とみなす
  const bare = s.match(BARE_CELL_TOKEN_RE);
  if (bare && s !== '') {
    format += `${bare[1]}:`;
    s = '';
  }
  return { header, marker, format, rowFormat, content: s };
}

function isDirectiveRowLine(line: string): boolean {
  const { cells, isFormatRow } = splitTableRow(line);
  if (!isFormatRow) return false;
  return cells.map((c) => splitCell(c)).every((s) => s.content === '');
}

function cellStyleFromFormat(format: string): string {
  let rest = format;
  let bgcolor = '';
  let color = '';
  let fontSize = '';
  let align = '';
  let valign = '';
  let width = '';
  let height = '';
  for (;;) {
    const m = rest.match(CELL_PREFIX_RE);
    if (!m) break;
    const prefix = m[1];
    rest = rest.slice(m[0].length);
    if (prefix === 'left' || prefix === 'center' || prefix === 'right') {
      align = prefix;
    } else if (prefix === 'top' || prefix === 'middle' || prefix === 'bottom') {
      valign = prefix;
    } else if (prefix.startsWith('color(')) {
      const v = prefix.slice(6, -1).trim();
      if (v) color = v;
    } else if (prefix.startsWith('bgcolor(')) {
      const v = prefix.slice(8, -1).trim();
      if (v) bgcolor = v;
    } else if (prefix.startsWith('size(')) {
      const v = prefix.slice(5, -1).trim();
      if (v) fontSize = toFontSize(v);
    } else if (prefix.startsWith('w(')) {
      const v = prefix.slice(2, -1).trim();
      if (v) width = /^\d+$/.test(v) ? `${v}px` : v;
    } else if (prefix.startsWith('h(')) {
      const v = prefix.slice(2, -1).trim();
      if (v) height = /^\d+$/.test(v) ? `${v}px` : v;
    }
  }
  let style = '';
  if (bgcolor) style += `background-color:${bgcolor};`;
  if (color) style += `color:${color};`;
  if (fontSize) style += `font-size:${fontSize};`;
  if (align) style += `text-align:${align};`;
  if (valign) style += `vertical-align:${valign};`;
  if (width) style += `width:${width};`;
  if (height) style += `height:${height};`;
  return style;
}

interface TableCell {
  header: boolean;
  style: string;
  contentHtml: string;
  colspan: number;
  rowspan: number;
}

function parseTableAttrs(line: string): { style: string | null; cls: string | null } {
  const innerMatch = line.match(/^\{\|(.*)\}?\s*$/);
  if (!innerMatch) return { style: null, cls: null };
  const inner = innerMatch[1].replace(/\|\}\s*$/, '').trim();
  if (!inner) return { style: null, cls: null };
  const classMatch = inner.match(/class\s*=\s*"([^"]*)"/);
  const styleMatch = inner.match(/style\s*=\s*"([^"]*)"/);
  return {
    style: styleMatch ? styleMatch[1] : null,
    cls: classMatch ? classMatch[1] : null,
  };
}

function splitTableRow(line: string): { cells: string[]; isFormatRow: boolean } {
  const isFormatRow = /\|c\s*$/.test(line);
  const stripped = isFormatRow ? line.replace(/c\s*$/, '') : line;
  const parts = stripped.split('|');
  const cells = parts.slice(1, -1);
  return { cells, isFormatRow };
}

interface TableRow {
  cells: TableCell[];
  thead: boolean;
}

function buildTableRows(rowLines: string[], explicit: boolean, ctx: RenderContext): TableRow[] {
  // rowspan解決用に配置済みセルを覚える簡易グリッド
  const grid: (TableCell | null)[][] = [];
  const colFormats: string[] = [];

  const outRows: TableRow[] = [];

  rowLines.forEach((line) => {
    const { cells, isFormatRow } = splitTableRow(line);
    const splits = cells.map((c) => splitCell(c));
    if (isFormatRow && splits.every((s) => s.content === '')) {
      // 書式指定行: 描画せず、列ごとの既定書式として保持する
      splits.forEach((s, idx) => {
        colFormats[idx] = s.format;
      });
      return;
    }
    const r = outRows.length;
    while (grid.length <= r) grid.push([]);
    // 先頭セルが'~'なら行全体をヘッダにする(実ページ通り。'!'は単独セルのみ)
    const first = splits[0];
    const wholeRowHeader =
      first !== undefined &&
      first.marker === '~' &&
      first.content !== '' &&
      first.content !== '>' &&
      first.content !== '^';
    const rowFormat = splits.map((s) => s.rowFormat).join('');
    const rowStyle = cellStyleFromFormat(rowFormat);
    let c = 0;
    let pendingColspan = 0;
    const rowCells: TableCell[] = [];
    for (let k = 0; k < splits.length; k++) {
      const split = splits[k];
      // '>' は右に結合: 自身は描画せず次のセルにcolspanを付与する(実ページ通り)
      if (split.content === '>') {
        pendingColspan += 1;
        continue;
      }
      if (split.content === '^') {
        let found: TableCell | null = null;
        for (let rr = r - 1; rr >= 0; rr--) {
          if (grid[rr] && grid[rr][c]) {
            found = grid[rr][c];
            break;
          }
        }
        if (found) {
          found.rowspan += 1;
          c++;
          continue;
        }
        // 結合先が無ければドロップする(実ページ通り)
        continue;
      }
      // セル書式・行書式・列書式の順に連結する(実ページのstyle順)
      const style =
        cellStyleFromFormat(split.format) + rowStyle + cellStyleFromFormat(colFormats[c] ?? '');
      const cell: TableCell = {
        header: wholeRowHeader || split.header,
        style,
        contentHtml: renderInline(split.content, ctx),
        colspan: 1 + pendingColspan,
        rowspan: 1,
      };
      pendingColspan = 0;
      grid[r][c] = cell;
      rowCells.push(cell);
      c++;
    }
    const thead = explicit && outRows.length === 0 && wholeRowHeader;
    outRows.push({ cells: rowCells, thead });
  });

  return outRows;
}

function renderTable(
  rowLines: string[],
  attrs: { style: string | null; cls: string | null },
  explicit: boolean,
  ctx: RenderContext
): string {
  const rows = buildTableRows(rowLines, explicit, ctx);
  let html = `<table id="content_block_${ctx.blockNum}"`;
  if (attrs.style) html += ` style="${escapeAttr(attrs.style)}"`;
  if (attrs.cls) html += ` class="${escapeAttr(attrs.cls)}"`;
  html += '>';
  const theadRows = rows.filter((r) => r.thead);
  const bodyRows = rows.filter((r) => !r.thead);
  if (theadRows.length > 0) {
    html += '<thead>';
    for (const r of theadRows) html += renderTableRowCells(r);
    html += '</thead>';
  }
  html += '<tbody>';
  for (const r of bodyRows) html += renderTableRowCells(r);
  html += '</tbody></table>\n';
  return html;
}

function renderTableRowCells(row: TableRow): string {
  let html = '<tr>';
  for (const cell of row.cells) {
    const tag = cell.header ? 'th' : 'td';
    let attr = '';
    if (cell.colspan > 1) attr += ` colspan="${cell.colspan}"`;
    if (cell.rowspan > 1) attr += ` rowspan="${cell.rowspan}"`;
    if (cell.style) attr += ` style="${escapeAttr(cell.style)}"`;
    html += `<${tag}${attr}>${cell.contentHtml}</${tag}>`;
  }
  html += '</tr>';
  return html;
}

function renderToc(ctx: RenderContext, maxLevel: number): string {
  const items = ctx.headings.filter((h) => h.id !== null && h.level <= maxLevel);
  let html =
    '<div class="toc">\n<div class="wiki-catalog">\n<div class="wiki-catalog-inner">\n<ul>\n';
  // h3ごと＋配下h4にグループ化し、h4が無いh3には入れ子ulを作らない
  const groups: { h3: (typeof items)[number] | null; h4s: (typeof items)[number][] }[] = [];
  for (const h of items) {
    if (h.level === 1) {
      groups.push({ h3: h, h4s: [] });
    } else if (h.level === 2) {
      if (groups.length === 0) groups.push({ h3: null, h4s: [] });
      groups[groups.length - 1].h4s.push(h);
    }
  }
  for (const g of groups) {
    if (g.h3) {
      const label = renderInline(g.h3.raw.trim() || '(無題)', ctx);
      if (g.h4s.length === 0) {
        html += `<li class="list-1"><a href="#${escapeAttr(g.h3.id as string)}">${label}</a></li>\n`;
      } else {
        html += `<li class="list-1"><a href="#${escapeAttr(g.h3.id as string)}">${label}</a>\n<ul>\n`;
        for (const h of g.h4s) {
          const sub = renderInline(h.raw.trim() || '(無題)', ctx);
          html += `<li class="list-2"><a href="#${escapeAttr(h.id as string)}">${sub}</a></li>\n`;
        }
        html += '</ul>\n</li>\n';
      }
    } else {
      html += '<li class="list-1">\n<ul>\n';
      for (const h of g.h4s) {
        const sub = renderInline(h.raw.trim() || '(無題)', ctx);
        html += `<li class="list-2"><a href="#${escapeAttr(h.id as string)}">${sub}</a></li>\n`;
      }
      html += '</ul>\n</li>\n';
    }
  }
  html += '</ul>\n</div>\n</div>\n</div>\n';
  return html;
}

interface ListItem {
  ordered: boolean;
  level: number;
  contentHtml: string;
}

function renderListGroup(items: ListItem[], bid: number | null): string {
  let html = '';
  const stack: { ordered: boolean; level: number }[] = [];
  let idEmitted = bid === null;
  const openList = (ordered: boolean, level: number): void => {
    const tag = ordered ? 'ol' : 'ul';
    if (!idEmitted && bid !== null) {
      html += `<${tag} id="content_block_${bid}" class="list-${level}">\n`;
      idEmitted = true;
    } else {
      html += `<${tag} class="list-${level}">\n`;
    }
    stack.push({ ordered, level });
  };
  const closeTop = (): void => {
    const top = stack.pop();
    if (!top) return;
    html += '</li>\n';
    html += top.ordered ? '</ol>\n' : '</ul>\n';
  };

  for (const item of items) {
    while (stack.length > 0 && stack[stack.length - 1].level > item.level) {
      closeTop();
    }
    const top = stack[stack.length - 1];
    if (top && top.level === item.level) {
      if (top.ordered !== item.ordered) {
        html += '</li>\n';
        const popped = stack.pop();
        html += popped?.ordered ? '</ol>\n' : '</ul>\n';
        openList(item.ordered, item.level);
      } else {
        html += '</li>\n';
      }
      html += `<li>${item.contentHtml}`;
    } else {
      let base = top ? top.level : 0;
      while (base < item.level) {
        openList(item.ordered, base + 1);
        base++;
        if (base < item.level) html += '<li>';
      }
      html += `<li>${item.contentHtml}`;
    }
  }
  while (stack.length > 0) closeTop();
  return html;
}

function renderToggle(
  titleRaw: string,
  inner: string[],
  open: boolean,
  ctx: RenderContext
): string {
  const bid = ++ctx.blockNum;
  const region = ++ctx.regionNum;
  const cls = open ? 'toggle-link-close' : 'toggle-link-open';
  const titleHtml = titleRaw ? renderInline(titleRaw, ctx) : '';
  ctx.inToggle++;
  let innerHtml = renderFlow(inner, ctx, false);
  ctx.inToggle--;
  // トグル末尾の<br />を1つ吸収する(実ページ通り)
  innerHtml = chompTrailingBr(innerHtml);
  const displayAttr = open ? '' : ' style="display:none"';
  return (
    `<div id="content_block_${bid}">\n` +
    `<div class="toggle-title"><a id="region_plugin_content_${region}" data-swe-toggle="content_block_${bid}-inside" class="${cls}"><img src="${SPACER_GIF_URL}" width="17" height="17" alt="" /></a><p>${titleHtml}</p></div>\n` +
    `<div${displayAttr} id="content_block_${bid}-inside" class="toggle-display">\n` +
    `${innerHtml}</div>\n</div>\n`
  );
}

function chompTrailingBr(html: string): string {
  // 末尾の </div> 群(</div> / </div>\nの連続)を越えて直前の<br />を1つ吸収する
  const DIV_NL = '</div>\n';
  const DIV = '</div>';
  const BR = '<br />\n';
  let end = html.length;
  for (;;) {
    if (end >= DIV_NL.length && html.slice(end - DIV_NL.length, end) === DIV_NL) {
      end -= DIV_NL.length;
    } else if (end >= DIV.length && html.slice(end - DIV.length, end) === DIV) {
      end -= DIV.length;
    } else {
      break;
    }
  }
  const divs = html.slice(end);
  if (end >= BR.length && html.slice(end - BR.length, end) === BR) {
    return html.slice(0, end - BR.length) + divs;
  }
  return html;
}

function renderFlow(lines: string[], ctx: RenderContext, isTop = true, quoteMode = false): string {
  let html = '';
  let i = 0;
  let sectionOpen = false;
  // 直前の行種別。table/quote開始時のchomp判定に使う。
  let prevKind: 'text' | 'blank' | 'block' | 'start' = 'start';
  const closeSection = (): void => {
    if (sectionOpen) {
      html += '</div></div>\n';
      sectionOpen = false;
    }
  };
  // 直前の<br />を1つ吸収する。末尾の </div> 群(閉じたセクション)を越えて探す。
  const chompOneBr = (): void => {
    html = chompTrailingBr(html);
  };

  while (i < lines.length) {
    const line = lines[i];

    const headingMatch = line.match(/^(\*{1,3})(?!\*)(.*)$/);
    if (headingMatch) {
      // セクションを閉じる際に直前の<br />を1つ吸収する(実ページ通り)。
      // 先頭見出し(セクション未生成)の前は吸収しない。
      if (sectionOpen) chompOneBr();
      closeSection();
      const level = headingMatch[1].length as 1 | 2 | 3;
      const raw = headingMatch[2].trim();
      const tag = level === 1 ? 'h3' : level === 2 ? 'h4' : 'h5';
      const headingId = takeHeadingId(ctx, level, raw);
      const bid = ++ctx.blockNum;
      const idAttr = headingId ? ` id="${escapeAttr(headingId)}"` : '';
      html +=
        `<div id="content_block_${bid}" class="wiki-section-${level}">` +
        `<div class="title-${level}"><${tag}${idAttr}>${renderInline(raw, ctx)}</${tag}></div>\n` +
        `<div id="content_block_${bid}-body" class="wiki-section-body-${level}">\n`;
      sectionOpen = true;
      prevKind = 'block';
      i++;
      continue;
    }

    const preMatch = line.match(/^=\|([^|]*)\|\s*$/);
    if (preMatch) {
      const kind = preMatch[1].trim() || 'BOX';
      const buf: string[] = [];
      let j = i + 1;
      while (j < lines.length && !/^\|\|=\s*$/.test(lines[j])) {
        buf.push(lines[j]);
        j++;
      }
      const bid = ++ctx.blockNum;
      html += `<pre id="content_block_${bid}" class="${escapeAttr(kind)}">\n${escapeHtmlBasic(buf.join('\n'))}\n</pre>\n`;
      prevKind = 'block';
      i = j + 1;
      continue;
    }

    const foldMatch = line.match(/^\[(\+|-)\](.*)$/);
    if (foldMatch) {
      const open = foldMatch[1] === '-';
      const titleRaw = foldMatch[2].trim();
      let j = i + 1;
      let depth = 1;
      const inner: string[] = [];
      while (j < lines.length) {
        if (/^\[(\+|-)\]/.test(lines[j])) {
          depth++;
          inner.push(lines[j]);
          j++;
          continue;
        }
        if (/^\[END\]/.test(lines[j])) {
          depth--;
          if (depth === 0) {
            j++;
            break;
          }
          inner.push(lines[j]);
          j++;
          continue;
        }
        inner.push(lines[j]);
        j++;
      }
      html += renderToggle(titleRaw, inner, open, ctx);
      prevKind = 'block';
      i = j;
      continue;
    }

    if (/^\[END\]/.test(line)) {
      prevKind = 'block';
      i++;
      continue;
    }

    if (/^\{\|/.test(line)) {
      const attrs = parseTableAttrs(line);
      const rowLines: string[] = [];
      let j = i + 1;
      while (j < lines.length && !/^\|\}\s*$/.test(lines[j])) {
        rowLines.push(lines[j]);
        j++;
      }
      ctx.blockNum++;
      const tableRows = rowLines.filter((l) => /^\|/.test(l));
      const others = rowLines.filter((l) => !/^\|/.test(l) && l.trim() !== '');
      // 書式指定行で始まる表は直前の<br />を1つ吸収する(実ページ通り)。
      // それ以外の表は本文直後の場合のみ吸収する。
      if (
        (tableRows.length > 0 && isDirectiveRowLine(tableRows[0])) ||
        prevKind === 'text'
      ) {
        chompOneBr();
      }
      if (tableRows.length > 0) {
        html += renderTable(tableRows, attrs, true, ctx);
      }
      if (others.length > 0) {
        html += renderFlow(others, ctx, false);
      }
      prevKind = 'block';
      i = j + 1;
      continue;
    }

    if (/^\|\}\s*$/.test(line)) {
      prevKind = 'block';
      i++;
      continue;
    }

    if (/^\|/.test(line)) {
      const rowLines: string[] = [];
      let j = i;
      while (j < lines.length && /^\|/.test(lines[j])) {
        rowLines.push(lines[j]);
        j++;
      }
      ctx.blockNum++;
      if (
        (rowLines.length > 0 && isDirectiveRowLine(rowLines[0])) ||
        prevKind === 'text'
      ) {
        chompOneBr();
      }
      html += renderTable(rowLines, { style: null, cls: null }, false, ctx);
      prevKind = 'block';
      i = j;
      continue;
    }

    if (/^----\s*$/.test(line)) {
      html += '<hr />\n';
      prevKind = 'block';
      i++;
      continue;
    }

    if (/^\/\//.test(line)) {
      i++;
      continue;
    }

    const contentsMatch = line.match(/^[&#]?contents(?:\((\d)\))?\s*$/i) ?? line.match(/^#contents(?:\(((?:1|2))\))?\s*$/);
    if (/^[&#]?contents(\(\d\))?\s*$/i.test(line) || /^#contents(\((1|2)\))?\s*$/.test(line)) {
      const depthArg = contentsMatch?.[1];
      const maxLevel = depthArg === '1' ? 1 : depthArg === '2' ? 2 : 3;
      html += renderToc(ctx, maxLevel);
      prevKind = 'block';
      i++;
      continue;
    }

    const listMatch = line.match(/^(-{1,3}|\+{1,3})(?!-)(.*)$/);
    if (listMatch && !/^----/.test(line)) {
      const items: ListItem[] = [];
      let j = i;
      while (j < lines.length) {
        const m = lines[j].match(/^(-{1,3}|\+{1,3})(?!-)(.*)$/);
        if (!m || /^----/.test(lines[j])) break;
        const marker = m[1];
        const ordered = marker[0] === '+';
        items.push({
          ordered,
          level: marker.length,
          contentHtml: renderInline(m[2].trim(), ctx),
        });
        j++;
      }
      ctx.blockNum++;
      // リスト開始時は直前の<br />を1つ吸収する(実ページ通り)
      chompOneBr();
      html += renderListGroup(items, ctx.blockNum);
      prevKind = 'block';
      i = j;
      continue;
    }

    const defMatch = line.match(/^:(.*)$/);
    if (defMatch) {
      let j = i;
      const bid = ++ctx.blockNum;
      let dl = `<dl id="content_block_${bid}">\n`;
      while (j < lines.length) {
        const m = lines[j].match(/^:(.*)$/);
        if (!m) break;
        const body = m[1];
        const sep = body.indexOf('|');
        if (sep === -1) {
          dl += `<dt>${renderInline(body.trim(), ctx)}</dt>`;
        } else {
          dl += `<dt>${renderInline(body.slice(0, sep).trim(), ctx)}</dt><dd>${renderInline(body.slice(sep + 1).trim(), ctx)}</dd>`;
        }
        dl += '\n';
        j++;
      }
      dl += '</dl>\n';
      html += dl;
      prevKind = 'block';
      i = j;
      continue;
    }

    const quoteMatch = line.match(/^(>+| +)(.*)$/);
    if (quoteMatch) {
      const inner: string[] = [];
      let j = i;
      while (j < lines.length) {
        const m = lines[j].match(/^(>+| +)(.*)$/);
        if (!m) break;
        let stripped = lines[j];
        if (stripped.startsWith('>')) {
          stripped = stripped.replace(/^>+/, '');
          if (stripped.startsWith(' ')) stripped = stripped.slice(1);
        } else {
          stripped = stripped.replace(/^ +/, '');
        }
        inner.push(stripped);
        j++;
      }
      const bid = ++ctx.blockNum;
      // 本文直後の引用は直前の<br />を1つ吸収する(実ページ通り)
      if (prevKind === 'text') chompOneBr();
      let quoteHtml = renderFlow(inner, ctx, false, true);
      // 引用末尾の<br />を1つ吸収する(実ページ通り)
      quoteHtml = chompTrailingBr(quoteHtml);
      html += `<blockquote id="content_block_${bid}">\n${quoteHtml}</blockquote>\n`;
      prevKind = 'block';
      i = j;
      continue;
    }

    if (/^\s*$/.test(line)) {
      // 文書末尾まで空行・コメントのみなら何も出さない(実ページ通り)。
      // 内側フローでは通常通り出力し、閉じ側の吸収に任せる。
      if (isTop) {
        let k = i;
        while (k < lines.length && (/^\s*$/.test(lines[k]) || /^\/\//.test(lines[k]))) k++;
        if (k >= lines.length) {
          i = lines.length;
          continue;
        }
      }
      html += '<br />\n';
      prevKind = 'blank';
      i++;
      continue;
    }

    // 本文行・&aname単独行: 常に<br />を付ける(行末~~は~~自体が改行を兼ねる)。
    // 引用内では<br />の代わりにスペース連結する(実ページ通り)。
    // 直後の見出し・リスト等が見えた段階で1つ吸収される。
    if (quoteMode) {
      const seg = renderInline(line, ctx);
      html += seg + (seg.endsWith('<br />') ? '\n' : ' ');
    } else if (!/~~[ \t]*$/.test(line)) {
      html += `${renderInline(line, ctx)}<br />\n`;
    } else {
      html += `${renderInline(line, ctx)}\n`;
    }
    prevKind = 'text';
    i++;
  }
  // 引用末尾の連結スペースを除去する
  if (quoteMode && html.endsWith(' ')) html = html.slice(0, -1);
  closeSection();
  return html;
}

function scanHeadings(lines: string[], ctx: RenderContext): void {
  // トグル内の見出しはcontent_系idを持たない(実ページ通り)。カウンタも消費しない。
  let foldDepth = 0;
  let inPre = false;
  const push = (level: 1 | 2 | 3, raw: string, id: string | null): void => {
    ctx.headings.push({ level, raw, id });
    const key = `${level} ${raw}`;
    const list = ctx.headingIds.get(key) ?? [];
    list.push(id);
    ctx.headingIds.set(key, list);
  };
  for (const line of lines) {
    if (inPre) {
      if (/^\|\|=\s*$/.test(line)) inPre = false;
      continue;
    }
    if (/^=\|[^|]*\|\s*$/.test(line)) {
      inPre = true;
      continue;
    }
    if (/^\[(\+|-)\]/.test(line)) {
      foldDepth++;
      continue;
    }
    if (/^\[END\]/.test(line)) {
      foldDepth = Math.max(0, foldDepth - 1);
      continue;
    }
    const m = line.match(/^(\*{1,3})(?!\*)(.*)$/);
    if (!m) continue;
    const level = m[1].length as 1 | 2 | 3;
    const raw = m[2].trim();
    if (foldDepth > 0) {
      push(level, raw, null);
      continue;
    }
    if (level === 1) {
      ctx.h3ord += 1;
      ctx.lastH3 = ctx.h3ord;
      push(level, raw, `content_${ctx.h3ord}`);
    } else if (level === 2) {
      ctx.h4seq += 1;
      ctx.lastH4 = ctx.h4seq;
      push(level, raw, `content_${ctx.lastH3 || 1}_${ctx.h4seq}`);
    } else {
      ctx.h5seq += 1;
      push(level, raw, `content_${ctx.lastH3 || 1}_${ctx.lastH4 || 0}_${ctx.h5seq}`);
    }
  }
}

function takeHeadingId(ctx: RenderContext, level: 1 | 2 | 3, raw: string): string {
  if (ctx.inToggle > 0) return '';
  const key = `${level} ${raw}`;
  const list = ctx.headingIds.get(key);
  if (list && list.length > 0) {
    const id = list.shift();
    if (id) return id;
    return '';
  }
  ctx.fallbackSeq += 1;
  return `content-x${ctx.fallbackSeq}`;
}

export function renderSeesaawikiToHtml(
  source: string,
  options: PreviewRenderOptions = {}
): string {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  // 末尾の改行由来の空行1つは除去する(実ページも末尾<br />を出さない)
  if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
  const ctx: RenderContext = {
    getWikiPageUrl: options.getWikiPageUrl ?? null,
    isExistingPage: options.isExistingPage ?? null,
    getWikiAddUrl: options.getWikiAddUrl ?? null,
    footnotes: [],
    headings: [],
    headingIds: new Map(),
    h3ord: 0,
    h4seq: 0,
    h5seq: 0,
    lastH3: 0,
    lastH4: 0,
    blockNum: 0,
    regionNum: 0,
    inToggle: 0,
    fallbackSeq: 0,
  };
  scanHeadings(lines, ctx);
  let body = renderFlow(lines, ctx);
  let footnotesHtml = '';
  if (ctx.footnotes.length > 0) {
    // フッター直前の<br />を1つ吸収する(実ページ通り)
    body = chompTrailingBr(body);
    footnotesHtml = '<div class="footer-footnote">\n<hr />\n<ul class="list-1">\n';
    ctx.footnotes.forEach((note, idx) => {
      const num = idx + 1;
      footnotesHtml += `<li><a href="#footnote${num}" name="footer-footnote${num}">*${num} </a> : ${note.html}</li>\n`;
    });
    footnotesHtml += '</ul>\n</div>\n';
  }
  return body + footnotesHtml;
}
