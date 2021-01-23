import { Emitter } from "./apps/Emitter";
import { Finder } from "./apps/Finder";
import { PreferredNetworks } from "./apps/PreferredNetworks";
import { Quantities } from "./apps/Quantities";
import { binsert } from "./bsearch";
import { Component, domEvent, Effect, mount, render } from "./component";
import { connect } from "./connection";
import { Data, DataStore, Quantity, Time } from "./data-stuff";
import { desktop } from "./desktop";
import { div } from "./div";
import { elem } from "./elem";
import { noop } from "./function-stuff";
import { Mat4, mat4, Vec2, Vec3, vec3 } from "./mat4";
import { menu, menuItem, menuSeparator } from "./menu";
import { posaphore } from "./posaphore";
import { either, join, just, map, rsquare, state, Stream, zip } from "./stream-stuff";
import { Cleanup, cleanup, Temporary } from "./temporary-stuff";
import { simpleTitleBar } from "./toolbar-bar";
import { WindowControls, windowEnvironment, windowPane } from "./window-stuff";

import { scaleLinear, ticks } from "d3";

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

function shaderProgram(gl: WebGLRenderingContext, vsSource: string, fsSource: string) {
  const vertexShader = shader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = shader(gl, gl.FRAGMENT_SHADER, fsSource);

  // Create the shader program

  const p = gl.createProgram();
  if (!p || !vertexShader || !fragmentShader) {
    console.error("Couldn't create shader program.");
    return;
  }
  gl.attachShader(p, vertexShader);
  gl.attachShader(p, fragmentShader);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error("Couldn't link shader program: " + gl.getProgramInfoLog(p));
    return;
  }

  return p;
}

//
// creates a shader of the given type, uploads the source and
// compiles it.
//
function shader(gl: WebGLRenderingContext, type: number, source: string) {
  const s = gl.createShader(type);
  if (!s) {
    console.error("Couldn't create shader.");
    return;
  }
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error("An error occurred compiling the shaders: " + gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return;
  }
  return s;
}

interface GeometryModel {
  vertices: Float32Array;
  faces: Uint32Array;
}

interface Model extends GeometryModel {
  normals: Float32Array;
}

function fetchModel(): Promise<Model> {
  const vertices = fetch("/vertices.lf32").then(
    r => r.arrayBuffer().then(b => new Float32Array(b)));
  const faces = fetch("/faces.lu32").then(
    r => r.arrayBuffer().then(b => new Uint32Array(b)));
  return Promise.all([vertices, faces]).then(
    ([vertices, faces]) => ({
      vertices,
      faces,
      normals: makeNormals(vertices, faces),
    }));
}

function makeNormals(vertices: Float32Array, faces: Uint32Array) {
  // TODO: Interleave normals with vertices and freeze on the server.
  const verticesLength = vertices.length;
  const facesLength = faces.length;
  const normals = new Float32Array(verticesLength);
  for (let i = 0; i < facesLength; i += 3) {
    const v0 = 3 * faces[i + 0];
    const v1 = 3 * faces[i + 1];
    const v2 = 3 * faces[i + 2];
    const ax = vertices[v1 + 0] - vertices[v0 + 0],
          ay = vertices[v1 + 1] - vertices[v0 + 1],
          az = vertices[v1 + 2] - vertices[v0 + 2];
    const bx = vertices[v2 + 0] - vertices[v0 + 0],
          by = vertices[v2 + 1] - vertices[v0 + 1],
          bz = vertices[v2 + 2] - vertices[v0 + 2];
    const nx = ay * bz - az * by;
    const ny = az * bx - ax * bz;
    const nz = ax * by - ay * bx;
    normals[v0+0] += nx;
    normals[v0+1] += ny;
    normals[v0+2] += nz;
    normals[v1+0] += nx;
    normals[v1+1] += ny;
    normals[v1+2] += nz;
    normals[v2+0] += nx;
    normals[v2+1] += ny;
    normals[v2+2] += nz;
  }
  for (let i = 0; i < verticesLength; i += 3) {
    const x = normals[i + 0];
    const y = normals[i + 1];
    const z = normals[i + 2];
    const d = Math.sqrt(x * x + y * y + z * z);
    normals[i + 0] = x / d;
    normals[i + 1] = y / d;
    normals[i + 2] = z / d;
  }
  return normals;
}

