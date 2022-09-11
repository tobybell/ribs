import { Emitter } from './apps/Emitter';
import { Finder } from './apps/Finder';
import { PreferredNetworks } from './apps/PreferredNetworks';
import { Quantities } from './apps/Quantities';
import { binsert } from './bsearch';
import { Component, delayedComponent, domEvent, Effect, render } from './component';
import { connect } from './connection';
import { Data, DataStore, Quantity, Time } from './data-stuff';
import { desktop } from './desktop';
import { children, divr, style } from './div';
import { elem } from './elem';
import { noop } from './function-stuff';
import { Mat4, mat4, quat, Vec2, Vec3, vec3 } from './mat4';
import { menu, menuItem, menuSeparator } from './menu';
import { posaphore } from './posaphore';
import { deferred, join, just, map, state, stream, Stream, zip } from './stream-stuff';
import { Cleanup, cleanup, cleanupFrom, Temporary } from './temporary-stuff';
import { windowEnvironment } from './window-stuff';

import { ScaleLinear, scaleLinear, ticks } from 'd3';
import { SimulationTimelineWindow } from './timeline';
import { SimpleWindow } from './simple-window';
import { fetchLf32 } from './fetching';
import { SimulationsList } from './SimulationsList';

type Handler<T> = (x: T) => void;

type ElementThing = HTMLElement | SVGSVGElement | Component | string | undefined;
type StreamableCSS = {[K in keyof CSSStyleDeclaration]: string | Stream<string>};

type Limits = readonly [number, number];
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
    console.error('Create shader program failed.');
    return;
  }
  gl.attachShader(p, vertexShader);
  gl.attachShader(p, fragmentShader);
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    console.error('Link shader program failed: ' + gl.getProgramInfoLog(p));
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
    console.error('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(s));
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
  const vertices = fetch('/vertices.lf32').then(
    r => r.arrayBuffer().then(b => new Float32Array(b)));
  const faces = fetch('/faces.lu32').then(
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
      uniform vec4 uOrientation;
      uniform mat4 uModelViewMatrix;
      uniform mat4 uProjectionMatrix;
      varying lowp vec4 vColor;
      void main(void) {
        // Scale down by 1e-4.
        vec4 pos = vec4(aVertexPosition.xyz, 1e4);

        // Orient.
        vec4 q = vec4(uOrientation.yzw, uOrientation.x);
        // vec4 q = uOrientation;

        vec4 i = vec4(
          +pos.x * q.w - pos.y * q.z + pos.z * q.y,
          +pos.x * q.z + pos.y * q.w - pos.z * q.x,
          -pos.x * q.y + pos.y * q.x + pos.z * q.w,
          +pos.x * q.x + pos.y * q.y + pos.z * q.z);
        pos = vec4(
          q.w * i.x + q.x * i.w + q.y * i.z - q.z * i.y,
          q.w * i.y - q.x * i.z + q.y * i.w + q.z * i.x,
          q.w * i.z + q.x * i.y - q.y * i.x + q.z * i.w, pos.w);

        vec4 ni = vec4(
          +aVertexNormal.x * q.w - aVertexNormal.y * q.z + aVertexNormal.z * q.y,
          +aVertexNormal.x * q.z + aVertexNormal.y * q.w - aVertexNormal.z * q.x,
          -aVertexNormal.x * q.y + aVertexNormal.y * q.x + aVertexNormal.z * q.w,
          +aVertexNormal.x * q.x + aVertexNormal.y * q.y + aVertexNormal.z * q.z);
        vec4 normal = vec4(
            q.w * ni.x + q.x * ni.w + q.y * ni.z - q.z * ni.y,
            q.w * ni.y - q.x * ni.z + q.y * ni.w + q.z * ni.x,
            q.w * ni.z + q.x * ni.y - q.y * ni.x + q.z * ni.w, 0);

        gl_Position = uProjectionMatrix * uModelViewMatrix * pos;
        float alp = dot((uModelViewMatrix * normal).xyz, vec3(0, 1, 0));
        vColor = vec4(alp, alp, alp, 1);
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
    const positionAttribute = gl.getAttribLocation(program, 'aVertexPosition');
    const normalAttribute = gl.getAttribLocation(program, 'aVertexNormal');
    const orientationUniform = gl.getUniformLocation(program, 'uOrientation')!;
    const projectionMatrixUniform = gl.getUniformLocation(program, 'uProjectionMatrix')!;
    const modelViewMatrixUniform = gl.getUniformLocation(program, 'uModelViewMatrix')!;

    const position = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, position);
    gl.bufferData(gl.ARRAY_BUFFER, m.vertices, gl.STATIC_DRAW);
  
    const normal = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, normal);
    gl.bufferData(gl.ARRAY_BUFFER, m.normals, gl.STATIC_DRAW);
  
    const index = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, index);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, m.faces, gl.STATIC_DRAW);

    const orientation = quat(1, 0, 0, 0);

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

      quat.exp(orientation, vec3(0, 0, performance.now() / 50000));

      // Set the shader uniforms
      gl.uniform4fv(orientationUniform, orientation);
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
    const positionAttribute = gl.getAttribLocation(program, 'center');
    const projectionMatrixUniform = gl.getUniformLocation(program, 'projectionMatrix');
    const modelViewMatrixUniform = gl.getUniformLocation(program, 'modelViewMatrix');
    const colorUniform = gl.getUniformLocation(program, 'color');
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
        gl_FragColor = vec4(vColor, 0.3);
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
    const positionAttribute = gl.getAttribLocation(program, 'position');
    const dirAttribute = gl.getAttribLocation(program, 'dir');
    const colorAttribute = gl.getAttribLocation(program, 'color');
    const projectionMatrixUniform = gl.getUniformLocation(program, 'projectionMatrix');
    const modelViewMatrixUniform = gl.getUniformLocation(program, 'modelViewMatrix');
    const resolutionUniform = gl.getUniformLocation(program, 'resolution');
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

