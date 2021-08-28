import { Component, domEvent, inputType, inputValue } from './component';
import { upDownButton } from './controls';
import { divr, children, rawInput, style } from './div';
import { focusHighlight } from './focus-stuff';
import { Thunk } from './function-stuff';
import { row, space } from './layout';
import { Sync } from './state';
import { state } from './stream-stuff';

export function textField(value: Sync<string>, size = 13): Component {
  const [highlight, setHighlight] = state(false);
  let pre: string;
  return divr(style({
    boxSizing: 'border-box',
    padding: '0 4px',
    height: `${size + 6}px`,
    width: '100%',
    backgroundColor: '#404040',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'start',
    color: '#ffffff',
    borderRadius: '.5px',
    boxShadow: '0 2px 2px -2px rgba(0, 0, 0, .3) inset, 0 -.5px 0 0 rgba(255, 255, 255, .08) inset, 0 0 0 .5px rgba(255, 255, 255, .2)',
  }), children(
    rawInput(
      style({
        background: 'none',
        border: 'none',
        outline: 'none',
        color: '#ffffff',
        fontSize: `${size}px`,
        padding: '0',
        margin: '0',
        width: '100%',
      }),
      inputType('text'),
      inputValue(value.stream),
      // TODO: Move this somewhere else so other text inputs can use it?
      n => domEvent('keypress', e => {
        if (e.key === 'Enter') {
          e.stopPropagation();
          e.preventDefault();
          n.blur();
        }
      })(n),
      n => domEvent('focus', () => {
        pre = n.value;
        setHighlight(true);
      })(n),
      n => domEvent('blur', () => {
        n.value !== pre && value.set(n.value);
        setHighlight(false);
      })(n),
    ),
  ),
  focusHighlight(highlight),
  );
}

export function upDownField(value: Sync<string>, onUp: Thunk, onDown: Thunk) {
  return row([
    divr(style({ flex: '1 0 50px' }), children(textField(value, 12))),
    space(5),
    divr(style({ flex: '0 0 11px' }), children(upDownButton(onUp, onDown))),
  ]);
}
