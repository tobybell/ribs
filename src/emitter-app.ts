import { clickControl, mutClick } from "./click-control";
import { div, rawInput, style, children, text, span } from "./div";
import { either, Handler, just, map, State, state, Stream, rsquare, join, all, not, stream, unique } from "./stream-stuff";
import { simpleTitleBar } from "./toolbar-bar";
import { win, windowPane, useDrag } from "./window-stuff";
import { Component, domEvent, Effect, enable, inputType, inputValue, render, renderAt, streamComp } from "./component";
import { noop, Thunk } from "./function-stuff";
import { addIcon, removeIcon, smallChevronDownIcon, smallChevronUpIcon } from "./icons";
import { row, rowF, space } from "./layout";
import { protocolWriter } from "./protocol-writer";
import { oneHot, streamOneHot } from "./one-hot";
import { ColumnLayout, columnLayout } from "./column-layout";
import { checkbox } from "./controls";
import { posaphore, square } from "./posaphore";
import { cleanup, Cleanup, cleanupFrom, empty, Temporary } from "./temporary-stuff";
import { aniJoin, animatable, Animatable, AnimatableHandler, AnimatableStream, unanimated } from "./animatable";
import { State as State2, state as state2 } from "./state";
import { counter } from "./counter";

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


function button(label: Stream<string>, action: Handler<MouseEvent>) {
  const [active, setActive] = state(false);
  return div({
    height: '19px',
    backgroundColor: either(active, '#336dd9', '#666768'),
    borderRadius: '3px',
    boxShadow: '0 0 1px rgba(0, 0, 0, .3), 0 1px 1px rgba(0, 0, 0, .15)',
    padding: '0 16px',
    width: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    overflow: 'hidden',
    cursor: 'default',
  }, [
    text(label),
    gloss,
  ], [
    clickControl(action, setActive),
  ]);
}

const focusHighlight = (enable: Stream<boolean>, inherit = true): Effect => n => render(div({
  position: "absolute",
  top: "0",
  left: "0",
  right: "0",
  bottom: "0",
  borderRadius: inherit ? "inherit" : ".5px",
  transition: either(enable, ".25s", "0s"),
  boxShadow: either(enable, "0 0 0 3px #436f98", "0 0 0 12px transparent"),
  pointerEvents: "none",
}), n);

function textField(value: Stream<string>, size = 13): Component {
  const [highlight, setHighlight] = state(false);
  return div({
    boxSizing: "border-box",
    padding: '0 4px',
    height: `${size + 6}px`,
    width: '100%',
    backgroundColor: '#404040',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'start',
    color: '#ffffff',
    borderRadius: '.5px',
    boxShadow: "0 2px 2px -2px rgba(0, 0, 0, .3) inset, 0 -.5px 0 0 rgba(255, 255, 255, .08) inset, 0 0 0 .5px rgba(255, 255, 255, .2)",
  }, [
    rawInput(
      style({
        background: "none",
        border: "none",
        outline: "none",
        color: "#ffffff",
        fontSize: `${size}px`,
        padding: "0",
        margin: "0",
        width: "100%",
      }),
      inputType("text"),
      inputValue(value),
      domEvent("focus", () => setHighlight(true)),
      domEvent("blur", () => setHighlight(false)),
    ),
  ], [
    focusHighlight(highlight),
  ]);
}

function halfButton(content: Component, action: Handler<MouseEvent>) {
  const [active, setActive] = state(false);
  return div({
    height: '50%',
    width: '100%',
    backgroundColor: either(active, '#336dd9', '#656565'),
    cursor: 'default',
  }, [content], [
    clickControl(action, setActive),
  ]);
}

function upDownButton(onUp: Handler<MouseEvent>, onDown: Handler<MouseEvent>) {
  return div({
    width: "11px",
    height: "18px",
  }, [
    div({
      width: "100%",
      height: "calc(100% + 2px)",
      transform: "translate(0, -1px)",
      borderRadius: '5px',
      boxShadow: '0 0 1px rgba(0, 0, 0, .3), 0 1px 1px rgba(0, 0, 0, .15)',
      overflow: 'hidden',
      cursor: 'default',
    }, [
      halfButton(smallChevronUpIcon(), onUp),
      halfButton(smallChevronDownIcon(), onDown),
      gloss,
    ]),
  ]);
}