function orbitProgram(url: string, color: Vec3): GraphicsProgram {
  const dataPromise = fetchLf32(url);
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
        // highp float t = (vTime - (time - 36000.)) / 36000.;
        // if (t > 0. && t <= 1.) {
        //   gl_FragColor = vec4(color, t);
        // } else {
        //   discard;
        // }
        gl_FragColor = vec4(color, 1.);
      }
    `)!;
    const dataBuffer = gl.createBuffer()!;
    dataPromise.then(x => {
      gl.bindBuffer(gl.ARRAY_BUFFER, dataBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, x, gl.STATIC_DRAW);
    });
    const timeAttribute = gl.getAttribLocation(program, 'aTime');
    const positionAttribute = gl.getAttribLocation(program, 'position');
    const projectionMatrixUniform = gl.getUniformLocation(program, 'projectionMatrix');
    const modelViewMatrixUniform = gl.getUniformLocation(program, 'modelViewMatrix');
    const colorUniform = gl.getUniformLocation(program, 'color');
    const timeUniform = gl.getUniformLocation(program, 'time');
    const tofs = 0; // Math.random() * 1e7;
    
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
      gl.uniform1f(timeUniform, (performance.now() * 10 + tofs) % data[data.length - 4]);

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

const glApp = (model: Model) => SimpleWindow('WebGL', r => {
  const container = elem('div');
  const canvas = elem('canvas');
  canvas.width = 100;
  canvas.height = 100;
  container.style.width = '100%';
  container.style.height = '100%';
  canvas.style.position = 'absolute';
  canvas.style.top = '0';
  canvas.style.left = '0';
  container.appendChild(canvas);
  const gl = canvas.getContext('webgl');

  if (!gl) {
    console.error('Could get WebGL context.');
    return noop;
  }
  if (!gl.getExtension('OES_element_index_uint')) {
    console.error('Missing required extension (OES_element_index_uint).');
    return noop;
  }
  if (!gl.getExtension('WEBGL_depth_texture')) {
    console.error('Missing required extension (WEBGL_depth_texture).');
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
    // dotsProgram(dc)(gl, register, projectionMatrix, resolution),
    ep(gl, register, projectionMatrix, resolution),
    axesProgram()(gl, register, projectionMatrix, resolution),
    // orbitProgram('/orbit-cart-1-gaf.lf32', vec3(0, 1, 1))(gl, register, projectionMatrix, resolution),
    orbitProgram('http://localhost/posonly/orbit-cart.lf32', vec3(1, 1, 0))(gl, register, projectionMatrix, resolution),
    orbitProgram('http://localhost/posonly-controlled/orbit-cart.lf32', vec3(1, 0, 1))(gl, register, projectionMatrix, resolution),
    // orbitProgram('/orbit-cart-1.lf32', vec3(1, 0, 1))(gl, register, projectionMatrix, resolution),
    // orbitProgram('/orbit-cart.lf32', vec3(1, 0, 1))(gl, register, projectionMatrix, resolution),
    // orbitProgram('/orbit-kep.lf32', vec3(1, 1, 0))(gl, register, projectionMatrix, resolution),
    // orbitProgram('/orbit-qns.lf32', vec3(1, 0, 1))(gl, register, projectionMatrix, resolution),
    r(container),
    domEvent('wheel', e => {
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

interface PlotContext {
  ctx: CanvasRenderingContext2D;
  top: number;
  bottom: number;
  left: number;
  right: number;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  xs: ScaleLinear<number, number>;
  ys: ScaleLinear<number, number>;
}

type PlotDrawer = Handler<PlotContext>;
type PlotComponent = Stream<PlotDrawer>;

interface PlotOptions {
  requestRegion?: Handler<Limits>;
  title?: string | Stream<string | undefined>;
  xLabel?: string | Stream<string>;
  yLabel?: string | Stream<string>;
  showXAxis?: boolean;
  xAxisScale?: number;
  yAxisScale?: number;
  legend?: string[];
  drawers?: PlotComponent[];
  // TODO:
  // onXScaleChange
  // onYScaleChange
  // onXOffsetChange
  // onYOffsetChange
}

type Series = Data & { color?: string | string[], width?: number, points?: boolean };

const Plot2D = (
  xlim: Stream<Limits>,
  ylim: Stream<Limits>,
  onSetXLim: Handler<Limits>,
  onSetYLim: Handler<Limits>,
  {
    legend = [],
    requestRegion = noop,
    title = just(undefined),
    xLabel = just('Time [s]'),
    yLabel = just('Position'),
    showXAxis = false,
    xAxisScale = 1,
    yAxisScale = 1,
    drawers = [],
  }: PlotOptions = {},
): Component => {
  const _title = typeof title === 'string' ? just(title) : title;
  const _xLabel = typeof xLabel === 'string' ? just(xLabel) : xLabel;
  const _yLabel = typeof yLabel === 'string' ? just(yLabel) : yLabel;

  const backgroundColor = '#000';
  const foregroundColor = '#fff';

  const tickLength = 5;
  const axisPad = 4;

  const tickFont = "10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif";
  const labelFont = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif";
  const titleFont = "bold 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif";

  const xs = scaleLinear();
  const ys = scaleLinear();

  /* Requested region covers 3x the xlim range. */
  const reqReg = map(xlim, ([a, b]) => [2 * a - b, 2 * b - a] as const);

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

      const cachedDrawerStreams: Cleanup[] = [];
      const cachedDrawers: PlotDrawer[] = [];
      const [drawersChanged, changeDrawers] = stream();
      drawers.forEach((x, i) => {
        cachedDrawers.push(noop);
        cachedDrawerStreams.push(x(drawer => {
          cachedDrawers[i] = drawer;
          changeDrawers();
        }));
      });
      cleanups.push(cleanupFrom(cachedDrawerStreams));

      const axisConfig = join({ size, xlim, ylim, xLabel: _xLabel, yLabel: _yLabel, title: _title, drawersChanged });

      interface AxisConfig {
        size: RectSize;
        xlim: Limits;
        ylim: Limits;
        title?: string;
        xLabel?: string;
        yLabel?: string;
        drawersChanged: void;
      }

      const legendMargin = 10;
      const legendTopMargin = legendMargin;
      const legendRightMargin = legendMargin;
      const legendPad = 6;
      const legendLineSpacing = 4;
      const legendLineHeight = 12;
      ctx.font = labelFont;
      const legendWidth = 2 * legendPad + (legend.length ? Math.max(...legend.map(x => ctx.measureText(x).width)) : 0);
      const legendHeight = 2 * legendPad + legendLineHeight + (legend.length - 1) * (legendLineHeight + legendLineSpacing);

      // Define a persistent context object that we can repeatedly pass to new
      // drawers. This is a mutable thing we will update as parameters change.
      const ourCtx: PlotContext = {
        ctx, top: 0, bottom: 1, left: 0, right: 0, xMin: 0, xMax: 1, yMin: 0,
        yMax: 1, xs, ys,
      };

      const drawAxes = ({ xLabel, yLabel, title, size: [width, height], xlim: [xMin, xMax], ylim: [yMin, yMax] }: AxisConfig) => {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, width, height);

        const top = title ? 25 : 10;
        const bottom = height - (xLabel ? 38 : 18);
        const yts = ticks(yMin * yAxisScale, yMax * yAxisScale, Math.abs(top - bottom) / 60);
        ctx.font = tickFont;
        const maxWidth = Math.ceil(Math.max(0, ...yts.map(t => ctx.measureText(`${t}`).width)));
        const left = maxWidth + (yLabel ? 25 : 9);
        const right = width - 10;
        const xMid = (left + right) / 2;
        const yMid = (top + bottom) / 2;
        const xts = ticks(xMin * xAxisScale, xMax * xAxisScale, Math.abs(right - left) / 60);
        xs.domain([xMin, xMax]).range([left, right]);
        ys.domain([yMin, yMax]).range([bottom, top]);
        ctx.fillStyle = foregroundColor;
        ctx.lineWidth = 1;

        Object.assign(ourCtx, {top, bottom, left, right, xMin, xMax, yMin, yMax});

        // Draw x ticks.
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.beginPath();
        for (const t of xts) {
          const x = xs(t / xAxisScale);
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
          const y = ys(t / yAxisScale);
          ctx.moveTo(left, y);
          ctx.lineTo(left + tickLength, y);
          ctx.fillText(`${t}`, left - axisPad, y);
        }
        ctx.stroke();

        if (showXAxis) {
          ctx.save();
          ctx.strokeStyle = '#888888';
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(left, ys(0));
          ctx.lineTo(right, ys(0));
          ctx.stroke();
          ctx.restore();
        }

        // Draw drawers.
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(left, top);
        ctx.lineTo(right, top);
        ctx.lineTo(right, bottom);
        ctx.lineTo(left, bottom);
        ctx.closePath();
        ctx.clip();
        cachedDrawers.forEach(f => f(ourCtx));
        ctx.restore();

        // Draw legend.
        ctx.fillStyle = backgroundColor;
        ctx.strokeStyle = foregroundColor;
        ctx.lineWidth = 1;
        if (legend.length) {
          const legendLeft = right - legendWidth - legendRightMargin;
          const legendTop = top + legendTopMargin;
          ctx.beginPath();
          ctx.rect(legendLeft, legendTop, legendWidth, legendHeight);
          ctx.fill();
          ctx.stroke();
          ctx.fillStyle = foregroundColor;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'bottom';
          ctx.font = labelFont;
          for (let i = 0; i < legend.length; i += 1) {
            ctx.fillText(legend[i], legendLeft + legendPad, legendTop + legendPad + i * (legendLineHeight + legendLineSpacing) + legendLineHeight);
          }
        }
        ctx.fillStyle = foregroundColor;

        // Draw borders.
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
      changeDrawers();
    }

    cleanups.push(r(container));

    return cleanup(...cleanups);
  };
};

const FillLayer = (
  css: Partial<StreamableCSS>,
  kids?: ElementThing[],
  effects?: Effect[]
) => divr(style({
  position: 'absolute',
  width: '100%',
  height: '100%',
  top: '0',
  left: '0',
  ...css,
}), kids && children(...kids), ...effects || []);

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

const Pane = (color: string, kids?: ElementThing[]) => divr(style({
  width: '100%',
  height: '100%',
  backgroundColor: '#ffffff',
}), children(...kids || []));

const WhitePane = Pane('white');

const Matte = (content: ElementThing) => divr(style({
  width: '100%',
  height: '100%',
  backgroundColor: '#ffffff',
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
}), children(content));

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

const dada = (q: Quantity): Stream<PlotDrawer> => h => {
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
      h(series(result));
    },
    add(x) {
      const i = binsert(result.t, x.time, (a, b) => a - b);
      result.y.splice(i, 0, x.value);
      h(series(result));
    },
  });
};

const naiveDada2 = (a: Quantity, b: Quantity): PlotComponent => h => {
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
        h(series(result));
      },
      add(x) {
        const i = binsert(aT, x.time, (a, b) => a - b);
        result.t.splice(i, 0, x.value);
        h(series(result));
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
        h(series(result));
      },
      add(x) {
        const i = binsert(bT, x.time, (a, b) => a - b);
        result.y.splice(i, 0, x.value);
        h(series(result));
      },
    }),
  );
};


const plot = (() => {
const [xlim, setXlim] = state([0, 1] as Limits);
const [ylim, setYlim] = state([0, 1] as Limits);
const plot = SimpleWindow('Yooo', Plot2D(xlim, ylim, setXlim, setYlim, {
  requestRegion: onRequest,
  title: conn.quantityName(15).stream,
  drawers: [
    dada(15), dada(16), dada(17)
  ]
}));
return plot;
})();

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

const openSimulationsList = () => addWindow(
  SimulationsList({
    onOpenTimeline: s => addWindow(SimulationTimelineWindow(s)),
  }),
  { x: 300, y: 300, width: 400, height: 600 },
);

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
  menuItem({ label: 'Simulations...', action: openSimulationsList }),
  menuSeparator,
  menuItem({ label: 'Hide Safari' }),
  menuItem({ label: 'Hide Others' }),
  menuItem({ label: 'Show All' }),
  menuSeparator,
  menuItem({ label: 'Quit Safari' }),
], undefined, true);

const dt = desktop(windows, safariMenu);

render(dt, document.body);

// addWindow(eApp);
// addWindow(qApp);

// This is the timeline-like window that uses too many WebGL canvases.
// addWindow(SimulationTimelineWindow('uextrap'), { x: 300, y: 300, width: 1000, height: 700 });

fetchModel().then(m => addWindow(glApp(m)));

const limits = (a: number[]): Limits => {
  const n = a.length;
  if (n === 0)
    return [0, 1];
  let min = a[0];
  let max = a[0];
  for (let i = 1; i < n; ++i) {
    const x = a[i];
    if (x < min)
      min = x;
    if (x > max)
      max = x;
  }
  const delta = max - min;
  if (delta === 0) {
    max += 0.5;
    min -= 0.5;
  } else {
    max += delta / 6;
    min -= delta / 6;
  }
  return [min, max];
}

const gaussianLine = (mean: number, stddev: number, color: string, dashed = false): PlotDrawer => {
  const dashedCfg = dashed ? [8, 8] : [];
  return ({ctx, top, bottom, left, right, xMin, xMax, yMin, yMax}) => {
    const yScale = (top - bottom) / (yMax - yMin);
    const yOffset = top - yScale * yMax;

    const isd = 1 / stddev;
    const scaleFactor = isd / Math.sqrt(2 * Math.PI);

    const xSpan = xMax - xMin;
    const hSpan = right - left;
    ctx.lineWidth = 2;
    ctx.strokeStyle = color;
    ctx.setLineDash(dashedCfg);
    ctx.beginPath();
    {
      const x = xMin;
      const ofs = (x - mean)  * isd;
      const y = scaleFactor * Math.exp(-.5 * ofs * ofs);
      const yp = yOffset + y * yScale;
      ctx.moveTo(left, yp);
    }
    for (let i = .00390625; i <= 1; i += .00390625) {
      const x = xMin + i * xSpan;
      const ofs = (x - mean) * isd;
      const y = scaleFactor * Math.exp(-.5 * ofs * ofs);
      const xp = left + i * hSpan;
      const yp = yOffset + y * yScale;
      ctx.lineTo(xp, yp);
    }
    ctx.stroke();
  };
};

const seriesFromUrl = (url: string) => fetchLf32(url).then(x => {
  const y = [...x.map(_ => 0)];
  const t = [...x];
  return { t, y, width: 1.5, points: true };
});

const series = (x: Series, yOffset = 0): PlotDrawer => ({ctx, xs, ys}) => {
  const {t: dx, y: dy, color = '#2965CC', width = 1, points = false} = x;
  const N = dx.length;
  const singleColor = !Array.isArray(color) && color;
  const colors = Array.isArray(color) && color;
  if (points) {
    singleColor && (ctx.fillStyle = singleColor);
    for (let i = 1; i <= N; i += 1) {
      colors && (ctx.fillStyle = colors[i]);
      ctx.beginPath();
      ctx.ellipse(xs(dx[i]), ys(dy[i]) + yOffset, width, width, 0, 0, 2 * Math.PI);
      ctx.fill();
    }
  } else {
    singleColor && (ctx.strokeStyle = singleColor);
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(xs(dx[0]), ys(dy[0]) + yOffset);
    for (let i = 1; i <= N; i += 1) {
      colors && (ctx.strokeStyle = colors[i]);
      ctx.lineTo(xs(dx[i]), ys(dy[i]) + yOffset);
    }
    ctx.stroke();
  }
};

const PointDistPlot = (url: string, index: number, mean: number, standardDeviation: number) => delayedComponent(fetchLf32(url).then(x => {
  const scaleFactor = 1 / (standardDeviation * Math.sqrt(2 * Math.PI));
  const data = seriesFromUrl(url);
  const xlim = data.then(x => limits(x.t));
  return Plot2D(deferred(xlim), just([-.5 * scaleFactor, 1.5 * scaleFactor] as const), noop, noop, {
    title: `Unscented transform (sim #${index})`,
    xLabel: 'Information gain',
    yLabel: 'Probability density',
    showXAxis: true,
    drawers: [
      just(gaussianLine(mean, standardDeviation, '#0099cc')),
      deferred(data.then(series)),
    ],
  });
}));

