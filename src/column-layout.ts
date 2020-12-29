/** File for actual data stuff. */

import { Thunk } from "./function-stuff";
import { customState, Handler, just, State, stream, Stream } from "./stream-stuff";

type Width = number;
type Offset = number;

interface ColumnStreams {
  read: [State<Offset>, State<Width>];
  write: [Thunk, Thunk];
}

function san(w: Width) {
  return Math.max(Math.round(w), 0);
}

function cumSum(x: Width[]): Offset[] {
  const result: Offset[] = [];
  let sum = 0;
  x.forEach(w => {
    sum += w;
    result.push(sum);
  });
  return result;
}

class ColumnLayout {

  private n: number;
  private widths: Width[];
  private offsets: Offset[];
  private streams: ColumnStreams[];

  constructor(...widths: Width[]) {
    this.n = widths.length;
    this.widths = widths.map(san);
    this.offsets = cumSum(this.widths);
    this.streams = Array(this.n).fill(0).map((_, i): ColumnStreams => {
      const [o, pokeO] = customState<Offset>(() => this.offsets[i]);
      const [w, pokeW] = customState<Width>(() => this.widths[i]);
      return { read: [o, w], write: [pokeO, pokeW] };
    });
  }

  column(i: number) {
    return this.streams[i].read;
  }

  width(i: number) {
    return this.streams[i].read[1];
  }

  offset(i: number) {
    if (i) return this.streams[i - 1].read[0];
    return just(0);
  }

  setWidth(i: number, w: Width) {
    const delta = Math.max(Math.round(w), 0) - this.widths[i];
    this.widths[i] += delta;
    this.streams[i].write[1]();
    for (let j = i; j < this.n; j += 1) {
      this.offsets[j] += delta;
      this.streams[j].write[0]();
    }
  }
}

export function columnLayout(...widths: Width[]) {
  return new ColumnLayout(...widths);
}