type Drawer = (m: Mat4) => void;
type GraphicsProgram = (
  g: WebGLRenderingContext,
  register: Temporary<Drawer>,
  projectionMatrix: Mat4,
  resolution: Vec2) => Cleanup;

function erosProgram(m: Model): GraphicsProgram {
  const numFaces = m.faces.length / 3;
  const numVertices = m.vertices.length / 3;
  console.log(numVertices);
  console.log(numFaces);

  return (gl, register, projectionMatrix) => {
    const program = shaderProgram(gl, `
      attribute vec4 aVertexPosition;
      attribute vec3 aVertexNormal;
      uniform mat4 uModelViewMatrix;
      uniform mat4 uProjectionMatrix;
      varying lowp vec4 vColor;
      void main(void) {
    
        // Scale down by 1e-4.
        vec4 pos = vec4(aVertexPosition.xyz, 1e4);
    
        gl_Position = uProjectionMatrix * uModelViewMatrix * pos;
        float i = dot((uModelViewMatrix * vec4(aVertexNormal, 0)).xyz, vec3(0, 1, 0));
        vColor = vec4(i, i, i, 1);
      }
    `, `
      varying lowp vec4 vColor;
      void main(void) {
        gl_FragColor = vColor;
      }
    `)!;

    // Collect all the info needed to use the shader program.
    // Look up which attributes our shader program is using
    // for aVertexPosition, aVevrtexColor and also
    // look up uniform locations.
    const positionAttribute = gl.getAttribLocation(program, "aVertexPosition");
    const normalAttribute = gl.getAttribLocation(program, "aVertexNormal");
    const projectionMatrixUniform = gl.getUniformLocation(program, "uProjectionMatrix")!;
    const modelViewMatrixUniform = gl.getUniformLocation(program, "uModelViewMatrix")!;

    const position = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, position);
    gl.bufferData(gl.ARRAY_BUFFER, m.vertices, gl.STATIC_DRAW);
  
    const normal = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, normal);
    gl.bufferData(gl.ARRAY_BUFFER, m.normals, gl.STATIC_DRAW);
  
    const index = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.faces, gl.STATIC_DRAW);

    const draw = (modelViewMatrix: Mat4) => {
      // Tell WebGL to use our program when drawing
      gl.useProgram(program);
    
      // Tell WebGL how to pull out the positions
      gl.bindBuffer(gl.ARRAY_BUFFER, position);
      gl.vertexAttribPointer(positionAttribute, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(positionAttribute);

      // Tell WebGL how to pull out the normals.
      gl.bindBuffer(gl.ARRAY_BUFFER, normal);
      gl.vertexAttribPointer(normalAttribute, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(normalAttribute);

      // Tell WebGL which indices to use to index the vertices
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);

      // Set the shader uniforms
      gl.uniformMatrix4fv(projectionMatrixUniform, false, projectionMatrix);
      gl.uniformMatrix4fv(modelViewMatrixUniform, false, modelViewMatrix);

      gl.drawElements(gl.TRIANGLES, 3 * numFaces, gl.UNSIGNED_INT, 0);
    };
    return cleanup(
      register(draw),
      () => {
        gl.deleteBuffer(position);
        gl.deleteBuffer(normal);
        gl.deleteBuffer(index);
        gl.deleteProgram(program);
      },
    );
  }
}

