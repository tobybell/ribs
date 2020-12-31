import { posaphore } from "./posaphore";
import { state, Stream } from "./stream-stuff";
import { cleanup, Cleanup } from "./temporary-stuff";

export interface ArrayHandler<T> {

  /** Handle replacing all data; new number of items. */
  init(d: T[]): void;

  /** Handle inserting an item at an index. */
  insert(d: T[], at: number): void;

  /** Handle removing the item at an index. */
  remove(d: T[], at: number, old: T): void;

  /** Handle moving an item from an index to a new index. */
  move(d: T[], from: number, to: number): void;
}

export interface ArrayStream<T> {
  (h: ArrayHandler<T>): Cleanup;
}

export interface ArrayState<T> {
  value: T[];
  stream: ArrayStream<T>;
}

export class MutableArray<T> implements ArrayState<T> {

  value: T[];
  private subs: Set<ArrayHandler<T>>;

  constructor(arr: T[] = []) {
    this.value = arr;
    this.subs = new Set();
  }

  init(arr: T[]) {
    this.value = arr;
    this.subs.forEach(h => h.init(arr));
  }

  insert(at: number, x: T) {
    this.value.splice(at, 0, x);
    this.subs.forEach(h => h.insert(this.value, at));
  }

  push(...x: T[]) {
    const oldLen = this.value.length;
    this.value.push(...x);
    const newLen = this.value.length;
    for (let i = oldLen; i < newLen; i += 1) {
      this.subs.forEach(h => h.insert(this.value, i));
    }
  }

  remove(at: number) {
    const [x] = this.value.splice(at, 1);
    this.subs.forEach(h => h.remove(this.value, at, x));
  }

  move(from: number, to: number) {
    // TODO: This shifts much more than necessary. Do some performance tests maybe.
    const [x] = this.value.splice(from, 1);
    this.value.splice(to, 0, x);
    this.subs.forEach(h => h.move(this.value, from, to));
  }

  stream: ArrayStream<T> = (h: ArrayHandler<T>) => {
    h.init(this.value);
    this.subs.add(h);
    return () => this.subs.delete(h);
  }
}

export const array = <T>(x: T[]) => new MutableArray(x);

export function length<T>(x: ArrayStream<T>): Stream<number> {
  const [get, set] = state(0);
  const enable = posaphore(() => x({
    init(d) { set(d.length); },
    insert(d) { set(d.length); },
    remove(d) { set(d.length); },
    move() {},
  }));
  return h => cleanup(enable(), get(h));
}

export function arrayMap<T, S>(src: ArrayStream<T>, fn: (x: T, i: number) => S): ArrayStream<S> {
  const array = new MutableArray<S>();
  const enable = posaphore(() => {
    return src({
      init: (d) => array.init(d.map(fn)),
      insert: (d, at) => array.insert(at, fn(d[at], at)),
      remove: (_, at) => array.remove(at),
      move: (_, from, to) => array.move(from, to),
    });
  });
  return h => cleanup(enable(), array.stream(h));
}

export function move<T>(array: T[], from: number, to: number) {
  const tmp = array[from];
  if (from < to)
    for (let i = from; i < to; i += 1)
      array[i] = array[i + 1];
  else
    for (let i = from; i > to; i -= 1)
      array[i] = array[i - 1];
  array[to] = tmp;
}
