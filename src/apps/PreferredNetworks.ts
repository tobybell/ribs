import { plusMinusButton } from "../add-remove-button";
import { array, contains } from "../array-stuff";
import { counter } from "../counter";
import { formSection } from "../form";
import { space } from "../layout";
import { state } from "../state";
import { Handler, Stream } from "../stream-stuff";
import { checkboxCell, editableTextCell, field, Field, table, textCell } from "../table";
import { simpleTitleBar } from "../toolbar-bar";
import { win, windowPane } from "../window-stuff";

interface Network {
  name: Stream<string>;
  setName: Handler<string>;
};

function network(name: string) {
  const ns = state(name);
  return { name: ns.get, setName: ns.set };
}

export const PreferredNetworks = win(c => {

  const networks = array([
    network("Beach House"),
    network("Astranis5"),
    network("slive"),
    network("Samosa"),
  ]);

  const selected = state<Network | undefined>(undefined);

  const hasSelection = contains(networks.stream, selected);

  const addNetwork = () => {
    const n = network("Test" + next());
    networks.push(n);
    selected.set(n);
  };

  const removeSelectedNetwork = () => {
    const s = selected.value;
    if (s) {
      const arr = networks.value;
      const i = arr.indexOf(s);
      if (i >= 0) {
        networks.remove(i);
        selected.set(arr[Math.min(arr.length - 1, i)]);
      }
    }
  };

  const fields = array<Field<Network>>([
    field("Network Name", n => editableTextCell({ get: n.name, set: console.log })),
    field("Security", () => textCell("WPA/WPA2 Personal")),
    field("Auto-Join", () => checkboxCell(state(Math.random() >= .5))),
  ]);

  const next = counter();

  const pane = windowPane([
    simpleTitleBar("Preferred Networks", c.handles.middle, c.close),
    space(12),
    formSection(table(networks.stream, fields.stream, selected)),
    formSection(plusMinusButton(addNetwork, removeSelectedNetwork, hasSelection.get)),
  ]);
  return pane;
});
