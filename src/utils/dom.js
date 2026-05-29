export function addCSS(css) {
  const style = document.createElement('style');
  style.innerHTML = css;
  document.head.append(style);
}
