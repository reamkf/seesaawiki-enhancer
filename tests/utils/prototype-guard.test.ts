import { describe, it, expect, afterEach } from 'bun:test';
import { withoutPrototypePollution } from '../../src/utils/prototype-guard.js';

type ArrayWithInclude = Array<unknown> & { include?: (...args: unknown[]) => unknown };

describe('withoutPrototypePollution', () => {
  afterEach(() => {
    if (Object.prototype.hasOwnProperty.call(Array.prototype, 'include')) {
      delete (Array.prototype as ArrayWithInclude).include;
    }
  });

  it('returns the value returned by the callback', () => {
    expect(withoutPrototypePollution(() => 42)).toBe(42);
  });

  it('removes Array.prototype.include during the callback', () => {
    (Array.prototype as ArrayWithInclude).include = function () {
      return 'polluted';
    };

    let sawIncludeDuringCallback: boolean | undefined;
    withoutPrototypePollution(() => {
      sawIncludeDuringCallback = Object.prototype.hasOwnProperty.call(
        Array.prototype,
        'include'
      );
    });

    expect(sawIncludeDuringCallback).toBe(false);
  });

  it('restores Array.prototype.include after the callback finishes', () => {
    const original = function include(): string {
      return 'restored';
    };
    (Array.prototype as ArrayWithInclude).include = original;

    withoutPrototypePollution(() => {});

    expect(Object.prototype.hasOwnProperty.call(Array.prototype, 'include')).toBe(true);
    expect((Array.prototype as ArrayWithInclude).include).toBe(original);
  });

  it('restores Array.prototype.include even when the callback throws', () => {
    const original = function include(): string {
      return 'restored';
    };
    (Array.prototype as ArrayWithInclude).include = original;

    expect(() =>
      withoutPrototypePollution(() => {
        throw new Error('boom');
      })
    ).toThrow('boom');

    expect(Object.prototype.hasOwnProperty.call(Array.prototype, 'include')).toBe(true);
    expect((Array.prototype as ArrayWithInclude).include).toBe(original);
  });

  it('does nothing extra when Array.prototype.include is not present', () => {
    expect(Object.prototype.hasOwnProperty.call(Array.prototype, 'include')).toBe(false);
    let ran = false;
    withoutPrototypePollution(() => {
      ran = true;
    });
    expect(ran).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(Array.prototype, 'include')).toBe(false);
  });
});
