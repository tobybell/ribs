import { plusMinusButton } from '../add-remove-button';
import { array, arrayMap, contains } from '../array-stuff';
import { Quantity } from '../data-stuff';
import { formSection } from '../form';
import { space } from '../layout';
import { ProtocolWriter } from '../protocol-writer';
import { set2arr, SetStream } from '../set-stuff';
import { state, Sync } from '../state';
import { editableTextCell, field, Field, table, textCell } from '../table';
import { simpleTitleBar } from '../toolbar-bar';
import { win, windowPane } from '../window-stuff';

interface MutableQuantity {
  id: Quantity;
  name: Sync<string>;
}

function quant(id: Quantity, name: Sync<string>): MutableQuantity {
  return { id, name };
}

export const Quantities = (q: SetStream<Quantity>, names: (q: Quantity) => Sync<string>, w: ProtocolWriter) => win(c => {
  const quantities = arrayMap(set2arr(q, (a, b) => a - b), x => quant(x, names(x)));
  const selected = state<MutableQuantity | undefined>(undefined);
  const hasSelection = contains(quantities, selected);

  const addQuantity = () => {
    w.devAddQuantity(Math.floor(100 * Math.random()));
  };

  const removeSelectedQuantity = () => {
    const s = selected.value;
    if (s) {
      w.devRemoveQuantity(s.id);
    }
  };

  const fields = array<Field<MutableQuantity>>([
    field('ID', q => textCell(`${q.id}`)),
    field('Name', q => editableTextCell(q.name)),
  ]);

  const pane = windowPane([
    simpleTitleBar('Quantities', c.handles.middle, c.close),
    space(12),
    formSection(table(quantities, fields.stream, selected)),
    formSection(plusMinusButton(addQuantity, removeSelectedQuantity, hasSelection.stream)),
  ]);
  return pane;
});
