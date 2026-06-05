import type * as monacoNs from 'monaco-editor';
import { context } from './context.js';

type MonacoNamespace = typeof monacoNs;

export function setupSeesaawikiHoverProvider(monaco: MonacoNamespace): void {
  const imageUrlRegex =
    /(https?:\/\/)([a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}(\/[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;%=]+)?\.(png|jpg|jpeg|gif|webp)(\?[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;%=]+)?/gi;

  monaco.languages.registerHoverProvider('seesaawiki', {
    provideHover(model, position) {
      const lineContent = model.getLineContent(position.lineNumber);

      let match: RegExpExecArray | null;
      imageUrlRegex.lastIndex = 0;
      while ((match = imageUrlRegex.exec(lineContent)) !== null) {
        const startIndex = match.index + 1;
        const endIndex = startIndex + match[0].length;

        if (position.column >= startIndex && position.column <= endIndex) {
          return {
            range: new monaco.Range(
              position.lineNumber,
              startIndex,
              position.lineNumber,
              endIndex
            ),
            contents: [
              { value: '**Image Preview**' },
              {
                value: `<img src="${match[0]}" alt="Image preview" height=200>`,
                supportHtml: true,
                isTrusted: true,
              },
            ],
          };
        }
      }

      if (!context.decodeHTMLEntities) return null;

      const escapeRegex = /&(?:#(\d+)|([a-zA-Z]+));/g;
      while ((match = escapeRegex.exec(lineContent)) !== null) {
        const startIndex = match.index + 1;
        const endIndex = startIndex + match[0].length;

        if (position.column >= startIndex && position.column <= endIndex) {
          const originalEntity = match[0];
          const decodedChar = context.decodeHTMLEntities(originalEntity);
          let description: string | undefined;

          if (match[1]) {
            description = 'Decimal Character Reference';
          } else if (match[2]) {
            description = 'Named Character Reference';
          }

          const unicode = decodedChar.charCodeAt(0).toString(16).toUpperCase().padStart(4, '0');

          return {
            range: new monaco.Range(
              position.lineNumber,
              startIndex,
              position.lineNumber,
              endIndex
            ),
            contents: [
              { value: `**${description}**` },
              { value: `Character: ${decodedChar}` },
              { value: `Unicode: U+${unicode}` },
            ],
          };
        }
      }

      return null;
    },
  });
}
