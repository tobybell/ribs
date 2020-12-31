import { Handler, map, Stream } from "./stream-stuff";

export type AnimatableStream<T> = Stream<[T, boolean]>;
export type AnimatableHandler<T> = Handler<[T, boolean]>;

export class Animatable<T> {
  value: T;
  private handlers = new Set<AnimatableHandler<T>>();

  constructor(init: T) {
    this.value = init;
  }

  set(x: [T, boolean]) {
    this.value = x[0];
    this.handlers.forEach(h => h(x));
  }

  sub(h: AnimatableHandler<T>) {
    this.handlers.add(h);
    h([this.value, false]);
    return () => { this.handlers.delete(h); };
  }
}

// TODO: These are not quite right, because of initial value should not be animated.
export const animated = <T>(s: Stream<T>): AnimatableStream<T> => map(s, x => [x, true]);
export const unanimated = <T>(s: Stream<T>): AnimatableStream<T> => map(s, x => [x, false]);

export const deanimated = <T>(s: AnimatableStream<T>) => map(s, x => x[0]);

export function animatable<T>(init: T): Animatable<T> {
  return new Animatable(init);
}

/** Join an object of animatable streams into a stream of objects. */
// TODO: Maybe get rid of this and go more directly for a complete aniStyle.
export const aniJoin = <T extends {}>(streams: {[K in keyof T]: AnimatableStream<T[K]>}): AnimatableStream<{[K in keyof T]: T[K]}> => {
  const keys = Object.keys(streams) as any as (keyof T)[];
  return h => {
    let nRemaining = keys.length;
    const rs = {} as {[K in keyof T]?: boolean};
    const cs = {} as {[K in keyof T]: T[K]};
    const us = keys.map(k => streams[k](x => {
      cs[k] = x[0];
      if (!rs[k]) {
        nRemaining -= 1;
        rs[k] = true;
      }
      if (!nRemaining) h([cs, x[1]]);
    }));
    return () => us.forEach(u => u());
  };
};