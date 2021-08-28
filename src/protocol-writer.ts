/** File for actual data stuff. */

import { Quantity, Time, Value, ValuePair } from './data-stuff';
import { Handler } from './stream-stuff';

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

export interface ProtocolWriter {
  addPoint: (q: Quantity, t: Time, v: Value) => void;
  addPoints: (q: Quantity, v: ValuePair[]) => void;
  subscribeSeries: (q: Quantity) => void;
  unsubscribeSeries: (q: Quantity) => void;
  quantitiesChanged: (q: Quantity[]) => void;
  quantitiesAdded: (q: Quantity) => void;
  quantitiesRemoved: (q: Quantity) => void;
  devAddQuantity: (q: Quantity) => void;
  devRemoveQuantity: (q: Quantity) => void;
  subscribeQuantities: () => void;
  unsubscribeQuantities: () => void;
  subscribeQuantityName: (q: number) => void;
  unsubscribeQuantityName: (q: number) => void;
  setQuantityName: (q: number, x: string) => void;
}

export function protocolWriter(h: MessageHandler): ProtocolWriter {
  const send = (...bs: Builder[]) => h(build(...bs));
  const msg = (type: number, ...bs: Builder[]) => send(u8(type), ...bs);
  return {
    addPoint(q, t, v) {
      msg(0, u32(q), f64(t), f64(v));
    },

    addPoints(q, v) {
      msg(1, u32(q), vec<ValuePair>(p => pack(f64(p.time), f64(p.value)))(v));
    },

    subscribeSeries(q) {
      msg(2, u32(q));
    },

    unsubscribeSeries(q) {
      msg(3, u32(q));
    },

    quantitiesChanged(q) {
      msg(6, vec(u32)(q));
    },

    quantitiesAdded(q) {
      msg(4, u32(q));
    },

    quantitiesRemoved(q) {
      msg(5, u32(q));
    },

    devAddQuantity(q) {
      msg(7, u32(q));
    },

    devRemoveQuantity(q) {
      msg(8, u32(q));
    },

    subscribeQuantities() {
      msg(9);
    },

    unsubscribeQuantities() {
      msg(10);
    },
    
    subscribeQuantityName(q) {
      msg(11, u32(q));
    },

    unsubscribeQuantityName(q) {
      msg(12, u32(q));
    },

    setQuantityName(q, x) {
      msg(14, u32(q), lputf8(x));
    },
  };
}
