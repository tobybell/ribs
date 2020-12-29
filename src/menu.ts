import { hoverEffect } from "./click-control";
import { Component, domEvent } from "./component";
import { div, span } from "./div";
import { noop, Thunk } from "./function-stuff";
import { menuCheckIcon } from "./icons";
import { either, Handler, just, state, Stream } from "./stream-stuff";

export type Menu = (handler: Handler<Thunk>) => Component;

type MenuComponent = (size: number, handler: Handler<Thunk>) => Component;

const borderOverlay = div({
  position: 'absolute',
  top: '0',
  left: '0',
  width: '100%',
  height: '100%',
  borderRadius: '5px',
  boxShadow: '0 .5px 0 rgba(255, 255, 255, .2) inset',
  pointerEvents: 'none',
}, [
  div({
    width: '100%',
    height: '100%',
    border: '1px solid rgba(255, 255, 255, .15)',
    borderRadius: '5px',
    boxSizing: 'border-box',
  }),
]);

const dropdownBorderOverlay = div({
  position: 'absolute',
  top: '0',
  left: '0',
  width: '100%',
  height: '100%',
  borderRadius: '0 0 5px 5px',
  pointerEvents: 'none',
}, [
  div({
    width: '100%',
    height: '100%',
    border: '1px solid rgba(255, 255, 255, .15)',
    borderRadius: '0 0 5px 5px',
    borderTopWidth: '0',
    boxSizing: 'border-box',
  }),
]);

const menuCheck = (size: number, visible: Stream<boolean>) => menuCheckIcon({
  size,
  style: {
    position: 'absolute',
    top: '50%',
    left: '11px',
    transform: 'translate(-50%, -50%)',
    pointerEvents: 'none',
  },
  effects: [
    r => visible(x => r.style.opacity = x ? '1' : '0'),
  ],
});

export const menu = (contents: MenuComponent[], size = 14, dropdown = false): Menu => h => div({
  padding: '4px 0',
  backgroundColor: '#323334',
  borderRadius: dropdown ? '0 0 5px 5px' : '5px',
  boxShadow: '0 0 0 .5px rgba(0, 0, 0, .8), 0 10px 20px rgba(0, 0, 0, .3)',
  whiteSpace: 'nowrap',
  transform: 'translateY(-.5px)'
}, [
  ...contents.map(x => x(size, h)),
  dropdown ? dropdownBorderOverlay : borderOverlay,
]);

export const menuItem = ({ label, action = noop, checked = just(false) }: {
  label: string;
  action?: Thunk;
  checked?: Stream<boolean>;
}) => (fontSize: number, handler: Handler<Thunk>): Component => {
  const [highlight, setHighlight] = state(false);
  return div({
    height: `${fontSize + 5}px`,
    fontSize: `${fontSize}px`,
    backgroundColor: either(highlight, '#336dd9', 'transparent'),
    color: '#ffffff',
    display: 'flex',
    alignItems: 'center',
    padding: '0 21px',
    cursor: 'default',
  }, [
    menuCheck(fontSize, checked),
    span({}, [label]),
  ], [
    hoverEffect(setHighlight),
    domEvent('click', e => {
      setHighlight(false);
      setTimeout(() => {
        setHighlight(true);
        handler(action);
      }, 60);
    }),
  ]);
};

export const menuSeparator = () => div({
  height: '2px',
  backgroundColor: 'rgba(255, 255, 255, .15)',
  margin: '5px 0',
});
