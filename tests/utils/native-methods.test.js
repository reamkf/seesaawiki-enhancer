import { describe, it, expect } from 'bun:test';
import { specReduce, specFrom } from '../../src/utils/native-methods.js';

describe('specReduce (Array.prototype.reduce replacement)', () => {
  it('reduces with a callback and initial value', () => {
    const result = specReduce.call([1, 2, 3, 4], (acc, x) => acc + x, 0);
    expect(result).toBe(10);
  });

  it('reduces with a callback and no initial value', () => {
    const result = specReduce.call([1, 2, 3, 4], (acc, x) => acc + x);
    expect(result).toBe(10);
  });

  it('returns initialValue when array is empty and initial is provided', () => {
    expect(specReduce.call([], (acc, x) => acc + x, 99)).toBe(99);
  });

  it('throws TypeError on empty array without initial value', () => {
    expect(() => specReduce.call([], (acc, x) => acc + x)).toThrow(TypeError);
  });

  it('passes (accumulator, value, index, array) to the callback', () => {
    const calls = [];
    specReduce.call(['a', 'b'], (acc, v, i, arr) => {
      calls.push([acc, v, i, arr.length]);
      return v;
    }, 'init');
    expect(calls).toEqual([
      ['init', 'a', 0, 2],
      ['a', 'b', 1, 2],
    ]);
  });

  it('with non-function callback on multi-element array, returns the array (Prototype.js 1.6 compat)', () => {
    const arr = [1, 2, 3];
    expect(specReduce.call(arr)).toBe(arr);
  });

  it('with non-function callback on single-element array, returns the lone element', () => {
    expect(specReduce.call([42])).toBe(42);
  });

  it('skips holes in sparse arrays', () => {
    const sparse = [1, , 3];
    const seen = [];
    specReduce.call(sparse, (acc, v) => {
      seen.push(v);
      return acc;
    }, 0);
    expect(seen).toEqual([1, 3]);
  });
});

describe('specFrom (Array.from replacement)', () => {
  it('returns an empty array for null/undefined (Prototype.js $A compat)', () => {
    expect(specFrom(null)).toEqual([]);
    expect(specFrom(undefined)).toEqual([]);
  });

  it('converts a Set to an array', () => {
    const set = new Set([1, 2, 3]);
    expect(specFrom(set)).toEqual([1, 2, 3]);
  });

  it('converts a Map to an array of [key, value] pairs', () => {
    const map = new Map([['a', 1], ['b', 2]]);
    expect(specFrom(map)).toEqual([['a', 1], ['b', 2]]);
  });

  it('converts an array-like to an array', () => {
    const arrayLike = { length: 3, 0: 'a', 1: 'b', 2: 'c' };
    expect(specFrom(arrayLike)).toEqual(['a', 'b', 'c']);
  });

  it('applies the mapFn argument when provided', () => {
    expect(specFrom([1, 2, 3], (x) => x * 2)).toEqual([2, 4, 6]);
  });

  it('passes (value, index) to the mapFn', () => {
    const calls = [];
    specFrom(['a', 'b'], (v, i) => {
      calls.push([v, i]);
      return v;
    });
    expect(calls).toEqual([
      ['a', 0],
      ['b', 1],
    ]);
  });

  it('respects thisArg for the mapFn', () => {
    const result = specFrom([1, 2], function (x) {
      return x + this.offset;
    }, { offset: 10 });
    expect(result).toEqual([11, 12]);
  });

  it('throws TypeError when mapFn is not a function', () => {
    expect(() => specFrom([1], 'not a function')).toThrow(TypeError);
  });

  it('converts an iterable string to an array of characters', () => {
    expect(specFrom('abc')).toEqual(['a', 'b', 'c']);
  });
});
