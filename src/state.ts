import { blank } from "./blank";
import { Handler, Stream, stream } from "./stream-stuff";

export interface Readable<T> {
  value: T;
}

export interface Writable<T> {
  set: Handler<T>;
}

export interface Streamable<T> {
  stream: Stream<T>;
}

export type Sync<T> = Streamable<T> & Writable<T>;
export type State<T> = Readable<T> & Streamable<T>;
export type MutableState<T> = State<T> & Writable<T>;

/** A version of state with no random access. */
export function state<T>(init: T): MutableState<T> {
  const result = blank<MutableState<T>>();
  const [str, send] = stream<T>();
  result.value = init;
  result.stream = h => (h(result.value), str(h));
  result.set = x => (result.value = x, send(x));
  return result;
}
