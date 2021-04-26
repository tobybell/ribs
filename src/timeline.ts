import { append, Component, domEvent, Effect, render, renderAt } from "./component";
import { children, div, text } from "./div";

import { ticks } from "d3";
import { customState, Handler, join, just, map, sample, Stream, time, zip } from "./stream-stuff";
import { ArrayHandler, arrayMap, ArrayStream } from "./array-stuff";
import { state, State } from "./state";
import { posaphore } from "./posaphore";
import { Cleanup, cleanup, Temporary } from "./temporary-stuff";
import { arrayChildren } from "./array-children";
import { elem } from "./elem";
import { shaderProgram } from "./web-gl";
import { noop } from "./function-stuff";
import { mat2, vec4 } from "./mat4";
import { fetchLf32, fetchLf64 } from "./fetching";
import { contentTitle, simpleTitleBar } from "./toolbar-bar";
import { win, windowPane } from "./window-stuff";
import { Frame } from "./frame";

const lineProgram = (gl: WebGLRenderingContext) => shaderProgram(gl, `
  attribute float aX;
  attribute float aY;
  uniform mediump vec4 uAff;
  void main(void) {
    gl_Position = vec4(uAff.x * aX + uAff.z, uAff.y * aY + uAff.w, .5, 1.);
  }
`, `
  uniform lowp vec3 uColor;
  uniform lowp float uOpacity;
  void main(void) {
    gl_FragColor = uOpacity * vec4(uColor, 1);
  }
`)!;

const TRACK_HEADER_WIDTH = 200;
const trackHeaderWidth = just(TRACK_HEADER_WIDTH);
const pixels = (w: Stream<number>) => map(w, x => `${x}px`);
const trackHeaderWidthPx = pixels(trackHeaderWidth);

export const fillWebGlCanvas = (ctx: TimelineContext, series: Float32Array, minY: number, maxY: number): Effect => p => {
  const c = elem("canvas");
  c.width = 100;
  c.height = 100;
  c.style.position = "absolute";
  c.style.top = "0";
  c.style.left = "0";
  const gl = c.getContext("webgl");
  if (!gl) {
    console.error("WebGL unavailable.");
    return noop;
  }

  const o = new ResizeObserver(entries => {
    const entry = entries[entries.length - 1];
    if (entry) {
      const { width, height } = entry.contentRect;
      const w = Math.floor(width);
      const h = Math.floor(height);
      c.width = w;
      c.height = h;
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
      gl.viewport(0, 0, w, h);
      draw();
    }
  });
  o.observe(p);

  // Clear to transparent.
  gl.clearColor(0., 0., 0., 0.);

  const lp = lineProgram(gl);

  const n = series.length / 2;

  const color = new Float32Array([1., 1., 0.]);

  const position = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, position);
  gl.bufferData(gl.ARRAY_BUFFER, series, gl.STATIC_DRAW);

  const aX = gl.getAttribLocation(lp, "aX");
  const aY = gl.getAttribLocation(lp, "aY");
  const uColor = gl.getUniformLocation(lp, "uColor")!;
  const uAff = gl.getUniformLocation(lp, "uAff")!;
  const uOpacity = gl.getUniformLocation(lp, "uOpacity")!;

  let affMat = vec4(2, 2, -1, -1);

  // Draw the scene repeatedly
  const draw = () => {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(lp);
    gl.lineWidth(1);

    // Tell WebGL how to pull out the positions
    gl.bindBuffer(gl.ARRAY_BUFFER, position);
    gl.vertexAttribPointer(aX, 1, gl.FLOAT, false, 8, 0);
    gl.vertexAttribPointer(aY, 1, gl.FLOAT, false, 8, 4);
    gl.enableVertexAttribArray(aX);
    gl.enableVertexAttribArray(aY);

    gl.uniform3fv(uColor, color);
    gl.uniform4fv(uAff, affMat);
    gl.uniform1f(uOpacity, 1);

    gl.drawArrays(gl.LINE_STRIP, 0, n);
  };

  // Manual correction in case there is only a single value.
  if (maxY - minY == 0) {
    minY -= .5;
    maxY += .5;
  }

  return cleanup(
    append(c, p),
    join({scale: ctx.timeScale, offset: ctx.timeOffset, width: ctx.tracksWidth})(({scale, offset, width}) => {
      affMat[0] = 2 / (width * scale);
      affMat[1] = 2 / (maxY - minY);
      affMat[2] = -2 * offset / (width * scale) - 1;
      affMat[3] = -2 * minY / (maxY - minY) - 1;
      requestAnimationFrame(draw);
    }),
  );
};

