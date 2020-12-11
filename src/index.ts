import { ticks, scaleLinear } from 'd3';

export {};

type Unsubscriber = () => void;
type Handler<T> = (x: T) => void;
type Thunk = () => void;
type Stream<T> = (f: Handler<T>) => Unsubscriber;
type Contents<T> = T extends Stream<infer U> ? U : never;
type Values<T> = T | Stream<T>;

/** No-op function. */
const noop = () => {};

/** Stream that just produces a fixed value. */
const just = <T>(x: T) => ((h?: Handler<T>) => h ? (h(x), noop) : x) as State<T>;

/** Stream that produces no/unit value at a given period. */
const tick = (dt: number): Stream<void> => h => {
  h();
  const interval = setInterval(() => h(), dt * 1000);
  return () => clearInterval(interval);
};

/** Transform values from one stream into another with the given function. */
const map = <T, S>(s: Stream<T>, f: (x: T) => S): Stream<S> =>
  h => s(x => h(f(x)));

/** Reduce values from a stream. */
const reduce = <T, S>(s: Stream<T>, f: (a: S, x: T) => S, initial: S): Stream<S> => {
  return h => {
    let a = initial;
    h(a);
    return s(x => {
      a = f(a, x);
      h(a);
    });
  };
};

/** Reduce values from multiple streams. */
type ReducePair<A, T> = [Stream<T>, (a: A, x: T) => A];
const reduceMulti = <A, T extends any[]>(ss: {[K in keyof T]: ReducePair<A, T[K]>}, init: A): Stream<A> => {
  return h => {
    let a = init;
    h(a);
    const us = ss.map(([s, f]) => s(x => {
      a = f(a, x);
      h(a);
    }));
    return () => us.forEach(u => u());
  };
};

/** Create a pull stream that counts up from 0. */
const counter = () => {
  let x = -1;
  return () => {
    x += 1;
    return x;
  };
}

/**
 * Union multiple streams.
 */
const merge = <T extends Stream<any>[]>(...ss: T): Stream<{[K in keyof T]: Contents<T[K]>}[number]> => h => {
  return cleanup(...ss.map(s => s(h)));
};

const filterSame = <T>(s: Stream<T>): Stream<T> => h => {
  let last: any = undefined;
  return s(x => {
    if (x !== last) h(x);
    last = x;
  });
};

/** Number of streams returning true. */
const countTrue = (streams: Stream<boolean>[]): Stream<number> => {
  const n = streams.length;
  return h => {
    const values = Array(n);
    let m = 0;
    return cleanup(...streams.map((s, i) => s(x => {
      if (x && !values[i]) {
        m += 1;
      } else if (!x && values[i]) {
        m -= 1;
      }
      values[i] = x;
      h(m);
    })));
  };
}

/** If any of the streams evaluate to true. */
const any = (streams: Stream<boolean>[]) =>
  filterSame(map(countTrue(streams), x => x != 0));

/** If all of the streams evaluate to true. */
const streamAll = (streams: Stream<boolean>[]) => {
  const n = streams.length;
  return filterSame(map(countTrue(streams), x => x === n));
};

/**
 * Join two streams into a stream of array pairs.
 *
 * TODO: I want a better API for this.
 */
const join = <T extends readonly any[]>(ss: {[K in keyof T]: Stream<T[K]>}): Stream<{-readonly [K in keyof T]: T[K]}> => {
  const n = ss.length;
  return h => {
    let nRemaining = n;
    let rs = Array(n);
    let cs = Array(n) as {-readonly [K in keyof T]: T[K]};
    const us = ss.map((s, i) => s(x => {
      cs[i] = x;
      if (!rs[i]) {
        nRemaining -= 1;
        rs[i] = true;
      }
      if (!nRemaining) h(cs);
    }));
    return () => us.forEach(u => u());
  };
};

/**
 * Join an object of streams into a stream of objects.
 */
const joinObj = <T extends {}>(streams: {[K in keyof T]: Stream<T[K]>}): Stream<{[K in keyof T]: T[K]}> => {
  const keys = Object.keys(streams) as any as (keyof T)[];
  return h => {
    let nRemaining = keys.length;
    const rs = {} as {[K in keyof T]?: boolean};
    const cs = {} as {[K in keyof T]: T[K]};
    const us = keys.map(k => streams[k](x => {
      cs[k] = x;
      if (!rs[k]) {
        nRemaining -= 1;
        rs[k] = true;
      }
      if (!nRemaining) h(cs);
    }));
    return () => us.forEach(u => u());
  };
};

/** Stream that produces a monotonically increasing time at some period. */
const time = (dt: number) => map(tick(dt), () => performance.now() / 1000);

/** Stream that produces alternating `true`/`false` values. */
const square = (dt: number) => reduce(tick(dt), a => !a, false);

type State<T> = {
  (): T;
  (h: Handler<T>): Unsubscriber;
}

function useGState<T>(init: T): [State<T>, Handler<T>] {
  let curr = init;
  let handlers = new Set<Handler<T>>();
  const get = (h?: Handler<T>) => {
    if (!h) return curr;
    handlers.add(h);
    h(curr);
    return () => { handlers.delete(h); };
  };
  const set = (x: T) => {
    curr = x;
    handlers.forEach(h => h(x));
  };
  return [get as State<T>, set];
}

function useState<T>(initial: T): [Stream<T>, Handler<T>] {
  let curr = initial;
  let handlers = new Set<Handler<T>>();
  const state: Stream<T> = (h: Handler<T>) => {
    handlers.add(h);
    h(curr);
    return () => { handlers.delete(h); };
  };
  const setState = (x: T) => {
    curr = x;
    handlers.forEach(h => h(x));
  };
  return [state, setState];
}

function useEnabler(): [Stream<boolean>, () => Cleanup] {
  const [values, set] = useState(false);
  return [values, () => {
    set(true);
    return () => set(false);
  }];
}

function useStream<T = void>(): [Stream<T>, Handler<T>] {
  let handlers = new Set<Handler<T>>();
  const stream: Stream<T> = (h: Handler<T>) => {
    handlers.add(h);
    return () => handlers.delete(h);
  };
  const emit = (x: T) => handlers.forEach(h => h(x));
  return [stream, emit];
};

interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FrameHandles {
  top: Handler<MouseEvent>;
  bottom: Handler<MouseEvent>;
  left: Handler<MouseEvent>;
  right: Handler<MouseEvent>;
  topLeft: Handler<MouseEvent>;
  topRight: Handler<MouseEvent>;
  bottomLeft: Handler<MouseEvent>;
  bottomRight: Handler<MouseEvent>;
  middle: Handler<MouseEvent>;
}

interface WindowControls {
  close(): void;
  minimize(): void;
  maximize(): void;
  focus(): void;
  handles: FrameHandles;
}

function cleanup(...debts: Unsubscriber[]) {
  return () => debts.forEach(x => x());
}

function windowFrame(
  frame: Stream<Frame>,
  zIndex: Stream<number>,
  resize: FrameHandles,
  content: Component,
  focus: Stream<void>,
  onFocus?: Thunk): Component {
  return r => {
    const debts = [];
    const div = document.createElement('div');
    const style = div.style;
    style.position = 'absolute';
    debts.push(frame(f => {
      style.left = `${f.x}px`;
      style.top = `${f.y}px`;
      style.width = `${f.width}px`;
      style.height = `${f.height}px`;
    }));
    debts.push(zIndex(i => {
      style.zIndex = `${i}`;
    }));
    debts.push(render(content, div));
    div.appendChild(topDragger(resize.top));
    div.appendChild(topLeftDragger(resize.topLeft));
    div.appendChild(topRightDragger(resize.topRight));
    div.appendChild(bottomLeftDragger(resize.bottomLeft));
    div.appendChild(bottomRightDragger(resize.bottomRight));
    div.appendChild(bottomDragger(resize.bottom));
    div.appendChild(leftDragger(resize.left));
    div.appendChild(rightDragger(resize.right));
    onFocus && div.addEventListener('mousedown', onFocus, true);

    // Whenever we get focused, move ourselves to the end of our parent?
    debts.push(focus(() => {
      // This is a sort of temporary hack to deal with the fact that some click
      // handlers get disrupted when we call `appendChild`. If we got rid of all
      // `click` events and just turned them into `mousedown`/`mouseup` events,
      // this might not be necessary.
      if (div !== div.parentNode?.lastChild) {
        div.parentNode?.appendChild(div);
      }
    }));

    debts.push(mount(div, r));

    return cleanup(...debts);
  };
}

const WindowPane = (content?: ElementThing[], effects?: Effect[]) => Div({
  backgroundColor: '#323334',
  borderRadius: '5px',
  overflow: 'hidden',
  transform: 'translateZ(0)',
  boxSizing: 'border-box',
  boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7)',
  display: 'flex',
  flexFlow: 'column nowrap',
  width: '100%',
  height: '100%',
}, content, effects);

const SimpleWindow = (title: string, content: Component): Window => (c: WindowControls) => {
  const pane = WindowPane([
    simpleTitleBar(title, c.handles.middle, c.close),
    content,
    borderOverlay,
  ]);
  return pane;
};

const Finder: Window = (c: WindowControls) => {
  const [expanded, setExpanded] = useState(false);
  return finder(expanded, setExpanded, c);
};

const rsquare = () => square(Math.random());

function finder(expanded: Stream<boolean>, setExpanded: any, c: WindowControls) {
  const [which, setWhich] = useState(0);
  const a = useOneHot(which);
  const content = WindowPane([
    menuBar(c.handles.middle, c.close),
    Div({
      flex: '1 0 0',
      display: 'flex',
      alignItems: 'stretch',
    }, [
      sidebar(expanded, setExpanded),
      Div({ flex: '1 0 auto' }, [
        radio(a(0), () => setWhich(0)),
        radio(a(1), () => setWhich(1)),
        radio(a(2), () => setWhich(2)),
        checkbox(...useState(false)),
        checkbox(...useState(true)),
        select(),
        slider(...useState(.5)),
      ]),
    ]),
    borderOverlay,
  ], [
    ContextMenu(menu([
      menuItem({ label: 'Back' }),
      menuItem({ label: 'Reload Page' }),
      menuSeparator,
      menuItem({ label: 'Show Page Source' }),
      menuItem({ label: 'Save Page As...' }),
      menuItem({ label: 'Print Page...' }),
      menuSeparator,
      menuItem({ label: 'Inspect Element' }),
    ])),
  ]);
  return content;
}

