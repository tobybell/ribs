import { Component, domEvent, mount, render } from "./component";
import { contextMenu, openMenuIn } from "./context-menu";
import { div } from "./div";
import { elem } from "./elem";
import { Frame } from "./frame";
import { Thunk } from "./function-stuff";
import { appleMenuIcon } from "./icons";
import { Menu, menu, menuItem, menuSeparator } from "./menu";
import { oneHot } from "./one-hot";
import { Handler, map, state, Stream, trigger } from "./stream-stuff";
import { cleanup } from "./temporary-stuff";
import { WindowHandles, WindowStream } from "./window-stuff";

function dragger(top: string, bottom: string, left: string, right: string, width: string, height: string, cursor: string, onMouseDown: Handler<MouseEvent>) {
  const div = elem('div');
  const {style} = div;
  style.position = 'absolute';
  style.top = top;
  style.bottom = bottom;
  style.left = left;
  style.right = right;
  style.width = width;
  style.height = height;
  style.cursor = cursor;
  div.addEventListener('mousedown', onMouseDown);
  return div;
}

const topDragger = (h: Handler<MouseEvent>) =>
  dragger('-3px', '', '6px', '6px', '', '6px', 'ns-resize', h);

const bottomDragger = (h: Handler<MouseEvent>) =>
  dragger('', '-3px', '6px', '6px', '', '6px', 'ns-resize', h);

const leftDragger = (h: Handler<MouseEvent>) =>
  dragger('6px', '6px', '-3px', '', '6px', '', 'ew-resize', h);

const rightDragger = (h: Handler<MouseEvent>) =>
  dragger('6px', '6px', '', '-3px', '6px', '', 'ew-resize', h);

const topLeftDragger = (h: Handler<MouseEvent>) =>
  dragger('-3px', '', '-3px', '', '9px', '9px', 'nwse-resize', h);

const topRightDragger = (h: Handler<MouseEvent>) =>
  dragger('-3px', '', '', '-3px', '9px', '9px', 'nesw-resize', h);

const bottomLeftDragger = (h: Handler<MouseEvent>) =>
  dragger('', '-3px', '-3px', '', '9px', '9px', 'nesw-resize', h);

const bottomRightDragger = (h: Handler<MouseEvent>) =>
  dragger('', '-3px', '', '-3px', '9px', '9px', 'nwse-resize', h);

function windowFrame(
  frame: Stream<Frame>,
  zIndex: Stream<number>,
  resize: WindowHandles,
  content: Component,
  focus: Stream<void>,
  onFocus?: Thunk): Component {
  return r => {
    const debts = [];
    const div = document.createElement('div');
    const style = div.style;
    style.position = 'absolute';
    debts.push(frame(f => {
      style.left = `${f.x}px`;
      style.top = `${f.y}px`;
      style.width = `${f.width}px`;
      style.height = `${f.height}px`;
    }));
    debts.push(zIndex(i => {
      style.zIndex = `${i}`;
    }));
    debts.push(render(content, div));
    div.appendChild(topDragger(resize.top));
    div.appendChild(topLeftDragger(resize.topLeft));
    div.appendChild(topRightDragger(resize.topRight));
    div.appendChild(bottomLeftDragger(resize.bottomLeft));
    div.appendChild(bottomRightDragger(resize.bottomRight));
    div.appendChild(bottomDragger(resize.bottom));
    div.appendChild(leftDragger(resize.left));
    div.appendChild(rightDragger(resize.right));
    onFocus && div.addEventListener('mousedown', onFocus, true);

    // Whenever we get focused, move ourselves to the end of our parent?
    debts.push(focus(() => {
      // This is a sort of temporary hack to deal with the fact that some click
      // handlers get disrupted when we call `appendChild`. If we got rid of all
      // `click` events and just turned them into `mousedown`/`mouseup` events,
      // this might not be necessary.
      if (div !== div.parentNode?.lastChild) {
        div.parentNode?.appendChild(div);
      }
    }));

    debts.push(mount(div, r));

    return cleanup(...debts);
  };
}

