import { Handler } from './stream-stuff';
import { Cleanup } from './temporary-stuff';

type RawStream<Handler> = (h: Handler) => Cleanup;

export interface AddOnlySetHandler<T> {

  /**
   * Handle a complete change in the contents of the set.
   */
  init: Handler<Set<T>>;

  /**
   * Handle a value being added to the set. A conformant stream must only call
   * this if the value is not already in the set.
   */
  add: (e: T, x: Set<T>) => void;
}

export type AddOnlySetStream<T> = RawStream<AddOnlySetHandler<T>>;

export interface AddOnlySet<T> {
  stream: AddOnlySetStream<T>;
}

// NOTE: As of 2020 Jan 3 this is structurally the same as `AddOnlySetHandler`
// but it is safe to call `add` repeatedly using this interface.
export interface MutableAddOnlySet<T> extends AddOnlySet<T> {
  init: Handler<Set<T>>;
  add: Handler<T>;
}

export function addOnlySet<T>(): MutableAddOnlySet<T> {
  let curr = new Set<T>();
  const handlers = new Set<AddOnlySetHandler<T>>();

  return {
    init: x => {
      curr = x;
      handlers.forEach(h => h.init(x));
    },
    add: x => {
      if (!curr.has(x)) {
        curr.add(x);
        handlers.forEach(h => h.add(x, curr));
      }
    },
    stream: h => {
      h.init(curr);
      handlers.add(h);
      return () => handlers.delete(h);
    },
  };
}
