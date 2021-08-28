import { clickControl, hoverEffect } from './click-control';
import { Component, domEvent } from './component';
import { contextMenu } from './context-menu';
import { children, divr, span, style } from './div';
import { columnsIcon, galleryIcon, iconsIcon, listIcon, searchIcon, windowCloseIcon, windowMaximizeIcon, windowMinimizeIcon } from './icons';
import { menu, menuItem, menuSeparator } from './menu';
import { Icon } from './paths-icon';
import { any, enable, Handler, map, state, Stream } from './stream-stuff';

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

  return divr(style({
    display: 'flex',
    marginRight: '8px',
  }), children(
    closeButton,
    minButton,
    maxButton,
  ),
  hoverEffect(setHover),
  )(r);
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
  return divr(style({
    height: '12px',
    width: '12px',
    borderRadius: '6px',
    backgroundColor: color,
    marginLeft: '8px',
  }), children(content),
    clickControl(onClick, setHighlight, onClicking),
  )(r);
};

const windowTitle = (title: string) => divr(style({
  flex: '0 1 auto',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
  color: '#b7b7ba',
  overflow: 'hidden',
  cursor: 'default',
}), children(title));

/** Title for representing the name of some user content. Just a bolder
 * typeface. */
export const contentTitle = (title: string) => divr(style({
  fontWeight: '600',
  cursor: 'default',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  color: '#a7a7aa',
}), children(title));

const titleBar = (title: string | Component, onClose: Handler<void>) => divr(style({
  display: 'flex',
  height: '22px',
  width: '100%',
  justifyContent: 'space-between',
  alignItems: 'center',
}), children(
  windowButtons(onClose),
  typeof title === 'string' ? windowTitle(title) : title,
  divr(style({
    flex: '0 10000 52px',
    height: '8px',
    minWidth: '8px',
  })),
));

export function simpleTitleBar(title: string | Component, windowDrag: Handler<MouseEvent>, onClose: Handler<void>) {
  return divr(style({
    flex: '0 0 auto',
    alignSelf: 'stretch',
    backgroundColor: '#3d3e3f',
    boxShadow: '0 -1px 0 rgba(0, 0, 0, 0.24) inset, 0 -.5px 0 #000 inset',
    overflow: 'scroll',
  }), children(
    titleBar(title, onClose),
  ),
  domEvent('mousedown', windowDrag));
}

function toolbar(...items: Component[]) {
  return divr(style({ display: 'flex', margin: '3px 8px 8px' }), children(...items),
    contextMenu(menu([
      menuItem({ label: 'Icon and Text' }),
      menuItem({ label: 'Icon Only' }),
      menuItem({ label: 'Text Only' }),
      menuSeparator,
      menuItem({ label: 'Customize Toolbar...' }),
    ]))
  );
}

function toolbarSearch() {
  return divr(style({
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
  }), children(
    searchIcon(),
    span(
      style({
        color: 'rgba(255, 255, 255, 0.3)',
        marginLeft: '3px',
        flex: '1 0 auto',
      }),
      children('Search'),
    ),
  ));
}

interface ButtonProps {
  title?: string;
  icon?: Component;
  rightIcon?: Component;
}

function toolbarButton({ title, icon, rightIcon }: ButtonProps): Component {
  return divr(style({
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
  }), children(
    icon,
  ));
}

const flexibleSpace = divr(style({ flex: '1 0 0' }));

export function toolbarBar(windowDrag: Handler<MouseEvent>, onClose: Handler<void>) {
  return divr(style({
    flex: '0 0 auto',
    alignSelf: 'stretch',
    backgroundColor: '#3d3e3f',
    boxShadow: '0 -1px 0 rgba(0, 0, 0, 0.24) inset, 0 -.5px 0 #000 inset',
    overflow: 'scroll',
  }), children(
    titleBar('Ribs — zsh — Solarized Dark – 98x26', onClose),
    toolbar(
      toolbarButton({icon: iconsIcon()}),
      toolbarButton({icon: listIcon()}),
      toolbarButton({icon: columnsIcon()}),
      toolbarButton({icon: galleryIcon()}),
      flexibleSpace,
      toolbarSearch(),
    ),
  ),
  domEvent('mousedown', windowDrag),
  );
}