const posCanvas = (ctx: TimelineContext, series: Float32Array, minY: number, maxY: number): Effect => p => {
  const c = elem("canvas");
  c.width = 100;
  c.height = 100;
  c.style.position = "absolute";
  c.style.top = "0";
  c.style.left = "0";
  const gl = c.getContext("webgl");
  if (!gl) {
    console.error("WebGL unavailable.");
    return noop;
  }

  const o = new ResizeObserver(entries => {
    const entry = entries[entries.length - 1];
    if (entry) {
      const { width, height } = entry.contentRect;
      const w = Math.floor(width);
      const h = Math.floor(height);
      c.width = w;
      c.height = h;
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
      gl.viewport(0, 0, w, h);
      draw();
    }
  });
  o.observe(p);

  // Clear to transparent.
  gl.clearColor(0., 0., 0., 0.);

  const lp = lineProgram(gl);

  const n = series.length / 4;

  const color = new Float32Array([0., 1., 1.]);

  const position = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, position);
  gl.bufferData(gl.ARRAY_BUFFER, series, gl.STATIC_DRAW);

  const aX = gl.getAttribLocation(lp, "aX");
  const aY = gl.getAttribLocation(lp, "aY");
  const uColor = gl.getUniformLocation(lp, "uColor")!;
  const uAff = gl.getUniformLocation(lp, "uAff")!;
  const uOpacity = gl.getUniformLocation(lp, "uOpacity")!;

  let affMat = vec4(2, 2, -1, -1);

  // Draw the scene repeatedly
  const draw = () => {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(lp);
    gl.lineWidth(1);

    gl.enableVertexAttribArray(aX);
    gl.enableVertexAttribArray(aY);
    gl.uniform4fv(uAff, affMat);
    gl.uniform3fv(uColor, color);
    gl.uniform1f(uOpacity, 1);

    gl.bindBuffer(gl.ARRAY_BUFFER, position);
    gl.vertexAttribPointer(aX, 1, gl.FLOAT, false, 16, 0);
    gl.vertexAttribPointer(aY, 1, gl.FLOAT, false, 16, 4);
    gl.drawArrays(gl.LINE_STRIP, 0, n);
    gl.vertexAttribPointer(aY, 1, gl.FLOAT, false, 16, 8);
    gl.drawArrays(gl.LINE_STRIP, 0, n);
    gl.vertexAttribPointer(aY, 1, gl.FLOAT, false, 16, 12);
    gl.drawArrays(gl.LINE_STRIP, 0, n);
  };

  // Manual correction in case there is only a single value.
  if (maxY - minY == 0) {
    minY -= .5;
    maxY += .5;
  }

  return cleanup(
    append(c, p),
    join({scale: ctx.timeScale, offset: ctx.timeOffset, width: ctx.tracksWidth})(({scale, offset, width}) => {
      affMat[0] = 2 / (width * scale);
      affMat[1] = 2 / (maxY - minY);
      affMat[2] = -2 * offset / (width * scale) - 1;
      affMat[3] = -2 * minY / (maxY - minY) - 1;
      requestAnimationFrame(draw);
    }),
  );
};

