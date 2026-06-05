import type * as monacoNs from 'monaco-editor';

type MonacoNamespace = typeof monacoNs;
type Model = monacoNs.editor.ITextModel;
type DocumentSymbol = monacoNs.languages.DocumentSymbol;

export class SeesaaWikiDocumentSymbolProvider
  implements monacoNs.languages.DocumentSymbolProvider
{
  private readonly monaco: MonacoNamespace;

  constructor(monaco: MonacoNamespace) {
    this.monaco = monaco;
  }

  provideDocumentSymbols(model: Model): DocumentSymbol[] {
    const documentSymbols: DocumentSymbol[] = [];
    let symbol: DocumentSymbol;
    const lastUnclosedHeadingSymbol: (DocumentSymbol | null)[] = [null, null, null];
    const headingRegex = /^\*{0,3}/;

    for (let lineIndex = 1; lineIndex <= model.getLineCount(); lineIndex++) {
      const lineContent = model.getLineContent(lineIndex);
      const headingMatch = lineContent.match(headingRegex);
      const headingLevel = (headingMatch && headingMatch[0].length) || 0;

      if (headingLevel) {
        const range = {
          startLineNumber: lineIndex,
          startColumn: 1,
          endLineNumber: lineIndex,
          endColumn: lineContent.length + 1,
        };

        symbol = {
          name: lineContent,
          detail: 'Heading ' + String(headingLevel),
          kind: this.monaco.languages.SymbolKind.String,
          tags: [],
          range,
          selectionRange: range,
          children: [],
        };

        for (let level = headingLevel; level <= 3; level++) {
          const unclosed = lastUnclosedHeadingSymbol[level - 1];
          if (unclosed !== null) {
            const updatedRange = {
              ...unclosed.range,
              endLineNumber: lineIndex - 1,
              endColumn: model.getLineMaxColumn(lineIndex - 1),
            };
            unclosed.range = updatedRange;
            unclosed.selectionRange = updatedRange;
            lastUnclosedHeadingSymbol[level - 1] = null;
          }
        }

        let childFlag = false;
        for (let j = headingLevel - 1; j > 0; j--) {
          const parent = lastUnclosedHeadingSymbol[j - 1];
          if (parent !== null) {
            parent.children!.push(symbol);
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

    const lastLineNum = model.getLineCount();
    for (const level of [1, 2, 3]) {
      const unclosed = lastUnclosedHeadingSymbol[level - 1];
      if (unclosed !== null) {
        const updatedRange = {
          ...unclosed.range,
          endLineNumber: lastLineNum,
          endColumn: model.getLineMaxColumn(lastLineNum),
        };
        unclosed.range = updatedRange;
        unclosed.selectionRange = updatedRange;
      }
    }

    return documentSymbols;
  }
}
