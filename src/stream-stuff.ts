import { noop, Thunk } from './function-stuff';
import { Cleanup, cleanup, Temporary } from './temporary-stuff';

export type Unsubscriber = () => void;
export type Handler<T> = (x: T) => void;
export type Stream<T> = (f: Handler<T>) => Unsubscriber;

/** Get the contents of a stream. */
type Contents<T> = T extends Stream<infer U> ? U : never;

export type State<T> = {
  (): T;
  (h: Handler<T>): Unsubscriber;
}

/** Stream that produces a fixed value once. */
export const just = <T>(x: T) =>
  ((h?: Handler<T>) => h ? (h(x), noop) : x) as State<T>;

/** Transform values from one stream into another with the given function. */
export const map = <T, S>(s: Stream<T>, f: (x: T) => S): Stream<S> =>
  h => s(x => h(f(x)));

/** Reduce values from a stream. */
export const reduce = <T, S>(s: Stream<T>, f: (a: S, x: T) => S, initial: S): Stream<S> => {
  return h => {
    let a = initial;
    h(a);
    return s(x => {
      a = f(a, x);
      h(a);
    });
  };
};

/** Stream that produces void/unit value at a given period. */
export const tick = (dt: number): Stream<void> => h => {
  h();
  const interval = setInterval(() => h(), dt * 1000);
  return () => clearInterval(interval);
};

/** Stream that produces a monotonically increasing time at some period. */
export const time = (dt: number) => map(tick(dt), () => performance.now() / 1000);

/** Stream that produces alternating `true`/`false` values. */
export const square = (dt: number) => reduce(tick(dt), a => !a, false);

export const rsquare = () => square(Math.random());

/** Join two streams into a stream of array pairs. */
const zip = <T extends readonly any[]>(ss: {[K in keyof T]: Stream<T[K]>}): Stream<{-readonly [K in keyof T]: T[K]}> => {
  const n = ss.length;
  return h => {
    let nRemaining = n;
    let rs = Array(n);
    let cs = Array(n) as {-readonly [K in keyof T]: T[K]};
    const us = ss.map((s, i) => s(x => {
      cs[i] = x;
      if (!rs[i]) {
        nRemaining -= 1;
        rs[i] = true;
      }
      if (!nRemaining) h(cs);
    }));
    return () => us.forEach(u => u());
  };
};

/** Join an object of streams into a stream of objects. */
export const join = <T extends {}>(streams: {[K in keyof T]: Stream<T[K]>}): Stream<{[K in keyof T]: T[K]}> => {
  const keys = Object.keys(streams) as any as (keyof T)[];
  return h => {
    let nRemaining = keys.length;
    const rs = {} as {[K in keyof T]?: boolean};
    const cs = {} as {[K in keyof T]: T[K]};
    const us = keys.map(k => streams[k](x => {
      cs[k] = x;
      if (!rs[k]) {
        nRemaining -= 1;
        rs[k] = true;
      }
      if (!nRemaining) h(cs);
    }));
    return () => us.forEach(u => u());
  };
};

export function stream<T = void>(): [Stream<T>, Handler<T>] {
  let handlers = new Set<Handler<T>>();
  const stream: Stream<T> = (h: Handler<T>) => {
    handlers.add(h);
    return () => handlers.delete(h);
  };
  const emit = (x: T) => handlers.forEach(h => h(x));
  return [stream, emit];
};

export function state<T>(init: T): [State<T>, Handler<T>] {
  let curr = init;
  let handlers = new Set<Handler<T>>();
  const get = (h?: Handler<T>) => {
    if (!h) return curr;
    handlers.add(h);
    h(curr);
    return () => { handlers.delete(h); };
  };
  const set = (x: T) => {
    curr = x;
    handlers.forEach(h => h(x));
  };
  return [get as State<T>, set];
}

export function toggle(init = false): [State<boolean>, Thunk] {
  let curr = init;
  let handlers = new Set<Handler<boolean>>();
  const get = (h?: Handler<boolean>) => {
    if (!h) return curr;
    handlers.add(h);
    h(curr);
    return () => { handlers.delete(h); };
  };
  const poke = () => {
    curr = !curr;
    handlers.forEach(h => h(curr));
  };
  return [get as State<boolean>, poke];
}

export function customState<T>(getter: () => T): [State<T>, Thunk] {
  let handlers = new Set<Handler<T>>();
  const get = (h?: Handler<T>) => {
    const curr = getter();
    if (!h) return curr;
    handlers.add(h);
    h(curr);
    return () => { handlers.delete(h); };
  };
  const poke = () => {
    handlers.forEach(h => h(getter()));
  };
  return [get as State<T>, poke];
}

/** Reduce values from multiple streams. */
// TOBU: Is this worth keeping around?
type ReducePair<A, T> = [Stream<T>, (a: A, x: T) => A];
const reduceMulti = <A, T extends any[]>(ss: {[K in keyof T]: ReducePair<A, T[K]>}, init: A): Stream<A> => {
  return h => {
    let a = init;
    h(a);
    const us = ss.map(([s, f]) => s(x => {
      a = f(a, x);
      h(a);
    }));
    return () => us.forEach(u => u());
  };
};

export function either<T>(s: Stream<boolean>, a: T, b: T) {
  return map(s, x => x ? a : b);
}

export const unique = <T>(s: Stream<T>): Stream<T> => h => {
  let last: any = undefined;
  return s(x => {
    if (x !== last) h(x);
    last = x;
  });
};

/** Number of streams returning true. */
const countTrue = (streams: Stream<boolean>[]): Stream<number> => {
  const n = streams.length;
  return h => {
    const values = Array(n);
    let m = 0;
    return cleanup(...streams.map((s, i) => s(x => {
      if (x && !values[i]) {
        m += 1;
      } else if (!x && values[i]) {
        m -= 1;
      }
      values[i] = x;
      h(m);
    })));
  };
}

/** If any of the streams evaluate to true. */
export const any = (streams: Stream<boolean>[]) =>
  unique(map(countTrue(streams), x => x != 0));

export const not = (s: Stream<boolean>) => map(s, x => !x);

/** If all of the streams evaluate to true. */
export const all = (streams: Stream<boolean>[]) => {
  const n = streams.length;
  return unique(map(countTrue(streams), x => x === n));
};

/**
 * Union multiple streams.
 */
export const merge = <T extends Stream<any>[]>(...ss: T): Stream<{[K in keyof T]: Contents<T[K]>}[number]> => h => {
  return cleanup(...ss.map(s => s(h)));
};

export const trigger = (s: Stream<boolean>, f: Temporary) => {
  let curr: Cleanup | undefined;
  const unsub = s(x => {
    if (x) {
      if (!curr) {
        curr = f();
      }
    } else {
      if (curr) {
        curr();
        curr = undefined;
      }
    }
  });
  return () => {
    unsub();
    if (curr) curr();
  };
};