type ElementThing = HTMLElement | SVGSVGElement | Component | string | undefined;
type StreamableCSS = {[K in keyof CSSStyleDeclaration]: string | Stream<string>};

function elem<K extends keyof HTMLElementTagNameMap>(s: K, p?: HTMLElement) {
  const e = document.createElement(s);
  if (p) {
    p.appendChild(e);
  }
  return e;
}

/** Create an invisible node to use as a placeholder/marker in the DOM. */
const marker = () => document.createComment('');

/** Render a component into a container. */
function render(c: Component, p: Node) {
  const m = marker();
  p.appendChild(m);
  return cleanup(c(m), () => m.remove());
}

const Text = (s: Stream<string>): Component => r => {
  const n = document.createTextNode('');
  return cleanup(
    s(x => n.textContent = x),
    mount(n, r),
  );
};

const Div = (
  style: Partial<StreamableCSS>,
  children?: ElementThing[],
  effects?: (Effect | undefined)[],
): Component => r => {
  const t = elem('div');

  const us = [];

  // Style bits.
  const keys = Object.keys(style) as (keyof CSSStyleDeclaration)[];
  const estyle = t.style as any;
  keys.forEach(k => {
    const v = style[k];
    if (typeof v === 'string') {
      estyle[k] = v;
    } else if (v) {
      us.push(v(x => estyle[k] = x));
    }
  });

  children?.forEach((x, i) => {
    if (!x) return;
    if (x instanceof HTMLElement || x instanceof SVGSVGElement) {
      t.appendChild(x);
    } else if (typeof x == 'string') {
      t.appendChild(document.createTextNode(x));
    } else {
      // TODO: Figure out how unsubscription should work.
      us.push(render(x, t));
    }
  });

  if (effects) {
    effects.forEach(f => { if (f) us.push(f(t)); });
  }

  us.push(mount(t, r));

  return cleanup(...us);
};

type Limits = [number, number];
type RectSize = [number, number]; // width, height


// Things to be able to plot:
// - Fixed known data.
// - Stream of incoming data in order.
// - Big known data but which we might need to fetch one piece at a time.
//
// "Data provider."
// A data provider needs a way for the plot to tell it what regions of data
// it's interested in, and a way for it to give the plot that data.
//
// Could the plot subscribe to regions of data? The plot might say, I am
// interested in region [0, 5]. Then the data notifies the plot whenever the
// regions change?

// The plot needs to be able to sample data at granular resolution, 

interface Data {
  x: number[];
  y: number[];
}

const makeData = () => {
  let x = 0;
  let y = Math.random();
  const N = 1000;
  const dataX = [x];
  const data = [y];
  for (let i = 0; i < N; i += 1) {
    x += .002 * Math.random();
    y += .05 * Math.random() - .025;
    dataX.push(x);
    data.push(y);
  }
  return { x: dataX, y: data };
}

const Plot2D = (
  xlim: State<Limits>,
  ylim: State<Limits>,
  onSetXLim: Handler<Limits>,
  onSetYLim: Handler<Limits>,
  data: State<Data>,
): Component => r => {
  const container = elem('div');
  const canvas = elem('canvas');
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  const [size, setSize] = useState([0, 0] as RectSize);

  const o = new ResizeObserver(entries => {
    const entry = entries[entries.length - 1];
    if (entry) {
      const { width, height } = entry.contentRect;
      setSize([Math.floor(width), Math.floor(height)]);
    }
  });

  container.style.width = '100%';
  container.style.height = '100%';
  o.observe(container);

  const title = just('Stock price');
  const xLabel = just('Time [d]');
  const yLabel = just('Price [$]');

  const tickLength = 5;
  const axisPad = 4;

  const tickFont = "10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif";
  const labelFont = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif";
  const titleFont = "bold 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif";

  canvas.style.width = '200px';
  canvas.style.height = '200px';
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';

  const cleanups: Cleanup[] = [];

  const xs = scaleLinear();
  const ys = scaleLinear();

  if (ctx) {
    let x0 = 0;
    let y0 = 0;
    const updateDrag = (e: MouseEvent) => {
      const [xda, xdb] = xs.domain();
      const [xra, xrb] = xs.range();
      const xt = (e.clientX - xra) / (xrb - xra);
      const xSpread = xdb - xda;
      const xLo = x0 - xt * xSpread;
      onSetXLim([xLo, xLo + xSpread]);

      const [yda, ydb] = ys.domain();
      const [yra, yrb] = ys.range();
      const yt = (e.clientY - yra) / (yrb - yra);
      const ySpread = ydb - yda;
      const yLo = y0 - yt * ySpread;
      onSetYLim([yLo, yLo + ySpread]);
    };
    const finishDrag = (e: MouseEvent) => {
      cleanupDrag();
    };
    const cleanupDrag = () => {
      window.removeEventListener('mousemove', updateDrag);
      window.removeEventListener('mouseup', finishDrag);
    };
    cleanups.push(Event('mousedown', e => {
      x0 = xs.invert(e.clientX);
      y0 = ys.invert(e.clientY);
      window.addEventListener('mousemove', updateDrag);
      window.addEventListener('mouseup', finishDrag);
    })(canvas));
    cleanups.push(cleanupDrag);

    cleanups.push(size(([w, h]) => {
      canvas.width = w * 2;
      canvas.height = h * 2;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.scale(2, 2);
    }));

    const axisConfig = joinObj({ size, xlim, ylim, xLabel, yLabel, title, data });

    interface AxisConfig {
      size: RectSize;
      xlim: Limits;
      ylim: Limits;
      title?: string;
      xLabel?: string;
      yLabel?: string;
      data: Data;
    }

    // Whenever width changes, need to compute a new left and right.
    // Whenever height changes, 

    const drawAxes = ({ xLabel, yLabel, title, size: [width, height], xlim: [xMin, xMax], ylim: [yMin, yMax], data }: AxisConfig) => {
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, width, height);

      const top = title ? 25 : 10;
      const bottom = height - (xLabel ? 38 : 18);
      const yts = ticks(yMin, yMax, Math.abs(top - bottom) / 60);
      ctx.font = tickFont;
      const maxWidth = Math.ceil(Math.max(0, ...yts.map(t => ctx.measureText(`${t}`).width)));
      const left = maxWidth + (yLabel ? 25 : 9);
      const right = width - 10;
      const xMid = (left + right) / 2;
      const yMid = (top + bottom) / 2;
      const xts = ticks(xMin, xMax, Math.abs(right - left) / 60);
      xs.domain([xMin, xMax]).range([left, right]);
      ys.domain([yMin, yMax]).range([bottom, top]);
      ctx.fillStyle = '#000';
      ctx.lineWidth = 1;

      // Draw x ticks.
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.beginPath();
      for (const t of xts) {
        const x = xs(t);
        ctx.moveTo(x, bottom);
        ctx.lineTo(x, bottom - tickLength);
        ctx.fillText(`${t}`, x, bottom + 3);
      }
      ctx.stroke();
      
      // Draw y ticks.
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.beginPath();
      for (const t of yts) {
        const y = ys(t);
        ctx.moveTo(left, y);
        ctx.lineTo(left + tickLength, y);
        ctx.fillText(`${t}`, left - axisPad, y);
      }
      ctx.stroke();

      const {x: dx, y: dy} = data;
      const N = dx.length;
      ctx.strokeStyle = '#2965CC';
      ctx.beginPath();
      ctx.moveTo(xs(dx[0]), ys(dy[0]));
      for (let i = 1; i <= N; i += 1) {
        ctx.lineTo(xs(dx[i]), ys(dy[i]));
      }
      ctx.stroke();

      // Draw borders.
      ctx.strokeStyle = '#000';
      ctx.beginPath();
      ctx.moveTo(left, top);
      ctx.lineTo(right, top);
      ctx.lineTo(right, bottom);
      ctx.lineTo(left, bottom);
      ctx.closePath();
      ctx.stroke();

      // Draw x-label.
      if (xLabel) {
        ctx.font = labelFont;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(xLabel, xMid, height - 5);
      }

      // Draw title.
      if (title) {
        ctx.font = titleFont;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(title, xMid, 4);
      }

      // Draw y-label.
      if (yLabel) {
        ctx.font = labelFont;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.save();
        ctx.translate(4, yMid);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(yLabel, 0, 0);
        ctx.restore();
      }
    };

    cleanups.push(axisConfig(drawAxes));
  }

  cleanups.push(mount(container, r));

  return cleanup(...cleanups);
};

const FillLayer = (
  style: Partial<StreamableCSS>,
  children?: ElementThing[],
  effects?: Effect[]
) => Div({
  position: 'absolute',
  width: '100%',
  height: '100%',
  top: '0',
  left: '0',
  ...style,
}, children, effects);


const span = (
  style: Partial<StreamableCSS>,
  children?: ElementThing[],
): Component => r => {
  const e = elem('span');

  // Style bits.
  const keys = Object.keys(style) as (keyof CSSStyleDeclaration)[];
  const estyle = e.style as any;
  keys.forEach(k => {
    const v = style[k];
    if (typeof v === 'string') {
      estyle[k] = v;
    } else if (v) {
      // TODO: Unsubscription
      v(x => estyle[k] = x);
    }
  });

  children?.forEach((x, i) => {
    if (!x) return;
    if (x instanceof HTMLElement || x instanceof SVGSVGElement) {
      e.appendChild(x);
    } else if (typeof x == 'string') {
      e.appendChild(document.createTextNode(x));
    } else {
      // TODO: Figure out how unsubscription should work.
      const u = render(x, e);
    }
  });

  return mount(e, r);
};

function dragger(top: string, bottom: string, left: string, right: string, width: string, height: string, cursor: string, onMouseDown: Handler<MouseEvent>) {
  const div = elem('div');
  const {style} = div;
  style.position = 'absolute';
  style.top = top;
  style.bottom = bottom;
  style.left = left;
  style.right = right;
  style.width = width;
  style.height = height;
  style.cursor = cursor;
  div.addEventListener('mousedown', onMouseDown);
  return div;
}

const topDragger = (h: Handler<MouseEvent>) =>
  dragger('-3px', '', '6px', '6px', '', '6px', 'ns-resize', h);

const bottomDragger = (h: Handler<MouseEvent>) =>
  dragger('', '-3px', '6px', '6px', '', '6px', 'ns-resize', h);

