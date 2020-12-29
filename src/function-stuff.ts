/** Stuff for general practical functional programming. */

/** Type of a function that just has side effects. */
export type Thunk = () => void;

/** No-op function. */
export const noop = () => {};

/** Type-constrained identity function factory. */
export const ident = <T>() => (x: T) => x;
