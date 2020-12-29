import { domEvent, Effect } from "./component";
import { noop } from "./function-stuff";
import { Handler } from "./stream-stuff";

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

export function clickControl(
  onHighlight: Handler<boolean> = noop,
  onClick: Handler<MouseEvent> = noop,
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
