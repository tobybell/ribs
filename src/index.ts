import { Data, DataStore } from './data-stuff';

import { Stream, state, just, map, join } from './stream-stuff';
import { Cleanup, cleanup } from "./temporary-stuff";
import { posaphore } from "./posaphore";
import { elem } from "./elem";
import { render, mount, domEvent, Component, Effect } from "./component";
import { div } from "./div";

import { ticks, scaleLinear } from 'd3';
import { WindowControls, windowEnvironment, windowPane } from './window-stuff';
import { simpleTitleBar } from './toolbar-bar';
import { Finder } from './finder';
import { menu, menuItem, menuSeparator } from './menu';
import { desktop } from './desktop';
import { emitterApp } from './emitter-app';
import { WifiApp } from './wifi-app';

type Handler<T> = (x: T) => void;

const SimpleWindow = (title: string, content: Component): Window => (c: WindowControls) => {
  const pane = windowPane([
    simpleTitleBar(title, c.handles.middle, c.close),
    content,
  ]);
  return pane;
};

type ElementThing = HTMLElement | SVGSVGElement | Component | string | undefined;
type StreamableCSS = {[K in keyof CSSStyleDeclaration]: string | Stream<string>};

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
  xlim: Stream<Limits>,
  ylim: Stream<Limits>,
  onSetXLim: Handler<Limits>,
  onSetYLim: Handler<Limits>,
  data: Stream<Data>,
  requestRegion: Handler<Limits>,
): Component => {

  const title = just('Stock price');
  const xLabel = just('Time [d]');
  const yLabel = just('Price [$]');

  const tickLength = 5;
  const axisPad = 4;

  const tickFont = "10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif";
  const labelFont = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif";
  const titleFont = "bold 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif";

  const xs = scaleLinear();
  const ys = scaleLinear();

  /* Requested region covers 3x the xlim range. */
  const reqReg = map(xlim, ([a, b]) => [2 * a - b, 2 * b - a]);

  // Wrap region requests in a posaphore, so multiple instances of this canvas
  // don't request multiple times.
  const doRequests = posaphore(() => reqReg(requestRegion));

  return r => {
    const container = elem('div');
    const canvas = elem('canvas');
    container.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    const [size, setSize] = state([0, 0] as RectSize);

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

    canvas.style.width = '200px';
    canvas.style.height = '200px';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';

    const cleanups: Cleanup[] = [doRequests()];

    if (ctx) {
      let x0 = 0;
      let y0 = 0;
      const updateDrag = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const [xda, xdb] = xs.domain();
        const [xra, xrb] = xs.range();
        const xt = (e.clientX - rect.left - xra) / (xrb - xra);
        const xSpread = xdb - xda;
        const xLo = x0 - xt * xSpread;
        onSetXLim([xLo, xLo + xSpread]);

        const [yda, ydb] = ys.domain();
        const [yra, yrb] = ys.range();
        const yt = (e.clientY - rect.top - yra) / (yrb - yra);
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
      cleanups.push(domEvent('mousedown', e => {
        const rect = canvas.getBoundingClientRect();
        x0 = xs.invert(e.clientX - rect.left);
        y0 = ys.invert(e.clientY - rect.top);
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

      const axisConfig = join({ size, xlim, ylim, xLabel, yLabel, title, data });

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

        const {t: dx, y: dy} = data;
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
};

const FillLayer = (
  style: Partial<StreamableCSS>,
  children?: ElementThing[],
  effects?: Effect[]
) => div({
  position: 'absolute',
  width: '100%',
  height: '100%',
  top: '0',
  left: '0',
  ...style,
}, children, effects);

function FillDragRegion(h: Handler<MouseEvent>) {
  return FillLayer({ zIndex: '0' }, [], [domEvent('mousedown', h)]);
}

function allEffect(...es: Effect[]): Effect {
  return n => cleanup(...es.map(e => e(n)));
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

const Pane = (color: string, children?: ElementThing[]) => div({
  width: '100%',
  height: '100%',
  backgroundColor: '#ffffff',
}, children);

const WhitePane = Pane('white');

const Matte = (content: ElementThing) => div({
  width: '100%',
  height: '100%',
  backgroundColor: '#ffffff',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
}, [content]);

type Window = (c: WindowControls) => Component;

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

const [windows, addWindow] = windowEnvironment();

const ds = new DataStore();

const data = (h: Handler<Data>) => ds.subscribe(5, h);

// const cli = setInterval(() => {
//   ds.addPoint(5, Math.random(), .1 * Math.random());
// }, 50);

// setTimeout(() => clearInterval(cli), 50000);

/*
Plot should be able to subscribe to a region of data.
If would be nice if the data provider could just hand us some data that should be plotted on the plot, then the plot doesn't need to care about it.
*/

const connect = () => {
  const ws = new WebSocket('ws://localhost:3000');
  ws.onmessage = x => console.log('received', x.data);
  return ws;
}

const ws = connect();

const onRequest = (region: Limits) => {
  console.log('request', region);
};

const [xlim, setXlim] = state([0, 1] as Limits);
const [ylim, setYlim] = state([0, 1] as Limits);
const plot = SimpleWindow("Yooo", Plot2D(xlim, ylim, setXlim, setYlim, data, onRequest));

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
  menuItem({ label: 'Preferences...', action: () => addWindow(emitterApp) }),
  menuItem({ label: 'Privacy Report...', action: () => addWindow(WifiApp) }),
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

const dt = desktop(windows, safariMenu);

render(dt, document.body);

addWindow(Finder);
addWindow(emitterApp);
// addWindow(plot);
