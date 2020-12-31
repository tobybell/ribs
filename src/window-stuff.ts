import { borderOverlay } from "./appearance-stuff";
import { Component, Effect } from "./component";
import { div, ElementThing } from "./div";
import { Frame } from "./frame";
import { ident, Thunk } from "./function-stuff";
import { Handler, just, map, merge, state, stream, Stream } from "./stream-stuff";

export interface WindowHandles {
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

export interface WindowControls {
  close(): void;
  minimize(): void;
  maximize(): void;
  focus(): void;
  handles: WindowHandles;
}

export function windowPane(content?: ElementThing[], effects?: Effect[]) {
  return div({
    backgroundColor: '#323334',
    borderRadius: '5px',
    overflow: 'hidden',
    transform: 'translateZ(0)',
    boxSizing: 'border-box',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7)',
    display: 'flex',
    flexFlow: 'column nowrap',
    alignItems: 'stretch',
    width: '100%',
    height: '100%',
  }, [...(content || []), borderOverlay], effects);
}

type Window = (c: WindowControls) => Component;

export const win = ident<Window>();

interface WindowRecord {
  frame: Stream<Frame>;
  zIndex: Stream<number>;
  handles: WindowHandles;
  content: Component;
  close: Stream<void>;
  focuses: Stream<void>;
  focus: Thunk;
}

export type WindowStream = Stream<WindowRecord>;
type WindowAdder = Handler<Window>;

/** Create a pull stream that counts up from 0. */
const counter = () => {
  let x = -1;
  return () => {
    x += 1;
    return x;
  };
}

type DragEndHandler = (e: MouseEvent) => void;
type DragMoveHandler = (e: MouseEvent) => DragEndHandler | void;
type DragHandler = (e: MouseEvent) => DragMoveHandler | void;

export function useDrag(h: DragHandler): Handler<MouseEvent> {
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

export const windowEnvironment = (): [WindowStream, WindowAdder] => {
  const windows: {[k: number]: [Handler<void>, WindowRecord]} = {};
  const nextId = counter();

  const [windowStream, emitWindow] = stream<WindowRecord>();

  const closeWindow = (k: number) => {
    if (!windows[k]) return;
    windows[k][0]();
    delete windows[k];
  };

  // I want a stream that produces deltas to add to x and y.

  function useRelativeDrag(): [Stream<number>, Stream<number>, Handler<MouseEvent>] {
    const [dx, emitDx] = stream<number>();
    const [dy, emitDy] = stream<number>();

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
    const [dx, emitDx] = stream<number>();

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
    const [dy, emitDy] = stream<number>();

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
  function useFrame(init: Frame): [Stream<Frame>, WindowHandles] {
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
    const [frame, setFrame] = state<Frame>(c);
    dx(d => (c.x += d, setFrame(c)));
    dy(d => (c.y += d, setFrame(c)));
    dw(d => (c.width += d, setFrame(c)));
    dh(d => (c.height += d, setFrame(c)));

    return [frame, {top, bottom, left, right, topLeft, topRight, bottomLeft, bottomRight, middle}];
  }

  const addWindow = (w: Window) => {
    const k = nextId();
    const [frame, handles] = useFrame({ x: 100, y: 100, width: 500, height: 400 });
    const [$close, close] = stream();
    const [$focus, focus] = stream();
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
