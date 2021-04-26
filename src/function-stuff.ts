/** Stuff for general practical functional programming. */

/** Type of a function that just has side effects. */
export type Thunk = () => void;

/** No-op function. */
export const noop = () => {};

/** Type-constrained identity function factory. */
export const ident = <T>() => (x: T) => x;

/** Create a callable object based on an existing object that has a call method. */
function callable<A extends any[], R, T>(c: T, f: (...a: A) => R) {
  function fn() { f.apply(fn, arguments as any); }
  Object.defineProperty(fn, "name", { writable: true, value: undefined });
  Object.defineProperty(fn, "length", { writable: true, value: undefined });
  Object.defineProperty(fn, "prototype", { writable: true, value: undefined });
  Object.setPrototypeOf(fn, Object.getPrototypeOf(c));
  Object.keys(c).forEach(k => (fn as any)[k] = (c as any)[k]);
  return fn as T & ((...a: A) => R);
}

export const exists = <T>(x: T | undefined): x is T => !!x;