function addRemoveButton(add: Thunk, remove: Thunk, enableRemove: Stream<boolean>): Component {
  const [highlightAdd, setHighlightAdd] = state(false);
  const [highlightRemove, setHighlightRemove] = state(false);
  const common = {
    outline: "1px solid rgba(255, 255, 255, .25)",
    width: "21px",
    height: "19px",
    boxSizing: "border-box",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  };
  return div({
    width: "45px",
    height: "21px",
  }, [
    div({
      ...common,
      background: either(highlightAdd, "rgba(255, 255, 255, .25", "rgba(255, 255, 255, .15)"),
      margin: "1px",
    }, [addIcon()], [
      clickControl(add, setHighlightAdd),
    ]),
    div({
      ...common,
      background: either(highlightRemove, "rgba(255, 255, 255, .25", "rgba(255, 255, 255, .15)"),
      margin: "1px 1px 1px 0",
      pointerEvents: either(enableRemove, "all", "none"),
      opacity: either(enableRemove, "1", ".5"),
    }, [removeIcon()], [
      clickControl(remove, setHighlightRemove),
    ])
  ], [
    rowF,
  ])
}

function upDownField(value: Stream<string>, onUp: Thunk, onDown: Thunk) {
  return row([
    div({ flex: "1 0 50px" }, [textField(value, 12)]),
    space(5),
    div({ flex: "0 0 11px" }, [upDownButton(onUp, onDown)]),
  ]);
}

type Offset = number;
type Width = number;
type RowCoords = [Stream<Offset>, Stream<Width>];
type Column = [State<Offset>, State<Width>];

interface CellProps {
  x: AnimatableStream<Offset>;
  y: AnimatableStream<Offset>;
  width: AnimatableStream<Width>;
  height: AnimatableStream<Width>;
  selected: Stream<boolean>;
  select: Thunk;
}

interface Cell {
  (x: CellProps): Component;
}

function tableDragger(shift: Handler<number>) {
  return div({
    position: "absolute",
    top: "0",
    right: "0",
    bottom: "0",
    padding: "3px 1px 3px 3px",
    cursor: "col-resize",
  }, [
    div({
      borderRight: "1px solid #484848",
      height: "100%",
    }),
  ], [
    n => domEvent("mousedown", useDrag(e => {
      let last = e.clientX;
      return e => {
        const delta = e.clientX - last;
        shift(delta);
        last = e.clientX;
      };
    }))(n),
  ]);
}

function tableHeaderCell(label: string, x: AnimatableStream<Offset>, width: AnimatableStream<Width>, resize: Handler<Width>) {
  return div({
    position: "absolute",
    top: "0",
    left: "0",
    height: "100%",
    boxSizing: "border-box",
    paddingLeft: "3px",
    display: "flex",
    flexFlow: "row nowrap",
    alignItems: "center",
    fontSize: "11px",
    color: "#fff",
  }, [
    label,
    tableDragger(resize),
  ], [
    n => width(([w, a]) => {
      n.style.transition = a ? ".25s" : "0s";
      n.style.width = `${w}px`;
    }),
    n => x(([x, a]) => {
      n.style.transition = a ? ".25s" : "0s";
      n.style.transform = `translate(${x}px, 0)`;
    }),
  ]);
}

export function arrayChildren(c: ArrayStream<Component>): Temporary<Node> {
  return n => {
    const us: Cleanup[] = [];
    return cleanup(
      c({
        init(d) {
          us.forEach(u => u());
          const len = d.length;
          us.length = len;
          for (let i = 0; i < len; i += 1) {
            us[i] = render(d[i], n);
          }
        },
        insert(d, i) {
          us.splice(i, 0, renderAt(d[i], n, i));
        },
        remove(d, i) {
          const [u] = us.splice(i, 1);
          u();
        },
        move(d, i) {
          console.error("Move not supported!");
        },
      }),
      cleanupFrom(us),
    );
  };
}

function tableHeader<T>(
  full: Stream<string>,
  cols: ArrayStream<TableColumn<T>>) {
  return div({
    height: "23px",
    minWidth: full,
    background: "#2c2c2c",
    borderBottom: "1px solid #484848",
    display: "flex",
  }, [], [arrayChildren(mapArray(cols, c => tableHeaderCell(c.name, c.x, c.width, c.shiftWidth)))]);
}

const aniTrans = (
  x: AnimatableStream<number>,
  y: AnimatableStream<number>,
): Temporary<ElementCSSInlineStyle> => n => aniJoin({ x, y })(([{ x, y }, a]) => {
  const { style } = n;
  style.transition = a ? "transform .25s" : "transform 0s";
  style.transform = `translate(${x}px, ${y}px)`;
});

