import { Quantity, ValuePair } from "./data-stuff";
import { posaphore } from "./posaphore";
import { protocolReader } from "./protocol-reader";
import { ProtocolWriter, protocolWriter } from "./protocol-writer";
import { mutableSet, SetHandler, SetStream } from "./set-stuff";
import { state, Sync } from "./state";
import { enable, Handler } from "./stream-stuff";
import { cleanup, Cleanup, Temporary } from "./temporary-stuff";


function enabler(h: Handler<boolean>): Temporary<void> {
  return () => (h(true), () => h(false));
}

interface ServerContent {
  quantities: SetStream<Quantity>;
  close: Cleanup;
  writer: ProtocolWriter;

  qNames: (q: Quantity) => Sync<string>;
  qSeries: (q: Quantity) => SetStream<ValuePair>;
}

function serverConnection(handle: Handler<ArrayBuffer>, whileConnected: Temporary<void>) {
  let ws: WebSocket;
  let done = false;
  let wc: Cleanup | undefined;
  const init = () => {
    if (done) return;
    ws = new WebSocket("ws://localhost:3000");
    ws.onopen = _ => {
      wc = whileConnected();
    }
    ws.onmessage = e => {
      const { data } = e;
      if (data instanceof Blob) data.arrayBuffer().then(x => {
        console.log("Receive", x);
        handle(x);
      });
      else console.error("Unexpected WebSocket data", data);
    };
    ws.onclose = _ => {
      wc?.();
      wc = undefined;
      if (done) return;
      console.warn("Socket closed! Trying to reconnect...");
      setTimeout(init, 5000);
    };
  };
  init();

  const close = () => {
    done = true;
    ws.close();
  };

  // TODO: Queue up if try to send when not connected?
  const send = (x: ArrayBuffer) => {
    console.log("Send", new Uint8Array(x));
    ws.send(x);
  };

  return { send, close };
}

const temporarySet = <T>(s: SetStream<Temporary<T>>): Temporary<T> => x => {
  let us = new Map<Temporary<T>, Cleanup>();
  return s({
    change(a) {
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
  });
};

export function connect(): ServerContent {

  /** Hoisted set of effects we want to run whenever we're actively connected to the server. */
  const [connectedEffects, mce] = mutableSet<Temporary<void>>();
  const connectedEffect = temporarySet(connectedEffects);

  const read = protocolReader({
    quantitiesChanged(q) { cqm.change(q); },
    quantitiesAdded(q) { cqm.add(q); },
    quantitiesRemoved(q) { cqm.remove(q); },
    quantityNameChanged(q, s) { cachedNames.get(q)?.[1](s); },
    seriesAdded(q, p) {
      cachedSeries.get(q)?.[1].add(p);
    },
    seriesChanged(q, p) {
      cachedSeries.get(q)?.[1].change(new Set(p));
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

  const subQuantities = enable(interestedInQuantities.get, () => {
    writer.subscribeQuantities();
    return () => writer.unsubscribeQuantities();
  });

  const cachedNames = new Map<Quantity, [Sync<string>, Handler<string>]>();
  const cachedSeries = new Map<Quantity,  [SetStream<ValuePair>, SetHandler<ValuePair>]>();
  
  mce.add(subQuantities);

  const qNames = (q: Quantity) => {
    let s = cachedNames.get(q);
    if (!s) {
      const rawS = state("Unknown");
      const interested = state(false);
      const enableInterest = posaphore(enabler(interested.set));
      let to: number | undefined;
      const subName = enable(interested.get, () => {
        if (to !== undefined) {
          clearTimeout(to);
          to = undefined;
        } else {
          writer.subscribeQuantityName(q);
        }
        return () => {
          to = setTimeout(() => writer.unsubscribeQuantityName(q), 100);
        }
      });
      mce.add(subName);
      s = [{
        get: h => cleanup(enableInterest(), rawS.get(h)),
        set: x => writer.setQuantityName(q, x),
      }, rawS.set];
      cachedNames.set(q, s);
    }
    return s[0];
  };

  const qSeries = (q: Quantity) => {
    let s = cachedSeries.get(q);
    if (!s) {
      const [rawSet, rawSetHandler] = mutableSet<ValuePair>();
      const interested = state(false);
      const enableInterest = posaphore(enabler(interested.set));
      let to: number | undefined;
      const subber = enable(interested.get, () => {
        if (to !== undefined) {
          clearTimeout(to);
          to = undefined;
        } else {
          writer.subscribeSeries(q);
        }
        return () => {
          to = setTimeout(() => writer.unsubscribeSeries(q), 100);
        }
      });
      mce.add(subber);
      s = [h => cleanup(enableInterest(), rawSet(h)), rawSetHandler];
      cachedSeries.set(q, s);
    }
    return s[0];
  };

  return {
    writer,
    quantities: h => cleanup(enableInterestedInQuantities(), cachedQuantities(h)),
    close: cleanup(conn.close),
    qNames,
    qSeries,
  };
}
