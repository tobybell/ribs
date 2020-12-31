import { Component, render, mount } from "./component";
import { Stream } from "./stream-stuff";
import { elem } from "./elem";
import { cleanup, Temporary, Cleanup } from "./temporary-stuff";

export type ElementThing = HTMLElement | SVGSVGElement | Component | string | undefined;
type StreamableCSS = {[K in keyof CSSStyleDeclaration]?: string | Stream<string>};

const exists = <T>(x: T | undefined): x is T => !!x;

const elemRawComponent =
  <K extends keyof HTMLElementTagNameMap>(e: K) =>
  (...effects: (Temporary<HTMLElementTagNameMap[K]> | undefined)[]): Component =>
  r => {
  const t = elem(e);
  return cleanup(
    ...effects.filter(exists).map(f => f(t)),
    mount(t, r),
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
      if (typeof v === "string") {
        target[k] = v;
      } else if (v) {
        us.push(v(x => target[k] = x));
      }
    });
    return cleanup(...us);
  }
}

function elemComponent<K extends keyof HTMLElementTagNameMap>(e: K) {
  const comp = elemRawComponent(e);
  return (
    decl: Partial<StreamableCSS>,
    child: ElementThing[] = [],
    effects: (Temporary<HTMLElementTagNameMap[K]> | undefined)[] = [],
  ) => comp(style(decl), children(...child), ...effects);
}

export const div = elemComponent("div");

export const span = elemRawComponent("span");

export const rawInput = elemRawComponent("input");

export const text = (s: Stream<string>): Component => r => {
  const n = document.createTextNode('');
  return cleanup(
    s(x => n.textContent = x),
    mount(n, r),
  );
};