const uncertaintyCanvas = (ctx: TimelineContext, series: Float32Array, minY: number, maxY: number): Effect => p => {
  const c = elem("canvas");
  c.width = 100;
  c.height = 100;
  c.style.position = "absolute";
  c.style.top = "0";
  c.style.left = "0";
  const gl = c.getContext("webgl");
  if (!gl) {
    console.error("WebGL unavailable.");
    return noop;
  }

  const o = new ResizeObserver(entries => {
    const entry = entries[entries.length - 1];
    if (entry) {
      const { width, height } = entry.contentRect;
      const w = Math.floor(width);
      const h = Math.floor(height);
      c.width = w;
      c.height = h;
      c.style.width = `${w}px`;
      c.style.height = `${h}px`;
      gl.viewport(0, 0, w, h);
      draw();
    }
  });
  o.observe(p);

  // Clear to transparent.
  gl.clearColor(0., 0., 0., 0.);

  const lp = lineProgram(gl);

  const n = series.length / 3;

  const color = new Float32Array([1., 1., 0.]);

  const areaPos = new Float32Array(4 * n);
  for (let i = 0; i < n; ++i) {
    const t = series[3 * i];
    const p = series[3 * i + 2];
    areaPos[4 * i] = t;
    areaPos[4 * i + 1] = p;
    areaPos[4 * i + 2] = t;
    areaPos[4 * i + 3] = 0;
  }

  const position = gl.createBuffer()!;
  const area = gl.createBuffer()!;
  gl.bindBuffer(gl.ARRAY_BUFFER, position);
  gl.bufferData(gl.ARRAY_BUFFER, series, gl.STATIC_DRAW);
  gl.bindBuffer(gl.ARRAY_BUFFER, area);
  gl.bufferData(gl.ARRAY_BUFFER, areaPos, gl.STATIC_DRAW);
  

  const aX = gl.getAttribLocation(lp, "aX");
  const aY = gl.getAttribLocation(lp, "aY");
  const uColor = gl.getUniformLocation(lp, "uColor")!;
  const uAff = gl.getUniformLocation(lp, "uAff")!;
  const uOpacity = gl.getUniformLocation(lp, "uOpacity")!;

  let affMat = vec4(2, 2, -1, -1);

  // Draw the scene repeatedly
  const draw = () => {
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.useProgram(lp);
    gl.lineWidth(1);

    gl.enableVertexAttribArray(aX);
    gl.enableVertexAttribArray(aY);

    // Draw the uncertainty area.
    gl.bindBuffer(gl.ARRAY_BUFFER, area);
    gl.vertexAttribPointer(aX, 1, gl.FLOAT, false, 8, 0);
    gl.vertexAttribPointer(aY, 1, gl.FLOAT, false, 8, 4);
    gl.uniform1f(uOpacity, .2);
    affMat[1] = -affMat[1];  // Flip upside down.
    gl.uniform4fv(uAff, affMat);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, n * 2);
    affMat[1] = -affMat[1];  // Flip back.
    gl.uniform4fv(uAff, affMat);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, n * 2);

    gl.bindBuffer(gl.ARRAY_BUFFER, position);
    gl.vertexAttribPointer(aX, 1, gl.FLOAT, false, 12, 0);
    gl.vertexAttribPointer(aY, 1, gl.FLOAT, false, 12, 4);
    gl.uniform3fv(uColor, color);
    gl.uniform1f(uOpacity, 1);
    gl.drawArrays(gl.LINE_STRIP, 0, n);
  };

  // Manual correction in case there is only a single value.
  if (maxY - minY == 0) {
    minY -= .5;
    maxY += .5;
  }

  return cleanup(
    append(c, p),
    join({scale: ctx.timeScale, offset: ctx.timeOffset, width: ctx.tracksWidth})(({scale, offset, width}) => {
      affMat[0] = 2 / (width * scale);
      affMat[1] = 2 / (maxY - minY);
      affMat[2] = -2 * offset / (width * scale) - 1;
      affMat[3] = -2 * minY / (maxY - minY) - 1;
      requestAnimationFrame(draw);
    }),
  );
};

