import { clickControl } from "./click-control";
import { div, rawInput, style, children, text } from "./div";
import { either, Handler, just, map, State, state, Stream, rsquare, join, all, not, stream } from "./stream-stuff";
import { simpleTitleBar } from "./toolbar-bar";
import { win, windowPane, useDrag } from "./window-stuff";
import { Component, domEvent, Effect, inputType, inputValue, render } from "./component";
import { noop, Thunk } from "./function-stuff";
import { addIcon, removeIcon, smallChevronDownIcon, smallChevronUpIcon } from "./icons";
import { row, rowF, space } from "./layout";
import { protocolWriter } from "./protocol-writer";
import { oneHot } from "./one-hot";
import { columnLayout } from "./column-layout";
import { checkbox } from "./controls";
import { posaphore, square } from "./posaphore";
import { cleanup, Cleanup, empty, Temporary } from "./temporary-stuff";

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
    clickControl(setActive, action),
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
    clickControl(setActive, action),
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



function addRemoveButton(add: Thunk, remove: Thunk): Component {
  const [highlightAdd, setHighlightAdd] = state(false);
  const [highlightRemove, setHighlightRemove] = state(false);
  const common = {
    outline: "1px solid rgba(255, 255, 255, .25)",
    width: "21px",
    height: "21px",
    boxSizing: "border-box",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
  };
  return div({
    width: "45px",
    height: "23px",
  }, [
    div({
      ...common,
      background: either(highlightAdd, "rgba(255, 255, 255, .25", "rgba(255, 255, 255, .15)"),
      margin: "1px",
    }, [addIcon()], [
      clickControl(setHighlightAdd, add),
    ]),
    div({
      ...common,
      background: either(highlightRemove, "rgba(255, 255, 255, .25", "rgba(255, 255, 255, .15)"),
      margin: "1px 1px 1px 0",
    }, [removeIcon()], [
      clickControl(setHighlightRemove, remove),
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
type MutableColumn = [Column, Handler<Width>];

interface Cell {
  (r: RowCoords, c: Column, selected: Stream<boolean>, select: Thunk): Component;
};

function tableDragger(width: State<number>, onWidth: Handler<number>) {
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
        onWidth(width() + delta);
        last = e.clientX;
      };
    }))(n),
  ]);
}

function tableHeaderCell(label: string, [offset, width]: Column, onWidth: Handler<Width>) {
  return div({
    position: "absolute",
    top: "0",
    left: "0",
    height: "100%",
    width: pixels(width),
    transform: map(offset, x => `translate(${x}px, 0)`),
    boxSizing: "border-box",
    paddingLeft: "3px",
    display: "flex",
    flexFlow: "row nowrap",
    alignItems: "center",
    fontSize: "11px",
    color: "#fff",
  }, [
    label,
    tableDragger(width, onWidth),
  ]);
}

function tableHeader(
  full: Stream<string>,
  [a, sa]: MutableColumn,
  [b, sb]: MutableColumn,
  [c, sc]: MutableColumn) {
  return div({
    height: "23px",
    minWidth: full,
    background: "#2c2c2c",
    borderBottom: "1px solid #484848",
    display: "flex",
  }, [
    tableHeaderCell("Network Name", a, sa),
    tableHeaderCell("Security", b, sb),
    tableHeaderCell("Auto-Join", c, sc),
  ]);
}

const pixels = (s: Stream<number>) => map(s, x => `${x}px`);

const basicCell = (...fx: Temporary<HTMLDivElement>[]): Cell => ([oy, sy], [ox, sx], selected, select) => div({
  position: "absolute",
  top: "0",
  left: "0",
  height: pixels(sy),
  width: pixels(sx),
  transform: map(join({ ox, oy }), x => `translate(${x.ox}px, ${x.oy}px)`),
  color: "#fff",
  background: either(selected, "#2357c9", "transparent"),
  display: "flex",
  flexFlow: "row nowrap",
  alignItems: "center",
  paddingLeft: "3px",
  boxSizing: "border-box",
  cursor: "default",
  transition: "transform .25s",
}, [], [
  clickControl(undefined, select),
  ...fx,
]);

const textCell = (label: string) => basicCell(children(label));

const checkboxCell = (checked: Stream<boolean>, check: Handler<boolean>) =>
  basicCell(
    children(checkbox(checked, check)),
  );

  //either(all([selected, not(focus)]), "#2357c9", "transparent"),