const pointDistPlotU =
  (url: string, index: number, mean: number, standardDeviation: number) =>
    addWindow(
      SimpleWindow('Plot', PointDistPlot(url, index, mean, standardDeviation)),
      {x: 500, y: 500});

const pointDistPlot = (index: number, mean: number, standardDeviation: number) =>
  pointDistPlotU(`http://localhost/uextrap/igain-${index}.lf32`, index, mean, standardDeviation);

pointDistPlot(1,   30583, 62082.6 );
pointDistPlot(2, 8475.04, 15716.2 );
pointDistPlot(3, 5702.17, 10019.5 );
pointDistPlot(4, 999.191, 1914.16 );
pointDistPlot(5, 280.813, 566.641 );
pointDistPlot(6, 163.164, 315.901 );
pointDistPlot(7, 103.939, 198.106 );
pointDistPlot(8, 84.6724, 152.158 );

const deferredDrawer = (x: Stream<PlotDrawer>): PlotDrawer => {
  let latest: PlotDrawer | undefined;
  return ctx => latest && latest(ctx);
}

const arange = (n: number) => Array(n).fill(0).map((_, i) => i);

const estimateColors = [
  '#88bb00',
  '#0088ff',
  '#ff0088',
];

/**
 * Plot for single Monte Carlo MCIG case.
 *
 * @param idx Which MCIG sim to show.
 */
