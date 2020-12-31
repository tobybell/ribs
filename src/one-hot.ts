import { Stream, Handler, stream, map, cat } from "./stream-stuff";
import { cleanup } from "./temporary-stuff";
import { posaphore } from "./posaphore";

export function oneHot<T>(s: Stream<T | undefined>): (x: T) => Stream<boolean> {
  let curr: T | undefined;
  const setter = (x: T | undefined) => {
    if (x === curr) return;
    if (curr !== undefined) {
      streams.get(curr)?.[1](false);
    }
    curr = x;
    if (x !== undefined) {
      streams.get(x)?.[1](true);
    }
  };
  const enable = posaphore(() => s(setter));
  const streams = new Map<T, [Stream<boolean>, Handler<boolean>]>();

  const getter = (k: T): Stream<boolean> => {
    const existing = streams.get(k);
    if (existing) return existing[0];
    const [oh, soh] = stream<boolean>();
    const foh: Stream<boolean> = h => {
      h(curr === k);
      return cleanup(enable(), oh(h));
    };
    streams.set(k, [foh, soh]);
    return foh;
  };
  return getter;
}

export function streamOneHot<T>(s: Stream<T | undefined>): (x: Stream<T>) => Stream<boolean> {
  return n => cat(map(n, oneHot(s)));
}