const leftDragger = (h: Handler<MouseEvent>) =>
  dragger('6px', '6px', '-3px', '', '6px', '', 'ew-resize', h);

const rightDragger = (h: Handler<MouseEvent>) =>
  dragger('6px', '6px', '', '-3px', '6px', '', 'ew-resize', h);

const topLeftDragger = (h: Handler<MouseEvent>) =>
  dragger('-3px', '', '-3px', '', '9px', '9px', 'nwse-resize', h);

const topRightDragger = (h: Handler<MouseEvent>) =>
  dragger('-3px', '', '', '-3px', '9px', '9px', 'nesw-resize', h);

const bottomLeftDragger = (h: Handler<MouseEvent>) =>
  dragger('', '-3px', '-3px', '', '9px', '9px', 'nesw-resize', h);

const bottomRightDragger = (h: Handler<MouseEvent>) =>
  dragger('', '-3px', '', '-3px', '9px', '9px', 'nwse-resize', h);

const borderOverlay = Div({
  position: 'absolute',
  top: '0',
  left: '0',
  width: '100%',
  height: '100%',
  borderRadius: '5px',
  boxShadow: '0 .5px 0 rgba(255, 255, 255, .2) inset',
  pointerEvents: 'none',
}, [
  Div({
    width: '100%',
    height: '100%',
    border: '1px solid rgba(255, 255, 255, .15)',
    borderRadius: '5px',
    boxSizing: 'border-box',
  }),
]);

const dropdownBorderOverlay = Div({
  position: 'absolute',
  top: '0',
  left: '0',
  width: '100%',
  height: '100%',
  borderRadius: '0 0 5px 5px',
  pointerEvents: 'none',
}, [
  Div({
    width: '100%',
    height: '100%',
    border: '1px solid rgba(255, 255, 255, .15)',
    borderRadius: '0 0 5px 5px',
    borderTopWidth: '0',
    boxSizing: 'border-box',
  }),
]);

const windowTitle = (title: string) => Div({
  flex: '0 1 auto',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
  color: '#b7b7ba',
  overflow: 'hidden',
  cursor: 'default',
}, [
  title,
]);

const titleBar = (title: string, onClose: Handler<void>) => Div({
  display: 'flex',
  height: '22px',
  width: '100%',
  justifyContent: 'space-between',
  alignItems: 'center',
}, [
  windowButtons(onClose),
  windowTitle(title),
  Div({
    flex: '0 10000 52px',
    height: '8px',
    minWidth: '8px',
  }),
]);

const windowButtons = (close: Handler<never>): Component => r => {
  const [hover, setHover] = useState(false);
  const clickingClose = useState(false);
  const clickingMin = useState(false);
  const clickingMax = useState(false);

  const showDetail = any([hover, clickingClose[0], clickingMin[0], clickingMax[0]]);

  const closeButton = windowButton(
    '#ec6559', '#ef8e84', windowCloseIcon, showDetail, clickingClose[1], close);
  const minButton = windowButton(
    '#e0c14c', '#fcee71', windowMinimizeIcon, showDetail, clickingMin[1], () => 0);
  const maxButton = windowButton(
    '#71bf46', '#9ded6f', windowMaximizeIcon, showDetail, clickingMax[1], () => 0);

  return Div({
    display: 'flex',
    marginRight: '8px',
  }, [
    closeButton,
    minButton,
    maxButton,
  ], [
    Hover(setHover),
  ])(r);
};

const windowButton = (
    defaultColor: string,
    highlightColor: string,
    icon: any,
    showDetail: Stream<boolean>,
    onClicking: Handler<boolean>,
    onClick: Handler<MouseEvent>): Component => r => {
  const [highlight, setHighlight] = useState(false);
  const color = map(highlight, x => x ? highlightColor : defaultColor);
  const content = enable(showDetail, icon({ color: 'black' }));
  return Div({
    height: '12px',
    width: '12px',
    borderRadius: '6px',
    backgroundColor: color,
    marginLeft: '8px',
  }, [
    content,
  ], [
    useClickController(setHighlight, onClick, onClicking),
  ])(r);
};

function simpleTitleBar(title: string, windowDrag: Handler<MouseEvent>, onClose: Handler<void>) {
  return Div({
    flex: '0 0 auto',
    backgroundColor: '#3d3e3f',
    boxShadow: '0 -1px 0 rgba(0, 0, 0, 0.24) inset, 0 -.5px 0 #000 inset',
    overflow: 'scroll',
  }, [
    titleBar(title, onClose),
  ], [
    Event('mousedown', windowDrag),
  ]);
}

function menuBar(windowDrag: Handler<MouseEvent>, onClose: Handler<void>) {
  return Div({
    flex: '0 0 auto',
    backgroundColor: '#3d3e3f',
    boxShadow: '0 -1px 0 rgba(0, 0, 0, 0.24) inset, 0 -.5px 0 #000 inset',
    overflow: 'scroll',
  }, [
    titleBar('Ribs — zsh — Solarized Dark – 98x26', onClose),
    toolbar(
      toolbarButton({icon: iconsIcon()}),
      toolbarButton({icon: listIcon()}),
      toolbarButton({icon: columnsIcon()}),
      toolbarButton({icon: galleryIcon()}),
      flexibleSpace,
      toolbarSearch(),
    ),
  ], [
    Event('mousedown', windowDrag),
  ]);
}

function FillDragRegion(h: Handler<MouseEvent>) {
  return FillLayer({ zIndex: '0' }, [], [Event('mousedown', h)]);
}

function toolbar(...items: Component[]) {
  return Div({ display: 'flex', margin: '3px 8px 8px' }, items, [
    ContextMenu(menu([
      menuItem({ label: 'Icon and Text' }),
      menuItem({ label: 'Icon Only' }),
      menuItem({ label: 'Text Only' }),
      menuSeparator,
      menuItem({ label: 'Customize Toolbar...' }),
    ]))
  ]);
}

interface ButtonProps {
  title?: string;
  icon?: Component;
  rightIcon?: Component;
}

function toolbarButton({title, icon, rightIcon}: ButtonProps): Component {
  return Div({
    backgroundColor: '#636365',
    height: '22px',
    boxSizing: 'border-box',
    boxShadow: '0 .5px 0 rgba(255, 255, 255, .2) inset, 0 1px 0 rgba(255, 255, 255, .05) inset',
    borderRadius: '4px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    color: '#ffffff',
    marginRight: '8px',
    padding: '0 5px',
  }, [
    icon,
  ]);
}

function toolbarSearch() {
  return Div({
    backgroundColor: '#636365',
    height: '22px',
    boxSizing: 'border-box',
    boxShadow: '0 .5px 0 rgba(255, 255, 255, .2) inset, 0 1px 0 rgba(255, 255, 255, .05) inset',
    borderRadius: '4px',
    flex: '0 1 300px',
    display: 'flex',
    alignItems: 'center',
    color: '#ffffff',
    marginRight: '8px',
    padding: '0 5px',
  }, [
    searchIcon(),
    span({
      color: 'rgba(255, 255, 255, 0.3)',
      marginLeft: '3px',
      flex: '1 0 auto',
    }, [
      'Search',
    ]),
  ]);
}

interface ChildrenProps {
  expanded: Stream<boolean>;
  onExpand: Handler<void>;
  onCollapse: Handler<void>;
  children: ItemProps[];
}

interface ItemProps {
  title: string;
}

function sidebar(expanded: Stream<boolean>, setExpanded: any) {
  return Div({
    backgroundColor: '#29282a',
    width: '150px',
    borderRight: '1px solid #000000',
    overflow: 'scroll',
  }, [
    section('iCloud', [
      item({
        title: 'iCloud Drive',
        icon: sidebariCloudIcon(),
        active: true,
        expanded,
        onExpand: () => setExpanded(true),
        onCollapse: () => setExpanded(false),
        children: [
          item({title: 'Documents', level: 1, icon: sidebarDocumentsFolderIcon()}),
          item({title: 'Desktop', level: 1, icon: sidebarDesktopFolderIcon()}),
        ],
      }),
      item({title: 'Documents', icon: sidebarDocumentsFolderIcon()}),
      item({title: 'Desktop', icon: sidebarDesktopFolderIcon()}),
      item({title: 'Books', icon: sidebarGenericFolderIcon()}),
      item({title: 'Applications', icon: sidebarGenericFolderIcon()}),
      item({title: 'Archive', icon: sidebarGenericFolderIcon()}),
      item({title: 'Fonts', icon: sidebarGenericFolderIcon()}),
      item({title: 'Sheets', icon: sidebarGenericFolderIcon()}),
      item({title: 'Pictures', icon: sidebarGenericFolderIcon()}),
      item({title: 'Movies', icon: sidebarGenericFolderIcon()}),
    ]),
    section('Favorites', [
      item({title: 'Books', icon: sidebarGenericFolderIcon()}),
      item({title: 'Applications', icon: sidebarGenericFolderIcon()}),
      item({title: 'Movies', icon: sidebarMoviesFolderIcon()}),
    ]),
    section('Smart Mailboxes', []),
    section('On My Mac', []),
    section('Stanford', []),
  ]);
}

function section(title: string, items: Component[]) {
  return Div({
    padding: '6px 0',
    overflow: 'auto',
  }, [
    sidebarHeading(title),
    ...items,
  ]);
}

function sidebarHeading(name: string) {
  return Div({
    display: 'flex',
    alignItems: 'center',
    height: '17px',
    paddingLeft: '9px',
    color: 'rgba(255, 255, 255, 0.62)',
    fontSize: '11px',
  }, [
    name,
  ]);
}

function item({ title, icon, level = 0, active = false, expanded = just(false), onExpand, onCollapse, children }: {
  title: string;
  level?: number;
  icon?: Component;
  active?: boolean;
  expanded?: Stream<boolean>;
  onExpand?: Handler<MouseEvent>;
  onCollapse?: Handler<MouseEvent>;
  children?: any[];
}) {
  const indent = `${level * 16}px`;
  const hasChildren = children && children.length > 0;
  const openCaret = caretDownIcon({ onClick: onCollapse });
  const closedCaret = caretRightIcon({ onClick: onExpand });
  const s = mounter(space(18));
  const carets = map(expanded, x => hasChildren
    ? x ? openCaret : closedCaret : s);

  return Div({
    paddingTop: '2px',
    boxSizing: 'border-box',
  }, [
    Div({
      display: 'flex',
      alignItems: 'center',
      height: '24px',
      paddingLeft: indent,
      color: '#ffffff',
      backgroundColor: active ? 'rgba(255, 255, 255, .17)' : 'transparent',
    }, [
      streamComp(carets),
      icon,
      space(5),
      title,
    ]),
    Div({
      overflow: 'hidden',
      transition: 'height .2s cubic-bezier(.4,1,.75,.9)',
      height: map(expanded, x => x ? 'auto' : '0'),
    }, children),
  ]);
}

