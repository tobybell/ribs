/** File for actual data stuff. */

import { Time, Quantity, Value, ValuePair } from "./data-stuff";
import { Handler } from "./stream-stuff";

type Message = ArrayBuffer;
type MessageHandler = Handler<Message>;

class ProtocolWriter {

  private handle: MessageHandler;

  constructor(h: MessageHandler) {
    this.handle = h;
  }

  addPoint(q: Quantity, t: Time, v: Value) {
    const buf = new ArrayBuffer(21);
    const view = new DataView(buf);
    view.setUint8(0, 0);
    view.setUint32(1, q, true);
    view.setFloat64(5, t, true);
    view.setFloat64(13, v, true);
    this.handle(buf);
  }

  addPoints(q: Quantity, v: ValuePair[]) {
    const n = v.length;
    const buf = new ArrayBuffer(9 + 16 * n);
    const view = new DataView(buf);
    view.setUint8(0, 1);
    view.setUint32(1, q, true);
    view.setUint32(5, n, true);
    for (let i = 0; i < n; i += 1) {
      view.setFloat64(9 + 16 * i, v[i][0], true);
      view.setFloat64(17 + 16 * i, v[i][1], true);
    }
    this.handle(buf);
  }
}

export function protocolWriter(h: MessageHandler) {
  return new ProtocolWriter(h);
}