function dotsProgram(color: Stream<Vec3>): GraphicsProgram {
  return (gl, register, projectionMatrix) => {
    const program = shaderProgram(gl, `
      attribute vec4 center;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      void main(void) {
        gl_Position = projectionMatrix * modelViewMatrix * center;
        gl_PointSize = 10.;
      }
    `, `
      uniform lowp vec3 color;
      void main(void) {
        lowp vec2 pos = gl_PointCoord - vec2(0.5, 0.5);
        lowp float dist_squared = dot(pos, pos);
        lowp float alpha;
        if (dist_squared >= 0.25) {
          discard;
        }
        gl_FragColor = vec4(color, 1);
      }
    `)!;
    const centers = new Float32Array([
      2, 0, 0,
      0, 2, 0,
      0, 0, 2,
    ]);
    const centersBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, centersBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, centers, gl.STATIC_DRAW);
    const positionAttribute = gl.getAttribLocation(program, "center");
    const projectionMatrixUniform = gl.getUniformLocation(program, "projectionMatrix");
    const modelViewMatrixUniform = gl.getUniformLocation(program, "modelViewMatrix");
    const colorUniform = gl.getUniformLocation(program, "color");
    let lastColor: Float32Array;
    
    const draw = (modelViewMatrix: Mat4) => {
      // Tell WebGL to use our program when drawing
      gl.useProgram(program);
  
      // Tell WebGL how to pull out the positions from the position
      // buffer into the vertexPosition attribute
      gl.bindBuffer(gl.ARRAY_BUFFER, centersBuffer);
      gl.vertexAttribPointer(positionAttribute, 3, gl.FLOAT, false, 0, 0);
      gl.enableVertexAttribArray(positionAttribute);
    
      // Set the shader uniforms
      gl.uniformMatrix4fv(projectionMatrixUniform, false, projectionMatrix);
      gl.uniformMatrix4fv(modelViewMatrixUniform, false, modelViewMatrix);
      gl.uniform3fv(colorUniform, lastColor);

      gl.drawArrays(gl.POINTS, 0, 3);
    };
    return cleanup(
      color(x => lastColor = x),
      register(draw),
      () => {
        gl.deleteBuffer(centersBuffer);
        gl.deleteProgram(program);
      },
    );
  }
}

/** Draws three coordinate axes. */
function axesProgram(): GraphicsProgram {
  return (gl, register, projectionMatrix, resolution) => {
    const program = shaderProgram(gl, `
      attribute vec3 position;
      attribute vec3 dir;
      attribute vec3 color;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      uniform vec2 resolution;
      varying lowp vec3 vColor;
      void main(void) {
        float aspect = resolution.x / resolution.y;
        mat4 m = projectionMatrix * modelViewMatrix;
        vec4 world0 = m * vec4(100. * position, 1.);
        vec4 world1 = m * vec4(100. * position + dir, 1.);
        vec2 clip0 = world0.xy / abs(world0.w);
        clip0.x *= aspect;
        vec2 clip1 = world1.xy / abs(world1.w);
        clip1.x *= aspect;
        vec2 tangent = normalize(clip1 - clip0);
        vec2 normal = vec2(-tangent.y, tangent.x);
        normal.x /= aspect;
        gl_Position = vec4(world0.xy + 2. * world0.w * normal / resolution.y, world0.zw);
        vColor = color;
      }
    `, `
      varying lowp vec3 vColor;
      void main(void) {
        gl_FragColor = vec4(vColor, 0.5);
      }
    `)!;
    const axes = new Float32Array([
      // Position, color
      // 0, 0, 0, 1, 0, 0,
      // 1, 0, 0, 0, 1, 0,
      // 0, 1, 0, 0, 0, 1,

      0, 0, 0, 1, 0, 0, 1, 0, 0,
      1, 0, 0, 1, 0, 0, -1, 0, 0,
      1, 0, 0, 1, 0, 0, 1, 0, 0,
      0, 0, 0, 1, 0, 0, 1, 0, 0,
      0, 0, 0, 1, 0, 0, -1, 0, 0,
      1, 0, 0, 1, 0, 0, -1, 0, 0,

      0, 0, 0, 0, 1, 0, 0, 1, 0,
      0, 1, 0, 0, 1, 0, 0, -1, 0,
      0, 1, 0, 0, 1, 0, 0, 1, 0,
      0, 0, 0, 0, 1, 0, 0, 1, 0,
      0, 0, 0, 0, 1, 0, 0, -1, 0,
      0, 1, 0, 0, 1, 0, 0, -1, 0,

      0, 0, 0, 0, 0, 1, 0, 0, 1,
      0, 0, 1, 0, 0, 1, 0, 0, -1,
      0, 0, 1, 0, 0, 1, 0, 0, 1,
      0, 0, 0, 0, 0, 1, 0, 0, 1,
      0, 0, 0, 0, 0, 1, 0, 0, -1,
      0, 0, 1, 0, 0, 1, 0, 0, -1,
    ]);
    const geoBuffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, geoBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, axes, gl.STATIC_DRAW);
    const positionAttribute = gl.getAttribLocation(program, "position");
    const dirAttribute = gl.getAttribLocation(program, "dir");
    const colorAttribute = gl.getAttribLocation(program, "color");
    const projectionMatrixUniform = gl.getUniformLocation(program, "projectionMatrix");
    const modelViewMatrixUniform = gl.getUniformLocation(program, "modelViewMatrix");
    const resolutionUniform = gl.getUniformLocation(program, "resolution");
    const draw = (modelViewMatrix: Mat4) => {
      // Tell WebGL to use our program when drawing
      gl.useProgram(program);
  
      // Tell WebGL how to pull out the positions from the position
      // buffer into the vertexPosition attribute
      gl.bindBuffer(gl.ARRAY_BUFFER, geoBuffer);
      gl.vertexAttribPointer(positionAttribute, 3, gl.FLOAT, false, 36, 0);
      gl.enableVertexAttribArray(positionAttribute);
      gl.vertexAttribPointer(colorAttribute, 3, gl.FLOAT, false, 36, 12);
      gl.enableVertexAttribArray(colorAttribute);
      gl.vertexAttribPointer(dirAttribute, 3, gl.FLOAT, false, 36, 24);
      gl.enableVertexAttribArray(dirAttribute);
    
      // Set the shader uniforms
      gl.uniformMatrix4fv(projectionMatrixUniform, false, projectionMatrix);
      gl.uniformMatrix4fv(modelViewMatrixUniform, false, modelViewMatrix);
      gl.uniform2fv(resolutionUniform, resolution);
      // gl.uniform3fv(colorUniform, lastColor);

      gl.drawArrays(gl.TRIANGLES, 0, axes.length / 9);
    };
    return cleanup(
      register(draw),
      () => {
        gl.deleteBuffer(geoBuffer);
        gl.deleteProgram(program);
      },
    );
  }
}

