export class SeesaaWikiDocumentSymbolProvider {
  constructor(monaco) {
    this.monaco = monaco;
  }

  provideDocumentSymbols(model) {
    const documentSymbols = [];
    let symbol;
    const lastUnclosedHeadingSymbol = [null, null, null];
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
          range,
          selectionRange: range,
          children: [],
        };

        for (let level = headingLevel; level <= 3; level++) {
          if (lastUnclosedHeadingSymbol[level - 1] !== null) {
            lastUnclosedHeadingSymbol[level - 1].range.endLineNumber = lineIndex - 1;
            lastUnclosedHeadingSymbol[level - 1].range.endColumn = model.getLineMaxColumn(lineIndex - 1);
            lastUnclosedHeadingSymbol[level - 1] = null;
          }
        }

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