const MonteCarloPlot = (idx: number, nUkfs: number): Component => {

  const mleDist = fetchLf32(`http://localhost/mcig-${idx}/dist.lf32`);
  const mleDrawer = mleDist.then(
    ([mean, std]) => gaussianLine(mean, std, '#00f', true));
  const scaleFactor = mleDist.then(
    ([_, stdDev]) => 1 / (stdDev * Math.sqrt(2 * Math.PI)));
  const yLim = scaleFactor.then(sf => [-.1, .35] as const);

  const data = fetchLf32(`http://localhost/mcig-${idx}/igain.lf32`).then(x => {
    const y = [...x.map(_ => 0)];
    const t = [...x];
    return { t, y, width: 1.5, points: true };
  });
  const xlim = data.then(x => limits(x.t));

  const nBuckets = 50;
  const histogram = data.then((x): PlotDrawer => {
    const n = x.t.length;
    const min = x.t[0];
    const max = x.t[n - 1];
    const counts = Array(nBuckets).fill(0);
    let i = 0;
    for (let k = 0; k < nBuckets; k += 1) {
      let nextBoundary = min + (k + 1) / nBuckets * (max - min);
      while (x.t[i] < nextBoundary)
        i += 1;
      counts[k] = i;
    }
    // Increment the last bucket to account for the last point, which will
    // never be counted otherwise.
    counts[nBuckets - 1] += 1;
    for (let k = nBuckets - 1; k > 0; k -= 1)
      counts[k] -= counts[k - 1];
    const bucketWidth = 1 / nBuckets * (max - min);
    return ({ctx, top, bottom, left, right, xMin, xMax, yMin, yMax}) => {
      console.log(bottom - top, n, bucketWidth, yMax, yMin);
      const rectHeightScale = (bottom - top) / (n * bucketWidth * (yMax - yMin));
      ctx.fillStyle = 'rgba(200, 100, 0, 0.5)';
      let rectWidth = bucketWidth / (xMax - xMin) * (right - left);
      for (let k = 0; k < nBuckets; k += 1) {
        const bX = left + ((min + k / nBuckets * (max - min)) - xMin) / (xMax - xMin) * (right - left);
        const bY = top + (0 - yMax) / (yMin - yMax) * (bottom - top);
        const bHeight = rectHeightScale * counts[k];
        ctx.fillRect(bX, bY - bHeight, rectWidth, bHeight);
      }
    };
  });

  // Fetch all the UKF estimates.
  const ukfDrawers = arange(nUkfs).map(i => deferred(
    fetchLf32(`http://localhost/mcig-${idx}/udist-${i}.lf32`).then(
      ([w0, mean, std]) => gaussianLine(mean, std, estimateColors[i]))));

  const plot = Plot2D(deferred(xlim), deferred(yLim), noop, noop, {
    title: `Orbit ${idx}`,
    xLabel: 'Information gain (b)',
    yLabel: 'Probability density',
    showXAxis: true,
    xAxisScale: 1 / Math.LN2,
    drawers: [
      deferred(data.then(d => series(d, 8))),
      deferred(histogram),
      ...ukfDrawers,
      deferred(mleDrawer),
    ],
  });

  return plot;
};