function orbitProgram(): GraphicsProgram {
  const dataPromise = fetch("/orbit-cart.lf32").then(
    r => r.arrayBuffer().then(b => new Float32Array(b)));
  let data: Float32Array | undefined;
  let numVertices = 0;
  dataPromise.then(x => {
    data = x;
    numVertices = data.length / 4;
  });
  return (gl, register, projectionMatrix) => {
    const program = shaderProgram(gl, `
      attribute highp float aTime;
      attribute vec4 position;
      uniform mat4 modelViewMatrix;
      uniform mat4 projectionMatrix;
      varying highp float vTime;
      void main(void) {
        // Scale down by 1e-4.
        vec4 pos = vec4(position.xyz, 1e4);
        gl_Position = projectionMatrix * modelViewMatrix * pos;
        vTime = aTime;
      }
    `, `
      uniform lowp vec3 color;
      uniform highp float time;
      varying highp float vTime;
      void main(void) {
        highp float t = (vTime - (time - 36000.)) / 36000.;
        if (t > 0. && t <= 1.) {
          gl_FragColor = vec4(color, t);
        } else {
          discard;
        }
      }
    `)!;
    const dataBuffer = gl.createBuffer()!;
    dataPromise.then(x => {
      gl.bindBuffer(gl.ARRAY_BUFFER, dataBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, x, gl.STATIC_DRAW);
    });
    const timeAttribute = gl.getAttribLocation(program, "aTime");
    const positionAttribute = gl.getAttribLocation(program, "position");
    const projectionMatrixUniform = gl.getUniformLocation(program, "projectionMatrix");
    const modelViewMatrixUniform = gl.getUniformLocation(program, "modelViewMatrix");
    const colorUniform = gl.getUniformLocation(program, "color");
    const timeUniform = gl.getUniformLocation(program, "time");
    const color = vec3(0, 1, 1);
    
    const draw = (modelViewMatrix: Mat4) => {
      if (!data) return;

      // Tell WebGL to use our program when drawing
      gl.useProgram(program);
      gl.lineWidth(1);
  
      // Tell WebGL how to pull out the positions from the position
      // buffer into the vertexPosition attribute
      gl.bindBuffer(gl.ARRAY_BUFFER, dataBuffer);
      gl.vertexAttribPointer(positionAttribute, 3, gl.FLOAT, false, 16, 4);
      gl.enableVertexAttribArray(positionAttribute);
      gl.vertexAttribPointer(timeAttribute, 1, gl.FLOAT, false, 16, 0);
      gl.enableVertexAttribArray(timeAttribute);
    
      // Set the shader uniforms
      gl.uniformMatrix4fv(projectionMatrixUniform, false, projectionMatrix);
      gl.uniformMatrix4fv(modelViewMatrixUniform, false, modelViewMatrix);
      gl.uniform3fv(colorUniform, color);
      gl.uniform1f(timeUniform, performance.now() % 1e7);

      gl.drawArrays(gl.LINE_STRIP, 0, numVertices);
    };
    return cleanup(
      register(draw),
      () => {
        gl.deleteBuffer(dataBuffer);
        gl.deleteProgram(program);
      },
    );
  }
}

