import { arrayMap, ArrayState, ArrayStream, length, move, MutableArray } from "./array-stuff";
import { Component, domEvent, inputType, inputValue, render } from "./component";
import { children, div, rawInput, span, style, text } from "./div";
import { arrayChildren } from "./array-children";
import { Stream, Handler, map, either, unique, just, streamComp } from "./stream-stuff";
import { Cleanup, cleanup, Temporary } from "./temporary-stuff";
import { aniJoin, animatable, Animatable, AnimatableStream } from "./animatable";
import { noop, Thunk } from "./function-stuff";
import { useDrag } from "./window-stuff";
import { mutClick } from "./click-control";
import { checkbox } from "./controls";
import { focusHighlight } from "./focus-stuff";
import { MutableState, State, state, Sync } from "./state";
import { columnLayout } from "./column-layout";
import { oneHot } from "./one-hot";

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

function tableHeader<T>(
  full: Stream<string>,
  cols: ArrayStream<TableColumn<T>>) {
  return div({
    height: "23px",
    minWidth: full,
    background: "#2c2c2c",
    borderBottom: "1px solid #484848",
    display: "flex",
  }, [], [arrayChildren(arrayMap(cols, c => tableHeaderCell(c.name, c.x, c.width, c.shiftWidth)))]);
}

type Offset = number;
type Width = number;

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

export const textCell = (label: string) => basicCell(children(label));

export const checkboxCell = (checked: Sync<boolean>) => basicCell(
  children(checkbox(checked))
);

export const editableTextCell = (value: Sync<string>): Cell => {
  const { get: rawFocus, set: setFocus } = state(false);
  const focus = unique(rawFocus);
  let pre: string;
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
    inputValue(value.get),
    // TODO: Move this somewhere else so other text inputs can use it?
    n => domEvent("keypress", e => {
      if (e.key === "Enter") {
        e.stopPropagation();
        e.preventDefault();
        n.blur();
      }
    })(n),
    n => domEvent("blur", () => {
      n.value !== pre && value.set(n.value);
      setFocus(false);
    })(n),
    n => (setTimeout(() => {
      pre = n.value;
      n.focus();
      n.select();
    }), noop),
  );
  return c => {
    const nonInput = span(
      style({ color: "#ffffff", fontSize: "13px" }),
      children(text(value.get)),
      mutClick(either(c.selected, () => setFocus(true), undefined)),
    );
    return basicCell(
      children(streamComp(either(focus, input, nonInput))),
      focusHighlight(focus, false),
    )(c);
  };
};

const rowHeight = 18;
const rowStride = 19;

class TableRow<T> {
  index: MutableState<number>;
  value: T;
  y: AnimatableStream<number>;
  height: AnimatableStream<number> = just([rowHeight, false]);
  rawY: Animatable<number>;
  selected: Stream<boolean>;
  select: Thunk;

  constructor(index: MutableState<number>, value: T, y: Animatable<number>, selected: Stream<boolean>, select: Handler<T>) {
    this.index = index;
    this.value = value;
    this.rawY = y;
    this.y = y.sub.bind(y);
    this.selected = selected;
    this.select = () => select(value);
  }
}

function tableRows<T>(source: ArrayStream<T>, selected: Stream<T>, select: Handler<T>) {
  const rows = new MutableArray<TableRow<T>>();
  const isSelected = oneHot(selected);
  const makeRow = (item: T, i: number) => {
    const index = state(i);
    return new TableRow(
      index,
      item,
      animatable(i * rowStride),
      isSelected(item),
      select);
  }
  const cleanupRows = source({
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
  return { rows, cleanupRows };
}

type CellMaker<T> = (x: T) => Cell;

export interface Field<T> {
  name: string;
  cell: CellMaker<T>;
}

/** Shorthand for defining a table field. */
export function field<T>(name: string, cell: (x: T) => Cell): Field<T> {
  return { name, cell };
}

interface TableColumn<T> {
  name: string;
  x: AnimatableStream<number>;
  width: AnimatableStream<number>;
  setWidth: Handler<number>;
  shiftWidth: Handler<number>;
  cell: CellMaker<T>;
}

function tableColumns<T>(fields: ArrayStream<Field<T>>) {
  const layout = columnLayout([]);
  const cols = new MutableArray<TableColumn<T>>();
  const makeCol = (f: Field<T>, i: number): TableColumn<T> => {
    return {
      ...f,
      x: layout.x(i),
      width: layout.width(i),
      setWidth: w => layout.setWidth(i, w),
      shiftWidth: d => layout.shiftWidth(i, d),
    };
  };
  const cleanupColumns = fields({
    init(d) {
      layout.init(d.map(_ => 150));
      cols.init(d.map(makeCol));
    },
    insert(d, i) {
      layout.insert(i, 150);
      cols.insert(i, makeCol(d[i], i));
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

  return { cols, full, cleanupColumns };
}

export function table<T>(data: ArrayStream<T>, fields: ArrayStream<Field<T>>, selected: Sync<T>) {
  const { rows, cleanupRows } = tableRows(data, selected.get, selected.set);
  const { cols, full, cleanupColumns } = tableColumns(fields);

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
      height: "110px",
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
    ], [
      () => cleanupRows,
      () => cleanupColumns,
    ]),
  ]);
}