const basicCell = (...fx: Temporary<HTMLDivElement>[]): Cell => c => div({
  position: "absolute",
  top: "0",
  left: "0",
  color: "#fff",
  background: either(c.selected, "#2357c9", "transparent"),
  display: "flex",
  flexFlow: "row nowrap",
  alignItems: "center",
  paddingLeft: "3px",
  boxSizing: "border-box",
  cursor: "default",
  transition: "transform .25s",
}, [], [
  mutClick(either(c.selected, undefined, c.select)),
  n => c.width(([x, a]) => {
    n.style.transition = a ? ".25s" : "0s";
    n.style.width = `${x}px`;
  }),
  n => c.height(([x, a]) => {
    n.style.transition = a ? ".25s" : "0s";
    n.style.height = `${x}px`;
  }),
  aniTrans(c.x, c.y),
  ...fx,
]);

const textCell = (label: string) => basicCell(children(label));

const checkboxCell = (checked: Stream<boolean>, check: Handler<boolean>) =>
  basicCell(
    children(checkbox(checked, check)),
  );

const editableTextCell = (label: State<string>, change: Handler<string>): Cell => {
  const [rawFocus, setFocus] = state(false);
  const focus = unique(rawFocus);
  const input = rawInput(
    style({
      position: "absolute",
      top: "0",
      left: "0",
      right: "0",
      bottom: "0",
      border: "none",
      outline: "none",
      color: "#ffffff",
      fontSize: "13px",
      padding: "0 0 0 3px",
      margin: "0",
      background: "#202020",
    }),
    inputType("text"),
    inputValue(label),
    domEvent("blur", () => setFocus(false)),
    n => (setTimeout(() => {
      n.focus();
      n.select();
    }), noop),
  );
  return c => {
    const nonInput = span(
      style({ color: "#ffffff", fontSize: "13px" }),
      children(text(label)),
      mutClick(either(c.selected, () => setFocus(true), undefined)),
    );
    return basicCell(
      children(streamComp(either(focus, input, nonInput))),
      focusHighlight(focus, false),
    )(c);
  };
};

type TableDataGetter = (row: number) => Cell[];

interface ArrayStream<T> {
  (h: ListHandler<T>): Cleanup;
}

interface ArrayState<T> {
  value: T[];
  stream: ArrayStream<T>;
}

class MutableList<T> {

  value: T[];
  private subs: Set<ListHandler<T>>;

  constructor(arr: T[] = []) {
    this.value = arr;
    this.subs = new Set();
  }

  init(arr: T[]) {
    this.value = arr;
    this.subs.forEach(h => h.init(arr));
  }

  insert(at: number, x: T) {
    this.value.splice(at, 0, x);
    this.subs.forEach(h => h.insert(this.value, at));
  }

  push(...x: T[]) {
    const oldLen = this.value.length;
    this.value.push(...x);
    const newLen = this.value.length;
    for (let i = oldLen; i < newLen; i += 1) {
      this.subs.forEach(h => h.insert(this.value, i));
    }
  }

  remove(at: number) {
    const [x] = this.value.splice(at, 1);
    this.subs.forEach(h => h.remove(this.value, at, x));
  }

  move(from: number, to: number) {
    // TODO: This shifts much more than necessary. Do some performance tests maybe.
    const [x] = this.value.splice(from, 1);
    this.value.splice(to, 0, x);
    this.subs.forEach(h => h.move(this.value, from, to));
  }

  stream: ArrayStream<T> = (h: ListHandler<T>) => {
    h.init(this.value);
    this.subs.add(h);
    return () => this.subs.delete(h);
  }
}

function length<T>(x: ArrayStream<T>): Stream<number> {
  const [get, set] = state(0);
  const enable = posaphore(() => x({
    init(d) { set(d.length); },
    insert(d) { set(d.length); },
    remove(d) { set(d.length); },
    move() {},
  }));
  return h => cleanup(enable(), get(h));
}

function mapArray<T, S>(src: ArrayStream<T>, fn: (x: T, i: number) => S): ArrayStream<S> {
  const array = new MutableList<S>();
  const enable = posaphore(() => {
    return src({
      init: (d) => array.init(d.map(fn)),
      insert: (d, at) => array.insert(at, fn(d[at], at)),
      remove: (_, at) => array.remove(at),
      move: (_, from, to) => array.move(from, to),
    });
  });
  return h => cleanup(enable(), array.stream(h));
}

function move<T>(array: T[], from: number, to: number) {
  const tmp = array[from];
  if (from < to)
    for (let i = from; i < to; i += 1)
      array[i] = array[i + 1];
  else
    for (let i = from; i > to; i -= 1)
      array[i] = array[i - 1];
  array[to] = tmp;
}