function runAnimation(f: FrameRequestCallback) {
  const repeat: FrameRequestCallback = t => {
    f(t);
    afr = requestAnimationFrame(repeat);
  };
  let afr = requestAnimationFrame(repeat);
  return () => cancelAnimationFrame(afr);
}

const glApp = (model: Model) => SimpleWindow("WebGL", r => {
  const container = elem("div");
  const canvas = elem("canvas");
  canvas.width = 100;
  canvas.height = 100;
  container.style.width = '100%';
  container.style.height = '100%';
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  container.appendChild(canvas);
  const gl = canvas.getContext("webgl");

  if (!gl) {
    console.error("Could get WebGL context.");
    return noop;
  }
  if (!gl.getExtension("OES_element_index_uint")) {
    console.error("Missing required extension (OES_element_index_uint).");
    return noop;
  }
  if (!gl.getExtension("WEBGL_depth_texture")) {
    console.error("Missing required extension (WEBGL_depth_texture).");
    return noop;
  }

  const fieldOfView = 45 * Math.PI / 180;
  const zNear = 0.1;
  const zFar = 100.0;
  const projectionMatrix = mat4.create();
  function resizeProjection(w: number, h: number) {
    const aspect = w / h;
    mat4.perspective(projectionMatrix, fieldOfView, aspect, zNear, zFar);
  }

  const resolution = new Float32Array([100, 100]);

  const cOrientation = mat4.create();

  const o = new ResizeObserver(entries => {
    const entry = entries[entries.length - 1];
    if (entry) {
      const { width, height } = entry.contentRect;
      const w = Math.floor(width);
      const h = Math.floor(height);
      resolution[0] = w;
      resolution[1] = h;
      canvas.width = w;
      canvas.height = h;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      resizeProjection(w, h);
      gl.viewport(0, 0, w, h);
      render();
    }
  });
  o.observe(container);

  const drawers = new Set<Drawer>();
  const register = (x: Drawer) => {
    drawers.add(x);
    return () => drawers.delete(x);
  };

  const ep = erosProgram(model);
  
  const dc = either(rsquare(), vec3(1, 0, 0), vec3(0, 1, 0));

  gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
  gl.clearDepth(1.0);                 // Clear everything
  gl.enable(gl.DEPTH_TEST);           // Enable depth testing
  gl.depthFunc(gl.LEQUAL);            // Near things obscure far things
  gl.enable(gl.BLEND);
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

  // Set the drawing position to the "identity" point, which is
  // the center of the scene.
  const modelViewMatrix = mat4.create();
  
  // Draw the scene repeatedly
  const render = () => {
    // Clear the canvas before we start drawing on it.
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    // Now move the drawing position a bit to where we want to
    // start drawing the square.
    mat4.identity(modelViewMatrix);
    mat4.translate(modelViewMatrix,     // destination matrix
                  modelViewMatrix,     // matrix to translate
                  vec3(0, 0, -Math.exp(zoom)));  // amount to translate
    mat4.multiply(modelViewMatrix,
                  modelViewMatrix,
                  cOrientation);

    drawers.forEach(f => f(modelViewMatrix));
  };

  // Temporary matrix used for updating the camera view.
  const tmp = mat4.create();

  let zoom = 1;

  return cleanup(
    runAnimation(_ => render()),
    dotsProgram(dc)(gl, register, projectionMatrix, resolution),
    ep(gl, register, projectionMatrix, resolution),
    axesProgram()(gl, register, projectionMatrix, resolution),
    orbitProgram()(gl, register, projectionMatrix, resolution),
    mount(container, r),
    domEvent("wheel", e => {
      e.preventDefault();
      e.stopPropagation();
      const { deltaX, deltaY } = e;
      if (e.altKey || e.ctrlKey) {
        zoom += deltaY / 500;
      } else {
        mat4.identity(tmp);
        mat4.rotate(tmp, tmp, -deltaX / 100, vec3(0, 1, 0));
        mat4.rotate(tmp, tmp, -deltaY / 100, vec3(1, 0, 0));
        mat4.multiply(cOrientation, tmp, cOrientation);
      }
    })(canvas),
  );
});