const menuBarItemStyle: Partial<CSSStyleDeclaration> = {
  height: '100%',
};

const menuBarLabelStyle: Partial<CSSStyleDeclaration> = {
  padding: '0 10px',
  height: '100%',
  display: 'flex',
  flexFlow: 'row nowrap',
  alignItems: 'center',
  color: '#ffffff',
  fontSize: '14px',
  cursor: 'default',
  zIndex: '2',
};

const menuBarLabel = (s: string, fontWeight = '400') => {
  const item = elem('div');
  item.textContent = s;
  Object.assign(item.style, menuBarLabelStyle, { fontWeight });
  return item;
}

const menuBarItem = (s: string, fontWeight = '400') => {
  const item = elem('div');
  Object.assign(item.style, menuBarItemStyle);
  item.appendChild(menuBarLabel(s, fontWeight));
  return item;
};

const MenuBar = (mainMenu: Menu): Component => r => {

  const us = [];

  const [activeItem, setActiveItem] = state<number | undefined>(undefined);
  const itemActive = oneHot(activeItem);

  // Menu bar is "active" if any individual menu item is active.
  const active = map(activeItem, x => x !== undefined);

  const ami = elem('div');
  Object.assign(ami.style, menuBarItemStyle);
  const amiLabel = elem('div');
  ami.appendChild(amiLabel);
  Object.assign(amiLabel.style, {
    width: '35px',
    height: '100%',
    zIndex: '2',
  });
  us.push( render(appleMenuIcon({ style: { transform: 'translateX(6.5px)' }}), amiLabel) );

  const items = [
    ami,
    menuBarItem('Safari', '700'),
    menuBarItem('File'),
    menuBarItem('Edit'),
    menuBarItem('View'),
    menuBarItem('History'),
    menuBarItem('Bookmarks'),
    menuBarItem('Develop'),
    menuBarItem('Window'),
    menuBarItem('Help'),
  ];

  let curr: any;
  activeItem(x => {
    if (curr) curr(x !== undefined);
    curr = x !== undefined ? openMenuIn(mainMenu, items[x], () => setActiveItem(undefined)) : undefined;
  });

  us.push(
    ...items.map((x, i) => domEvent('mousedown', e => {
      e.preventDefault();
      setActiveItem(i);
    })(x.children[0])),
    ...items.map((x, i) => itemActive(i)(h => {
      (x.children[0] as any).style.backgroundColor = h ? '#336dd9' : 'transparent';
    })),
  );

  // Whenever we become active, enable extra stuff.
  us.push(trigger(active, () => cleanup(
    ...items.map((x, i) => domEvent('mouseenter', () => setActiveItem(i))(x.children[0])),
  )));

  us.push(div({
    height: '22px',
    display: 'flex',
    flexFlow: 'row nowrap',
    paddingLeft: '10px',
    zIndex: '100',
  }, [
    div({
      position: 'absolute',
      left: '0',
      right: '0',
      top: '0',
      bottom: '0',
      zIndex: '1',
      backgroundColor: '#1b1a1e',
    }),
    ...items,
  ])(r));

  return cleanup(...us);
};

export const desktop = (env: WindowStream, mainMenu: Menu): Component => r => {
  return div({
    backgroundColor: '#000000',
    width: '100vw',
    height: '100vh',
  }, [MenuBar(mainMenu)], [
    contextMenu(menu([
      menuItem({ label: 'New Folder' }),
      menuSeparator,
      menuItem({ label: 'Get Info' }),
      menuSeparator,
      menuItem({ label: 'Import from iPhone or iPad' }),
      menuSeparator,
      menuItem({ label: 'Change Desktop Background...' }),
      menuItem({ label: 'Use Stacks' }),
      menuItem({ label: 'Sort By' }),
      menuItem({ label: 'Clean Up' }),
      menuItem({ label: 'Clean Up By' }),
      menuItem({ label: 'Show View Options' }),
    ])),
    box => env(x => {
      const frame = windowFrame(x.frame, x.zIndex, x.handles, x.content, x.focuses, x.focus);
      x.close(render(frame, box));
    }),
  ])(r);
}
