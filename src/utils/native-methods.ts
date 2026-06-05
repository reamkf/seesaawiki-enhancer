// Seesaa Wikiの編集ページはPrototype.js(1.6系)を読み込んでおり、
// Array.prototype.reduce や Array.from をECMAScript仕様と非互換な実装で
// 上書きする。iframe廃止後はMonacoがホストページと同じrealmで動くため、
// これらの非互換実装に依存するMonaco内部がクラッシュする。
//   - Prototypeのreduce: 配列を畳み込まず単純化する別物。
//     Monacoの設定シリアライズ(folders)やリスト描画(consolidate)が壊れる。
//   - PrototypeのArray.from: Setなどのiterableで空配列を返す。
//     Monacoの各所(Array.from(set)等)が壊れる。
// そこでMonaco読み込み前に、非ネイティブな場合のみ仕様準拠の実装へ戻す。
// 仕様互換なメソッド(map/filter等)はPrototype版のままでもMonacoは動くため
// 触らず、Seesaa側コードへの影響を最小化する。
// このモジュールはimport時の副作用として適用される(api.tsでmonacoより前にimport)。

function isNative(fn: unknown): boolean {
  return (
    typeof fn === 'function' &&
    /\{\s*\[native code\]\s*\}/.test(Function.prototype.toString.call(fn))
  );
}

function define(target: object, name: string, value: unknown): void {
  Object.defineProperty(target, name, {
    value,
    writable: true,
    enumerable: false,
    configurable: true,
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReduceCallback = (accumulator: any, value: any, index: number, array: ArrayLike<any>) => any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function specReduce(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  this: ArrayLike<any>,
  callback?: ReduceCallback,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialValue?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  // Prototype.js 1.6互換: 引数が関数でなければ従来の畳み込み(単一要素化)を行う。
  // これによりSeesaa側がPrototype流にreduce()を呼んでも従来通り動作する。
  if (typeof callback !== 'function') {
    return this.length > 1 ? this : this[0];
  }
  const O = Object(this) as ArrayLike<unknown>;
  const len = O.length >>> 0;
  let k = 0;
  let accumulator: unknown;
  if (arguments.length >= 2) {
    accumulator = initialValue;
  } else {
    while (k < len && !(k in O)) k++;
    if (k >= len) {
      throw new TypeError('Reduce of empty array with no initial value');
    }
    accumulator = O[k++];
  }
  while (k < len) {
    if (k in O) accumulator = callback(accumulator, O[k], k, O);
    k++;
  }
  return accumulator;
}

export function specFrom<T, U = T>(
  items: Iterable<T> | ArrayLike<T> | null | undefined,
  mapFn?: ((value: T, index: number) => U) | string,
  thisArg?: unknown
): U[] | T[] {
  // Prototype.jsの$A互換: nullish時は空配列を返す(仕様はthrowだがMonacoは渡さない)。
  if (items == null) {
    return [];
  }
  const mapping = mapFn !== undefined;
  if (mapping && typeof mapFn !== 'function') {
    throw new TypeError(String(mapFn) + ' is not a function');
  }
  const mapper = mapFn as ((value: T, index: number) => U) | undefined;
  const result: (U | T)[] = [];
  const iteratorFn = (items as Iterable<T>)[Symbol.iterator];
  if (typeof iteratorFn === 'function') {
    const iterator = iteratorFn.call(items as Iterable<T>);
    let i = 0;
    let step: IteratorResult<T>;
    while (!(step = iterator.next()).done) {
      result.push(mapping ? mapper!.call(thisArg, step.value, i) : step.value);
      i++;
    }
  } else {
    const arrayLike = items as ArrayLike<T>;
    const len = arrayLike.length >>> 0;
    for (let i = 0; i < len; i++) {
      result.push(mapping ? mapper!.call(thisArg, arrayLike[i], i) : arrayLike[i]);
    }
  }
  return result as U[] | T[];
}

if (!isNative(Array.prototype.reduce)) {
  define(Array.prototype, 'reduce', specReduce);
}
if (!isNative(Array.from)) {
  define(Array, 'from', specFrom);
}