function mapGrid<T, S>(src1: ArrayState<T>, src2: ArrayState<S>, fn: (a: T, b: S) => Cleanup): Cleanup {
  const active: Cleanup[][] = [];
  return cleanup(
    src1.stream({
      init: (d) => {
        active.forEach(r => r.forEach(u => u()));
        const n = d.length;
        active.length = n;
        for (let i = 0; i < n; i += 1) {
          const x = d[i];
          active[i] = src2.value.map(y => fn(x, y));
        }
      },
      insert: (d, at) => {
        const x = d[at];
        active.splice(at, 0, src2.value.map(y => fn(x, y)));
      },
      remove: (_, at) => {
        const [r] = active.splice(at, 1);
        r.forEach(u => u());
      },
      move: (_, from, to) => move(active, from, to),
    }),
    src2.stream({
      init: (d) => {
        active.forEach(r => r.forEach(u => u()));
        const n = active.length;
        for (let i = 0; i < n; i += 1) {
          const x = src1.value[i];
          active[i] = d.map(y => fn(x, y));
        }
      },
      insert: (d, at) => {
        const y = d[at];
        const n = active.length;
        for (let i = 0; i < n; i += 1) {
          const x = src1.value[i];
          active[i].splice(at, 0, fn(x, y));
        }
      },
      remove: (_, at) => {
        const n = active.length;
        for (let i = 0; i < n; i += 1) {
          const [u] = active[i].splice(at, 1);
          u();
        }
      },
      move: (_, from, to) => {
        const n = active.length;
        for (let i = 0; i < n; i += 1) {
          move(active[i], from, to);
        }
      },
    }),
  );
}

interface ListHandler<T> {

  /** Handle replacing all data; new number of items. */
  init(d: T[]): void;

  /** Handle inserting an item at an index. */
  insert(d: T[], at: number): void;

  /** Handle removing the item at an index. */
  remove(d: T[], at: number, old: T): void;

  /** Handle moving an item from an index to a new index. */
  move(d: T[], from: number, to: number): void;
}

interface TableHandler {

  /** Handle replacing all data; new number of items. */
  init(d: TableDataGetter, rows: number, cols: number): void;

  /** Handle inserting an item at an index. */
  insert(d: TableDataGetter, at: number): void;

  /** Handle removing the item at an index. */
  remove(d: TableDataGetter, at: number, old: Cell[]): void;

  /** Handle moving an item from an index to a new index. */
  move(d: TableDataGetter, from: number, to: number): void;
}

const rowHeight = 18;
const rowStride = 19;

class TableRow<T> {
  index: State2<number>;
  value: T;
  y: AnimatableStream<number>;
  height: AnimatableStream<number> = just([rowHeight, false]);
  rawY: Animatable<number>;
  selected: Stream<boolean>;
  select: Thunk;

  constructor(index: State2<number>, value: T, y: Animatable<number>, selected: Stream<boolean>, select: Handler<T>) {
    this.index = index;
    this.value = value;
    this.rawY = y;
    this.y = y.sub.bind(y);
    this.selected = selected;
    this.select = () => select(value);
  }
}

function tableRows<T>(source: ArrayStream<T>, selected: Stream<T>, select: Handler<T>) {
  const rows = new MutableList<TableRow<T>>();
  const isSelected = oneHot(selected);
  const makeRow = (item: T, i: number) => {
    const index = state2(i);
    return new TableRow(
      index,
      item,
      animatable(i * rowStride),
      isSelected(item),
      select);
  }
  source({
    init(d) {
      rows.init(d.map(makeRow));
    },
    insert(d, i) {
      const rowsArr = rows.value;
      const n = rowsArr.length;
      for (let j = i; j < n; j += 1) {
        const { rawY: y, index } = rowsArr[j];
        y.set([y.value + rowStride, true]);
        index.set(index.value + 1);
      }
      rows.insert(i, makeRow(d[i], i));
    },
    remove(_, i) {
      rows.remove(i);
      const rowsArr = rows.value;
      const n = rowsArr.length;
      for (let j = i; j < n; j += 1) {
        const { rawY: y, index } = rowsArr[j];
        y.set([y.value - rowStride, true]);
        index.set(index.value - 1);
      }
    },
    move(_, from, to) {
      console.error("Move not implemented");
      rows.move(from, to);
    },
  });
  return rows;
}

function denseIntegerAllocator(): [() => number, Handler<number>] {
  let n = 0;
  const free: number[] = [];
  const acquire = () => {
    const last = free.pop();
    if (last !== undefined) {
      return last;
    }
    return n++;
  };
  const release = (x: number) => {
    if (x === n - 1) {
      n -= 1;
    } else {
      free.push(x);
    }
  }
  return [acquire, release];
}