type IconPath = [number, string];

const icons: { [key: string]: IconPath[] } = {
  sidebarDesktopFolder: [
    [1, 'M0,8C0,5.792 1.792,4 4,4C4,4 32,4 32,4C34.208,4 36,5.792 36,8L36,28C36,30.208 34.208,32 32,32C32,32 4,32 4,32C1.792,32 0,30.208 0,28C0,28 0,8 0,8ZM32.013,30C33.107,29.993 33.993,29.106 34,28.013L34,10L2,10L2,28C2,29.104 2.896,30 4,30L32.013,30ZM34,8C34,6.9 33.111,6.007 32.013,6L4,6C2.896,6 2,6.896 2,8L34,8Z'],
    [.4, 'M32.013,30C33.107,29.993 33.993,29.106 34,28.013L34,10L2,10L2,28C2,29.104 2.896,30 4,30L8,30L8,25L9,24L27,24L28,25L28,30L32.013,30Z'],
    [.7, 'M9,30L8,30L8,25L9,24L27,24L28,25L28,30L27,30L27,30L9,30L9,30ZM14,29L14,25L10,25L10,29L14,29ZM20,29L20,25L16,25L16,29L20,29ZM26,29L26,25L22,25L22,29L26,29Z'],
  ],
  sidebarGenericFolder: [
    [1, 'M13.414,6L34,6C35.104,6 36,6.896 36,8L36,30C36,31.104 35.104,32 34,32L2,32C0.896,32 0,31.104 0,30L0,5C0,3.896 0.896,3 2,3L10,3C10.256,3 10.512,3.098 10.707,3.293L13.414,6ZM34,30C34,30 34,30 34,30ZM3,12C2.448,12 2,12.448 2,13L2,30L34,30L34,13C34,12.448 33.552,12 33,12L3,12ZM34,10.171L34,8L13,8L13,8C12.744,8 12.488,7.902 12.293,7.707L9.586,5L2,5L2,10.171C2.313,10.06 2.649,10 3,10L33,10C33.351,10 33.687,10.06 34,10.171Z'],
    [.3, 'M34,13C34,12.735 33.895,12.48 33.707,12.293C33.52,12.105 33.265,12 33,12C28.225,12 7.775,12 3,12C2.735,12 2.48,12.105 2.293,12.293C2.105,12.48 2,12.735 2,13C2,16.782 2,30 2,30L34,30L34,13Z'],
    [.1, 'M33,10L3,10C2.66,10.001 2.324,10.058 2.003,10.17L2,10.171L2,5L9.586,5L12.293,7.707C12.488,7.902 12.744,8 13,8L13,8L34,8L34,10.171C33.687,10.06 33.351,10 33,10Z'],
  ],
  sidebariCloud: [
    [.1, 'M7.8,28C7.8,28 28.5,28 28.5,28C31.536,28 34,25.536 34,22.5C34,19.802 32.053,17.554 29.488,17.088C28.963,16.993 28.497,16.691 28.195,16.25C27.893,15.809 27.78,15.266 27.882,14.741C27.959,14.339 28,13.924 28,13.5C28,9.913 25.087,7 21.5,7C18.785,7 16.457,8.668 15.485,11.033C15.232,11.647 14.692,12.096 14.042,12.231C13.392,12.366 12.717,12.17 12.241,11.707C11.791,11.27 11.177,11 10.5,11C9.12,11 8,12.12 8,13.5C8,13.702 8.024,13.898 8.069,14.087C8.195,14.609 8.105,15.16 7.82,15.615C7.534,16.071 7.078,16.392 6.553,16.507C3.949,17.079 2,19.407 2,22.186C2,25.394 4.598,28 7.8,28Z'],
    [1, 'M7.8,30C3.495,30 0,26.499 0,22.186C0,18.45 2.624,15.323 6.124,14.554C6.043,14.216 6,13.863 6,13.5C6,11.016 8.016,9 10.5,9C11.718,9 12.824,9.485 13.635,10.273C14.906,7.18 17.951,5 21.5,5C26.191,5 30,8.809 30,13.5C30,14.054 29.947,14.596 29.845,15.121C33.343,15.755 36,18.82 36,22.5C36,26.639 32.639,30 28.5,30L7.8,30ZM7.8,28C7.8,28 28.5,28 28.5,28C31.536,28 34,25.536 34,22.5C34,19.802 32.053,17.554 29.488,17.088C28.963,16.993 28.497,16.691 28.195,16.25C27.893,15.809 27.78,15.266 27.882,14.741C27.959,14.339 28,13.924 28,13.5C28,9.913 25.087,7 21.5,7C18.785,7 16.457,8.668 15.485,11.033C15.232,11.647 14.692,12.096 14.042,12.231C13.392,12.366 12.717,12.17 12.241,11.707C11.791,11.27 11.177,11 10.5,11C9.12,11 8,12.12 8,13.5C8,13.702 8.024,13.898 8.069,14.087C8.195,14.609 8.105,15.16 7.82,15.615C7.534,16.071 7.078,16.392 6.553,16.507C3.949,17.079 2,19.407 2,22.186C2,25.394 4.598,28 7.8,28Z'],
  ],
  sidebarDocumentsFolder: [
    [.4, 'M20,3L14,3L14,7L24,17L24,27L32,27L32,15L30,13L22,13L22,5L20,3Z'],
    [.15, 'M22,21L20,19L12,19L12,11L10,9L4,9L4,33L22,33L22,21Z'],
    [1, 'M12,7L12,1L24,1L34,11L34,29L24,29L24,35L2,35L2,7L12,7ZM12,11L10,9L4,9L4,33L22,33L22,21L20,19L12,19L12,11ZM24,27L32,27L32,15L30,13L22,13L22,5L20,3L14,3L14,7L24,17L24,27ZM14,17L14,10L21,17L14,17ZM24,11L24,4L31,11L24,11Z'],
  ],
  sidebarDownloadsFolder: [
    [1, 'M18,0C27.934,0 36,8.066 36,18C36,27.934 27.934,36 18,36C8.066,36 0,27.934 0,18C0,8.066 8.066,0 18,0ZM18,2C26.831,2 34,9.169 34,18C34,26.831 26.831,34 18,34C9.169,34 2,26.831 2,18C2,9.169 9.169,2 18,2Z'],
    [.9, 'M18,2C26.831,2 34,9.169 34,18C34,26.831 26.831,34 18,34C9.169,34 2,26.831 2,18C2,9.169 9.169,2 18,2ZM14,8L22,8L22,18L28,18L18,29L8,18L14,18L14,8Z'],
    [1, 'M12,16L12,8C12,6.895 12.895,6 14,6L22,6C23.105,6 24,6.895 24,8L24,16L28,16C28.792,16 29.509,16.467 29.829,17.191C30.149,17.915 30.012,18.76 29.48,19.345L19.48,30.345C19.101,30.762 18.563,31 18,31C17.437,31 16.899,30.762 16.52,30.345L6.52,19.345C5.988,18.76 5.851,17.915 6.171,17.191C6.491,16.467 7.208,16 8,16L12,16ZM14,8L22,8L22,18L28,18L18,29L8,18L14,18L14,8Z'],
  ],
  sidebarMoviesFolder: [
    [1, 'M34,1L2,1L2,35L34,35L34,1ZM28,19L8,19L8,33L28,33L28,19ZM32,31L30,31L30,33L32,33L32,31ZM6,31L4,31L4,33L6,33L6,31ZM32,27L30,27L30,29L32,29L32,27ZM6,27L4,27L4,29L6,29L6,27ZM32,23L30,23L30,25L32,25L32,23ZM6,23L4,23L4,25L6,25L6,23ZM32,19L30,19L30,21L32,21L32,19ZM6,19L4,19L4,21L6,21L6,19ZM6,15L4,15L4,17L6,17L6,15ZM32,15L30,15L30,17L32,17L32,15ZM28,3L8,3L8,17L28,17L28,3ZM32,11L30,11L30,13L32,13L32,11ZM6,11L4,11L4,13L6,13L6,11ZM32,7L30,7L30,9L32,9L32,7ZM6,7L4,7L4,9L6,9L6,7ZM6,3L4,3L4,5L6,5L6,3ZM32,3L30,3L30,5L32,5L32,3Z'],
    [.2, 'M8,3L28,3L28,17,L8,17Z'],
    [.2, 'M8,19L28,19L28,33,L8,33Z'],
  ],
  caretRight: [
    [1, 'M11,9L11,27L26,18L11,9Z'],
  ],
  caretDown: [
    [1, 'M9,11L27,11L18,26L9,11Z'],
  ],
  icons: [
    [1, 'M22,21C22,19.896 21.104,19 20,19L16,19C14.896,19 14,19.896 14,21L14,25C14,26.104 14.896,27 16,27L20,27C21.104,27 22,26.104 22,25L22,21ZM12,21C12,19.896 11.104,19 10,19L6,19C4.896,19 4,19.896 4,21L4,25C4,26.104 4.896,27 6,27L10,27C11.104,27 12,26.104 12,25L12,21ZM32,21C32,19.896 31.104,19 30,19L26,19C24.896,19 24,19.896 24,21L24,25C24,26.104 24.896,27 26,27L30,27C31.104,27 32,26.104 32,25L32,21ZM12,11C12,9.896 11.104,9 10,9L6,9C4.896,9 4,9.896 4,11L4,15C4,16.104 4.896,17 6,17L10,17C11.104,17 12,16.104 12,15L12,11ZM22,11C22,9.896 21.104,9 20,9L16,9C14.896,9 14,9.896 14,11L14,15C14,16.104 14.896,17 16,17L20,17C21.104,17 22,16.104 22,15L22,11ZM32,11C32,9.896 31.104,9 30,9L26,9C24.896,9 24,9.896 24,11L24,15C24,16.104 24.896,17 26,17L30,17C31.104,17 32,16.104 32,15L32,11Z'],
  ],
  list: [
    [1, 'M32,26L4,26L4,28L32,28L32,26ZM32,20L4,20L4,22L32,22L32,20ZM32,14L4,14L4,16L32,16L32,14ZM32,8L4,8L4,10L32,10L32,8Z'],
  ],
  columns: [
    [1, 'M34,10.5C34,9.12 32.88,8 31.5,8L4.5,8C3.12,8 2,9.12 2,10.5L2,25.5C2,26.88 3.12,28 4.5,28L31.5,28C32.88,28 34,26.88 34,25.5L34,10.5ZM12,10L12,26L4.5,26C4.224,26 4,25.776 4,25.5L4,10.5C4,10.224 4.224,10 4.5,10L12,10ZM24,10L31.5,10C31.776,10 32,10.224 32,10.5L32,25.5C32,25.776 31.776,26 31.5,26L24,26L24,10ZM22,10L14,10L14,26L22,26L22,10Z'],
  ],
  gallery: [
    [.6, 'M30,10.5C30,10.224 29.776,10 29.5,10L6.5,10C6.224,10 6,10.224 6,10.5L6,19.5C6,19.776 6.224,20 6.5,20L29.5,20C29.776,20 30,19.776 30,19.5L30,10.5Z'],
    [1, 'M14,25.5C14,24.672 13.328,24 12.5,24L11.5,24C10.672,24 10,24.672 10,25.5L10,26.5C10,27.328 10.672,28 11.5,28L12.5,28C13.328,28 14,27.328 14,26.5L14,25.5ZM20,25.5C20,24.672 19.328,24 18.5,24L17.5,24C16.672,24 16,24.672 16,25.5L16,26.5C16,27.328 16.672,28 17.5,28L18.5,28C19.328,28 20,27.328 20,26.5L20,25.5ZM26,25.5C26,24.672 25.328,24 24.5,24L23.5,24C22.672,24 22,24.672 22,25.5L22,26.5C22,27.328 22.672,28 23.5,28L24.5,28C25.328,28 26,27.328 26,26.5L26,25.5ZM32,25.5C32,24.672 31.328,24 30.5,24L29.5,24C28.672,24 28,24.672 28,25.5L28,26.5C28,27.328 28.672,28 29.5,28L30.5,28C31.328,28 32,27.328 32,26.5L32,25.5ZM8,25.5C8,24.672 7.328,24 6.5,24L5.5,24C4.672,24 4,24.672 4,25.5L4,26.5C4,27.328 4.672,28 5.5,28L6.5,28C7.328,28 8,27.328 8,26.5L8,25.5ZM32,10.5C32,9.12 30.88,8 29.5,8L6.5,8C5.12,8 4,9.12 4,10.5L4,19.5C4,20.88 5.12,22 6.5,22L29.5,22C30.88,22 32,20.88 32,19.5L32,10.5ZM30,10.5C30,10.224 29.776,10 29.5,10L6.5,10C6.224,10 6,10.224 6,10.5L6,19.5C6,19.776 6.224,20 6.5,20L29.5,20C29.776,20 30,19.776 30,19.5L30,10.5Z'],
  ],
  search: [
    [1, 'M23.327,24.742C21.603,26.153 19.4,27 17,27C11.481,27 7,22.519 7,17C7,11.481 11.481,7 17,7C22.519,7 27,11.481 27,17C27,19.4 26.153,21.603 24.742,23.327L31.707,30.293L30.293,31.707L23.327,24.742ZM17,9C21.415,9 25,12.585 25,17C25,21.415 21.415,25 17,25C12.585,25 9,21.415 9,17C9,12.585 12.585,9 17,9Z'],
  ],
  checkmark: [
    [1, 'M12.205,17.377L19.822,7.222C20.484,6.339 21.529,5.949 22.412,6.612C23.295,7.274 23.262,8.317 22.6,9.2L13.6,21.2C13.252,21.664 12.814,21.796 12.236,21.837C11.657,21.878 11.219,21.601 10.809,21.191L5.809,16.191C5.029,15.41 4.931,14.24 5.712,13.46C6.492,12.679 7.634,12.805 8.414,13.586L12.205,17.377Z'],
  ],
  mixed: [
    [1, 'M22,13.94C22,12.836 21.104,11.94 20,11.94L8,11.94C6.896,11.94 6,12.836 6,13.94C6,15.044 6.896,15.94 8,15.94L20,15.94C21.104,15.94 22,15.044 22,13.94Z'],
  ],
  nsChevron: [
    [1, 'M12.852,25.853C13.404,26.117 14.085,26.024 14.547,25.574L20.561,19.56C21.146,18.975 21.146,18.024 20.561,17.439C19.976,16.854 19.025,16.854 18.44,17.439L13.5,22.378L8.561,17.439C7.976,16.854 7.025,16.854 6.44,17.439C5.854,18.024 5.854,18.975 6.44,19.56L12.467,25.587L12.69,25.763L12.852,25.853ZM12.852,2.147C13.404,1.883 14.085,1.976 14.547,2.426L20.561,8.439C21.146,9.025 21.146,9.975 20.561,10.561C19.975,11.146 19.025,11.146 18.439,10.561L13.5,5.621L8.561,10.561C7.975,11.146 7.025,11.146 6.439,10.561C5.854,9.975 5.854,9.025 6.439,8.439L12.467,2.412L12.69,2.237L12.852,2.147Z'],
  ],
  windowClose: [
    [.55, 'M12,10.586L16.293,6.293C16.683,5.903 17.317,5.903 17.707,6.293C18.097,6.683 18.097,7.317 17.707,7.707L13.414,12L17.707,16.293C18.097,16.683 18.097,17.317 17.707,17.707C17.317,18.097 16.683,18.097 16.293,17.707L12,13.414L7.707,17.707C7.317,18.097 6.683,18.097 6.293,17.707C5.903,17.317 5.903,16.683 6.293,16.293L10.586,12L6.293,7.707C5.903,7.317 5.903,6.683 6.293,6.293C6.683,5.903 7.317,5.903 7.707,6.293L12,10.586Z'],
  ],
  windowMinimize: [
    [.55, 'M5,13L19,13C19.552,13 20,12.552 20,12C20,11.448 19.552,11 19,11L5,11C4.448,11 4,11.448 4,12C4,12.552 4.448,13 5,13Z'],
  ],
  windowMaximize: [
    [.55, 'M15,18L6,9C6,9 6,14.256 6,16C6,17.104 6.896,18 8,18L15,18ZM9,6L18,15C18,15 18,9.744 18,8C18,6.896 17.104,6 16,6L9,6Z'],
  ],
  appleMenu: [
    [.95, 'M34.219,28.783C33.761,29.857 33.219,30.845 32.591,31.753C31.735,32.991 31.034,33.849 30.494,34.325C29.657,35.106 28.759,35.506 27.799,35.529C27.109,35.529 26.277,35.33 25.309,34.926C24.337,34.524 23.444,34.325 22.628,34.325C21.772,34.325 20.854,34.524 19.872,34.926C18.888,35.33 18.096,35.54 17.49,35.561C16.568,35.601 15.65,35.189 14.733,34.325C14.148,33.807 13.416,32.919 12.54,31.662C11.599,30.32 10.826,28.763 10.22,26.988C9.571,25.07 9.246,23.214 9.246,21.416C9.246,19.358 9.684,17.582 10.563,16.094C11.253,14.899 12.172,13.956 13.321,13.263C14.47,12.571 15.712,12.219 17.05,12.196C17.782,12.196 18.741,12.426 19.934,12.877C21.123,13.33 21.887,13.559 22.222,13.559C22.472,13.559 23.32,13.291 24.758,12.756C26.118,12.259 27.266,12.054 28.206,12.135C30.754,12.343 32.668,13.362 33.941,15.198C31.662,16.598 30.535,18.56 30.558,21.077C30.578,23.037 31.279,24.668 32.657,25.964C33.281,26.565 33.978,27.029 34.754,27.359C34.586,27.854 34.408,28.328 34.219,28.783ZM28,4C27.994,5.747 27.376,7.496 26.318,8.808C25.26,10.121 23.763,10.997 22,11C22.021,7.486 24.441,4.011 28,4Z'],
  ],
  mCheck: [
    [.95, 'M11.579,18.744L20.605,4.898C21.202,3.983 22.429,3.725 23.344,4.321C24.259,4.918 24.518,6.145 23.921,7.06L13.463,23.102C13.124,23.622 12.561,23.952 11.942,23.995C11.323,24.038 10.719,23.788 10.312,23.32L4.887,17.081C4.17,16.256 4.257,15.005 5.082,14.288C5.906,13.572 7.157,13.659 7.874,14.483L11.579,18.744Z'],
  ],
};

