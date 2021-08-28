import { Quantity, ValuePair } from './data-stuff';
import { Handler } from './stream-stuff';

type Message = ArrayBuffer;

export interface ProtocolHandler {
  quantitiesChanged: (q: Set<Quantity>) => void;
  quantitiesAdded: (q: Quantity) => void;
  quantitiesRemoved: (q: Quantity) => void;
  quantityNameChanged: (q: Quantity, name: string) => void;
  seriesChanged: (q: number, p: ValuePair[]) => void;
  seriesAdded: (q: number, p: ValuePair) => void;
}

export function protocolReader(h: ProtocolHandler): Handler<Message> {
  const td = new TextDecoder();
  return x => {
    if (x.byteLength < 1) {
      console.warn('Discarding empty message.');
      return;
    }
    const v = new DataView(x);

    // TODO: Check bounds on all of these?
    const byType: {[k in number]?: (x: DataView) => void} = {
      4: v => {
        const q = v.getUint32(1, true);
        h.quantitiesAdded(q);
      },
      5: v => {
        const q = v.getUint32(1, true);
        h.quantitiesRemoved(q);
      },
      6: v => {
        const n = v.getUint32(1, true);
        const q = new Set<Quantity>();
        for (let i = 0; i < n; i += 1) {
          q.add(v.getUint32(5 + i * 4, true));
        }
        h.quantitiesChanged(q);
      },
      13: v => {
        const q = v.getUint32(1, true);
        const n = v.getUint32(5, true);
        const s = td.decode(new Uint8Array(x, 9, n));
        h.quantityNameChanged(q, s);
      },
      15: v => {
        const q = v.getUint32(1, true);
        const time = v.getFloat64(5, true);
        const value = v.getFloat64(13, true);
        h.seriesAdded(q, { time, value });
      },
      16: v => {
        const q = v.getUint32(1, true);
        const n = v.getUint32(5, true);
        const p = Array<ValuePair>(n);
        for (let i = 0; i < n; i += 1) {
          p[i] = {
            time: v.getFloat64(9 + i * 16, true),
            value: v.getFloat64(17 + i * 16, true),
          };
        }
        h.seriesChanged(q, p);
      },
    };

    const type = v.getUint8(0);
    const handler = byType[type];
    if (handler) {
      handler(v);
    } else {
      console.error('Unexpected message type', type);
    }
  };
}
