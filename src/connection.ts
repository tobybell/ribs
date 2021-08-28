import { AddOnlySet, addOnlySet } from './add-only-set';
import { Quantity, ValuePair } from './data-stuff';
import { Thunk } from './function-stuff';
import { posaphore } from './posaphore';
import { protocolReader } from './protocol-reader';
import { ProtocolWriter, protocolWriter } from './protocol-writer';
import { mutableSet, SetStream } from './set-stuff';
import { state, Sync } from './state';
import { enable, Handler } from './stream-stuff';
import { cleanup, Cleanup, Temporary } from './temporary-stuff';

function enabler(h: Handler<boolean>): Temporary<void> {
  return () => (h(true), () => h(false));
}

interface ServerContent {
  quantities: SetStream<Quantity>;
  close: Cleanup;
  writer: ProtocolWriter;

  quantityName: (q: Quantity) => Sync<string>;
  quantityData: (q: Quantity) => AddOnlySet<ValuePair>;
}

function serverConnection(handle: Handler<ArrayBuffer>, whileConnected: Temporary<void>) {
  let ws: WebSocket;
  let done = false;
  let wc: Cleanup | undefined;
  const init = () => {
    if (done) return;
    ws = new WebSocket('ws://localhost:3000');
    ws.onopen = _ => {
      wc = whileConnected();
    }
    ws.onmessage = e => {
      const { data } = e;
      if (data instanceof Blob) data.arrayBuffer().then(x => {
        handle(x);
      });
      else console.error('Unexpected WebSocket data', data);
    };
    ws.onclose = _ => {
      wc?.();
      wc = undefined;
      if (done) return;
      console.warn('Socket closed! Trying to reconnect...');
      setTimeout(init, 20000);
    };
  };
  init();

  const close = () => {
    done = true;
    ws.close();
  };

  // TODO: Queue up if try to send when not connected?
  const send = (x: ArrayBuffer) => {
    ws.send(x);
  };

  return { send, close };
}

/** Create a effect from a mutable set of effects. */
const temporarySet = <T>(s: SetStream<Temporary<T>>): Temporary<T> => x => {
  let us = new Map<Temporary<T>, Cleanup>();
  return cleanup(
    s({
      init(a) {
        us.forEach(u => u());
        a.forEach(t => us.set(t, t(x)));
      },
      add(t) {
        us.set(t, t(x));
      },
      remove(t) {
        us.get(t)!();
        us.delete(t);
      },
    }),
    () => us.forEach(u => u()),
  );
};

export function connect(): ServerContent {

  /** Hoisted set of effects we want to run whenever we're actively connected to the server. */
  const [connectedEffects, mce] = mutableSet<Temporary<void>>();
  const connectedEffect = temporarySet(connectedEffects);

  const read = protocolReader({
    quantitiesChanged(q) { cqm.init(q); },
    quantitiesAdded(q) { cqm.add(q); },
    quantitiesRemoved(q) { cqm.remove(q); },
    quantityNameChanged(q, s) { quantityNames.cache.get(q)?.raw.set(s); },
    seriesAdded(q, p) {
      quantitySeries.cache.get(q)?.raw.add(p);
    },
    seriesChanged(q, p) {
      quantitySeries.cache.get(q)?.raw.init(new Set(p));
    },
  });

  const conn = serverConnection(read, connectedEffect);

  const writer = protocolWriter(conn.send);

  /** Cached knowledge of the list of quantities. */
  const [cachedQuantities, cqm] = mutableSet<Quantity>();

  /** Whether we are interested in updates about quantities. */
  const interestedInQuantities = state(false);

  /** Posaphore for interest in quantities. */
  const enableInterestedInQuantities = posaphore(enabler(interestedInQuantities.set));

  // Experiment: How useful is this function? Creates a simple temporary from
  // an initializer and deinitializer/cleanup function.
  const couple = (init: Thunk, deinit: Thunk) => () => (init(), deinit);

  const subQuantities = enable(
    interestedInQuantities.stream,
    couple(writer.subscribeQuantities, writer.unsubscribeQuantities));

  mce.add(subQuantities);

  /**
   * This is an involved function. It creates a 'managed cache' of generic
   * values that come from the server, where each value is some property of a
   * quantity---for example, the name of a quantity, or the data for a
   * quantity. The resulting cache is used to automatically subscribe and
   * unsubscribe from the remote value using the shared server connection.
   */
  function makeManaged<H, Raw, Managed>({
    makeRaw,
    makeManaged,
    subscribe,
    unsubscribe,
  }: {
    makeRaw: () => Raw & { stream: Temporary<H>; };
    makeManaged: (q: Quantity) => Managed;
    subscribe: Handler<Quantity>;
    unsubscribe: Handler<Quantity>;
  }) {
    const cache = new Map<Quantity, {
      raw: Raw;
      managed: Managed & { stream: Temporary<H> };
    }>();
    const getter = (q: Quantity) => {
      let s = cache.get(q);
      if (!s) {
        const raw = makeRaw();
        const interested = state(false);
        const enableInterest = posaphore(enabler(interested.set));
        let to: number | undefined;
        const subName = enable(interested.stream, () => {
          if (to !== undefined) {
            clearTimeout(to);
            to = undefined;
          } else {
            subscribe(q);
          }
          return () => {
            to = setTimeout(() => unsubscribe(q), 200);
          }
        });
        mce.add(subName);
        s = { raw, managed: {
          ...makeManaged(q),
          stream: h => cleanup(enableInterest(), raw.stream(h)),
        }};
        cache.set(q, s);
      }
      return s.managed;
    };
    return { getter, cache };
  }

  const quantityNames = makeManaged({
    makeRaw: () => state('Unknown'),
    makeManaged: q => ({
      set: (x: string) => writer.setQuantityName(q, x),
    }),
    subscribe: writer.subscribeQuantityName,
    unsubscribe: writer.unsubscribeQuantityName,
  });

  const quantitySeries = makeManaged({
    makeRaw: () => addOnlySet<ValuePair>(),
    makeManaged: () => ({}),
    subscribe: writer.subscribeSeries,
    unsubscribe: writer.unsubscribeSeries,
  });

  return {
    writer,
    quantities: h => cleanup(enableInterestedInQuantities(), cachedQuantities(h)),
    close: cleanup(conn.close),
    quantityName: quantityNames.getter,
    quantityData: quantitySeries.getter,
  };
}
