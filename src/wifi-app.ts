import { plusMinusButton } from "./add-remove-button";
import { array, MutableArray } from "./array-stuff";
import { counter } from "./counter";
import { formSection } from "./form";
import { space } from "./layout";
import { posaphore } from "./posaphore";
import { state, Stream, Handler } from "./stream-stuff";
import { checkboxCell, editableTextCell, field, Field, table, textCell } from "./table";
import { cleanup } from "./temporary-stuff";
import { simpleTitleBar } from "./toolbar-bar";
import { win, windowPane } from "./window-stuff";

interface Network {
  name: Stream<string>;
  setName: Handler<string>;
};

function network(name: string) {
  const [ nameStream, setName ] = state(name);
  return { name: nameStream as Stream<string>, setName };
}

function contains<T>(array: MutableArray<T>, value: Stream<T>): Stream<boolean> {
  let last: T;
  const [result, setResult] = state(false);
  const enable = posaphore(() => cleanup(
    value(x => {
      last = x;
      setResult(array.value.indexOf(x) !== -1);
    }),
    array.stream({
      init(d) { setResult(d.indexOf(last) !== -1); },
      insert(d, i) { if (d[i] === last) setResult(true); },
      remove(_0, _1, old) { if (old === last) setResult(false); },
      move() {},
    }),
  ))
  return h => cleanup(enable(), result(h));
}

function removeValue<T>(array: MutableArray<T>, x: T): number | undefined {
  const i = array.value.indexOf(x);
  if (i >= 0) {
    array.remove(i);
    return i;
  }
}

class MyFunction {
  death: number;

  constructor() {
    this.death = 5 + 6;
  }

  drastic(x: number) {
    this.death = x;
  }

  call() {
    console.log(this.death);
  }
}

export const WifiApp = win(c => {

  const networks = array([
    network("Beach House"),
    network("Astranis5"),
    network("slive"),
    network("Samosa"),
  ]);

  const [selected, setSelected] = state<Network | undefined>(undefined);

  const hasSelection = contains(networks, selected);

  const addNetwork = () => {
    const n = network("Test" + next());
    networks.push(n);
    setSelected(n);
  };

  const removeSelectedNetwork = () => {
    const s = selected();
    if (s) {
      const arr = networks.value;
      const i = arr.indexOf(s);
      if (i >= 0) {
        networks.remove(i);
        setSelected(arr[Math.min(arr.length - 1, i)]);
      }
    }
  };

  const fields = array<Field<Network>>([
    field("Network Name", n => editableTextCell(n.name, console.log)),
    field("Security", () => textCell("WPA/WPA2 Personal")),
    field("Auto-Join", () => checkboxCell(...state(Math.random() >= .5))),
  ]);

  const next = counter();

  const pane = windowPane([
    simpleTitleBar("Preferred Networks", c.handles.middle, c.close),
    space(12),
    formSection(table(networks.stream, fields.stream, selected, setSelected)),
    formSection(plusMinusButton(addNetwork, removeSelectedNetwork, hasSelection)),
  ]);
  return pane;
});