const editableTextCell = (label: State<string>, change: Handler<string>) => {
  const [focus, setFocus] = state(false);
  return basicCell(
    children(rawInput(
      style({
        border: "none",
        outline: "none",
        color: "#ffffff",
        fontSize: "13px",
        padding: "0",
        margin: "0",
        background: "none",
      }),
      inputType("text"),
      inputValue(label),
      domEvent("focus", () => setFocus(true)),
      domEvent("blur", () => setFocus(false)),
    )),
    focusHighlight(focus, false),
  );
};

type TableDataGetter = (row: number, col: number) => Cell;

interface ArrayStream<T> {
  sub(h: ListHandler<T>): Cleanup;
}

class MutableList<T> implements ArrayStream<T> {

  array: T[];
  subs: Set<ListHandler<T>>;

  constructor(arr: T[] = []) {
    this.array = arr;
    this.subs = new Set();
  }

  init(arr: T[]) {
    this.array = arr;
    this.subs.forEach(h => h.init(arr));
  }

  insert(at: number, x: T) {
    this.array.splice(at, 0, x);
    this.subs.forEach(h => h.insert(this.array, at));
  }

  push(...x: T[]) {
    const oldLen = this.array.length;
    this.array.push(...x);
    const newLen = this.array.length;
    for (let i = oldLen; i < newLen; i += 1) {
      this.subs.forEach(h => h.insert(this.array, i));
    }
  }

  remove(at: number) {
    const [x] = this.array.splice(at, 1);
    this.subs.forEach(h => h.remove(this.array, at, x));
  }

  move(from: number, to: number) {
    // TODO: This shifts much more than necessary. Do some performance tests maybe.
    const [x] = this.array.splice(from, 1);
    this.array.splice(to, 0, x);
    this.subs.forEach(h => h.move(this.array, from, to));
  }

  map<S>(fn: (x: T) => S) {
    return new ArrayMap(this, fn);
  }

  sub(h: ListHandler<T>) {
    h.init(this.array);
    this.subs.add(h);
    return () => this.subs.delete(h);
  }
}

class ArrayMap<T, S> implements ArrayStream<S> {
  private source: ArrayStream<T>;
  private fn: (x: T) => S;
  private arr: S[];
  private subs: Set<ListHandler<S>>;
  private enable: Temporary;

  constructor(source: ArrayStream<T>, fn: (x: T) => S) {
    this.source = source;
    this.fn = fn;
    this.arr = [];
    this.subs = new Set();
    this.enable = posaphore(this.listen);
  }

  private listen = () => {
    return this.source.sub({
      init: (d) => {
        this.arr = d.map(this.fn);
        this.subs.forEach(h => h.init(this.arr));
      },
      insert: (d, at) => {
        this.arr.splice(at, 0, this.fn(d[at]));
        this.subs.forEach(h => h.insert(this.arr, at));
      },
      remove: (d, at) => {
        const [x] = this.arr.splice(at, 1);
        this.subs.forEach(h => h.remove(this.arr, at, x));
      },
      move: (d, from, to) => {
        const [x] = this.arr.splice(from, 1);
        this.arr.splice(to, 0, x);
        this.subs.forEach(h => h.move(this.arr, from, to));
      },
    });
  };

