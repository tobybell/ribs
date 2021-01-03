import { clickControl } from "./click-control";
import { Component, domEvent } from "./component";
import { openMenu } from "./context-menu";
import { div, text } from "./div";
import { checkmark, nsChevronIcon, smallChevronDownIcon, smallChevronUpIcon } from "./icons";
import { menu, menuItem } from "./menu";
import { oneHot } from "./one-hot";
import { Sync } from "./state";
import { either, enable, Handler, map, state, Stream } from "./stream-stuff";

export const radio = (active: Stream<boolean>, onClick?: Handler<MouseEvent>) => {
  const [highlight, setHighlight] = state(false);
  return div({
    width: '16px',
    height: '16px',
    borderRadius: '8px',
    backgroundImage: map(active, x => x ? 'linear-gradient(#3367df, #255cc6)' : 'linear-gradient(#505152, #6b6c6c)'),
    boxShadow: '0 .5px 1px -.5px rgba(255, 255, 255, .4) inset, 0 0 1px rgba(0, 0, 0, .4), 0 .5px 1px rgba(0, 0, 0, .4)',
    overflow: 'hidden',
  }, [
    div({
      visibility: map(active, x => x ? 'visible' : 'hidden'),
      transform: 'translate(5.25px, 5.25px)',
      width: '5.5px',
      height: '5.5px',
      backgroundColor: '#ffffff',
      borderRadius: '2.75px',
    }),
    enable(highlight, div({ position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', backgroundColor: 'rgba(255,255,255,.15)' })),
  ], [
    clickControl(onClick, setHighlight),
  ]);
};

export function checkbox(checked: Sync<boolean>) {
  let isChecked = false;
  const [active, setActive] = state(false);
  return div({
    width: '14px',
    height: '14px',
    borderRadius: '3px',
    backgroundImage: either(checked.get, 'linear-gradient(#3367df, #255cc6)', 'linear-gradient(#505152, #6b6c6c)'),
    boxShadow: '0 1px 1px -1px rgba(255, 255, 255, .4) inset, 0 0 1px rgba(0, 0, 0, .4), 0 1px 1px rgba(0, 0, 0, .2)',
    overflow: 'hidden',
  }, [
    enable(checked.get, checkmark()),
    enable(active, div({ position: 'absolute', top: '0', left: '0', width: '100%', height: '100%', backgroundColor: 'rgba(255,255,255,.15)' })),
  ], [
    () => checked.get(x => isChecked = x),
    clickControl(() => checked.set(!isChecked), setActive),
  ]);
}

export function slider(value: Sync<number>) {
  return div({
    height: '15px',
    margin: '16px',
  }, [
    div({
      backgroundColor: '#505050',
      height: '3px',
      width: '100%',
      borderRadius: '1.5px',
      transform: 'translate(0, 6px)',
    }, [
      div({
        backgroundColor: '#3268de',
        height: '100%',
        width: '100%',
        transform: map(value.get, v => `translateX(${50 * (v - 1)}%) scaleX(${v})`),
      }),
    ]),
    div({
      width: '100%',
      height: '15px',
      position: 'absolute',
      top: '0',
      left: '0',
      transform: map(value.get, v => `translateX(calc(${v} * (100% - 15px)))`),
    }, [
      div({
        backgroundColor: '#ccc',
        height: '15px',
        width: '15px',
        borderRadius: '7.5px',
        boxShadow: '0 .5px 1px -.5px rgba(255, 255, 255, .6) inset, 0 0 1px rgba(0, 0, 0, .3), 0 .5px 1px rgba(0, 0, 0, .3)',
      })
    ]),
  ], [
    domEvent('mousedown', e => {
      e.preventDefault();
      const target = e.currentTarget as HTMLDivElement;
      const rect = target.getBoundingClientRect();
      const left = rect.left + 7.5;
      const width = rect.width - 15;

      const update = (e: MouseEvent) => {
        const lerp = (e.clientX - left) / width;
        const newVal = Math.min(Math.max(lerp, 0), 1);
        value.set(newVal);
      };
    
      const stopUpdate = () => {
        window.removeEventListener('mousemove', update);
        window.removeEventListener('mouseup', stopUpdate);
      };

      update(e);
      window.addEventListener('mousemove', update);
      window.addEventListener('mouseup', stopUpdate);
    }),
  ]);
}

// TODO: Use a CSS pseudo-element for this?
const gloss = div({
  position: 'absolute',
  top: '0',
  left:'0',
  width: '100%',
  height: '100%',
  boxShadow: 'inset 0 1px 1px -1px rgba(255, 255, 255, .6)',
  borderRadius: 'inherit',
  pointerEvents: 'none',
});

export function button(label: Stream<string>, action: Handler<MouseEvent>) {
  const [active, setActive] = state(false);
  return div({
    height: '19px',
    backgroundColor: either(active, '#336dd9', '#666768'),
    borderRadius: '3px',
    boxShadow: '0 0 1px rgba(0, 0, 0, .3), 0 1px 1px rgba(0, 0, 0, .15)',
    padding: '0 16px',
    width: 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#ffffff',
    overflow: 'hidden',
    cursor: 'default',
  }, [
    text(label),
    gloss,
  ], [
    clickControl(action, setActive),
  ]);
}

/** Get the "current" value from a stream. */
function sample<T>(f: Stream<T>, init: T): T;
function sample<T>(f: Stream<T>, init?: T): T | undefined {
  f(x => init = x)();
  return init;
}

export const select = () => {
  const options = ['Small', 'Medium', 'Large', 'Death', 'Travel'];
  const [currIdx, setCurrIdx] = state(1);
  const selected = oneHot(currIdx);
  return div({
    margin: '16px',
    width: '120px',
    height: '19px',
    backgroundColor: '#666768',
    borderRadius: '3px',
    boxShadow: '0 0 1px rgba(0, 0, 0, .4), 0 1px 1px rgba(0, 0, 0, .2)',
    paddingLeft: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    color: '#ffffff',
    overflow: 'hidden',
    cursor: 'default',
  }, [
    text(map(currIdx, x => options[x])),
    div({
      backgroundImage: 'linear-gradient(#3367df, #255cc6)',
      width: '16px',
      alignSelf: 'stretch',
    }, [
      nsChevronIcon({ style: {
        transform: 'translate(1px, 2.5px)',
      }}),
    ]),
    gloss,
  ], [
    r => {
      const m = menu(
        options.map((x, i) => menuItem({
          label: x,
          checked: selected(i),
          action: () => setCurrIdx(i),
        })),
        13,
      );
      const open = (e: MouseEvent) => {
        const rect = r.getBoundingClientRect();
        openMenu(m, rect.left - 13, rect.top - 18 * sample(currIdx, 0));
      };
      return domEvent('mousedown', open)(r);
    },
  ]);
};

function halfButton(content: Component, action: Handler<MouseEvent>) {
  const [active, setActive] = state(false);
  return div({
    height: '50%',
    width: '100%',
    backgroundColor: either(active, '#336dd9', '#656565'),
    cursor: 'default',
  }, [content], [
    clickControl(action, setActive),
  ]);
}

export function upDownButton(onUp: Handler<MouseEvent>, onDown: Handler<MouseEvent>) {
  return div({
    width: "11px",
    height: "18px",
  }, [
    div({
      width: "100%",
      height: "calc(100% + 2px)",
      transform: "translate(0, -1px)",
      borderRadius: '5px',
      boxShadow: '0 0 1px rgba(0, 0, 0, .3), 0 1px 1px rgba(0, 0, 0, .15)',
      overflow: 'hidden',
      cursor: 'default',
    }, [
      halfButton(smallChevronUpIcon(), onUp),
      halfButton(smallChevronDownIcon(), onDown),
      gloss,
    ]),
  ]);
}