/**
 * Summary of Monte Carlo MCIG sim.
 */
const MonteCarloSummary = (): Component => {
  return divr(
    style({
      backgroundColor: 'white',
      height: '100%',
      width: '100%',
    }),
    children(
      divr(
        style({ height: '33%' }),
        children(MonteCarloPlot(1, 3))),
      divr(
        style({ height: '33%' }),
        children(MonteCarloPlot(2, 3))),
      divr(
        style({ height: '33%' }),
        children(MonteCarloPlot(3, 3))),
    ),
  );
};

const CorrelationPlot = (): Component => {
  const correlation = fetchLf32(`http://localhost/truth-corr/corr.lf32`);
  const magnitude = fetchLf32(`http://localhost/truth-corr/magnitude.lf32`);

  const redBlueColorScale = (min: number, max: number) => {
    const spread = max - min;
    return (magnitude: number) => {
      const t = Math.min(1, Math.max(0, (magnitude - min) / spread));
      const red = t;
      const green = .5 * (1 - t);
      const blue = 1 - t;

      const hex = (x: number) => {
        const s = Math.round(x * 255).toString(16);
        return s.length < 2 ? '0' + s : s;
      };
      return `#${hex(red)}${hex(green)}${hex(blue)}`;
    };
  };

  const emphasizeMinColorScale = (min: number, max: number) => {
    const spread = max - min;
    return (magnitude: number) => {
      const t = Math.min(1, Math.max(0, (magnitude - min) / spread));
      const t2 = Math.pow(1 - t, 4);
      const red = t2;
      const green = .5 * (1 - t2);
      const blue = 1 - t2;

      const hex = (x: number) => {
        const s = Math.round(x * 255).toString(16);
        return s.length < 2 ? '0' + s : s;
      };
      return `#${hex(red)}${hex(green)}${hex(blue)}`;
    };
  };

  const data = Promise.all([correlation, magnitude]).then(([data, magnitude]) => {
    const ig: number[] = [];
    const err: number[] = [];
    const color: string[] = [];
    const colorScale = emphasizeMinColorScale(Math.min(...magnitude), Math.max(...magnitude));
    for (let i = 0; i < magnitude.length; i += 1) {
      ig.push(data[2 * i]);
      err.push(data[2 * i + 1]);
      color.push(colorScale(magnitude[i]));
    }
    return series({ t: ig, y: err, points: true, color });
  });


  const [xlim, setXlim] = state([0, 110] as const);
  const [ylim, setYlim] = state([28000, 40000] as const);
  return Plot2D(xlim, ylim, setXlim, setYlim, {
    xLabel: 'Information gain (b)',
    yLabel: 'Error × 1e-3 (m³/s²)',
    xAxisScale: 1 / Math.LN2,
    yAxisScale: 1 / 1000,
    drawers: [
      deferred(data),
    ],
  });
};

