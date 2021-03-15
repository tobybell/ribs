import { append, domEvent, Effect } from "./component";
import { div, text } from "./div";

import { ticks } from "d3";
import { customState, Handler, just, map, Stream, time } from "./stream-stuff";
import { ArrayHandler, arrayMap, ArrayStream } from "./array-stuff";
import { state, State } from "./state";
import { posaphore } from "./posaphore";
import { cleanup, Temporary } from "./temporary-stuff";
import { arrayChildren } from "./array-children";
import { elem } from "./elem";
import { shaderProgram } from "./web-gl";
import { noop } from "./function-stuff";
import { mat2, vec4 } from "./mat4";
import { fetchLf32, fetchLf64 } from "./fetching";

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

export const fillWebGlCanvas = (tlim: State<Limits>, series: Float32Array): Effect => p => {
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
      render();
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
  const render = () => {
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

  let minY = series[1];
  let maxY = series[1];
  for (let i = 1; i < n; i += 1) {
    const y = series[2 * i + 1];
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }

  // Manual correction in case there is only a single value.
  if (maxY - minY == 0) {
    minY -= .5;
    maxY += .5;
  }

  return cleanup(
    append(c, p),
    tlim.stream(x => {
      affMat[0] = 2 / (x[1] - x[0]);
      affMat[1] = 2 / (maxY - minY);
      affMat[2] = -2 * x[0] / (x[1] - x[0]) - 1;
      affMat[3] = -2 * minY / (maxY - minY) - 1;
      render();
    }),
  );
};

const uncertaintyCanvas = (tlim: State<Limits>, series: Float32Array): Effect => p => {
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
      render();
    }
  });
  o.observe(p);

  // Clear to transparent.
  gl.clearColor(0., 0., 0., 0.);

  const lp = lineProgram(gl);

  const n = series.length / 3;

  const color = new Float32Array([1., 1., 0.]);

  console.log(series);
  (window as any).unc = series;
  const areaPos = new Float32Array(4 * n);
  for (let i = 0; i < n; ++i) {
    const t = series[3 * i];
    const p = series[3 * i + 2];
    areaPos[4 * i] = t;
    areaPos[4 * i + 1] = p;
    areaPos[4 * i + 2] = t;
    areaPos[4 * i + 3] = 0;
  }
  (window as any).uncAr = areaPos;

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
  const render = () => {
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

  // Manual correction in case there is only a single value.
  if (maxY - minY == 0) {
    minY -= .5;
    maxY += .5;
  }

  return cleanup(
    append(c, p),
    tlim.stream(x => {
      affMat[0] = 2 / (x[1] - x[0]);
      affMat[1] = 2 / (maxY - minY);
      affMat[2] = -2 * x[0] / (x[1] - x[0]) - 1;
      affMat[3] = -2 * minY / (maxY - minY) - 1;
      render();
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

const trueTrack = (name: string, tlim: State<Limits>) => {
  return div({
    height: "100px",
    boxShadow: "0 -1px 0 rgba(255, 255, 255, 0.1) inset",
  }, [], [
    defer(
      fetchLf64(`/true-${name}.lf64`).then(x => {
        const x32 = new Float32Array(x);
        return fillWebGlCanvas(tlim, x32);
      }),
    ),
  ]);
};

const uncertaintyTrack = (name: string, tlim: State<Limits>) => {
  return div({
    height: "100px",
    boxShadow: "0 -1px 0 rgba(255, 255, 255, 0.1) inset",
  }, [], [
    defer(
      fetchLf32(`/error-${name}.lf32`).then(x => uncertaintyCanvas(tlim, x)),
    ),
  ]);
};

const track = (tlim: State<Limits>) => {
  const n = 1000;
  const series = new Float32Array(2 * n);
  let d = 0;
  for (let i = 0; i < n; i += 1) {
    series[2 * i] = i;
    series[2 * i + 1] = d;
    d += Math.random() * .02 - .01;
  }

  return div({
    height: "100px",
    boxShadow: "0 -1px 0 rgba(255, 255, 255, 0.1) inset",
  }, [], [
    fillWebGlCanvas(tlim, series),
  ]);
};

function tickStream(lim: State<Limits>): ArrayStream<number> {
  const curr = ticks(lim.value[0], lim.value[1], 17);
  const handlers = new Set<ArrayHandler<number>>();
  const enable = posaphore(() => lim.stream(([min, max]) => {
    curr.splice(0);
    curr.push(...ticks(min, max, 17));
    handlers.forEach(h => h.init(curr));
  }));
  return h => (handlers.add(h), cleanup(enable(), () => handlers.delete(h)));
}

const timeAxis = (tlim: State<Limits>) => {
  const ts = tickStream(tlim);
  return div({
    height: "25px",
    boxShadow: "0 -1px 0 rgba(255, 255, 255, 0.1) inset",
  }, [
    div({
      height: "100%",
      transform: map(tlim.stream, ([a, b]) => `translateX(${-1000 / (b - a) * a}px)`),
    }, [], [arrayChildren(arrayMap(ts, x =>
      div({
        position: "absolute",
        height: "100%",
        width: "1px",
        borderLeft: "1px solid white",
        transform: `translateX(${1000 * x / (tlim.value[1] - tlim.value[0])}px)`,
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

export const Timeline = () => {
  const tlim = state<Limits>([0, 120]);
  const tlimCache = tlim.value;
  const left = 0;
  const right = 1000;
  const width = right - left;
  const tScale = (t: number) => left + (t - tlimCache[0]) / (tlimCache[1] - tlimCache[0]) * width;
  const tInvert = (p: number) => tlimCache[0] + (p - left) / width * (tlimCache[1] - tlimCache[0]);
  return div({}, [
    timeAxis(tlim),
    track(tlim),
    track(tlim),
    track(tlim),
    track(tlim),
    trueTrack("g00", tlim),
    uncertaintyTrack("g00", tlim),
  ], [
    domEvent("wheel", e => {
      const d = e.currentTarget! as HTMLDivElement;
      e.preventDefault();
      e.stopPropagation();
      const { deltaX, deltaY } = e;
      if (e.altKey || e.ctrlKey) {
        if (deltaY) {
          const [xda, xdb] = tlimCache;
          const rect = d.getBoundingClientRect();
          const xc = tInvert(e.clientX - rect.left);
          const sf = Math.exp(deltaY * .01);
          tlimCache[0] = xc + sf * (xda - xc);
          tlimCache[1] = xc + sf * (xdb - xc);
          tlim.set(tlimCache);
        }
      } else {
        if (deltaX) {
          const [xda, xdb] = tlimCache;
          const [xra, xrb] = [left, right];
          const dx = deltaX * (xdb - xda) / (xrb - xra);
          tlimCache[0] = xda + dx;
          tlimCache[1] = xdb + dx;
          tlim.set(tlimCache);
        }
      }
    })
  ]);
};
