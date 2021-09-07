import { noop } from './function-stuff';
import { Handler, Stream } from './stream-stuff';
import { cleanup, Cleanup, Temporary } from './temporary-stuff';

type Mounter = Temporary<Node>;
export type Component = Temporary<Mounter>;
export type Effect = Temporary<Element>;

/** Create an invisible node to use as a placeholder/marker in the DOM. */
export function marker() {
  return document.createComment("");
}

/** Render a component into a container. */
export function render(c: Component, p: Node): Cleanup {
  return c(e => (p.appendChild(e), () => p.removeChild(e)));
}

/** Render a component into a container at an index. */
export function renderAt(c: Component, p: Node, i: number): Cleanup {
  return c(e => (p.insertBefore(e, p.childNodes[i]), () => p.removeChild(e)));
}

export function mount(n: Node, r: Node): Cleanup {
  const p = r.parentNode!;
  p.replaceChild(n, r);
  return () => p.replaceChild(r, n);
}

export function append(c: Node, p: Node): Cleanup {
  p.appendChild(c);
  return () => void p.removeChild(c);
}

export function domEvent<Type extends keyof HTMLElementEventMap>(
  t: Type,
  h: Handler<HTMLElementEventMap[Type]>,
  capture?: boolean,
): Temporary<EventTarget> {
  return n => {
    n.addEventListener(t, h, capture);
    return () => n.removeEventListener(t, h, capture);
  };
}

export const inputType = (v: string) => (n: HTMLInputElement) => (n.type = v, noop);

export const inputValue = (v: Stream<string>) => (n: HTMLInputElement) => v(x => n.value = x);

export const delayedComponent = (x: Promise<Component>): Component => r => {
  let mounted = true;
  let c = noop;
  x.then(f => mounted && (c = f(r)));
  return () => (mounted = false, c());
}
