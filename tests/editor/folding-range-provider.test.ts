import { describe, it, expect } from 'bun:test';
import { computeSeesaawikiFoldingRanges } from '../../src/editor/folding-range-provider.js';

const fold = (text: string) =>
  computeSeesaawikiFoldingRanges(text.split('\n'));

describe('computeSeesaawikiFoldingRanges', () => {
  it('returns an empty array for an empty document', () => {
    expect(computeSeesaawikiFoldingRanges([])).toEqual([]);
  });

  it('returns an empty array when there are no foldable constructs', () => {
    expect(fold(['plain', 'text', 'lines'].join('\n'))).toEqual([]);
  });

  describe('simple [+]...[END]', () => {
    it('produces a single range from [+] to [END]', () => {
      const ranges = fold(['[+]Title', 'content', '[END]'].join('\n'));
      expect(ranges).toEqual([{ start: 1, end: 3 }]);
    });

    it('also recognises [-] as the opening marker', () => {
      const ranges = fold(['[-]Title', 'content', '[END]'].join('\n'));
      expect(ranges).toEqual([{ start: 1, end: 3 }]);
    });
  });

  describe('nested foldings', () => {
    it('produces ranges for outer and inner blocks', () => {
      const ranges = fold(
        [
          '[+]Outer', // 1
          '[+]Inner', // 2
          'content', // 3
          '[END]', // 4 — closes Inner
          '[END]', // 5 — closes Outer
        ].join('\n')
      );
      expect(ranges).toEqual([
        { start: 2, end: 4 },
        { start: 1, end: 5 },
      ]);
    });

    it('handles three levels of nesting', () => {
      const ranges = fold(
        [
          '[+]A', // 1
          '[+]B', // 2
          '[+]C', // 3
          'x', // 4
          '[END]', // 5 — closes C
          '[END]', // 6 — closes B
          '[END]', // 7 — closes A
        ].join('\n')
      );
      expect(ranges).toEqual([
        { start: 3, end: 5 },
        { start: 2, end: 6 },
        { start: 1, end: 7 },
      ]);
    });
  });

  describe('missing [END]', () => {
    it('extends the range to the last line when [END] is missing', () => {
      const ranges = fold(
        ['[+]Title', 'content1', 'content2'].join('\n')
      );
      expect(ranges).toEqual([{ start: 1, end: 3 }]);
    });

    it('extends both ranges to the last line when all [END] tags are missing', () => {
      const ranges = fold(
        [
          '[+]Outer', // 1
          '[+]Inner', // 2
          'content', // 3
        ].join('\n')
      );
      // Stack is popped LIFO at EOF: Inner first, then Outer.
      expect(ranges).toEqual([
        { start: 2, end: 3 },
        { start: 1, end: 3 },
      ]);
    });
  });

  describe('nested with missing [END]', () => {
    it('closes the inner block normally and extends the outer block to EOF', () => {
      const ranges = fold(
        [
          '[+]Outer', // 1
          '[+]Inner', // 2
          'content', // 3
          '[END]', // 4 — closes Inner
          'tail', // 5
        ].join('\n')
      );
      expect(ranges).toEqual([
        { start: 2, end: 4 },
        { start: 1, end: 5 },
      ]);
    });

    it('handles three-level nesting where the outermost [END] is missing', () => {
      const ranges = fold(
        [
          '[+]A', // 1
          '[+]B', // 2
          '[+]C', // 3
          'x', // 4
          '[END]', // 5 — closes C
          '[END]', // 6 — closes B
          'tail', // 7
        ].join('\n')
      );
      expect(ranges).toEqual([
        { start: 3, end: 5 },
        { start: 2, end: 6 },
        { start: 1, end: 7 },
      ]);
    });
  });

  describe('headings', () => {
    it('produces a heading range that ends before the next sibling heading', () => {
      const ranges = fold(
        [
          '*A', // 1
          'body', // 2
          '*B', // 3
          'body', // 4
        ].join('\n')
      );
      expect(ranges).toEqual([
        { start: 1, end: 2 },
        { start: 3, end: 4 },
      ]);
    });

    it('closes a heading that is inside a folding when the folding ends', () => {
      const ranges = fold(
        [
          '[+]Block', // 1
          '*Heading', // 2
          'body', // 3
          '[END]', // 4
        ].join('\n')
      );
      // Folding range first, then the inner heading range (end = [END] - 1).
      expect(ranges).toEqual([
        { start: 1, end: 4 },
        { start: 2, end: 3 },
      ]);
    });
  });
});
