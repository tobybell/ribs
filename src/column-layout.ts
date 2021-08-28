import { animatable, Animatable, AnimatableStream } from './animatable';

type Width = number;
type Offset = number;

function san(w: Width) {
  return Math.max(Math.round(w), 0);
}

export class ColumnLayout {
  full = animatable(0);
  private xs: Animatable<Offset>[] = [];
  private ws: Animatable<Width>[] = [];

  constructor(widths: Width[]) {
    this.init(widths);
  }

  /** Re-initialize the layout with completely new widths. */
  init(widths: number[]) {
    const { xs, ws, full } = this;
    const n = widths.length;
    ws.length = n;
    xs.length = n + 1;
    let sum = 0;
    for (let i = 0; i < n; i += 1) {
      const w = san(widths[i]);
      xs[i] = animatable(sum);
      ws[i] = animatable(w);
      sum += w;
    }
    full.set([sum, false]);
    xs[n] = full;
  }

  /** Insert a new width at an index. */
  insert(index: number, width: number) {
    const { xs, ws } = this;
    const w = san(width);
    ws.splice(index, 0, animatable(w));
    xs.splice(index, 0, animatable(xs[index].value));
    const n = ws.length;
    for (let j = index + 1; j <= n; j += 1) {
      const x = xs[j];
      x.set([x.value + w, true]);
    }
  }

  /** Remove the width at an index. */
  remove(index: number) {
    const { xs, ws } = this;
    const w = ws[index].value;
    ws.splice(index, 1);
    xs.splice(index, 1);
    const n = ws.length;
    for (let j = index; j <= n; j += 1) {
      const x = xs[j];
      x.set([x.value - w, true]);
    }
  }

  x(i: number): AnimatableStream<Offset> {
    return this.xs[i].sub.bind(this.xs[i]);
  }

  width(i: number): AnimatableStream<Width> {
    return this.ws[i].sub.bind(this.ws[i]);
  }

  setWidth(i: number, w: Width) {
    const { xs, ws } = this;
    const target = ws[i];
    const delta = san(w) - target.value;
    target.set([target.value + delta, true]);
    const n = ws.length;
    for (let j = i + 1; j <= n; j += 1) {
      const neighbor = xs[j];
      neighbor.set([neighbor.value + delta, true]);
    }
  }

  shiftWidth(i: number, dw: number) {
    const { xs, ws } = this;
    const target = ws[i];
    const delta = san(target.value + dw) - target.value;
    target.set([target.value + delta, false]);
    const n = ws.length;
    for (let j = i + 1; j <= n; j += 1) {
      const neighbor = xs[j];
      neighbor.set([neighbor.value + delta, false]);
    }
  }
}

export function columnLayout(widths: Width[]) {
  return new ColumnLayout(widths);
}
