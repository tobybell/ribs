import { Component, mount, render } from './component';
import { elem } from './elem';
import { Stream } from './stream-stuff';
import { cleanup, Cleanup, Temporary } from './temporary-stuff';

export type ElementThing = HTMLElement | SVGSVGElement | Component | string | undefined | null | false;
type StreamableCSS = {[K in keyof CSSStyleDeclaration]?: string | Stream<string>};

const exists = <T>(x: T | undefined): x is T => !!x;

const element =
  <K extends keyof HTMLElementTagNameMap>(e: K) =>
  (...effects: (Temporary<HTMLElementTagNameMap[K]> | undefined)[]): Component =>
  r => {
  const t = elem(e);
  return cleanup(
    ...effects.filter(exists).map(f => f(t)),
    r(t),
  );
}

export function children(...c: ElementThing[]): Temporary<Node> {
  return n => {
    const us: Cleanup[] = [];
    c.forEach(x => {
      if (!x) return;
      if (x instanceof HTMLElement || x instanceof SVGSVGElement) {
        n.appendChild(x);
      } else if (typeof x == 'string') {
        n.appendChild(document.createTextNode(x));
      } else {
        us.push(render(x, n));
      }
    });
    return cleanup(...us);
  };
}

export function style(decl: StreamableCSS): Temporary<ElementCSSInlineStyle> {
  const keys = Object.keys(decl) as (keyof CSSStyleDeclaration)[];
  return n => {
    const target = n.style as any;
    const us: Cleanup[] = [];
    keys.forEach(k => {
      const v = decl[k];
      if (typeof v === 'string') {
        target[k] = v;
      } else if (v) {
        us.push(v(x => target[k] = x));
      }
    });
    return cleanup(...us);
  }
}

export const divr = element('div');

export const span = element('span');

export const rawInput = element('input');

export const text = (s: Stream<string>): Component => r => {
  const n = document.createTextNode('');
  return cleanup(
    s(x => n.textContent = x),
    r(n),
  );
};