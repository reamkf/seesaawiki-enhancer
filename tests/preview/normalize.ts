// 実ページHTMLとプレビュー出力を構造比較するための正規化ヘルパー。
// カウンタ由来のID(content_block_N等)や編集用リンクの差異を吸収する。
const VOID_ELEMENTS = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr',
]);

const DROP_ATTRS = new Set(['onclick', 'data-swe-toggle', 'data-wiki-page']);

function rewriteIdRefs(value: string): string {
  return value
    .replace(/content_block_\d+/g, 'content_block_#')
    .replace(/region_plugin_content_\d+/g, 'region_plugin_content_#')
    .replace(/\bcontent_\d+(?:_\d+)*\b/g, 'content_#');
}

function canonNode(node: Node): string {
  if (node.nodeType === 3) {
    const text = (node.textContent ?? '').replace(/[ \t\r\n\f\v]+/g, ' ').trim();
    return text;
  }
  if (node.nodeType !== 1) return '';
  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  // プレビュー用の付加属性(遅延読込・はみ出し防止)は実ページに無いため比較対象外
  const dropForMedia =
    tag === 'img' || tag === 'video' || tag === 'iframe' || tag === 'audio'
      ? new Set(['loading', 'style', 'preload'])
      : new Set<string>();
  const attrs: string[] = [];
  for (const name of el.getAttributeNames()) {
    const lower = name.toLowerCase();
    if (DROP_ATTRS.has(lower) || dropForMedia.has(lower)) continue;
    let value = el.getAttribute(name) ?? '';
    if (name === 'id' || name === 'href') value = rewriteIdRefs(value);
    attrs.push(`${name}="${value}"`);
  }
  attrs.sort();
  const open = attrs.length > 0 ? `<${tag} ${attrs.join(' ')}>` : `<${tag}>`;
  if (VOID_ELEMENTS.has(tag)) {
    return attrs.length > 0 ? `<${tag} ${attrs.join(' ')} />` : `<${tag} />`;
  }
  let inner = '';
  for (const child of Array.from(el.childNodes)) {
    if (
      child.nodeType === 1 &&
      (child as Element).classList?.contains('part-edit')
    ) {
      continue;
    }
    if (child.nodeType === 1) {
      const childTag = (child as Element).tagName.toLowerCase();
      if (childTag === 'script' || childTag === 'style') continue;
    }
    inner += canonNode(child);
  }
  void open;
  const openTag = attrs.length > 0 ? `<${tag} ${attrs.join(' ')}>` : `<${tag}>`;
  return `${openTag}${inner}</${tag}>`;
}

export function normalizePreviewHtml(html: string): string {
  const doc = new DOMParser().parseFromString(
    `<body><div id="swe-normalize-root">${html}</div></body>`,
    'text/html'
  );
  const root = doc.getElementById('swe-normalize-root');
  if (!root) return '';
  let out = '';
  for (const child of Array.from(root.childNodes)) {
    out += canonNode(child);
  }
  return out;
}
