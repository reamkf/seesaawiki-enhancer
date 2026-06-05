export function addCSS(css: string): void {
  const style = document.createElement('style');
  style.innerHTML = css;
  document.head.append(style);
}
