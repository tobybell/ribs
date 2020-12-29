import { Stream, Handler, stream } from "./stream-stuff";
import { cleanup } from "./temporary-stuff";
import { posaphore } from "./posaphore";

type OneHotStreams = (x: number) => Stream<boolean>;

export function oneHot(s: Stream<number | undefined>): OneHotStreams {
  let curr: number | undefined;
  const setter = (x: number | undefined) => {
    if (x === curr) return;
    if (curr !== undefined && streams[curr]) {
      streams[curr][1](false);
    }
    curr = x;
    if (x !== undefined && streams[x]) {
      streams[x][1](true);
    }
  };
  const incr = posaphore(() => s(setter));
  const streams: {[k: number]: [Stream<boolean>, Handler<boolean>]} = {};
  const getter = (k: number): Stream<boolean> => {
    if (streams[k]) return streams[k][0];
    const [oh, soh] = stream<boolean>();
    const foh: Stream<boolean> = h => {
      const decr = incr();
      h(curr === k);
      return cleanup(oh(h), decr);
    };
    streams[k] = [foh, soh];
    return foh;
  };
  return getter;
}
