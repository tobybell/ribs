import { Handler, Stream, stream } from './stream-stuff';

export class State<T> {

  value: T;
  private updates: Stream<T>;
  private send: Handler<T>;

  constructor(x: T) {
    this.value = x;
    [this.updates, this.send] = stream();
  }

  set(x: T) {
    this.value = x;
    this.send(x);
  }

  subscribe: Stream<T> = h => {
    h(this.value);
    return this.updates(h);
  };
}

export const state = <T>(init: T) => new State(init);
