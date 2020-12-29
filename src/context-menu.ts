import { wait } from "./async-stuff";
import { append, domEvent, Effect, render } from "./component";
import { elem } from "./elem";
import { Thunk } from "./function-stuff";
import { Menu } from "./menu";
import { cleanup, Cleanup } from "./temporary-stuff";


function showContextMenu(e: MouseEvent, menu: Menu) {
  return openMenu(menu, e.clientX, e.clientY);
}

export function openMenu(menu: Menu, x: number, y: number) {
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
    domEvent('mousedown', e => {
      if (!c.contains(e.target as Node)) close();
    }, true)(document.body)
  );
}

export function openMenuIn(menu: Menu, r: HTMLElement, onDismiss: Thunk) {
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
    domEvent('mousedown', e => {
      if (!c.contains(e.target as Node)) onDismiss();
    }, true)(document.body),
  );

  return close;
}

export function contextMenu(menu: Menu): Effect {
  return domEvent('contextmenu', e => {
    e.preventDefault();
    e.stopPropagation();
    showContextMenu(e, menu);
  });
}
