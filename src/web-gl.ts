import { append, Component, Effect, marker, mount } from './component';
import { elem } from './elem';
import { noop } from './function-stuff';
import { mat4 } from './mat4';
import { cleanup, Temporary } from './temporary-stuff';


/** Create a shader of the given type from source. */
function shader(gl: WebGLRenderingContext, type: number, source: string) {
  const s = gl.createShader(type);
  if (!s) {
    console.error('Create shader failed.');
    return;
  }
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    console.error('Compile shader failed: ' + gl.getShaderInfoLog(s));
    gl.deleteShader(s);
    return;
  }
  return s;
}

export function shaderProgram(gl: WebGLRenderingContext, vsSource: string, fsSource: string) {
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

export const fillWebGlCanvas = (...fx: Temporary<HTMLCanvasElement>[]): Effect => p => {
  const c = elem('canvas');
  c.width = 100;
  c.height = 100;
  c.style.position = 'absolute';
  c.style.top = '0';
  c.style.left = '0';
  const gl = c.getContext('webgl');
  if (!gl) {
    console.error('WebGL unavailable.');
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

  // Draw the scene repeatedly
  const render = () => {
    // Clear the canvas before we start drawing on it.
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    // TODO: Drawers or something?
  };

  return cleanup(
    append(c, p),
    ...fx.map(f => f(c)),
  );
};
