// Seesaa WikiはPrototype.jsを読み込んでおり、Array.prototypeに
// include()などのEnumerableメソッドを追加する。Monacoのトークナイザ
// コンパイラは各ルールで rule.include を参照するため、配列形式のルールが
// Array.prototype.include を継承してしまい
// 「an 'include' attribute must be a string」エラーになる。
// Monacoの同期処理の間だけ衝突するプロトタイプ拡張を退避し、終了後に戻す。
const CONFLICTING_ARRAY_KEYS = ['include'];

export function withoutPrototypePollution(fn) {
  const saved = [];
  for (const key of CONFLICTING_ARRAY_KEYS) {
    if (Object.prototype.hasOwnProperty.call(Array.prototype, key)) {
      saved.push([key, Object.getOwnPropertyDescriptor(Array.prototype, key)]);
      delete Array.prototype[key];
    }
  }
  try {
    return fn();
  } finally {
    for (const [key, descriptor] of saved) {
      Object.defineProperty(Array.prototype, key, descriptor);
    }
  }
}
