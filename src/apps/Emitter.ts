import { plusMinusButton } from '../add-remove-button';
import { array, contains } from '../array-stuff';
import { button } from '../controls';
import { ValuePair } from '../data-stuff';
import { formSection, formSeparator, labeledSection, submitSection } from '../form';
import { space } from '../layout';
import { ProtocolWriter } from '../protocol-writer';
import { state, Sync } from '../state';
import { Handler, just, map, stream, Stream } from '../stream-stuff';
import { editableTextCell, Field, field, table } from '../table';
import { textField, upDownField } from '../text-field';
import { simpleTitleBar } from '../toolbar-bar';
import { win, windowPane } from '../window-stuff';

type Streams<T> = { [K in keyof T]: Stream<T[K]> };
type Setters<T> = { [K in keyof T]: Handler<T[K]> };
type Syncs<T> = { [K in keyof T]: Sync<T[K]> };


interface Mutable<T> {
  value: T;
  syn: Syncs<T>,
};

type MutableValuePair = Mutable<ValuePair>;

const blank = <T>() => Object.create(null) as T;

const keys = <T>(o: T) => Object.keys(o) as (keyof T)[];

function mutable<T>(obj: T): Mutable<T> {
  const result = blank<Mutable<T>>();
  const mut = blank<Syncs<T>>();
  const o = obj as any;
  keys(obj).forEach(k => {
    const [str, send] = stream<T[keyof T]>();
    mut[k] = {
      stream: h => (h(o[k]), str(h)),
      set: (x: any) => {
        o[k] = x;
        send(x);
      },
    };
  });
  result.value = obj;
  result.syn = mut;
  return result;
}

function mutValPair(time: number, value: number): MutableValuePair {
  return mutable({ time, value });
}

export const Emitter = (w: ProtocolWriter) => win(c => {
  const quantity = state(10);
  const incr = () => quantity.set(quantity.value + 1);
  const decr = () => quantity.set(quantity.value - 1);

  const time = state(0.0);
  const value = state(0.0);

  const addPoint = () => {
    w.addPoint(quantity.value, time.value, value.value);
  };

  const points = array([mutValPair(0, 0)]);

  const selected = state<MutableValuePair | undefined>(undefined);
  const hasSelection = contains(points.stream, selected);
  const addTablePoint = () => {
    const newPoint = mutValPair(0, 0);
    points.push(newPoint);
    selected.set(newPoint);
  };
  const removeSelectedPoint = () => {
    const s = selected.value;
    if (s) {
      const arr = points.value;
      const i = arr.indexOf(s);
      if (i >= 0) {
        points.remove(i);
        selected.set(arr[Math.min(arr.length - 1, i)]);
      }
    }
  };

  const addPoints = () => {
    w.addPoints(quantity.value, points.value.map(x => x.value));
  };

  const format = (x: number) => Intl.NumberFormat(navigator.language, {
    minimumFractionDigits: 1,
    maximumFractionDigits: 16,
  }).format(x);

  const parseF = (f: Handler<number>): Handler<string> => s => {
    const p = parseFloat(s);
    if (!isNaN(p)) f(p);
  };
  const parseI = (f: Handler<number>): Handler<string> => s => {
    const p = parseInt(s);
    if (!isNaN(p)) f(p);
  };
  const mapSync = <T, S>(s: Sync<T>, to: (x: T) => S, from: (h: Handler<T>) => Handler<S>): Sync<S> => ({
    stream: map(s.stream, to),
    set: from(s.set),
  });

  const fields = array<Field<MutableValuePair>>([
    field('Time', p => editableTextCell(mapSync(p.syn.time, format, parseF))),
    field('Value', p => editableTextCell(mapSync(p.syn.value, format, parseF))),
  ]);

  const ud = upDownField({
    stream: map(quantity.stream, String),
    set: parseI(quantity.set),
  }, incr, decr);
  const pane = windowPane([
    simpleTitleBar('Emitter', c.handles.middle, c.close),
    space(12),
    labeledSection('Quantity:', ud),
    labeledSection('Time:', textField(mapSync(time, String, parseF))),
    labeledSection('Value:', textField(mapSync(value, String, parseF))),
    submitSection(button(just('Add Point'), addPoint)),
    formSeparator(),
    formSection(table(points.stream, fields.stream, selected)),
    formSection(plusMinusButton(addTablePoint, removeSelectedPoint, hasSelection.stream)),
    submitSection(button(just('Add Points'), addPoints)),
  ]);
  return pane;
});
