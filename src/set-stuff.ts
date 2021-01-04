import { ArrayStream } from "./array-stuff";
import { binsert } from "./bsearch";
import { Handler } from "./stream-stuff";
import { Cleanup } from "./temporary-stuff";

export interface SetHandler<T> {
  init: Handler<Set<T>>;

  /** A conformant stream must only call this if the value is not already in
   * the set. */
  add: Handler<T>;

  /** A conformant stream must only call this if the value is currently in the
   * set. */
  remove: Handler<T>;
}

export type SetStream<T> = (h: SetHandler<T>) => Cleanup;

/** Create a new mutable set. */
export function mutableSet<T>(): [SetStream<T>, SetHandler<T>] {

  let value = new Set<T>();
  const subs = new Set<SetHandler<T>>();

  return [
    h => {
      h.init(value);
      subs.add(h);
      return () => subs.delete(h);
    }, {
      init: x => (value = x, subs.forEach(h => h.init(x))),
      add: x => value.has(x) || (value.add(x), subs.forEach(h => h.add(x))),
      remove: x => value.delete(x) && subs.forEach(h => h.remove(x)),
    }
  ];
}

export function set2arr<T>(x: SetStream<T>, cmp: (a: T, b: T) => number): ArrayStream<T> {
  return h => {
    let arr: T[] = [];
    return x({
      init(x) {
        arr = [...x];
        arr.sort(cmp);
        h.init(arr);
      },
      add(x) {
        const i = binsert(arr, x, cmp);
        h.insert(arr, i);
      },
      remove(x) {
        const i = arr.indexOf(x);
        const [old] = arr.splice(i, 1);
        h.remove(arr, i, old);
      },
    });
  };
}