const defer = (x: Promise<Effect>): Effect => {
  return r => {
    let mounted = true;
    let cleanup = noop;
    x.then(f => mounted && (cleanup = f(r)));
    return () => {
      mounted = false;
      cleanup;
    };
  };
};

const defaultTrueTrack = (name: string) =>
  trueTrack(`/true-${name}.lf64`);

const simTrueTrack = (sim: string, vari: string) =>
  trueTrack(`http://localhost/${sim}/true-${vari}.lf64`);

const simCartTrack = (sim: string) =>
  positionTrack(`http://localhost/${sim}/orbit-cart.lf32`);

interface TimelineContext {
  timeScale: Stream<number>;
  timeOffset: Stream<number>;
  tracksWidth: Stream<number>;
};

type Header = (width: Stream<string>) => Component;
type Region = (ctx: TimelineContext) => Effect;
type Track = (ctx: TimelineContext) => Component;

const trackTitle = (title: string) => div({
  color: '#fff',
  fontSize: '14px',
  fontWeight: 'bold',
}, [title]);

const statLabel = (label: string, value: Stream<number | null>) => div({
  borderRadius: '8px',
  height: '16px',
  color: '#eee',
  marginTop: '5px',
  backgroundColor: 'rgba(255, 255, 255, 0.15)',
  padding: '0 6px',
  display: 'flex',
}, [label, text(map(value, x => `${x}`))]);

const simpleTrackHeader = (title: string, min?: Stream<number | null>, max?: Stream<number | null>): Header => width => div({
  width,
  height: '100%',
  padding: '10px',
  display: 'flex',
  flexFlow: 'column nowrap',
  justifyContent: 'center',
  alignItems: 'flex-start',
  boxSizing: 'border-box',
  background: 'linear-gradient(#383838, #303030)',
  boxShadow: '0 1px 0 rgba(255, 255, 255, 0.15) inset, 0 -1px 0 rgba(0, 0, 0, 0.15) inset',
}, [
  trackTitle(title),
  min != undefined && statLabel('Min ', min),
  max != undefined && statLabel('Max ', max),
]);

const arbTrack = (header: Header, content: Region): Track => ctx => div({
  height: "100px",
  backgroundColor: '#222',
  boxShadow: '0 1px 0 rgba(255, 255, 255, 0.05) inset, 0 -1px 0 rgba(0, 0, 0, 0.3) inset',
  display: 'flex',
  alignItems: 'stretch',
}, [
  header(trackHeaderWidthPx),
  div({
    flex: '1 0 0',
  }, [], [content(ctx)]),
]);

