import type { DecodeHTMLEntitiesFn } from '../utils/encoding.js';

export interface DiffContent {
  oldContent: string;
  newContent: string;
}

export function extractDiffContent(
  innerHTML: string,
  decodeHTMLEntities: DecodeHTMLEntitiesFn
): DiffContent {
  innerHTML = innerHTML.replace(/<br>|<\/span>/g, '');
  innerHTML = decodeHTMLEntities(innerHTML, { stripAnchors: true });
  innerHTML = innerHTML.replace(/(?:<\/span>\s*)+$/g, '');

  const oldContent = innerHTML.replace(
    /<span class="line-add">.*?\n|<span class="line-delete">/g,
    ''
  );
  const newContent = innerHTML.replace(
    /<span class="line-delete">.*?\n|<span class="line-add">/g,
    ''
  );

  return { oldContent, newContent };
}
