import { Thunk } from "./function-stuff";
import { Handler, map, State, state, Stream, stream, toggle } from "./stream-stuff";
import { Temporary, cleanup, Cleanup } from "./temporary-stuff";

/**
 * A posaphore is an object that wraps some temporary `f`. The wrapped
 * temporary will be enabled whenever at least one instance of the posaphore
 * is active.
 */
export function posaphore(f: Temporary) {
  let active = 0;
  let unsubscribe: Cleanup;
  const decr = () => {
    active -= 1;
    if (active === 0) unsubscribe();
  };
  const incr = () => {
    if (active === 0) unsubscribe = f();
    active += 1;
    return decr;
  }
  return incr;
}

const fanOut = <T>(s: Stream<T>): Stream<T> => {
  const [cache, send] = stream<T>();
  const ticker = posaphore(() => s(send));
  return h => cleanup(ticker(), cache(h));
};

const cache = <T>(s: Stream<T>): Stream<T> => {
  let curr: T;
  const [str, send] = stream<T>();
  const ticker = posaphore(() => s(x => {
    curr = x;
    send(x);
  }));
  return h => cleanup(ticker(), (h(curr), str(h)));
};

function timeout(h: Thunk, ms: number): Cleanup {
  const id = setTimeout(h, ms);
  return () => clearTimeout(id);
}

function interval(h: Thunk, ms: number): Cleanup {
  const id = setInterval(h, ms);
  return () => clearInterval(id);
}

function timeoutInterval(h: Thunk, msTimeout: number, msInterval: number): Cleanup {
  let u: Cleanup;
  u = timeout(() => {
    u = interval(h, msInterval);
  }, msTimeout);
  return () => u();
}

const perstTick = (dt: number): Stream<void> => {
  const t0 = performance.now();
  const ms = dt * 1000;
  return h => {
    const elapsed = performance.now() - t0;
    const ttnb = ms - elapsed % ms;
    return timeoutInterval(h, ttnb, ms);
  };
};

const counter = (init = 0): [Stream<number>, Thunk, Handler<number>] => {
  let curr = init;
  const [s, ss] = stream<number>();
  const incr = () => (curr += 1, ss(curr));
  const set = (x: number) => (curr = x, ss(curr));
  return [h => (h(curr), s(h)), incr, set];
};

const perstCount = (dt: number): Stream<number> => {
  const [count, incr, set] = counter();
  const t0 = performance.now();
  const ms = dt * 1000;
  const ticker = posaphore(() => {
    const elapsed = performance.now() - t0;
    set(Math.floor(elapsed / ms));
    const ttnb = ms - elapsed % ms;
    return timeoutInterval(incr, ttnb, ms);
  });
  return h => cleanup(ticker(), count(h));
};

export const square = (dt: number) => {
  return cache(map(perstCount(dt), x => x % 2 >= 1));
};
