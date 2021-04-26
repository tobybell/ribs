import { clickControl, hoverEffect } from "./click-control";
import { Component, domEvent } from "./component";
import { contextMenu } from "./context-menu";
import { children, div, span, style } from "./div";
import { columnsIcon, galleryIcon, iconsIcon, listIcon, searchIcon, windowCloseIcon, windowMaximizeIcon, windowMinimizeIcon } from "./icons";
import { menu, menuItem, menuSeparator } from "./menu";
import { Icon } from "./paths-icon";
import { any, enable, Handler, map, state, Stream } from "./stream-stuff";

const windowButtons = (close: Handler<never>): Component => r => {
  const [hover, setHover] = state(false);
  const clickingClose = state(false);
  const clickingMin = state(false);
  const clickingMax = state(false);

  const showDetail = any([hover, clickingClose[0], clickingMin[0], clickingMax[0]]);

  const closeButton = windowButton(
    '#ec6559', '#ef8e84', windowCloseIcon, showDetail, clickingClose[1], close);
  const minButton = windowButton(
    '#e0c14c', '#fcee71', windowMinimizeIcon, showDetail, clickingMin[1], () => 0);
  const maxButton = windowButton(
    '#71bf46', '#9ded6f', windowMaximizeIcon, showDetail, clickingMax[1], () => 0);

  return div({
    display: 'flex',
    marginRight: '8px',
  }, [
    closeButton,
    minButton,
    maxButton,
  ], [
    hoverEffect(setHover),
  ])(r);
};

const windowButton = (
    defaultColor: string,
    highlightColor: string,
    icon: Icon,
    showDetail: Stream<boolean>,
    onClicking: Handler<boolean>,
    onClick: Handler<MouseEvent>): Component => r => {
  const [highlight, setHighlight] = state(false);
  const color = map(highlight, x => x ? highlightColor : defaultColor);
  const content = enable(showDetail, icon({ color: 'black' }));
  return div({
    height: '12px',
    width: '12px',
    borderRadius: '6px',
    backgroundColor: color,
    marginLeft: '8px',
  }, [
    content,
  ], [
    clickControl(onClick, setHighlight, onClicking),
  ])(r);
};

const windowTitle = (title: string) => div({
  flex: '0 1 auto',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
  color: '#b7b7ba',
  overflow: 'hidden',
  cursor: 'default',
}, [
  title,
]);

/** Title for representing the name of some user content. Just a bolder
 * typeface. */
export const contentTitle = (title: string) => div({
  fontWeight: "600",
  cursor: "default",
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: '#a7a7aa',
}, [title]);

const titleBar = (title: string | Component, onClose: Handler<void>) => div({
  display: 'flex',
  height: '22px',
  width: '100%',
  justifyContent: 'space-between',
  alignItems: 'center',
}, [
  windowButtons(onClose),
  typeof title === 'string' ? windowTitle(title) : title,
  div({
    flex: '0 10000 52px',
    height: '8px',
    minWidth: '8px',
  }),
]);

export function simpleTitleBar(title: string | Component, windowDrag: Handler<MouseEvent>, onClose: Handler<void>) {
  return div({
    flex: '0 0 auto',
    alignSelf: 'stretch',
    backgroundColor: '#3d3e3f',
    boxShadow: '0 -1px 0 rgba(0, 0, 0, 0.24) inset, 0 -.5px 0 #000 inset',
    overflow: 'scroll',
  }, [
    titleBar(title, onClose),
  ], [
    domEvent('mousedown', windowDrag),
  ]);
}

function toolbar(...items: Component[]) {
  return div({ display: 'flex', margin: '3px 8px 8px' }, items, [
    contextMenu(menu([
      menuItem({ label: 'Icon and Text' }),
      menuItem({ label: 'Icon Only' }),
      menuItem({ label: 'Text Only' }),
      menuSeparator,
      menuItem({ label: 'Customize Toolbar...' }),
    ]))
  ]);
}

function toolbarSearch() {
  return div({
    backgroundColor: '#636365',
    height: '22px',
    boxSizing: 'border-box',
    boxShadow: '0 .5px 0 rgba(255, 255, 255, .2) inset, 0 1px 0 rgba(255, 255, 255, .05) inset',
    borderRadius: '4px',
    flex: '0 1 300px',
    display: 'flex',
    alignItems: 'center',
    color: '#ffffff',
    marginRight: '8px',
    padding: '0 5px',
  }, [
    searchIcon(),
    span(
      style({
        color: 'rgba(255, 255, 255, 0.3)',
        marginLeft: '3px',
        flex: '1 0 auto',
      }),
      children('Search'),
    ),
  ]);
}

interface ButtonProps {
  title?: string;
  icon?: Component;
  rightIcon?: Component;
}

function toolbarButton({ title, icon, rightIcon }: ButtonProps): Component {
  return div({
    backgroundColor: '#636365',
    height: '22px',
    boxSizing: 'border-box',
    boxShadow: '0 .5px 0 rgba(255, 255, 255, .2) inset, 0 1px 0 rgba(255, 255, 255, .05) inset',
    borderRadius: '4px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    color: '#ffffff',
    marginRight: '8px',
    padding: '0 5px',
  }, [
    icon,
  ]);
}

const flexibleSpace = div({ flex: '1 0 0' });

export function toolbarBar(windowDrag: Handler<MouseEvent>, onClose: Handler<void>) {
  return div({
    flex: '0 0 auto',
    alignSelf: 'stretch',
    backgroundColor: '#3d3e3f',
    boxShadow: '0 -1px 0 rgba(0, 0, 0, 0.24) inset, 0 -.5px 0 #000 inset',
    overflow: 'scroll',
  }, [
    titleBar('Ribs — zsh — Solarized Dark – 98x26', onClose),
    toolbar(
      toolbarButton({icon: iconsIcon()}),
      toolbarButton({icon: listIcon()}),
      toolbarButton({icon: columnsIcon()}),
      toolbarButton({icon: galleryIcon()}),
      flexibleSpace,
      toolbarSearch(),
    ),
  ], [
    domEvent('mousedown', windowDrag),
  ]);
}