const sidebarDesktopFolderIcon = pathsIcon(icons.sidebarDesktopFolder, 18);
const sidebarGenericFolderIcon = pathsIcon(icons.sidebarGenericFolder, 18);
const sidebariCloudIcon = pathsIcon(icons.sidebariCloud, 18);
const sidebarDocumentsFolderIcon = pathsIcon(icons.sidebarDocumentsFolder, 18);
const sidebarDownloadsFolderIcon = pathsIcon(icons.sidebarDownloadsFolder, 18);
const sidebarMoviesFolderIcon = pathsIcon(icons.sidebarMoviesFolder, 18);
const caretRightIcon = pathsIcon(icons.caretRight, 18);
const caretDownIcon = pathsIcon(icons.caretDown, 18);
const iconsIcon = pathsIcon(icons.icons, 18);
const listIcon = pathsIcon(icons.list, 18);
const columnsIcon = pathsIcon(icons.columns, 18);
const galleryIcon = pathsIcon(icons.gallery, 18);
const searchIcon = pathsIcon(icons.search, 18);
const checkmark = pathsIcon(icons.checkmark, 14);
const mixedIcon = pathsIcon(icons.mixed, 14);
const nsChevronIcon = pathsIcon(icons.nsChevron, 14);
const mCheckIcon = pathsIcon(icons.mCheck, 14);
const windowCloseIcon = pathsIcon(icons.windowClose, 12);
const windowMinimizeIcon = pathsIcon(icons.windowMinimize, 12);
const windowMaximizeIcon = pathsIcon(icons.windowMaximize, 12);
const appleMenuIcon = pathsIcon(icons.appleMenu, 22);