  sub(h: ListHandler<S>) {
    const p = this.enable();
    h.init(this.arr);
    this.subs.add(h);
    return cleanup(p, () => this.subs.delete(h));
  }
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

type TableDataStream = (h: TableHandler) => Cleanup;

interface TableData {
  sub: TableDataStream;
};

const dgetter = (cells: Cell[][]): TableDataGetter => (i, j) => cells[i]?.[j];

const literalData = (cells: Cell[][]): TableData => {
  const get = dgetter(cells);
  const sub: TableDataStream = h => {
    h.init(get, cells.length, cells[0].length)
    return noop;
  };
  return { sub };
};

// TODO: Possibly just get rid of this.
const tableData = (x: ArrayStream<Cell[]>): TableData =>{
  const sub: TableDataStream = h => x.sub({
    init: (d) => {
      h.init(dgetter(d), d.length, d[0].length);
    },
    insert: (d, at) => {
      h.insert(dgetter(d), at);
    },
    remove: (d, at, old) => {
      // TOBU: Try changing this to `insert` and see what happens.
      h.remove(dgetter(d), at, old);
    },
    move: (d, from, to) => {
      h.move(dgetter(d), from, to);
    },
  });
  return { sub };
}

type MutableRows = (i: number) => RowCoords;

interface RowModifier {
  init(n: number): void;
  insert(i: number): void;
  remove(i: number): void;
  move(from: number, to: number): void;
}

function mutableRows(): [MutableRows, RowModifier] {
  const rowStride = 19;
  const yStreams: [State<number>, Handler<number>][] = [];
  const get: MutableRows = i => [yStreams[i][0], just(18)];

  const mut: RowModifier = {
    init(n) {
      yStreams.length = n;
      yStreams.fill(null as any).forEach((_, i, a) => a[i] = state(i * 19));
    },
    insert(i) {
      const n = yStreams.length;
      for (let j = i; j < n; j += 1) {
        const [y, setY] = yStreams[j];
        setY(y() + rowStride);
      }
      yStreams.splice(i, 0, state(i * 19));
    },
    remove(i) {
      yStreams.splice(i, 1);
      const n = yStreams.length;
      for (let j = i; j < n; j += 1) {
        const [y, setY] = yStreams[j];
        setY(y() - rowStride);
      }
    },
    move(from, to) {

    }
  };

  return [get, mut];
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

function tableView(data: TableData) {
  const cl = columnLayout(100, 100, 100);
  const a = cl.width(0);
  const b = cl.width(1);
  const c = cl.width(2);
  const ax = cl.offset(0);
  const bx = cl.offset(1);
  const cx = cl.offset(2);
  const full = cl.offset(3);
  const SetA = (x: Width) => cl.setWidth(0, x);
  const SetB = (x: Width) => cl.setWidth(1, x);
  const SetC = (x: Width) => cl.setWidth(2, x);

  const fullPixels = map(full, x => `${x}px`);

  const cols: [Column, Column, Column] = [[ax, a], [bx, b], [cx, c]];
  const [selectedRow, setSelectedRow] = state(0);
  const isSelected = oneHot(selectedRow);

  const [getId, freeId] = denseIntegerAllocator();

  const [fixedRows, rowControl] = mutableRows();

  interface ActiveRow {
    id: number;
    cells: Cleanup[];
  }

  const active: ActiveRow[] = [];

  let lnc = 0;
  return div({
    border: "1px solid #565656",
    background: "#202020",
    overflowX: "scroll",
  }, [
    tableHeader(fullPixels, [[ax, a], SetA], [[bx, b], SetB], [[cx, c], SetC]),
    div({
      overflowY: "scroll",
      height: "100px",
      minWidth: fullPixels,
    }, [], [
      n => {
        let childUs: Cleanup[] = [];
        const unsub = data.sub({
          init(data, nr, nc) {
            lnc = nc;
            active.forEach(r => {
              freeId(r.id);
              r.cells.forEach(u => u());
            });
            active.length = nr;
            rowControl.init(nr);
            childUs.forEach(u => u());
            childUs = [];
            for (let i = 0; i < nr; i += 1) {
              const id = getId();
              const us: Cleanup[] = [];
              active[i] = { id, cells: us };
              for (let j = 0; j < nc; j += 1) {
                us.push(
                  render(data(i, j)(fixedRows(i), cols[j], isSelected(id), () => setSelectedRow(id)), n),
                );
              }
            }
          },
          insert(data, at) {
            rowControl.insert(at);
            const id = getId();
            const us: Cleanup[] = [];
            active.splice(at, 0, { id, cells: us });
            for (let j = 0; j < lnc; j += 1) {
              us.push(
                render(data(at, j)(fixedRows(at), cols[j], isSelected(id), () => setSelectedRow(id)), n),
              );
            }
          },
          remove(data, at) {
            freeId(active[at].id);
            active[at].cells.forEach(u => u());
            active.splice(at, 1);
            rowControl.remove(at);
          },
          move(data, from, to) {

          }
        });
        return cleanup(unsub, () => cleanup(...childUs)());
      },
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
    "Beach House",
    "Astranis5",
    "slive",
    "Beach House",
    "Astranis5",
    "slive",
  ]);

  const data = tableData(words.map(x => [
    editableTextCell(just(`${Math.random()}`), console.log),
    textCell(x),
    checkboxCell(...state(Math.random() >= .5)),
  ]));

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
      section(tableView(data)),
      section(addRemoveButton(() => words.insert(2, "Testtt"), () => words.remove(2))),
      formSeparator(),
    ]),
  ]);
  return pane;
});