const sleep = (ms: number) => new Promise<void>(resolve => {
  setTimeout(resolve, ms);
});

const gaussianLinePlotWindow = () => {
  const height = 0.4;
  const plot = Plot2D(just([0, 20] as const), just([-.2 * height, 1.2 * height] as const), noop, noop, {
    title: 'Predicted value',
    xLabel: 'Value',
    yLabel: 'Probability density',
    showXAxis: true,
    drawers: [
      just(gaussianLine(5.5, 3, '#ffaa00')),
      just(gaussianLine(6, 1, '#0099cc')),
    ],
  });
  return SimpleWindow('Gaussian Line Plot', plot);
};

// addWindow(gaussianLinePlotWindow(), {x: 500, y: 500});

addWindow(SimpleWindow('Monte Carlo', MonteCarloSummary()), {x: 100, y: 100, width: 1000, height: 700});
addWindow(SimpleWindow('Correlation', CorrelationPlot()), {x: 100, y: 100, width: 300, height: 200});

// filterErrorPlot('extrap', 'c00', 'C₀₀ (µ)');
// filterErrorPlot('extrap', 'c20', 'C₂₀');
// filterErrorPlot('extrap', 'c21', 'C₂₁');
// filterErrorPlot('extrap', 'c22', 'C₂₂');
// filterErrorPlot('extrap', 's21', 'S₂₁');
// filterErrorPlot('extrap', 's22', 'S₂₂');
// filterErrorPlot('extrap', 'pos', 'Position', {
//   yAxisScale: 1,
//   yLabel: 'Position error [m]',
//   xMin: 0,
//   xMax: 4 * 86400,
//   showUncertainty: false,
// });
// scalarResidualPlot('posonly', 'pos', 'Position residual');

