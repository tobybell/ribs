import { clickControl, mutClick } from "./click-control";
import { div, rawInput, style, children, text, span } from "./div";
import { either, Handler, just, map, State, state, Stream, unique } from "./stream-stuff";
import { simpleTitleBar } from "./toolbar-bar";
import { win, windowPane, useDrag } from "./window-stuff";
import { Component, domEvent, Effect, inputType, inputValue, render, renderAt, streamComp } from "./component";
import { noop, Thunk } from "./function-stuff";
import { addIcon, removeIcon, smallChevronDownIcon, smallChevronUpIcon } from "./icons";
import { row, rowF, space } from "./layout";
import { protocolWriter } from "./protocol-writer";
import { oneHot } from "./one-hot";
import { columnLayout } from "./column-layout";
import { button, checkbox, upDownButton } from "./controls";
import { posaphore } from "./posaphore";
import { cleanup, Cleanup, cleanupFrom, Temporary } from "./temporary-stuff";
import { aniJoin, animatable, Animatable, AnimatableStream } from "./animatable";
import { counter } from "./counter";
import { formSection, formSeparator, labeledSection, submitSection } from "./form";
import { textField, upDownField } from "./text-field";
import { focusHighlight } from "./focus-stuff";
import { array, length, MutableArray } from "./array-stuff";
import { checkboxCell, editableTextCell, Field, field, table, textCell } from "./table";
import { plusMinusButton } from "./add-remove-button";

const gloss = div({
  position: 'absolute',
  top: '0',
  left: '0',
  width: '100%',
  height: '100%',
  boxShadow: 'inset 0 1px 1px -1px rgba(255, 255, 255, .6)',
  borderRadius: 'inherit',
  pointerEvents: 'none',
});



export const emitterApp = win(c => {

  const writer = protocolWriter(x => console.log(new Uint8Array(x)));

  const [quantity, setQuantity] = state(10);
  const incr = () => setQuantity(quantity() + 1);
  const decr = () => setQuantity(quantity() - 1);

  const [time, setTime] = state(0.0);
  const [value, setValue] = state(0.0);

  const addPoint = () => {
    writer.addPoint(quantity(), time(), value());
  };

  const words = new MutableArray([
    "Beach House",
    "Astranis5",
    "slive",
    "Beach House2",
    "Astranis52",
    "slive2",
    "Beach House3",
    "Astranis53",
    "slive3",
  ]);
  const [selected, setSelected] = state<string | undefined>(undefined);

  const wordsLength = length(words.stream);

  const fields = array<Field<string>>([
    field("Network Name", () => editableTextCell(just(`${Math.random()}`), console.log)),
    field("Security", textCell),
    field("Auto-Join", () => checkboxCell(...state(Math.random() >= .5))),
  ]);

  const next = counter();

  const ud = upDownField(map(quantity, String), incr, decr);
  const pane = windowPane([
    simpleTitleBar("Emitter", c.handles.middle, c.close),
    space(12),
    labeledSection("Quantity:", ud),
    labeledSection("Time:", textField(map(time, String))),
    labeledSection("Value:", textField(map(value, String))),
    submitSection(button(just("Add Point"), addPoint)),
    formSeparator(),
    formSection(table(words.stream, fields.stream, selected, setSelected)),
    formSection(plusMinusButton(() => words.insert(2, "Test" + next()), () => words.remove(2), map(wordsLength, x => x > 2))),
    submitSection(button(just("Add Points"), addPoint)),
  ]);
  return pane;
});