function space(size: number) {
  const div = document.createElement('div');
  div.style.flex = `0 0 ${size}px`;
  return div;
}

const flexibleSpace = Div({ flex: '1 0 0' });

type Cleanup = () => void;
type Temporary<T = void> = (x: T) => Cleanup;
type Unmounter = Cleanup;
type Component = Temporary<Node>;
type Effect = Temporary<Element>;

const mounter = (n: Node): Component => r => mount(n, r);

const mount = (n: Node, r: Node) => {
  const p = r.parentNode!;
  p.replaceChild(n, r);
  return () => p.replaceChild(r, n);
}

function pathsIcon(paths: IconPath[], defaultSize = 18, defaultColor = 'white') {
  return ({ size = defaultSize, color = defaultColor, onClick, style, effects = [] }: {
    size?: number,
    color?: string,
    onClick?: Handler<MouseEvent>,
    style?: any,
    effects?: Temporary<SVGSVGElement>[],
  } = {}): Component => {
    const sizeStr = `${size}`;
    const viewBox = `0 0 ${defaultSize * 2} ${defaultSize * 2}`;
    return r => {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttributeNS(null, 'fill', color);
      svg.setAttributeNS(null, 'width', sizeStr);
      svg.setAttributeNS(null, 'height', sizeStr);
      svg.setAttributeNS(null, 'viewBox', viewBox);
      svg.setAttributeNS(null, 'fill-rule', 'evenodd');
      svg.style.display = 'block';
      Object.keys(style || {}).forEach(k => {
        svg.style.setProperty(k, style[k]);
      });
      if (onClick) svg.addEventListener('click', onClick);
      paths.forEach(([o, p]) => {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttributeNS(null, 'd', p);
        path.setAttributeNS(null, 'fill-opacity', `${o}`);
        svg.appendChild(path);
      });
      return cleanup(
        ...effects.map(f => f(svg)),
        mount(svg, r),
      );
    }
  };
}

const useClickController = (
    onHighlight: Handler<boolean> = noop,
    onClick: Handler<MouseEvent> = noop,
    onClicking: Handler<boolean> = noop) => {
  return Event('mousedown', e => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLDivElement;
    let over = true;
    const highlight = () => {
      onHighlight(true);
      over = true;
    };
    const unhighlight = () => {
      onHighlight(false);
      over = false;
    };
    const cleanup = (e: MouseEvent) => {
      if (over && onClick) onClick(e);
      unhighlight();
      onClicking(false);
      target.removeEventListener('mouseenter', highlight);
      target.removeEventListener('mouseleave', unhighlight);
      window.removeEventListener('mouseup', cleanup);
    }
    onClicking(true);
    highlight();
    target.addEventListener('mouseenter', highlight);
    target.addEventListener('mouseleave', unhighlight);
    window.addEventListener('mouseup', cleanup);
  });
};