// Orbit period hard-coded based on mu and initial sma.
const finalStatisticsWindow = 75241.6809991484;

function scalarResidualPlot(sim: string, vari: string, title: string) {
  fetchLf32(`http://localhost/${sim}/res-${vari}.lf32`).then(x => {
    const [xlim, setXlim] = state([0, 5 * 86400] as Limits);
    const [ylim, setYlim] = state([-11.9324, 11.9324] as Limits);
    const n = x.length / 2;
    const t: number[] = [];
    const v: number[] = [];

    // stuff for final statistics
    const fsStart = x[2 * (n - 1)] - finalStatisticsWindow;
    let fsCount = 0;
    let fsValMean = 0;
    let fsValMom2 = 0;

    for (let i = 0; i < n; i += 1) {
      const time = x[2 * i];
      const val = x[2 * i + 1];
      t.push(time);
      v.push(val);

      if (time >= fsStart) {
        fsCount += 1;
        const mix = 1 / fsCount;
        fsValMean += mix * (val - fsValMean);
        fsValMom2 += mix * (val * val - fsValMom2);
      }
    }
    const fsValStd = fsValMom2 - fsValMean * fsValMean;

    const plot = Plot2D(xlim, ylim, setXlim, setYlim, {
      title,
      xLabel: 'Time [d]',
      yLabel: 'Residual [m]',
      showXAxis: true,
      xAxisScale: 1/86400,
      legend: [
        `µ = ${fsValMean.toPrecision(4)}, σ = ${fsValStd.toPrecision(4)}`,
      ],
      drawers: [
        just(series({ t, y: v, width: 1.5 })),
      ]
    });
    const win = SimpleWindow('Plot', plot);
    addWindow(win, {x: 500, y: 500});
  });
}

