import { domEvent, Effect } from './component';
import { noop } from './function-stuff';
import { Handler, Stream } from './stream-stuff';
import { cleanup, Cleanup } from './temporary-stuff';

export function hoverEffect(h: Handler<boolean>): Effect {
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

export const mutClick = (onClick: Stream<Handler<MouseEvent> | undefined>): Effect => n => {
  let last: Cleanup | undefined;
  return cleanup(
    onClick(h => {
      last?.();
      last = h && clickControl(h)(n);
    }),
    () => last?.(),
  );
};

export function clickControl(
  onClick: Handler<MouseEvent> = noop,
  onHighlight: Handler<boolean> = noop,
  onClicking: Handler<boolean> = noop,
) {
  return domEvent('mousedown', e => {
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