interface PlotOptions {
  requestRegion?: Handler<Limits>;
  title?: Stream<string>;
}

const Plot2D = (
  xlim: Stream<Limits>,
  ylim: Stream<Limits>,
  onSetXLim: Handler<Limits>,
  onSetYLim: Handler<Limits>,
  data: Stream<Data>[],
  {
    requestRegion = noop,
    title = just("Plot"),
  }: PlotOptions = {},
): Component => {
  const xLabel = just('Time [s]');
  const yLabel = just('Position');

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
      cleanups.push(domEvent('wheel', e => {
        e.preventDefault();
        e.stopPropagation();
        const { deltaX, deltaY } = e;
        if (e.altKey || e.ctrlKey) {
          if (deltaY) {
            const [xda, xdb] = xs.domain();
            const [yda, ydb] = ys.domain();
            const rect = canvas.getBoundingClientRect();
            const xc = xs.invert(e.clientX - rect.left);
            const yc = ys.invert(e.clientY - rect.top);
            const sf = Math.exp(deltaY * .01);
            onSetXLim([xc + sf * (xda - xc), xc + sf * (xdb - xc)]);
            onSetYLim([yc + sf * (yda - yc), yc + sf * (ydb - yc)]);
          }
        } else {
          if (deltaX) {
            const [xda, xdb] = xs.domain();
            const [xra, xrb] = xs.range();
            const dx = deltaX * (xdb - xda) / (xrb - xra);
            onSetXLim([xda + dx, xdb + dx]);
          }
          if (deltaY) {
            const [yda, ydb] = ys.domain();
            const [yra, yrb] = ys.range();
            const dy = deltaY * (ydb - yda) / (yrb - yra);
            onSetYLim([yda + dy, ydb + dy]);
          }
        }
      })(canvas));
      cleanups.push(cleanupDrag);

      cleanups.push(size(([w, h]) => {
        canvas.width = w * 2;
        canvas.height = h * 2;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
        ctx.scale(2, 2);
      }));

      const axisConfig = join({ size, xlim, ylim, xLabel, yLabel, title, data: zip(data) });

      interface AxisConfig {
        size: RectSize;
        xlim: Limits;
        ylim: Limits;
        title?: string;
        xLabel?: string;
        yLabel?: string;
        data: Data[];
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

        for (const {t: dx, y: dy} of data) {
          const N = dx.length;
          ctx.strokeStyle = '#2965CC';
          ctx.beginPath();
          ctx.moveTo(xs(dx[0]), ys(dy[0]));
          for (let i = 1; i <= N; i += 1) {
            ctx.lineTo(xs(dx[i]), ys(dy[i]));
          }
          ctx.stroke();
        }

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

const conn = connect();

const onRequest = (region: Limits) => {
  console.log('request', region);
};

const dada = (q: Quantity): Stream<Data> => h => {
  const result: Data = { t: [], y: [] };
  return conn.quantityData(q).stream({
    init(x) {
      result.t = Array(x.size);
      result.y = Array(x.size);
      let i = 0;
      for (const v of x) {
        result.t[i] = v.time;
        result.y[i++] = v.value;
      }
      h(result);
    },
    add(x) {
      const i = binsert(result.t, x.time, (a, b) => a - b);
      result.y.splice(i, 0, x.value);
      h(result);
    },
  });
};

const naiveDada2 = (a: Quantity, b: Quantity): Stream<Data> => h => {
  const result: Data = { t: [], y: [] };
  const aT: Time[] = [];
  const bT: Time[] = [];
  return cleanup(
    conn.quantityData(a).stream({
      init(x) {
        aT.length = x.size;
        result.t.length = x.size;
        let i = 0;
        for (const v of x) {
          aT[i] = v.time;
          result.t[i++] = v.value;
        }
        h(result);
      },
      add(x) {
        const i = binsert(aT, x.time, (a, b) => a - b);
        result.t.splice(i, 0, x.value);
        h(result);
      },
    }),
    conn.quantityData(b).stream({
      init(x) {
        bT.length = x.size;
        result.y.length = x.size;
        let i = 0;
        for (const v of x) {
          bT[i] = v.time;
          result.y[i++] = v.value;
        }
        h(result);
      },
      add(x) {
        const i = binsert(bT, x.time, (a, b) => a - b);
        result.y.splice(i, 0, x.value);
        h(result);
      },
    }),
  );
};


const [xlim, setXlim] = state([0, 1] as Limits);
const [ylim, setYlim] = state([0, 1] as Limits);
const plot = SimpleWindow("Yooo", Plot2D(xlim, ylim, setXlim, setYlim, [dada(15), dada(16), dada(17)], {
  requestRegion: onRequest,
  title: conn.quantityName(15).stream,
}));

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

const eApp = Emitter(conn.writer);
const qApp = Quantities(conn.quantities, conn.quantityName, conn.writer);

const safariMenu = menu([
  menuItem({ label: 'About Safari', action: () => addWindow(Finder) }),
  menuItem({ label: 'Safari Extensions...', action: () => addWindow(plot) }),
  menuSeparator,
  menuItem({ label: 'Preferences...', action: () => addWindow(eApp) }),
  menuItem({ label: 'Privacy Report...', action: () => addWindow(PreferredNetworks) }),
  menuItem({ label: 'Settings for This Website...' }),
  menuSeparator,
  menuItem({ label: 'Clear History...', action: () => addWindow(qApp) }),
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
addWindow(eApp);
addWindow(qApp);

fetchModel().then(m => addWindow(glApp(m)));

(window as any).plot = function(ns: number[]) {
  const [xlim, setXlim] = state([0, 10] as Limits);
  const [ylim, setYlim] = state([-2, 2] as Limits);
  const plot = Plot2D(xlim, ylim, noop, setYlim, ns.map(dada), {
    title: conn.quantityName(ns[0] || 0).stream,
  });
  const win = SimpleWindow("Custom", plot);
  addWindow(win);
};

const rateLimit = <T>(s: Stream<T>): Stream<T> => h => {
  let mute = false;
  let waiting = false;
  let last: T;
  return s(x => {
    if (mute) {
      waiting = true;
      last = x;
    } else {
      h(x);
      mute = true;
      setTimeout(() => {
        mute = false;
        if (waiting) {
          h(last);
        }
        waiting = false;
      }, 30);
    }
  });
};

(window as any).plot2 = function(x: number, y: number) {
  const [xlim, setXlim] = state([0, 1] as Limits);
  const [ylim, setYlim] = state([0, 1] as Limits);
  const plot = Plot2D(xlim, ylim, setXlim, setYlim, [rateLimit(naiveDada2(x, y))], {
    title: map(zip([conn.quantityName(x).stream, conn.quantityName(y).stream]), ([x, y]) => `${y} vs. ${x}`),
  });
  const win = SimpleWindow("Custom", plot);
  addWindow(win);
};
