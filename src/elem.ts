export function elem<K extends keyof HTMLElementTagNameMap>(s: K, p?: HTMLElement) {
  const e = document.createElement(s);
  if (p) {
    p.appendChild(e);
  }
  return e;
}