type CellMaker<T> = (x: T) => Cell;

interface Field<T> {
  name: string;
  cell: CellMaker<T>;
}

/** Shorthand for defining a table field. */
const field = <T>(name: string, cell: (x: T) => Cell) => ({ name, cell });

class TableColumn<T> {
  name: string;
  x: AnimatableStream<number>;
  width: AnimatableStream<number>;
  setWidth: Handler<number>;
  shiftWidth: Handler<number>;
  cell: CellMaker<T>;

  constructor(
      props: Field<T>,
      x: AnimatableStream<number>,
      width: AnimatableStream<number>,
      setWidth: Handler<number>,
      shiftWidth: Handler<number>) {
    this.name = props.name;
    this.x = x;
    this.width = width;
    this.setWidth = setWidth;
    this.shiftWidth = shiftWidth;
    this.cell = props.cell;
  }
}

function tableColumns<T>(fields: ArrayStream<Field<T>>) {
  const layout = columnLayout([]);
  const cols = new MutableList<TableColumn<T>>();
  fields({
    init(d) {
      layout.init(d.map(_ => 150));
      cols.init(d.map((f, i) => new TableColumn(
        f, layout.x(i), layout.width(i),
        layout.setWidth.bind(layout, i),
        layout.shiftWidth.bind(layout, i),
      )));
    },
    insert(d, i) {
      layout.insert(i, 150);
      cols.insert(i, new TableColumn(
        d[i], layout.x(i), layout.width(i),
        layout.setWidth.bind(layout, i),
        layout.shiftWidth.bind(layout, i),
      ));
    },
    remove(d, i) {
      layout.remove(i);
      cols.remove(i);
    },
    move() {
      console.error("Move not supported!");
    }
  });

  const full = layout.full.sub.bind(layout.full);

  return { cols, full };
}

function table<T>(data: ArrayStream<T>, fields: ArrayStream<Field<T>>, selected: Stream<T>, select: Handler<T>) {
  const rows = tableRows(data, selected, select);
  const { cols, full } = tableColumns(fields);

  const fullPixels = map(full, x => `${x[0]}px`);

  const fullHeight = map(length(data), x => x * rowStride);

  return div({
    border: "1px solid #565656",
    background: "#202020",
    overflowX: "scroll",
  }, [
    tableHeader(fullPixels, cols.stream),
    div({
      overflowY: "scroll",
      height: "100px",
      minWidth: fullPixels,
    }, [
      div({
        height: map(fullHeight, x => `${x}px`),
      }, [], [
        n => mapGrid(rows, cols, (r, c) => render(c.cell(r.value)({
          x: c.x,
          y: r.y,
          width: c.width,
          height: r.height,
          selected: r.selected,
          select: r.select,
        }), n)),
      ]),
    ]),
  ]);
}


function section(input: Component) {
  return div({ padding: "4px 16px", }, [input]);
}

function labeledSection(label: string, input: Component) {
  return row([
    div({ color: "white", flex: "0 0 60px" }, [label]),
    space(10),
    div({ color: "white", flex: "1 0 0" }, [input]),
  ], [
    style({
      padding: "6px 16px",
    }),
  ]);
}

function submitSection(...items: Component[]) {
  return row(items, [
    style({
      padding: "8px 16px",
      justifyContent: "flex-end",
    }),
  ]);
}

function formSeparator() {
  return div({
    padding: "12px 16px",
  }, [
    div({ background: "#464646", height: "1px", width: "100%" }),
  ]);
}

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

  const words = new MutableList([
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

  const fields = new MutableList<Field<string>>([
    field("Network Name", _ => editableTextCell(just(`${Math.random()}`), console.log)),
    field("Security", x => textCell(x)),
    field("Auto-Join", x => checkboxCell(...state(Math.random() >= .5))),
  ]);

  const next = counter();

  const ud = upDownField(map(quantity, String), incr, decr);
  const pane = windowPane([
    simpleTitleBar("Emitter", c.handles.middle, c.close),
    div({
      width: '100%',
    }, [
      labeledSection("Quantity:", ud),
      labeledSection("Time:", textField(map(time, String))),
      labeledSection("Value:", textField(map(value, String))),
      submitSection(button(just("Add Point"), addPoint)),
      formSeparator(),
      section(table(words.stream, fields.stream, selected, setSelected)),
      section(addRemoveButton(() => words.insert(2, "Test" + next()), () => words.remove(2), map(wordsLength, x => x > 2))),
      submitSection(button(just("Add Points"), addPoint)),
      formSeparator(),
    ]),
  ]);
  return pane;
});
