import type { DecodeHTMLEntitiesFn } from '../utils/encoding.js';

const lineAddMarker = '';
const lineDeleteMarker = '';

export interface DiffContent {
  oldContent: string;
  newContent: string;
}

export function extractDiffContent(
  innerHTML: string,
  decodeHTMLEntities: DecodeHTMLEntitiesFn
): DiffContent {
  innerHTML = innerHTML.replace(
    /<br\s*\/?>|<\/span>|<span class="line-add">|<span class="line-delete">/g,
    (tag) => {
      if (tag.endsWith('line-add">')) return lineAddMarker;
      if (tag.endsWith('line-delete">')) return lineDeleteMarker;
      return '';
    }
  );
  innerHTML = decodeHTMLEntities(innerHTML, { stripAnchors: true });

  const oldContent = innerHTML.replace(
    new RegExp(`${lineAddMarker}.*?\n|${lineDeleteMarker}`, 'g'),
    ''
  );
  const newContent = innerHTML.replace(
    new RegExp(`${lineDeleteMarker}.*?\n|${lineAddMarker}`, 'g'),
    ''
  );

  return { oldContent, newContent };
}
