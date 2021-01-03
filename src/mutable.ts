import { blank } from "./blank";
import { Handler, Stream, stream } from "./stream-stuff";

export type Streams<T> = { [K in keyof T]: Stream<T[K]> };
export type Setters<T> = { [K in keyof T]: Handler<T[K]> };

export interface Mutable<T> {
  value: T;
  mut: Streams<T>,
  set: Setters<T>,
};

const keys = <T>(o: T) => Object.keys(o) as (keyof T)[];

export function mutable<T>(obj: T): Mutable<T> {
  const result = blank<Mutable<T>>();
  const mut = blank<Streams<T>>();
  const set = blank<Setters<T>>();
  const o = obj as any;
  keys(obj).forEach(k => {
    const [str, send] = stream<T[keyof T]>();
    mut[k] = h => (h(o[k]), str(h));
    set[k] = (x: any) => {
      o[k] = x;
      send(x);
    };
  });
  result.value = obj;
  result.mut = mut;
  result.set = set;
  return result;
}
