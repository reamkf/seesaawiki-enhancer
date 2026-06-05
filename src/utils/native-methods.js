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
// このモジュールはimport時の副作用として適用される(api.jsでmonacoより前にimport)。

function isNative(fn) {
  return (
    typeof fn === 'function' &&
    /\{\s*\[native code\]\s*\}/.test(Function.prototype.toString.call(fn))
  );
}

function define(target, name, value) {
  Object.defineProperty(target, name, {
    value,
    writable: true,
    enumerable: false,
    configurable: true,
  });
}

export function specReduce(callback, initialValue) {
  // Prototype.js 1.6互換: 引数が関数でなければ従来の畳み込み(単一要素化)を行う。
  // これによりSeesaa側がPrototype流にreduce()を呼んでも従来通り動作する。
  if (typeof callback !== 'function') {
    return this.length > 1 ? this : this[0];
  }
  const O = Object(this);
  const len = O.length >>> 0;
  let k = 0;
  let accumulator;
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

export function specFrom(items, mapFn, thisArg) {
  // Prototype.jsの$A互換: nullish時は空配列を返す(仕様はthrowだがMonacoは渡さない)。
  if (items == null) {
    return [];
  }
  const mapping = mapFn !== undefined;
  if (mapping && typeof mapFn !== 'function') {
    throw new TypeError(String(mapFn) + ' is not a function');
  }
  const result = [];
  const iteratorFn = items[Symbol.iterator];
  if (typeof iteratorFn === 'function') {
    const iterator = iteratorFn.call(items);
    let i = 0;
    let step;
    while (!(step = iterator.next()).done) {
      result.push(mapping ? mapFn.call(thisArg, step.value, i) : step.value);
      i++;
    }
  } else {
    const len = items.length >>> 0;
    for (let i = 0; i < len; i++) {
      result.push(mapping ? mapFn.call(thisArg, items[i], i) : items[i]);
    }
  }
  return result;
}

if (!isNative(Array.prototype.reduce)) {
  define(Array.prototype, 'reduce', specReduce);
}
if (!isNative(Array.from)) {
  define(Array, 'from', specFrom);
}
