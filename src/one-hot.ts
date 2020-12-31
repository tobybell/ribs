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

  // TODO: Under certain usage patterns this could fill up with old unused
  // streams. We could schedule an infrequent cleanup operation to get rid of
  // them or something.
  const streams = new Map<T, [Stream<boolean>, Handler<boolean>]>();

  const getter = (k: T): Stream<boolean> => {
    const existing = streams.get(k);
    if (existing) return existing[0];
    const [oh, soh] = stream<boolean>();
    const foh: Stream<boolean> = h => {
      const d = enable();
      h(curr === k);
      return cleanup(oh(h), d);
    };
    streams.set(k, [foh, soh]);
    return foh;
  };
  return getter;
}

export function streamOneHot<T>(s: Stream<T | undefined>): (x: Stream<T>) => Stream<boolean> {
  return n => cat(map(n, oneHot(s)));
}
