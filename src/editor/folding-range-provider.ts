import type * as monacoNs from 'monaco-editor';

type MonacoNamespace = typeof monacoNs;
type Model = monacoNs.editor.ITextModel;

export interface SeesaawikiFoldingRange {
  start: number;
  end: number;
}

export function computeSeesaawikiFoldingRanges(
  lines: string[]
): SeesaawikiFoldingRange[] {
  const ranges: SeesaawikiFoldingRange[] = [];
  const headingStartLine: number[] = [-1, -1, -1];
  const headingInFoldingStartLine: number[] = [-1, -1, -1];
  const foldingStartLine: number[] = [];
  const lineCount = lines.length;
  const headingRegex = /^\*{0,3}/;
  const foldingOpenRegex = /^\[(\+|-)\]/;
  const foldingCloseRegex = /^\[END\]/;

  for (let i = 0; i < lineCount; i++) {
    const lineNum = i + 1;
    const text = lines[i];
    const headingMatch = text.match(headingRegex);
    const headingLevel = (headingMatch && headingMatch[0].length) || 0;

    if (headingLevel) {
      for (let level = headingLevel; level <= 3; level++) {
        if (headingStartLine[level - 1] !== -1) {
          ranges.push({
            start: headingStartLine[level - 1],
            end: lineNum - 1,
          });
          headingStartLine[level - 1] = -1;
          headingInFoldingStartLine[level - 1] = -1;
        }
      }
      headingStartLine[headingLevel - 1] = lineNum;
      if (foldingStartLine.length) {
        headingInFoldingStartLine[headingLevel - 1] =
          foldingStartLine[foldingStartLine.length - 1];
      }
    } else if (foldingOpenRegex.test(text)) {
      foldingStartLine.push(lineNum);
    } else if (foldingCloseRegex.test(text)) {
      if (foldingStartLine.length) {
        const start = foldingStartLine.pop();
        if (start !== undefined) {
          ranges.push({ start, end: lineNum });
          for (let level = 1; level <= 3; level++) {
            if (headingInFoldingStartLine[level - 1] === start) {
              ranges.push({
                start: headingStartLine[level - 1],
                end: lineNum - 1,
              });
              headingStartLine[level - 1] = -1;
              headingInFoldingStartLine[level - 1] = -1;
            }
          }
        }
      }
    }
  }

  for (let level = 1; level <= 3; level++) {
    if (headingStartLine[level - 1] !== -1) {
      ranges.push({ start: headingStartLine[level - 1], end: lineCount });
    }
  }
  while (foldingStartLine.length) {
    const start = foldingStartLine.pop();
    if (start !== undefined) {
      ranges.push({ start, end: lineCount });
    }
  }

  return ranges;
}

export class SeesaaWikiFoldingRangeProvider
  implements monacoNs.languages.FoldingRangeProvider
{
  private readonly monaco: MonacoNamespace;

  constructor(monaco: MonacoNamespace) {
    this.monaco = monaco;
  }

  provideFoldingRanges(model: Model): monacoNs.languages.FoldingRange[] {
    const lineCount = model.getLineCount();
    const lines: string[] = new Array(lineCount);
    for (let i = 1; i <= lineCount; i++) {
      lines[i - 1] = model.getLineContent(i);
    }
    return computeSeesaawikiFoldingRanges(lines).map((r) => ({
      start: r.start,
      end: r.end,
      kind: this.monaco.languages.FoldingRangeKind.Region,
    }));
  }
}
