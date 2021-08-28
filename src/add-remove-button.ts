import { clickControl } from './click-control';
import { Component } from './component';
import { children, divr, style } from './div';
import { Thunk } from './function-stuff';
import { addIcon, removeIcon } from './icons';
import { rowF } from './layout';
import { either, Handler, just, state, Stream } from './stream-stuff';

function halfButton(content: Component, click: Handler<MouseEvent>, enable: Stream<boolean>) {
  const [highlighted, highlight] = state(false);
  return divr(
    style({
      outline: '1px solid rgba(255, 255, 255, .25)',
      width: '21px',
      height: '19px',
      boxSizing: 'border-box',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      background: either(highlighted, 'rgba(255, 255, 255, .25', 'rgba(255, 255, 255, .15)'),
      margin: '1px 1px 1px 0',
      pointerEvents: either(enable, 'all', 'none'),
      opacity: either(enable, '1', '.5'),
    }),
    children(content),
    clickControl(click, highlight),
  );
}

export function plusMinusButton(add: Thunk, remove: Thunk, enableRemove: Stream<boolean>): Component {
  return divr(
    style({
      width: '45px',
      height: '21px',
      padding: '0 0 0 1px',
    }),
    children(
      halfButton(addIcon(), add, just(true)),
      halfButton(removeIcon(), remove, enableRemove),
    ),
    rowF,
  );
}
