/** File for actual data stuff. */

import { Quantity, Time, Value, ValuePair } from "./data-stuff";
import { Handler } from "./stream-stuff";

type Message = ArrayBuffer;
type MessageHandler = Handler<Message>;

type Struct<T extends any[]> = (...x: T) => Builder;
type Builder = (v: DataView, o: number) => number;

const te = new TextEncoder();

const u8: Struct<[number]> = x => (v, o) => (v.setUint8(o, x), o + 1);
const u32: Struct<[number]> = x => (v, o) => (v.setUint32(o, x, true), o + 4);
const f64: Struct<[number]> = x => (v, o) => (v.setFloat64(o, x, true), o + 8);
const pack: Struct<Builder[]> = (...x) => (v, o) => {
  const n = x.length;
  for (let i = 0; i < n; i += 1) {
    o = x[i](v, o);
  }
  return o;
}

const lputf8: Struct<[string]> = x => (v, o) => {
  const e = te.encode(x);
  const n = e.byteLength;
  v.setUint32(o, n, true);
  new Uint8Array(v.buffer).set(e, o + 4);
  return o + 4 + n;
};

function build(...mods: Builder[]) {
  const buf = new ArrayBuffer(1000);
  const view = new DataView(buf);
  let o = 0;
  for (let i = 0; i < mods.length; i += 1) {
    o = mods[i](view, o);
  }
  return buf.slice(0, o);
}

const vec = <T>(f: (x: T) => Builder): Struct<[T[]]> => x => pack(u32(x.length), ...x.map(f));

export class ProtocolWriter {

  private handle: MessageHandler;

  constructor(h: MessageHandler) {
    this.handle = h;
  }

  private send(...mods: Builder[]) {
    this.handle(build(...mods));
  }

  private message(type: number, ...mods: Builder[]) {
    this.send(u8(type), ...mods);
  }

  addPoint(q: Quantity, t: Time, v: Value) {
    this.message(0, u32(q), f64(t), f64(v));
  }

  addPoints(q: Quantity, v: ValuePair[]) {
    this.message(1, u32(q), vec<ValuePair>(p => pack(f64(p.time), f64(p.value)))(v));
  }

  subscribeSeries(q: Quantity) {
    this.message(2, u32(q));
  }

  unsubscribeSeries(q: Quantity) {
    this.message(3, u32(q));
  }

  quantitiesChanged(q: Quantity[]) {
    this.message(6, vec(u32)(q));
  }

  quantitiesAdded(q: Quantity) {
    this.message(4, u32(q));
  }

  quantitiesRemoved(q: Quantity) {
    this.message(5, u32(q));
  }

  devAddQuantity(q: Quantity) {
    this.message(7, u32(q));
  }

  devRemoveQuantity(q: Quantity) {
    this.message(8, u32(q));
  }

  subscribeQuantities() {
    this.message(9);
  }

  unsubscribeQuantities() {
    this.message(10);
  }
  
  subscribeQuantityName(q: number) {
    this.message(11, u32(q));
  }

  unsubscribeQuantityName(q: number) {
    this.message(12, u32(q));
  }

  setQuantityName(q: number, x: string) {
    this.message(14, u32(q), lputf8(x));
  }
}

export function protocolWriter(h: MessageHandler) {
  return new ProtocolWriter(h);
}