const trueTrack = (url: string): Track => ctx => {
  const data = fetchLf64(url);
  const dataPack = data.then(series => {
    const n = series.length / 2;
    let minY = series[1];
    let maxY = series[1];
    for (let i = 1; i < n; i += 1) {
      const y = series[2 * i + 1];
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    return [series, minY, maxY] as const;
  });

  return arbTrack(
    simpleTrackHeader(varName(url)),
    ctx => defer(dataPack.then(([x, minY, maxY]) => {
      const x32 = new Float32Array(x);
      return fillWebGlCanvas(ctx, x32, minY, maxY);
    })),
  )(ctx);
};

const positionTrack = (url: string): Track => ctx => {
  const minY$ = state<number | null>(null);
  const maxY$ = state<number | null>(null);

  const data = fetchLf32(url);
  const dataPack = data.then(series => {
    const n = series.length;
    let minY = series[1];
    let maxY = series[1];
    for (let i = 2; i < n; i += 1) {
      if (i % 4 == 0) continue;
      const y = series[i];
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    minY$.set(minY);
    maxY$.set(maxY);
    return [series, minY, maxY] as const;
  });

  return arbTrack(
    simpleTrackHeader(varName(url), minY$.stream, maxY$.stream),
    ctx => defer(dataPack.then(([x, minY, maxY]) => {
      return posCanvas(ctx, x, minY, maxY);
    })),
  )(ctx);
};

const defaultUncertaintyTrack = (name: string) =>
  uncertaintyTrack(`/error-${name}.lf32`);

const simUncertaintyTrack = (sim: string, vari: string) =>
  uncertaintyTrack(`http://localhost/${sim}/error-${vari}.lf32`);

const simEventTrack = (sim: string, vari: string) =>
  eventTrack(`http://localhost/${sim}/event-${vari}.lf32`);

const varName = (url: string) => {
  const a = url.lastIndexOf('/') + 1;
  const b = url.indexOf('-', a) + 1;
  const c = url.lastIndexOf('.');
  return url.substring(b, c);
};

const uncertaintyTrack = (url: string): Track => ctx => {
  const data = fetchLf32(url);

  const minY$ = state<number | null>(null);
  const maxY$ = state<number | null>(null);

  const dataPack = data.then(series => {
    const n = series.length;
    let minY = series[1];
    let maxY = series[1];
    for (let i = 1; i < n; i += 1) {
      const d = series[3 * i + 1];
      const p = series[3 * i + 2];
      if (d < minY) minY = d;
      if (d > maxY) maxY = d;
      if (-p < minY) minY = -p;
      if (p > maxY) maxY = p;
    }
    minY$.set(minY);
    maxY$.set(maxY);
    return [series, minY, maxY] as const;
  });

  return arbTrack(
    simpleTrackHeader(varName(url), minY$.stream, maxY$.stream),
    ctx => defer(dataPack.then(([x, minY, maxY]) => uncertaintyCanvas(ctx, x, minY, maxY))),
  )(ctx);
};

const eventBubbles = (ctx: TimelineContext, series: Float32Array): Effect => p => {
  const timeStream = join({
    scale: ctx.timeScale,
    offset: ctx.timeOffset,
  });
  const eventBubble = (time: number): Component => {
    return div({
      position: 'absolute',
      width: '12px',
      height: '12px',
      transform: 'translateY(-2px)',
      backgroundColor: '#e32',
      border: '1px solid #fff',
      boxSizing: 'border-box',
      borderRadius: '50%',
      left: map(timeStream, ({scale, offset}) => `${(time - offset) / scale}px`),
      top: '0',
      content: `${time}`,
    });
  };

  const us: Cleanup[] = [];

  const n = series.length;
  for (let i = 0; i < n; ++i) {
    us.push(render(eventBubble(series[i]), p));
  }

  return cleanup(...us);
};

const eventTrack = (url: string) => arbTrack(
  simpleTrackHeader(varName(url)),
  ctx => defer(
    fetchLf32(url).then(x => eventBubbles(ctx, x)),
  ),
);

function tickStream(lim: Stream<Limits>): ArrayStream<number> {
  const curr: number[] = [];
  const handlers = new Set<ArrayHandler<number>>();
  const enable = posaphore(() => lim(([min, max]) => {
    curr.splice(0);
    curr.push(...ticks(min, max, 10));
    handlers.forEach(h => h.init(curr));
  }));
  return h => (handlers.add(h), cleanup(enable(), () => handlers.delete(h)));
}

const timeAxis = (ctx: TimelineContext) => {
  const time = join({
    scale: ctx.timeScale,
    offset: ctx.timeOffset,
    width: ctx.tracksWidth,
  });
  const limits = map(time, ({scale, offset, width}) => [offset, offset + width * scale] as Limits);
  const ofs = map(time, ({scale, offset}) => -offset / scale);
  const ts = tickStream(limits);
  return div({
    flex: '1 0 0',
  }, [
    div({
      height: "100%",
      transform: map(ofs, x => `translateX(${x}px)`),
    }, [], [arrayChildren(arrayMap(ts, x =>
      div({
        position: "absolute",
        height: "100%",
        width: "1px",
        borderLeft: "1px solid white",
        transform: map(ctx.timeScale, m => `translateX(${x / m}px)`),
      }, [
        div({
          transform: "translate(5px, 0)",
          color: "#ffffff",
          fontSize: "12px",
        }, [text(just(`${x}`))]),
      ])
    )
  )])]); 
}

type Limits = [number, number];

const headerHeader = () => div({
  width: trackHeaderWidthPx,
  background: 'linear-gradient(#383838, #303030)',
  boxShadow: '0 1px 0 rgba(255, 255, 255, 0.15) inset, 0 -1px 0 rgba(0, 0, 0, 0.15) inset',
});

const tracksArea = (tracks: Component[], onWheel: Handler<WheelEvent>) => div({
  overflow: 'hidden scroll',
  flex: '1 0 0',
}, tracks, [domEvent("wheel", onWheel)]);

const headerArea = (ctx: TimelineContext) => div({
  height: '25px',
  display: 'flex',
  alignItems: 'stretch',
}, [
  headerHeader(),
  timeAxis(ctx),
]);

export const Timeline = (frame: Stream<Frame>, ...tracks: Track[]) => {
  
  const timeScale = state(1);
  const timeOffset = state(0);

  const context: TimelineContext = {
    timeScale: timeScale.stream,
    timeOffset: timeOffset.stream,
    tracksWidth: map(frame, f => f.width - TRACK_HEADER_WIDTH),
  };

  // Layout context:
  // - scale parts
  //     timeScale - multiply by for pixels -> time
  // - offset parts
  //     timeOffset - time to offset by, time at left side of area

  // Compute reactive quantities at the granularity of the coarsest thing/
  // biggest bundle. Peel off smaller things from that if needed.
  const left = 0;
  const tInvert = (p: number) => timeScale.value * (p - left) + timeOffset.value;
  return div({
    flex: '1 0 0',
    display: 'flex',
    flexFlow: 'column nowrap',
    backgroundColor: '#282828',
  }, [
    headerArea(context),
    tracksArea(
      tracks.map(x => x(context)),
      e => {
        const d = e.currentTarget! as HTMLDivElement;
        const { deltaX, deltaY } = e;
        if (e.altKey || e.ctrlKey) {
          if (deltaY) {
            const m = timeScale.value;
            const b = timeOffset.value;
            const rect = d.getBoundingClientRect();
            const xc = m * (e.clientX - rect.left - TRACK_HEADER_WIDTH) + b;
            const sf = Math.exp(deltaY * .01);
            timeOffset.set(xc + sf * (b - xc));
            timeScale.set(m * sf);
          }
          e.preventDefault();
          e.stopPropagation();
        } else {
          if (deltaX) {
            const dx = deltaX * timeScale.value;
            timeOffset.set(timeOffset.value + dx);
          }
        }
      },
    ),
  ]);
};

const SharedTimelineWindow = (title: string | Component, ...tracks: Track[]) =>
  win(c => windowPane([
    simpleTitleBar(title, c.handles.middle, c.close),
    Timeline(c.frame, ...tracks),
  ]));

export const TimelineWindow = () =>
  SharedTimelineWindow("Timeline",
    defaultTrueTrack("g00"),
    defaultUncertaintyTrack("g00"),
  );

export const SimulationTimelineWindow = (sim: string) =>
  SharedTimelineWindow(contentTitle(sim),
    simTrueTrack(sim, "g00"),
    simCartTrack(sim),
    simUncertaintyTrack(sim, "c00"),
    simUncertaintyTrack(sim, "pos"),
    simUncertaintyTrack(sim, "c00-sim1"),
    simUncertaintyTrack(sim, "c00-sim2"),
    simUncertaintyTrack(sim, "c00-sim3"),
    simUncertaintyTrack(sim, "c00-sim4"),
    simUncertaintyTrack(sim, "c00-sim5"),
    // simEventTrack(sim, 'meas'),
  );