function filterErrorPlot(sim: string, vari: string, title: string, {
  yAxisScale = 2.2406667455596465e-06,
  yLabel = 'Relative error [µ]',
  xMin = 0,
  xMax = 10 * 86400,
  yMin = -21573.9324,
  yMax = 21573.9324,
  showUncertainty = true,
} = {}) {
  fetchLf32(`http://localhost/${sim}/error-${vari}.lf32`).then(x => {
    const [xlim, setXlim] = state([xMin, xMax] as Limits);
    const [ylim, setYlim] = state([yMin, yMax] as Limits);
    const n = x.length / 3;
    const t: number[] = [];
    const v: number[] = [];
    const filtError: number[] = [];
    const negFiltError: number[] = [];

    // stuff for final statistics
    const fsStart = x[3 * (n - 1)] - finalStatisticsWindow;
    let fsCount = 0;
    let fsMeanMean = 0;
    let fsMeanMom2 = 0;
    let fsVarMean = 0;
    let fsVarMom2 = 0;

    for (let i = 0; i < n; i += 1) {
      const time = x[3 * i];
      const err = x[3 * i + 1];
      const unc = x[3 * i + 2];
      t.push(time);
      v.push(err);
      filtError.push(unc);
      negFiltError.push(-unc);

      if (time >= fsStart) {
        fsCount += 1;
        const mix = 1 / fsCount;
        fsMeanMean += mix * (err - fsMeanMean);
        fsMeanMom2 += mix * (err * err - fsMeanMom2);
        fsVarMean += mix * (unc - fsVarMean);
        fsVarMom2 += mix * (unc * unc - fsVarMom2);
      }
    }
    const fsMeanStd = fsMeanMom2 - fsMeanMean * fsMeanMean;
    const fsVarStd = fsVarMom2 - fsVarMean * fsVarMean;

    const drawers: Stream<PlotDrawer>[] = [just(series({ t, y: v, width: 1.5 }))];
    if (showUncertainty) {
      drawers.push(
        just(series({ t, y: filtError, color: 'rgba(41, 101, 204, 0.5)' })),
        just(series({ t, y: negFiltError, color: 'rgba(41, 101, 204, 0.5)' })),
      );
    }

    const plot = Plot2D(xlim, ylim, setXlim, setYlim, {
      title,
      xLabel: 'Time [d]',
      yLabel,
      showXAxis: true,
      xAxisScale: 1/86400,
      yAxisScale,
      drawers,
      legend: [
        `Error: µ = ${fsMeanMean.toPrecision(4)}, σ = ${fsMeanStd.toPrecision(4)}`,
        `Est. std.: µ = ${fsVarMean.toPrecision(4)}, σ = ${fsVarStd.toPrecision(4)}`,
      ],
    });
    const win = SimpleWindow('Plot', plot);
    addWindow(win, {x: 500, y: 500});
  });
}

(window as any).plot = function(ns: number[]) {
  const [xlim, setXlim] = state([0, 10] as Limits);
  const [ylim, setYlim] = state([-2, 2] as Limits);
  const plot = Plot2D(xlim, ylim, setXlim, setYlim, {
    title: conn.quantityName(ns[0] || 0).stream,
    drawers: ns.map(dada),
  });
  const win = SimpleWindow('Custom', plot);
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
  const plot = Plot2D(xlim, ylim, setXlim, setYlim, {
    title: map(zip([conn.quantityName(x).stream, conn.quantityName(y).stream]), ([x, y]) => `${y} vs. ${x}`),
    drawers: [
      rateLimit(naiveDada2(x, y)),
    ],
  });
  const win = SimpleWindow('Custom', plot);
  addWindow(win);
};
