/** File for actual data stuff. */

import { Handler } from "./stream-stuff";

export type Quantity = number;
export type Time = number;
export type Value = number;

export interface ValuePair {
  time: Time;
  value: Value;
}

export interface Data {
  t: Time[];
  y: Value[];
}

function mergeSorted(t1: Time[], v1: Value[], t2: Time[], v2: Value[]) {
  const n1 = t1.length;
  const n2 = t2.length;
  const n = n1 + n2;
  const t = Array<Time>(n);
  const v = Array<Value>(n);
  let i1 = 0;
  let i2 = 0;
  let i = 0;
  while (i1 < n1 && i2 < n2) {
    if (t1[i1] <= t2[i2]) {
      t[i] = t1[i1];
      v[i] = v1[i1];
      i1 += 1;
    } else {
      t[i] = t2[i2];
      v[i] = v2[i2];
      i2 += 1;
    }
    i += 1;
  }
  while (i1 < n1) {
    t[i] = t1[i1];
    v[i] = v1[i1];
    i1 += 1;
    i += 1;
  }
  while (i2 < n2) {
    t[i] = t2[i2];
    v[i] = v2[i2];
    i2 += 1;
    i += 1;
  }
  return [t, v];
}

function insertSorted(ts: Time[], vs: Value[], t: Time, v: Value) {
  const i = insertionIndex(ts, t);
  ts.push(0);
  vs.push(0);
  for (let j = ts.length - 1; j > i; j -= 1) {
    ts[j] = ts[j - 1];
    vs[j] = vs[j - 1];
  }
  ts[i] = t;
  vs[i] = v;
}

function insertionIndex(ts: Time[], t: Time, lo = 0, hi = ts.length) {
  while (lo < hi) {
    const mid = lo + Math.floor((hi - lo) / 2);
    const val = ts[mid];
    if (t < val) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }
  return lo;
}

/**
 * Can receive individual points or batch points, but everything is for a particular quantity (for now, maybe can batch those too in future).
 */

export class DataStore {
  data: { [q in Quantity]?: QuantityData };

  constructor() {
    this.data = {};
  }

  addPoint(q: Quantity, t: Time, v: Value) {
    this.quantityData(q).addPoint(t, v);
  }

  addBatch(q: Quantity, t: Time[], v: Value[]) {
    this.quantityData(q).addBatch(t, v);
  }

  subscribe(q: Quantity, handler: Handler<Data>) {
    return this.quantityData(q).subscribe(handler);
  }

  private quantityData(q: Quantity) {
    let qd = this.data[q];
    if (!qd) {
      qd = new QuantityData();
      this.data[q] = qd;
    }
    return qd;
  }
}

export class QuantityData {
  times: Time[];
  values: Value[];
  handlers: Set<Handler<Data>>;

  constructor() {
    this.times = [];
    this.values = [];
    this.handlers = new Set();
  }

  addPoint(t: Time, v: Value) {
    insertSorted(this.times, this.values, t, v);
    this.handlers.forEach(h => h({ t: this.times, y: this.values }));
  }

  addBatch(t: Time[], v: Value[]) {
    [this.times, this.values] = mergeSorted(this.times, this.values, t, v);
    this.handlers.forEach(h => h({ t: this.times, y: this.values }));
  }

  subscribe(handler: Handler<Data>) {
    handler({ t: this.times, y: this.values });
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }
}

// const makeAppendData = () => {
//   const [data, setData] = state(makeData());
//   const under = data();
//   const append = (x: number, y: number) => {
//     under.x.push(x);
//     under.y.push(y);
//     setData(under);
//   };
//   return [data, append] as [State<Data>, (x: number, y: number) => void];
// };

// const [data, appendPoint] = makeAppendData();