const radio = (active: Stream<boolean>, onClick?: Handler<MouseEvent>) => {
  const [highlight, setHighlight] = useState(false);
  const click = useClickController(setHighlight, onClick);
  return Div({
    width: '16px',
    height: '16px',
    borderRadius: '8px',
    margin: '16px',
    backgroundImage: map(active, x => x ? 'linear-gradient(#3367df, #255cc6)' : 'linear-gradient(#505152, #6b6c6c)'),
    boxShadow: '0 .5px 1px -.5px rgba(255, 255, 255, .4) inset, 0 0 1px rgba(0, 0, 0, .4), 0 .5px 1px rgba(0, 0, 0, .4)',
    overflow: 'hidden',
  }, [
    Div({
      visibility: map(active, x => x ? 'visible' : 'hidden'),
      transform: 'translate(5.25px, 5.25px)',
      width: '5.5px',
      height: '5.5px',
      backgroundColor: '#ffffff',
      borderRadius: '2.75px',
    }),
    enable(highlight, Div({ position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', backgroundColor: 'rgba(255,255,255,.15)' })),
  ], [
    click,
  ]);
};

// TODO:
//   State: on, mixed, off
//   Disabled: yes, no
//   Blurred: yes, no
//   Highlighted: yes, no
const checkbox = (state: Stream<boolean>, onChange?: Handler<boolean>) => {
  let checked: boolean;
  const [active, setActive] = useState(false);
  const click = useClickController(setActive, onChange && (() => onChange(!checked)));
  return Div({
    width: '14px',
    height: '14px',
    borderRadius: '3px',
    margin: '16px',
    backgroundImage: either(state, 'linear-gradient(#3367df, #255cc6)', 'linear-gradient(#505152, #6b6c6c)'),
    boxShadow: '0 1px 1px -1px rgba(255, 255, 255, .4) inset, 0 0 1px rgba(0, 0, 0, .4), 0 1px 1px rgba(0, 0, 0, .2)',
    overflow: 'hidden',
  }, [
    enable(state, checkmark()),
    enable(active, Div({ position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', backgroundColor: 'rgba(255,255,255,.15)' })),
  ], [
    () => state(x => checked = x),
    click,
  ]);
};

const slider = (
    value: Stream<number>,
    onChange: Handler<number> = noop) => {
  return Div({
    height: '15px',
    margin: '16px',
  }, [
    Div({
      backgroundColor: '#505050',
      height: '3px',
      width: '100%',
      borderRadius: '1.5px',
      transform: 'translate(0, 6px)',
    }, [
      Div({
        backgroundColor: '#3268de',
        height: '100%',
        width: '100%',
        transform: map(value, v => `translateX(${50 * (v - 1)}%) scaleX(${v})`),
      }),
    ]),
    Div({
      width: '100%',
      height: '15px',
      position: 'absolute',
      top: '0',
      left: '0',
      transform: map(value, v => `translateX(calc(${v} * (100% - 15px)))`),
    }, [
      Div({
        backgroundColor: '#ccc',
        height: '15px',
        width: '15px',
        borderRadius: '7.5px',
        boxShadow: '0 .5px 1px -.5px rgba(255, 255, 255, .6) inset, 0 0 1px rgba(0, 0, 0, .3), 0 .5px 1px rgba(0, 0, 0, .3)',
      })
    ]),
  ], [
    Event('mousedown', e => {
      e.preventDefault();
      const target = e.currentTarget as HTMLDivElement;
      const rect = target.getBoundingClientRect();
      const left = rect.left + 7.5;
      const width = rect.width - 15;

      const update = (e: MouseEvent) => {
        const lerp = (e.clientX - left) / width;
        const value = Math.min(Math.max(lerp, 0), 1);
        onChange(value);
      };
    
      const stopUpdate = () => {
        window.removeEventListener('mousemove', update);
        window.removeEventListener('mouseup', stopUpdate);
      };

      update(e);
      window.addEventListener('mousemove', update);
      window.addEventListener('mouseup', stopUpdate);
    }),
  ]);
};

function sample<T>(f: Stream<T>, init: T): T;

function sample<T>(f: Stream<T>, init?: T): T | undefined {
  f(x => init = x)();
  return init;
}

const select = () => {
  const options = ['Small', 'Medium', 'Large', 'Death', 'Travel'];
  const [currIdx, setCurrIdx] = useState(1);
  const selected = useOneHot(currIdx);
  return Div({
    margin: '16px',
    width: '120px',
    height: '19px',
    backgroundColor: '#666768',
    borderRadius: '3px',
    boxShadow: '0 0 1px rgba(0, 0, 0, .4), 0 1px 1px rgba(0, 0, 0, .2)',
    paddingLeft: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: '#ffffff',
    overflow: 'hidden',
    cursor: 'default',
  }, [
    Text(map(currIdx, x => options[x])),
    Div({
      backgroundImage: 'linear-gradient(#3367df, #255cc6)',
      width: '16px',
      alignSelf: 'stretch',
    }, [
      nsChevronIcon({ style: {
        transform: 'translate(1px, 2.5px)',
      }}),
    ]),
    gloss,
  ], [
    r => {
      const m = menu(
        options.map((x, i) => menuItem({
          label: x,
          checked: selected(i),
          action: () => setCurrIdx(i),
        })),
        13,
      );
      const open = (e: MouseEvent) => {
        const rect = r.getBoundingClientRect();
        openMenu(m, rect.left - 13, rect.top - 18 * sample(currIdx, 0));
      };
      return Event('mousedown', open)(r);
    },
  ]);
};

type Menu = (handler: Handler<Thunk>) => Component;

type MenuComponent = (size: number, handler: Handler<Thunk>) => Component;

const menu = (contents: MenuComponent[], size = 14, dropdown = false): Menu => h => Div({
  padding: '4px 0',
  backgroundColor: '#323334',
  borderRadius: dropdown ? '0 0 5px 5px' : '5px',
  boxShadow: '0 0 0 .5px rgba(0, 0, 0, .8), 0 10px 20px rgba(0, 0, 0, .3)',
  whiteSpace: 'nowrap',
  transform: 'translateY(-.5px)'
}, [
  ...contents.map(x => x(size, h)),
  dropdown ? dropdownBorderOverlay : borderOverlay,
]);

const either = <T>(s: Stream<boolean>, a: T, b: T) => map(s, x => x ? a : b);

const menuItem = ({ label, action = noop, checked = just(false) }: {
  label: string;
  action?: Thunk;
  checked?: Stream<boolean>;
}) => (fontSize: number, handler: Handler<Thunk>): Component => {
  const [highlight, setHighlight] = useState(false);
  return Div({
    height: `${fontSize + 5}px`,
    fontSize: `${fontSize}px`,
    backgroundColor: either(highlight, '#336dd9', 'transparent'),
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    padding: '0 21px',
    cursor: 'default',
  }, [
    menuCheck(fontSize, checked),
    span({}, [label]),
  ], [
    Hover(setHighlight),
    Event('click', e => {
      setHighlight(false);
      setTimeout(() => {
        setHighlight(true);
        handler(action);
      }, 60);
    }),
  ]);
};

const menuCheck = (size: number, visible: Stream<boolean>) => mCheckIcon({
  size,
  style: {
    position: 'absolute',
    top: '50%',
    left: '11px',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
  },
  effects: [
    r => visible(x => r.style.opacity = x ? '1' : '0'),
  ],
});

const menuSeparator = () => Div({
  height: '2px',
  backgroundColor: 'rgba(255, 255, 255, .15)',
  margin: '5px 0',
});

// TODO: Use a CSS pseudo-element for this?
const gloss = Div({
  position: 'absolute',
  top: '0',
  left:'0',
  width: '100%',
  height: '100%',
  boxShadow: 'inset 0 1px 1px -1px rgba(255, 255, 255, .6)',
  borderRadius: 'inherit',
  pointerEvents: 'none',
});

const streamComp = (s: Stream<Component>): Component => r => {
  let old = noop;
  const unsub = s(x => {
    old();
    old = x(r);
  });
  return () => (unsub(), old());
};

// Component that does nothing.
const empty: Temporary<any> = () => noop;

const enable = (s: Stream<boolean>, c: Component) => streamComp(map(s, x => x ? c : empty));

interface WindowRecord {
  frame: Stream<Frame>;
  zIndex: Stream<number>;
  handles: FrameHandles;
  content: Component;
  close: Stream<void>;
  focuses: Stream<void>;
  focus: Thunk;
}

type WindowStream = Stream<WindowRecord>;
type WindowAdder = Handler<Window>;

const makeEnvironment = (): [WindowStream, WindowAdder] => {
  const windows: {[k: number]: [Handler<void>, WindowRecord]} = {};
  const nextId = counter();

  const [windowStream, emitWindow] = useStream<WindowRecord>();

  const closeWindow = (k: number) => {
    if (!windows[k]) return;
    windows[k][0]();
    delete windows[k];
  };

  const addWindow = (w: Window) => {
    const k = nextId();
    const [frame, handles] = useFrame({ x: 100, y: 100, width: 500, height: 400 });
    const [$close, close] = useStream();
    const [$focus, focus] = useStream();
    const zIndex = just(0);
    const content = w({
      close: () => closeWindow(k),
      handles,
      minimize: null as any,
      maximize: null as any,
      focus: focus as Thunk,
    });
    windows[k] = [close, {
      frame,
      zIndex,
      handles,
      content,
      close: $close,
      focuses: $focus,
      focus: focus as Thunk,
    }];
    emitWindow(windows[k][1]);
  };

  return [windowStream, addWindow];
};

function StaticDesktop(...windows: Window[]) {

  // So... I think the desktop should ultimately be in control of the layering.
  // So maybe we create a div for each window to live inside of.
  // const frames: HTMLDivElement[] = [];
  const contents = [];

  for (const window of windows) {
    const [frame, handles] = useFrame({ x: 100, y: 100, width: 500, height: 400 });
    const ctrl: WindowControls = {
      close() {},
      minimize() {},
      maximize() {},
      focus() {},
      handles,
    };
    const content = window(ctrl);
    const comp = windowFrame(frame, just(0), handles, content, empty);
    contents.push(comp);
  }

  return Div({
    backgroundColor: '#000000',
    width: '100vw',
    height: '100vh',
  }, contents, [
    ContextMenu(menu([
      menuItem({ label: 'New Folder' }),
      menuSeparator,
      menuItem({ label: 'Get Info' }),
      menuSeparator,
      menuItem({ label: 'Import from iPhone or iPad' }),
      menuSeparator,
      menuItem({ label: 'Change Desktop Background...' }),
      menuItem({ label: 'Use Stacks' }),
      menuItem({ label: 'Sort By' }),
      menuItem({ label: 'Clean Up' }),
      menuItem({ label: 'Clean Up By' }),
      menuItem({ label: 'Show View Options' }),
    ])),
  ]);
}

/**
 * A posaphore is an object that wraps some temporary `f`. The wrapped
 * temporary will be enabled whenever at least one instance of the posaphore
 * is active.
 */
const posaphore = (f: Temporary) => {
  let active = 0;
  let unsubscribe: Unsubscriber;
  const decr = () => {
    active -= 1;
    if (active === 0) unsubscribe();
  };
  const incr = () => {
    if (active === 0) unsubscribe = f();
    active += 1;
    return decr;
  }
  return incr;
};

type OneHotStreams = (x: number) => Stream<boolean>;

const useOneHot = (s: Stream<number | undefined>): OneHotStreams => {
  let curr: number | undefined;
  const setter = (x: number | undefined) => {
    if (x === curr) return;
    if (curr !== undefined && streams[curr]) {
      streams[curr][1](false);
    }
    curr = x;
    if (x !== undefined && streams[x]) {
      streams[x][1](true);
    }
  };
  const incr = posaphore(() => s(setter));
  const streams: {[k: number]: [Stream<boolean>, Handler<boolean>]} = {};
  const getter = (k: number): Stream<boolean> => {
    if (streams[k]) return streams[k][0];
    const [oh, soh] = useStream<boolean>();
    const foh: Stream<boolean> = h => {
      const decr = incr();
      h(curr === k);
      return cleanup(oh(h), decr);
    };
    streams[k] = [foh, soh];
    return foh;
  };
  return getter;
};

const menuBarItemStyle: Partial<CSSStyleDeclaration> = {
  height: '100%',
};

const menuBarLabelStyle: Partial<CSSStyleDeclaration> = {
  padding: '0 10px',
  height: '100%',
  display: 'flex',
  flexFlow: 'row nowrap',
  alignItems: 'center',
  color: '#ffffff',
  fontSize: '14px',
  cursor: 'default',
  zIndex: '2',
};

const triggerEffect = (s: Stream<boolean>, f: Temporary) => {
  let curr: Cleanup | undefined;
  const unsub = s(x => {
    if (x) {
      if (!curr) {
        curr = f();
      }
    } else {
      if (curr) {
        curr();
        curr = undefined;
      }
    }
  });
  return () => {
    unsub();
    if (curr) curr();
  };
};

const menuBarLabel = (s: string, fontWeight = '400') => {
  const item = elem('div');
  item.textContent = s;
  Object.assign(item.style, menuBarLabelStyle, { fontWeight });
  return item;
}

const MenuBar = (mainMenu: Menu): Component => r => {

  const us = [];

  const [activeItem, setActiveItem] = useState<number | undefined>(undefined);
  const itemActive = useOneHot(activeItem);

  // Menu bar is "active" if any individual menu item is active.
  const active = map(activeItem, x => x !== undefined);

  const ami = elem('div');
  Object.assign(ami.style, menuBarItemStyle);
  const amiLabel = elem('div');
  ami.appendChild(amiLabel);
  Object.assign(amiLabel.style, {
    width: '35px',
    height: '100%',
    zIndex: '2',
  });
  us.push( render(appleMenuIcon({ style: { transform: 'translateX(6.5px)' }}), amiLabel) );

  const menuBarItem = (s: string, fontWeight = '400') => {
    const item = elem('div');
    Object.assign(item.style, menuBarItemStyle);
    item.appendChild(menuBarLabel(s, fontWeight));
    return item;
  };

  const items = [
    ami,
    menuBarItem('Safari', '700'),
    menuBarItem('File'),
    menuBarItem('Edit'),
    menuBarItem('View'),
    menuBarItem('History'),
    menuBarItem('Bookmarks'),
    menuBarItem('Develop'),
    menuBarItem('Window'),
    menuBarItem('Help'),
  ];

  let curr: any;
  activeItem(x => {
    if (curr) curr(x !== undefined);
    curr = x !== undefined ? showMenuIn(mainMenu, items[x], () => setActiveItem(undefined)) : undefined;
  });

  us.push(
    ...items.map((x, i) => Event('mousedown', e => {
      e.preventDefault();
      setActiveItem(i);
    })(x.children[0])),
    ...items.map((x, i) => itemActive(i)(h => {
      (x.children[0] as any).style.backgroundColor = h ? '#336dd9' : 'transparent';
    })),
  );

  // Whenever we become active, enable extra stuff.
  us.push(triggerEffect(active, () => cleanup(
    ...items.map((x, i) => Event('mouseenter', () => setActiveItem(i))(x.children[0])),
  )));

  us.push(Div({
    height: '22px',
    display: 'flex',
    flexFlow: 'row nowrap',
    paddingLeft: '10px',
    zIndex: '100',
  }, [
    Div({
      position: 'absolute',
      left: '0',
      right: '0',
      top: '0',
      bottom: '0',
      zIndex: '1',
      backgroundColor: '#1b1a1e',
    }),
    ...items,
  ])(r));

  return cleanup(...us);
};

const Desktop = (env: WindowStream, mainMenu: Menu): Component => r => {
  return Div({
    backgroundColor: '#000000',
    width: '100vw',
    height: '100vh',
  }, [MenuBar(mainMenu)], [
    ContextMenu(menu([
      menuItem({ label: 'New Folder' }),
      menuSeparator,
      menuItem({ label: 'Get Info' }),
      menuSeparator,
      menuItem({ label: 'Import from iPhone or iPad' }),
      menuSeparator,
      menuItem({ label: 'Change Desktop Background...' }),
      menuItem({ label: 'Use Stacks' }),
      menuItem({ label: 'Sort By' }),
      menuItem({ label: 'Clean Up' }),
      menuItem({ label: 'Clean Up By' }),
      menuItem({ label: 'Show View Options' }),
    ])),
    box => env(x => {
      const frame = windowFrame(x.frame, x.zIndex, x.handles, x.content, x.focuses, x.focus);
      x.close(render(frame, box));
    }),
  ])(r);
}

function all(...es: Effect[]): Effect {
  return n => cleanup(...es.map(e => e(n)));
}

function Event<Type extends keyof HTMLElementEventMap>(
  t: Type,
  h: Handler<HTMLElementEventMap[Type]>,
  capture?: boolean,
): Temporary<EventTarget> {
  return n => {
    n.addEventListener(t, h, capture);
    return () => n.removeEventListener(t, h, capture);
  };
}

function AddClass(s: string): Effect {
  return n => {
    if (n.classList.contains(s)) {
      return () => undefined;
    }
    n.classList.add(s);
    return () => n.classList.remove(s);
  };
}

function Hover(h: Handler<boolean>): Effect {
  return n => {
    const mouseEnter = () => { h(true); };
    const mouseLeave = () => { h(false); };
    n.addEventListener('mouseenter', mouseEnter);
    n.addEventListener('mouseleave', mouseLeave);
    return () => {
      n.removeEventListener('mouseenter', mouseEnter);
      n.removeEventListener('mouseleave', mouseLeave);
    };
  };
}

/**
 * Adds an effect to a node that triggers the given handler effect `h`
 * whenever the user both has their mouse down and is over the node. If `r` is
 * provided, then it's called if the user releases their mouse while over it.
 */
function Downing(h: Handler<boolean>): Effect {
  return n => {
    const mouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      h(true);
    };
    const mouseUp = () => h(false);
    n.addEventListener('mousedown', mouseDown);
    window.addEventListener('mouseup', mouseUp);
    return () => {
      n.removeEventListener('mousedown', mouseDown);
      window.removeEventListener('mouseup', mouseUp);
    };
  };
}

/**
 * Adds an effect to a node that triggers the given handler effect `h`
 * whenever the user both has their mouse down and is over the node. If `r` is
 * provided, then it's called if the user releases their mouse while over it.
 */
function Clicking(h: Handler<boolean>, r?: Handler<MouseEvent>): Effect {
  return n => {
    let down = false;
    let over = false;
    const mouseEnter = () => { over = true; if (down) h(true); };
    const mouseLeave = () => { over = false; if (down) h(false); };
    const mouseDown = (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      down = true;
      if (over) h(true);
    };
    const mouseUp = (e: MouseEvent) => {
      down = false;
      if (over) {
        h(false);
        r && r(e);
      }
    };
    n.addEventListener('mouseenter', mouseEnter);
    n.addEventListener('mouseleave', mouseLeave);
    n.addEventListener('mousedown', mouseDown);
    window.addEventListener('mouseup', mouseUp);
    return () => {
      n.removeEventListener('mouseenter', mouseEnter);
      n.removeEventListener('mouseleave', mouseLeave);
      n.removeEventListener('mousedown', mouseDown);
      window.removeEventListener('mouseup', mouseUp);
    };
  };
}

function ContextMenu(menu: Menu): Effect {
  return Event('contextmenu', e => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e, menu);
  });
}

const wait = (dt: number) => new Promise(r => setTimeout(r, dt * 1000));

const append = (c: Node, p: Node) => {
  p.appendChild(c);
  return () => void p.removeChild(c);
};

function showContextMenu(e: MouseEvent, menu: Menu) {
  return openMenu(menu, e.clientX, e.clientY);
}

function openMenu(menu: Menu, x: number, y: number) {
  // Create a container.
  const c = elem('div');
  const cStyle = c.style;
  cStyle.position = 'absolute';
  cStyle.zIndex = '102';
  cStyle.top = `${y - 3}px`;
  cStyle.left = `${x}px`;
  cStyle.transition = 'opacity .2s ease-in';

  let u: Cleanup;

  const close = () => {
    c.style.opacity = '0';
    return wait(.2).then(u);
  };

  const handle = (t: Thunk) => close().then(t);

  u = cleanup(
    append(c, document.body),
    render(menu(handle), c),
    Event('mousedown', e => {
      if (!c.contains(e.target as Node)) close();
    }, true)(document.body)
  );
}

function showMenuIn(menu: Menu, r: HTMLElement, onDismiss: Thunk) {
  const c = elem('div');
  c.style.position = 'absolute';
  c.style.top = '100%';
  c.style.left = '0';
  c.style.zIndex = '0';
  c.style.transition = 'opacity .2s ease-in';

  let u: Cleanup;

  // Function for closing it.
  const close = (fast?: boolean) => {
    if (fast) {
      u();
    } else {
      c.style.opacity = '0';
      return wait(.2).then(u);
    }
  };

  const handle = (t: Thunk) => (onDismiss(), t());

  u = cleanup(
    append(c, r),
    render(menu(handle), c),
    Event('mousedown', e => {
      if (!c.contains(e.target as Node)) onDismiss();
    }, true)(document.body),
  );

  return close;
}

type DragEndHandler = (e: MouseEvent) => void;
type DragMoveHandler = (e: MouseEvent) => DragEndHandler | void;
type DragHandler = (e: MouseEvent) => DragMoveHandler | void;

function useDrag(h: DragHandler): Handler<MouseEvent> {
  return e => {
    if (e.button != 0) return;
    e.preventDefault();
    const moveHandler = h(e);
    if (moveHandler) {
      let endHandler: DragEndHandler | void;
      const onMouseMove = (e: MouseEvent) => {
        endHandler = moveHandler(e);
      };
      const onMouseUp = (e: MouseEvent) => {
        if (endHandler) endHandler(e);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      }
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
  };
}

// I want a stream that produces deltas to add to x and y.

function useRelativeDrag(): [Stream<number>, Stream<number>, Handler<MouseEvent>] {
  const [dx, emitDx] = useStream<number>();
  const [dy, emitDy] = useStream<number>();

  const onMouseDown = useDrag(e => {
    let x = e.clientX;
    let y = e.clientY;
    return e => {
      emitDx(e.clientX - x);
      emitDy(e.clientY - y);
      x = e.clientX;
      y = e.clientY;
    };
  });

  return [dx, dy, onMouseDown];
};


function useHorizontalRelativeDrag(): [Stream<number>, Handler<MouseEvent>] {
  const [dx, emitDx] = useStream<number>();

  const onMouseDown = useDrag(e => {
    let x = e.clientX;
    return e => {
      emitDx(e.clientX - x);
      x = e.clientX;
    };
  });

  return [dx, onMouseDown];
};


function useVerticalRelativeDrag(): [Stream<number>, Handler<MouseEvent>] {
  const [dy, emitDy] = useStream<number>();

  const onMouseDown = useDrag(e => {
    let y = e.clientY;
    return e => {
      emitDy(e.clientY - y);
      y = e.clientY;
    };
  });

  return [dy, onMouseDown];
};

/**
 * I want a "frame stream".
 *
 * The output should be the frame stream. The input should be all the ways to
 * modify the frame. Let's try just returning 9 drag handlers.
 */


function useFrame(init: Frame): [Stream<Frame>, FrameHandles] {
  const [dX, dY, middle] = useRelativeDrag();
  const [dLeft, left] = useHorizontalRelativeDrag();
  const [dRight, right] = useHorizontalRelativeDrag();
  const [dTop, top] = useVerticalRelativeDrag();
  const [dBottom, bottom] = useVerticalRelativeDrag();
  const [dTopLeftX, dTopLeftY, topLeft] = useRelativeDrag();
  const [dTopRightX, dTopRightY, topRight] = useRelativeDrag();
  const [dBottomLeftX, dBottomLeftY, bottomLeft] = useRelativeDrag();
  const [dBottomRightX, dBottomRightY, bottomRight] = useRelativeDrag();

  const negate = (s: Stream<number>) => map(s, x => -x);

  const dAnyLeft = merge(dLeft, dTopLeftX, dBottomLeftX);
  const dAnyRight = merge(dRight, dTopRightX, dBottomRightX);
  const dAnyTop = merge(dTop, dTopLeftY, dTopRightY);
  const dAnyBottom = merge(dBottom, dBottomLeftY, dBottomRightY);
  const dx = merge(dX, dAnyLeft);
  const dy = merge(dY, dAnyTop);
  const dw = merge(dAnyRight, negate(dAnyLeft));
  const dh = merge(dAnyBottom, negate(dAnyTop));

  let c = {...init};
  const [frame, setFrame] = useState<Frame>(c);
  dx(d => (c.x += d, setFrame(c)));
  dy(d => (c.y += d, setFrame(c)));
  dw(d => (c.width += d, setFrame(c)));
  dh(d => (c.height += d, setFrame(c)));

  return [frame, {top, bottom, left, right, topLeft, topRight, bottomLeft, bottomRight, middle}];
}

const Pane = (color: string, children?: ElementThing[]) => Div({
  width: '100%',
  height: '100%',
  backgroundColor: '#ffffff',
}, children);

const WhitePane = Pane('white');

const Matte = (content: ElementThing) => Div({
  width: '100%',
  height: '100%',
  backgroundColor: '#ffffff',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
}, [content]);

type Window = (c: WindowControls) => Component;
type WindowCloser = () => void;
type WindowOpener = (w: Window) => WindowCloser;

// You create a window controller...
// You can tell it to open windows.
// You can tell it to close windows.
//
// State:
//   - List of windows. Maybe the order of this list is the stacking order of the windows.
//
// How does a window 
//  - 
// You can create a new window by providing a content view.
/*
env.open(Finder);
*/

const [windows, addWindow] = makeEnvironment();

const makeAppendData = () => {
  const [data, setData] = useGState(makeData());
  const under = data();
  const append = (x: number, y: number) => {
    under.x.push(x);
    under.y.push(y);
    setData(under);
  };
  return [data, append] as [State<Data>, (x: number, y: number) => void];
};

const [data, appendPoint] = makeAppendData();

const [xlim, setXlim] = useGState([0, 1] as Limits);
const [ylim, setYlim] = useGState([0, 1] as Limits);
const plot = SimpleWindow("Yooo", Plot2D(xlim, ylim, setXlim, setYlim, data));

// setInterval(() => appendPoint(Math.random(), Math.random()), 500);

const appleMenu = menu([
  menuItem({ label: 'About This Mac' }),
  menuSeparator,
  menuItem({ label: 'System Preferences...' }),
  menuItem({ label: 'App Store...' }),
  menuSeparator,
  menuItem({ label: 'Recent Items' }),
  menuSeparator,
  menuItem({ label: 'Force Quit...' }),
  menuSeparator,
  menuItem({ label: 'Sleep' }),
  menuItem({ label: 'Restart...' }),
  menuItem({ label: 'Shut Down...' }),
  menuSeparator,
  menuItem({ label: 'Lock Screen' }),
  menuItem({ label: 'Log Out Toby Bell...' }),
], undefined, true);

const safariMenu = menu([
  menuItem({ label: 'About Safari', action: () => addWindow(Finder) }),
  menuItem({ label: 'Safari Extensions...', action: () => addWindow(plot) }),
  menuSeparator,
  menuItem({ label: 'Preferences...' }),
  menuItem({ label: 'Privacy Report...' }),
  menuItem({ label: 'Settings for This Website...' }),
  menuSeparator,
  menuItem({ label: 'Clear History...' }),
  menuSeparator,
  menuItem({ label: 'Services' }),
  menuSeparator,
  menuItem({ label: 'Hide Safari' }),
  menuItem({ label: 'Hide Others' }),
  menuItem({ label: 'Show All' }),
  menuSeparator,
  menuItem({ label: 'Quit Safari' }),
], undefined, true);

const dt = Desktop(windows, safariMenu);

render(dt, document.body);

addWindow(Finder);
addWindow(Finder);
// addWindow(plot);
