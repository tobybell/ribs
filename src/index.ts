import { xor } from "lodash";

export {};

type Unsubscriber = () => void;
type Handler<T> = (x: T) => void;
type Stream<T> = (f: Handler<T>) => Unsubscriber;
type Contents<T> = T extends Stream<infer U> ? U : never;
type Values<T> = T | Stream<T>;

/** Stream that just produces a fixed value. */
const just = <T>(x: T): Stream<T> => h => (h(x), () => {});

/** Stream that produces no/unit value at a given period. */
const tick = (dt: number): Stream<void> => h => {
  h();
  const interval = setInterval(() => h(), dt * 1000);
  return () => clearInterval(interval);
};

/** Transform values from one stream into another with the given function. */
const map = <T, S>(s: Stream<T>, f: (x: T) => S): Stream<S> =>
  h => s(x => h(f(x)));

/** Reduce values from a stream. */
const reduce = <T, S>(s: Stream<T>, f: (a: S, x: T) => S, initial: S): Stream<S> => {
  return h => {
    let a = initial;
    h(a);
    return s(x => {
      a = f(a, x);
      h(a);
    });
  };
};

/** Reduce values from multiple streams. */
type ReducePair<A, T> = [Stream<T>, (a: A, x: T) => A];
const reduceMulti = <A, T extends any[]>(ss: {[K in keyof T]: ReducePair<A, T[K]>}, init: A): Stream<A> => {
  return h => {
    let a = init;
    h(a);
    const us = ss.map(([s, f]) => s(x => {
      a = f(a, x);
      h(a);
    }));
    return () => us.forEach(u => u());
  };
};

/**
 * Union multiple streams.
 */
const merge = <T extends Stream<any>[]>(...ss: T): Stream<{[K in keyof T]: Contents<T[K]>}[number]> => h => {
  const us = ss.map(s => s(h));
  return () => us.forEach(u => u());
};

/**
 * Join two streams into a stream of array pairs.
 *
 * TODO: I want a better API for this.
 */
const join = <T extends readonly any[]>(ss: {[K in keyof T]: Stream<T[K]>}): Stream<{-readonly [K in keyof T]: T[K]}> => {
  const n = ss.length;
  return h => {
    let nRemaining = n;
    let rs = Array(n);
    let cs = Array(n) as {-readonly [K in keyof T]: T[K]};
    const us = ss.map((s, i) => s(x => {
      cs[i] = x;
      if (!rs[i]) {
        nRemaining -= 1;
        rs[i] = true;
      }
      if (!nRemaining) h(cs);
    }));
    return () => us.forEach(u => u());
  };
};

/** Stream that produces a monotonically increasing time at some period. */
const time = (dt: number) => map(tick(dt), () => performance.now() / 1000);

/** Stream that produces alternating `true`/`false` values. */
const square = (dt: number) => reduce(tick(dt), a => !a, false);

function useState<T>(initial: T): [Stream<T>, Handler<T>] {
  let curr = initial;
  let handlers = new Set<Handler<T>>();
  const state: Stream<T> = (h: Handler<T>) => {
    handlers.add(h);
    h(curr);
    return () => handlers.delete(h);
  };
  const setState = (x: T) => {
    curr = x;
    handlers.forEach(h => h(x));
  };
  return [state, setState];
}

function useStream<T>(): [Stream<T>, Handler<T>] {
  let handlers = new Set<Handler<T>>();
  const stream: Stream<T> = (h: Handler<T>) => {
    handlers.add(h);
    return () => handlers.delete(h);
  };
  const emit = (x: T) => handlers.forEach(h => h(x));
  return [stream, emit];
};

interface Frame {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FrameHandles {
  top: Handler<MouseEvent>;
  bottom: Handler<MouseEvent>;
  left: Handler<MouseEvent>;
  right: Handler<MouseEvent>;
  topLeft: Handler<MouseEvent>;
  topRight: Handler<MouseEvent>;
  bottomLeft: Handler<MouseEvent>;
  bottomRight: Handler<MouseEvent>;
  middle: Handler<MouseEvent>;
}

// TODO: Componentize.
function windowFrame(frame: Stream<Frame>, resize: FrameHandles, content: Component): Component {
  return r => {
    const div = document.createElement('div');
    const style = div.style;
    style.position = 'absolute';
    frame(f => {
      style.left = `${f.x}px`;
      style.top = `${f.y}px`;
      style.width = `${f.width}px`;
      style.height = `${f.height}px`;
    });
    render(content, div);
    div.appendChild(topDragger(resize.top));
    div.appendChild(topLeftDragger(resize.topLeft));
    div.appendChild(topRightDragger(resize.topRight));
    div.appendChild(bottomLeftDragger(resize.bottomLeft));
    div.appendChild(bottomRightDragger(resize.bottomRight));
    div.appendChild(bottomDragger(resize.bottom));
    div.appendChild(leftDragger(resize.left));
    div.appendChild(rightDragger(resize.right));

    return mount(div, r);
  };
}

function finder(frame: Stream<Frame>, expanded: Stream<boolean>, setExpanded: any, h: FrameHandles) {
  const content = Div({
    // backgroundColor: '#1f1f20',
    backgroundColor: '#323334',
    borderRadius: '5px',
    overflow: 'hidden',
    boxSizing: 'border-box',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.7)',
    display: 'flex',
    flexFlow: 'column nowrap',
    width: '100%',
    height: '100%',
  }, [
    menuBar(h.middle),
    Div({
      flex: '1 0 0',
      position: 'relative',
      display: 'flex',
      alignItems: 'stretch',
    }, [
      sidebar(expanded, setExpanded),
      Div({}, [
        radio(square(Math.random())),
        radio(just(false)),
        radio(just(false)),
        checkbox(square(Math.random())),
        checkbox(just(true)),
        select('Medium'),
      ]),
    ]),
    borderOverlay,
  ], [
    ContextMenu(menu([
      menuItem('Back', true),
      menuItem('Reload Page'),
      menuSeparator(),
      menuItem('Show Page Source'),
      menuItem('Save Page As...'),
      menuItem('Print Page...'),
      menuSeparator(),
      menuItem('Inspect Element'),
    ])),
  ]);
  const frameView = windowFrame(frame, h, content);
  return frameView;
}

type ElementThing = HTMLElement | SVGSVGElement | Component | string | undefined;
type StreamableCSS = {[K in keyof CSSStyleDeclaration]: string | Stream<string>};

function elem<K extends keyof HTMLElementTagNameMap>(s: K) {
  return document.createElement(s);
}

function marker() {
  return document.createComment('');
}

/** Render a component into a container. */
function render(c: Component, p: HTMLElement) {
  return c(p.appendChild(marker()));
}

const Div = (
  style: Partial<StreamableCSS>,
  children?: ElementThing[],
  effects?: Effect[],
): Component => r => {
  const t = elem('div');

  // Style bits.
  const keys = Object.keys(style) as (keyof CSSStyleDeclaration)[];
  const estyle = t.style as any;
  keys.forEach(k => {
    const v = style[k];
    if (typeof v === 'string') {
      estyle[k] = v;
    } else if (v) {
      // TODO: Unsubscription
      v(x => estyle[k] = x);
    }
  });

  children?.forEach((x, i) => {
    if (!x) return;
    if (x instanceof HTMLElement || x instanceof SVGSVGElement) {
      t.appendChild(x);
    } else if (typeof x == 'string') {
      t.appendChild(document.createTextNode(x));
    } else {
      // TODO: Figure out how unsubscription should work.
      const u = render(x, t);
    }
  });

  // TODO: Use this.
  const cleanups = effects?.map(f => f(t)) || [];

  return mount(t, r);
};


const FillLayer = (
  style: Partial<StreamableCSS>,
  children?: ElementThing[],
  effects?: Effect[]
) => Div({
  position: 'absolute',
  width: '100%',
  height: '100%',
  top: '0',
  left: '0',
  ...style,
}, children, effects);


const span = (
  style: Partial<StreamableCSS>,
  children?: ElementThing[],
): Component => r => {
  const e = elem('span');

  // Style bits.
  const keys = Object.keys(style) as (keyof CSSStyleDeclaration)[];
  const estyle = e.style as any;
  keys.forEach(k => {
    const v = style[k];
    if (typeof v === 'string') {
      estyle[k] = v;
    } else if (v) {
      // TODO: Unsubscription
      v(x => estyle[k] = x);
    }
  });

  children?.forEach((x, i) => {
    if (!x) return;
    if (x instanceof HTMLElement || x instanceof SVGSVGElement) {
      e.appendChild(x);
    } else if (typeof x == 'string') {
      e.appendChild(document.createTextNode(x));
    } else {
      // TODO: Figure out how unsubscription should work.
      const u = render(x, e);
    }
  });

  return mount(e, r);
};

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

const borderOverlay = Div({
  position: 'absolute',
  top: '0',
  left: '0',
  width: '100%',
  height: '100%',
  borderRadius: '5px',
  boxShadow: '0 .5px 0 rgba(255, 255, 255, .2) inset',
  pointerEvents: 'none',
}, [
  Div({
    width: '100%',
    height: '100%',
    border: '1px solid rgba(255, 255, 255, .15)',
    borderRadius: '5px',
    boxSizing: 'border-box',
  }),
]);

const windowTitle = (title: string) => Div({
  flex: '0 1 auto',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
  color: '#b7b7ba',
  overflow: 'hidden',
}, [
  title,
]);

const titleBar = () => Div({
  display: 'flex',
  height: '22px',
  width: '100%',
  justifyContent: 'space-between',
  alignItems: 'center',
}, [
  windowButtons(),
  windowTitle('Ribs — zsh — Solarized Dark – 98x26'),
  Div({
    flex: '0 10000 52px',
    height: '8px',
    minWidth: '8px',
  }),
]);

const windowButtons = () => Div({
  display: 'flex',
  marginRight: '8px',
}, [
  windowButton('#ec6559'),
  windowButton('#e0c14c'),
  windowButton('#71c047'),
]);

const windowButton = (color: string) => Div({
  height: '12px',
  width: '12px',
  borderRadius: '6px',
  backgroundColor: color,
  marginLeft: '8px',
});

function menuBar(windowDrag: Handler<MouseEvent>) {
  return Div({
    flex: '0 0 auto',
    backgroundColor: '#3d3e3f',
    boxShadow: '0 -1px 0 rgba(0, 0, 0, 0.24) inset, 0 -.5px 0 #000 inset',
    overflow: 'scroll',
    position: 'relative',
  }, [
    titleBar(),
    toolbar(
      toolbarButton({icon: iconsIcon()}),
      toolbarButton({icon: listIcon()}),
      toolbarButton({icon: columnsIcon()}),
      toolbarButton({icon: galleryIcon()}),
      flexibleSpace,
      toolbarSearch(),
    ),
  ], [
    Event('mousedown', windowDrag),
  ]);
}

function FillDragRegion(h: Handler<MouseEvent>) {
  return FillLayer({ zIndex: '0' }, [], [Event('mousedown', h)]);
}

function toolbar(...items: Component[]) {
  return Div({ display: 'flex', margin: '3px 8px 8px' }, items, [
    ContextMenu(menu([
      menuItem('Icon and Text'),
      menuItem('Icon Only'),
      menuItem('Text Only'),
      menuSeparator(),
      menuItem('Customize Toolbar...'),
    ]))
  ]);
}

interface ButtonProps {
  title?: string;
  icon?: Component;
  rightIcon?: Component;
}

function toolbarButton({title, icon, rightIcon}: ButtonProps): Component {
  return Div({
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

function toolbarSearch() {
  return Div({
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
    span({
      color: 'rgba(255, 255, 255, 0.3)',
      marginLeft: '3px',
      flex: '1 0 auto',
    }, [
      'Search',
    ]),
  ]);
}

interface ChildrenProps {
  expanded: Stream<boolean>;
  onExpand: Handler<void>;
  onCollapse: Handler<void>;
  children: ItemProps[];
}

interface ItemProps {
  title: string;
}

function sidebar(expanded: Stream<boolean>, setExpanded: any) {
  return Div({
    backgroundColor: '#29282a',
    width: '150px',
    borderRight: '1px solid #000000',
    overflow: 'scroll',
  }, [
    section('iCloud', [
      item({
        title: 'iCloud Drive',
        icon: sidebariCloudIcon(),
        active: true,
        expanded,
        onExpand: () => setExpanded(true),
        onCollapse: () => setExpanded(false),
        children: [
          item({title: 'Documents', level: 1, icon: sidebarDocumentsFolderIcon()}),
          item({title: 'Desktop', level: 1, icon: sidebarDesktopFolderIcon()}),
        ],
      }),
      item({title: 'Documents', icon: sidebarDocumentsFolderIcon()}),
      item({title: 'Desktop', icon: sidebarDesktopFolderIcon()}),
      item({title: 'Books', icon: sidebarGenericFolderIcon()}),
      item({title: 'Applications', icon: sidebarGenericFolderIcon()}),
      item({title: 'Archive', icon: sidebarGenericFolderIcon()}),
      item({title: 'Fonts', icon: sidebarGenericFolderIcon()}),
      item({title: 'Sheets', icon: sidebarGenericFolderIcon()}),
      item({title: 'Pictures', icon: sidebarGenericFolderIcon()}),
      item({title: 'Movies', icon: sidebarGenericFolderIcon()}),
    ]),
    section('Favorites', [
      item({title: 'Books', icon: sidebarGenericFolderIcon()}),
      item({title: 'Applications', icon: sidebarGenericFolderIcon()}),
      item({title: 'Movies', icon: sidebarMoviesFolderIcon()}),
    ]),
    section('Smart Mailboxes', []),
    section('On My Mac', []),
    section('Stanford', []),
  ]);
}

function section(title: string, items: Component[]) {
  return Div({
    padding: '6px 0',
    overflow: 'auto',
  }, [
    sidebarHeading(title),
    ...items,
  ]);
}

function sidebarHeading(name: string) {
  return Div({
    display: 'flex',
    alignItems: 'center',
    height: '17px',
    paddingLeft: '9px',
    color: 'rgba(255, 255, 255, 0.62)',
    fontSize: '11px',
  }, [
    name,
  ]);
}

function item({ title, icon, level = 0, active = false, expanded = just(false), onExpand, onCollapse, children }: {
  title: string;
  level?: number;
  icon?: Component;
  active?: boolean;
  expanded?: Stream<boolean>;
  onExpand?: Handler<MouseEvent>;
  onCollapse?: Handler<MouseEvent>;
  children?: any[];
}) {
  const indent = `${level * 16}px`;
  const hasChildren = children && children.length > 0;
  const openCaret = caretDownIcon(onCollapse);
  const closedCaret = caretRightIcon(onExpand);
  const s = mounter(space(18));
  const carets = map(expanded, x => hasChildren
    ? x ? openCaret : closedCaret : s);

  return Div({
    paddingTop: '2px',
    boxSizing: 'border-box',
  }, [
    Div({
      display: 'flex',
      alignItems: 'center',
      height: '24px',
      paddingLeft: indent,
      color: '#ffffff',
      backgroundColor: active ? 'rgba(255, 255, 255, .17)' : 'transparent',
    }, [
      streamComp(carets),
      icon,
      space(5),
      title,
    ]),
    Div({
      overflow: 'hidden',
      transition: 'height .2s cubic-bezier(.4,1,.75,.9)',
      height: map(expanded, x => x ? 'auto' : '0'),
    }, children),
  ]);
}

type IconPath = [number, string];

const icons: { [key: string]: IconPath[] } = {
  sidebarDesktopFolder: [
    [1, 'M0,8C0,5.792 1.792,4 4,4C4,4 32,4 32,4C34.208,4 36,5.792 36,8L36,28C36,30.208 34.208,32 32,32C32,32 4,32 4,32C1.792,32 0,30.208 0,28C0,28 0,8 0,8ZM32.013,30C33.107,29.993 33.993,29.106 34,28.013L34,10L2,10L2,28C2,29.104 2.896,30 4,30L32.013,30ZM34,8C34,6.9 33.111,6.007 32.013,6L4,6C2.896,6 2,6.896 2,8L34,8Z'],
    [.4, 'M32.013,30C33.107,29.993 33.993,29.106 34,28.013L34,10L2,10L2,28C2,29.104 2.896,30 4,30L8,30L8,25L9,24L27,24L28,25L28,30L32.013,30Z'],
    [.7, 'M9,30L8,30L8,25L9,24L27,24L28,25L28,30L27,30L27,30L9,30L9,30ZM14,29L14,25L10,25L10,29L14,29ZM20,29L20,25L16,25L16,29L20,29ZM26,29L26,25L22,25L22,29L26,29Z'],
  ],
  sidebarGenericFolder: [
    [1, 'M13.414,6L34,6C35.104,6 36,6.896 36,8L36,30C36,31.104 35.104,32 34,32L2,32C0.896,32 0,31.104 0,30L0,5C0,3.896 0.896,3 2,3L10,3C10.256,3 10.512,3.098 10.707,3.293L13.414,6ZM34,30C34,30 34,30 34,30ZM3,12C2.448,12 2,12.448 2,13L2,30L34,30L34,13C34,12.448 33.552,12 33,12L3,12ZM34,10.171L34,8L13,8L13,8C12.744,8 12.488,7.902 12.293,7.707L9.586,5L2,5L2,10.171C2.313,10.06 2.649,10 3,10L33,10C33.351,10 33.687,10.06 34,10.171Z'],
    [.3, 'M34,13C34,12.735 33.895,12.48 33.707,12.293C33.52,12.105 33.265,12 33,12C28.225,12 7.775,12 3,12C2.735,12 2.48,12.105 2.293,12.293C2.105,12.48 2,12.735 2,13C2,16.782 2,30 2,30L34,30L34,13Z'],
    [.1, 'M33,10L3,10C2.66,10.001 2.324,10.058 2.003,10.17L2,10.171L2,5L9.586,5L12.293,7.707C12.488,7.902 12.744,8 13,8L13,8L34,8L34,10.171C33.687,10.06 33.351,10 33,10Z'],
  ],
  sidebariCloud: [
    [.1, 'M7.8,28C7.8,28 28.5,28 28.5,28C31.536,28 34,25.536 34,22.5C34,19.802 32.053,17.554 29.488,17.088C28.963,16.993 28.497,16.691 28.195,16.25C27.893,15.809 27.78,15.266 27.882,14.741C27.959,14.339 28,13.924 28,13.5C28,9.913 25.087,7 21.5,7C18.785,7 16.457,8.668 15.485,11.033C15.232,11.647 14.692,12.096 14.042,12.231C13.392,12.366 12.717,12.17 12.241,11.707C11.791,11.27 11.177,11 10.5,11C9.12,11 8,12.12 8,13.5C8,13.702 8.024,13.898 8.069,14.087C8.195,14.609 8.105,15.16 7.82,15.615C7.534,16.071 7.078,16.392 6.553,16.507C3.949,17.079 2,19.407 2,22.186C2,25.394 4.598,28 7.8,28Z'],
    [1, 'M7.8,30C3.495,30 0,26.499 0,22.186C0,18.45 2.624,15.323 6.124,14.554C6.043,14.216 6,13.863 6,13.5C6,11.016 8.016,9 10.5,9C11.718,9 12.824,9.485 13.635,10.273C14.906,7.18 17.951,5 21.5,5C26.191,5 30,8.809 30,13.5C30,14.054 29.947,14.596 29.845,15.121C33.343,15.755 36,18.82 36,22.5C36,26.639 32.639,30 28.5,30L7.8,30ZM7.8,28C7.8,28 28.5,28 28.5,28C31.536,28 34,25.536 34,22.5C34,19.802 32.053,17.554 29.488,17.088C28.963,16.993 28.497,16.691 28.195,16.25C27.893,15.809 27.78,15.266 27.882,14.741C27.959,14.339 28,13.924 28,13.5C28,9.913 25.087,7 21.5,7C18.785,7 16.457,8.668 15.485,11.033C15.232,11.647 14.692,12.096 14.042,12.231C13.392,12.366 12.717,12.17 12.241,11.707C11.791,11.27 11.177,11 10.5,11C9.12,11 8,12.12 8,13.5C8,13.702 8.024,13.898 8.069,14.087C8.195,14.609 8.105,15.16 7.82,15.615C7.534,16.071 7.078,16.392 6.553,16.507C3.949,17.079 2,19.407 2,22.186C2,25.394 4.598,28 7.8,28Z'],
  ],
  sidebarDocumentsFolder: [
    [.4, 'M20,3L14,3L14,7L24,17L24,27L32,27L32,15L30,13L22,13L22,5L20,3Z'],
    [.15, 'M22,21L20,19L12,19L12,11L10,9L4,9L4,33L22,33L22,21Z'],
    [1, 'M12,7L12,1L24,1L34,11L34,29L24,29L24,35L2,35L2,7L12,7ZM12,11L10,9L4,9L4,33L22,33L22,21L20,19L12,19L12,11ZM24,27L32,27L32,15L30,13L22,13L22,5L20,3L14,3L14,7L24,17L24,27ZM14,17L14,10L21,17L14,17ZM24,11L24,4L31,11L24,11Z'],
  ],
  sidebarDownloadsFolder: [
    [1, 'M18,0C27.934,0 36,8.066 36,18C36,27.934 27.934,36 18,36C8.066,36 0,27.934 0,18C0,8.066 8.066,0 18,0ZM18,2C26.831,2 34,9.169 34,18C34,26.831 26.831,34 18,34C9.169,34 2,26.831 2,18C2,9.169 9.169,2 18,2Z'],
    [.9, 'M18,2C26.831,2 34,9.169 34,18C34,26.831 26.831,34 18,34C9.169,34 2,26.831 2,18C2,9.169 9.169,2 18,2ZM14,8L22,8L22,18L28,18L18,29L8,18L14,18L14,8Z'],
    [1, 'M12,16L12,8C12,6.895 12.895,6 14,6L22,6C23.105,6 24,6.895 24,8L24,16L28,16C28.792,16 29.509,16.467 29.829,17.191C30.149,17.915 30.012,18.76 29.48,19.345L19.48,30.345C19.101,30.762 18.563,31 18,31C17.437,31 16.899,30.762 16.52,30.345L6.52,19.345C5.988,18.76 5.851,17.915 6.171,17.191C6.491,16.467 7.208,16 8,16L12,16ZM14,8L22,8L22,18L28,18L18,29L8,18L14,18L14,8Z'],
  ],
  sidebarMoviesFolder: [
    [1, 'M34,1L2,1L2,35L34,35L34,1ZM28,19L8,19L8,33L28,33L28,19ZM32,31L30,31L30,33L32,33L32,31ZM6,31L4,31L4,33L6,33L6,31ZM32,27L30,27L30,29L32,29L32,27ZM6,27L4,27L4,29L6,29L6,27ZM32,23L30,23L30,25L32,25L32,23ZM6,23L4,23L4,25L6,25L6,23ZM32,19L30,19L30,21L32,21L32,19ZM6,19L4,19L4,21L6,21L6,19ZM6,15L4,15L4,17L6,17L6,15ZM32,15L30,15L30,17L32,17L32,15ZM28,3L8,3L8,17L28,17L28,3ZM32,11L30,11L30,13L32,13L32,11ZM6,11L4,11L4,13L6,13L6,11ZM32,7L30,7L30,9L32,9L32,7ZM6,7L4,7L4,9L6,9L6,7ZM6,3L4,3L4,5L6,5L6,3ZM32,3L30,3L30,5L32,5L32,3Z'],
    [.2, 'M8,3L28,3L28,17,L8,17Z'],
    [.2, 'M8,19L28,19L28,33,L8,33Z'],
  ],
  caretRight: [
    [1, 'M11,9L11,27L26,18L11,9Z'],
  ],
  caretDown: [
    [1, 'M9,11L27,11L18,26L9,11Z'],
  ],
  icons: [
    [1, 'M22,21C22,19.896 21.104,19 20,19L16,19C14.896,19 14,19.896 14,21L14,25C14,26.104 14.896,27 16,27L20,27C21.104,27 22,26.104 22,25L22,21ZM12,21C12,19.896 11.104,19 10,19L6,19C4.896,19 4,19.896 4,21L4,25C4,26.104 4.896,27 6,27L10,27C11.104,27 12,26.104 12,25L12,21ZM32,21C32,19.896 31.104,19 30,19L26,19C24.896,19 24,19.896 24,21L24,25C24,26.104 24.896,27 26,27L30,27C31.104,27 32,26.104 32,25L32,21ZM12,11C12,9.896 11.104,9 10,9L6,9C4.896,9 4,9.896 4,11L4,15C4,16.104 4.896,17 6,17L10,17C11.104,17 12,16.104 12,15L12,11ZM22,11C22,9.896 21.104,9 20,9L16,9C14.896,9 14,9.896 14,11L14,15C14,16.104 14.896,17 16,17L20,17C21.104,17 22,16.104 22,15L22,11ZM32,11C32,9.896 31.104,9 30,9L26,9C24.896,9 24,9.896 24,11L24,15C24,16.104 24.896,17 26,17L30,17C31.104,17 32,16.104 32,15L32,11Z'],
  ],
  list: [
    [1, 'M32,26L4,26L4,28L32,28L32,26ZM32,20L4,20L4,22L32,22L32,20ZM32,14L4,14L4,16L32,16L32,14ZM32,8L4,8L4,10L32,10L32,8Z'],
  ],
  columns: [
    [1, 'M34,10.5C34,9.12 32.88,8 31.5,8L4.5,8C3.12,8 2,9.12 2,10.5L2,25.5C2,26.88 3.12,28 4.5,28L31.5,28C32.88,28 34,26.88 34,25.5L34,10.5ZM12,10L12,26L4.5,26C4.224,26 4,25.776 4,25.5L4,10.5C4,10.224 4.224,10 4.5,10L12,10ZM24,10L31.5,10C31.776,10 32,10.224 32,10.5L32,25.5C32,25.776 31.776,26 31.5,26L24,26L24,10ZM22,10L14,10L14,26L22,26L22,10Z'],
  ],
  gallery: [
    [.6, 'M30,10.5C30,10.224 29.776,10 29.5,10L6.5,10C6.224,10 6,10.224 6,10.5L6,19.5C6,19.776 6.224,20 6.5,20L29.5,20C29.776,20 30,19.776 30,19.5L30,10.5Z'],
    [1, 'M14,25.5C14,24.672 13.328,24 12.5,24L11.5,24C10.672,24 10,24.672 10,25.5L10,26.5C10,27.328 10.672,28 11.5,28L12.5,28C13.328,28 14,27.328 14,26.5L14,25.5ZM20,25.5C20,24.672 19.328,24 18.5,24L17.5,24C16.672,24 16,24.672 16,25.5L16,26.5C16,27.328 16.672,28 17.5,28L18.5,28C19.328,28 20,27.328 20,26.5L20,25.5ZM26,25.5C26,24.672 25.328,24 24.5,24L23.5,24C22.672,24 22,24.672 22,25.5L22,26.5C22,27.328 22.672,28 23.5,28L24.5,28C25.328,28 26,27.328 26,26.5L26,25.5ZM32,25.5C32,24.672 31.328,24 30.5,24L29.5,24C28.672,24 28,24.672 28,25.5L28,26.5C28,27.328 28.672,28 29.5,28L30.5,28C31.328,28 32,27.328 32,26.5L32,25.5ZM8,25.5C8,24.672 7.328,24 6.5,24L5.5,24C4.672,24 4,24.672 4,25.5L4,26.5C4,27.328 4.672,28 5.5,28L6.5,28C7.328,28 8,27.328 8,26.5L8,25.5ZM32,10.5C32,9.12 30.88,8 29.5,8L6.5,8C5.12,8 4,9.12 4,10.5L4,19.5C4,20.88 5.12,22 6.5,22L29.5,22C30.88,22 32,20.88 32,19.5L32,10.5ZM30,10.5C30,10.224 29.776,10 29.5,10L6.5,10C6.224,10 6,10.224 6,10.5L6,19.5C6,19.776 6.224,20 6.5,20L29.5,20C29.776,20 30,19.776 30,19.5L30,10.5Z'],
  ],
  search: [
    [1, 'M23.327,24.742C21.603,26.153 19.4,27 17,27C11.481,27 7,22.519 7,17C7,11.481 11.481,7 17,7C22.519,7 27,11.481 27,17C27,19.4 26.153,21.603 24.742,23.327L31.707,30.293L30.293,31.707L23.327,24.742ZM17,9C21.415,9 25,12.585 25,17C25,21.415 21.415,25 17,25C12.585,25 9,21.415 9,17C9,12.585 12.585,9 17,9Z'],
  ],
  checkmark: [
    [1, 'M12.205,17.377L19.822,7.222C20.484,6.339 21.529,5.949 22.412,6.612C23.295,7.274 23.262,8.317 22.6,9.2L13.6,21.2C13.252,21.664 12.814,21.796 12.236,21.837C11.657,21.878 11.219,21.601 10.809,21.191L5.809,16.191C5.029,15.41 4.931,14.24 5.712,13.46C6.492,12.679 7.634,12.805 8.414,13.586L12.205,17.377Z'],
  ],
  mixed: [
    [1, 'M22,13.94C22,12.836 21.104,11.94 20,11.94L8,11.94C6.896,11.94 6,12.836 6,13.94C6,15.044 6.896,15.94 8,15.94L20,15.94C21.104,15.94 22,15.044 22,13.94Z'],
  ],
  nsChevron: [
    [1, 'M12.852,25.853C13.404,26.117 14.085,26.024 14.547,25.574L20.561,19.56C21.146,18.975 21.146,18.024 20.561,17.439C19.976,16.854 19.025,16.854 18.44,17.439L13.5,22.378L8.561,17.439C7.976,16.854 7.025,16.854 6.44,17.439C5.854,18.024 5.854,18.975 6.44,19.56L12.467,25.587L12.69,25.763L12.852,25.853ZM12.852,2.147C13.404,1.883 14.085,1.976 14.547,2.426L20.561,8.439C21.146,9.025 21.146,9.975 20.561,10.561C19.975,11.146 19.025,11.146 18.439,10.561L13.5,5.621L8.561,10.561C7.975,11.146 7.025,11.146 6.439,10.561C5.854,9.975 5.854,9.025 6.439,8.439L12.467,2.412L12.69,2.237L12.852,2.147Z'],
  ]
};

const sidebarDesktopFolderIcon = pathsIcon.bind(undefined, icons.sidebarDesktopFolder, 18);
const sidebarGenericFolderIcon = pathsIcon.bind(undefined, icons.sidebarGenericFolder, 18);
const sidebariCloudIcon = pathsIcon.bind(undefined, icons.sidebariCloud, 18);
const sidebarDocumentsFolderIcon = pathsIcon.bind(undefined, icons.sidebarDocumentsFolder, 18);
const sidebarDownloadsFolderIcon = pathsIcon.bind(undefined, icons.sidebarDownloadsFolder, 18);
const sidebarMoviesFolderIcon = pathsIcon.bind(undefined, icons.sidebarMoviesFolder, 18);
const caretRightIcon = pathsIcon.bind(undefined, icons.caretRight, 18);
const caretDownIcon = pathsIcon.bind(undefined, icons.caretDown, 18);
const iconsIcon = pathsIcon.bind(undefined, icons.icons, 18);
const listIcon = pathsIcon.bind(undefined, icons.list, 18);
const columnsIcon = pathsIcon.bind(undefined, icons.columns, 18);
const galleryIcon = pathsIcon.bind(undefined, icons.gallery, 18);
const searchIcon = pathsIcon.bind(undefined, icons.search, 18);
const checkmark = pathsIcon.bind(undefined, icons.checkmark, 14);
const mixedIcon = pathsIcon.bind(undefined, icons.mixed, 14);
const nsChevronIcon = (style: any) => pathsIcon(icons.nsChevron, 14, undefined, style);

function space(size: number) {
  const div = document.createElement('div');
  div.style.flex = `0 0 ${size}px`;
  return div;
}

const flexibleSpace = Div({ flex: '1 0 0' });

type Unmounter = () => void;
type Component = (p: Node) => Unmounter;

type Cleanup = () => void;
type Effect = (p: HTMLElement) => Cleanup;

const mounter = (n: Node): Component => r => mount(n, r);

const mount = (n: Node, r: Node) => {
  const p = r.parentNode!;
  p.replaceChild(n, r);
  return () => p.replaceChild(r, n);
}

function pathsIcon(paths: IconPath[], scale: number, onClick?: Handler<MouseEvent>, style?: any): Component {
  const scaleStr = `${scale}`;
  const viewBox = `0 0 ${scale * 2} ${scale * 2}`;
  return r => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttributeNS(null, 'fill', '#ffffff');
    svg.setAttributeNS(null, 'width', scaleStr);
    svg.setAttributeNS(null, 'height', scaleStr);
    svg.setAttributeNS(null, 'viewBox', viewBox);
    svg.setAttributeNS(null, 'fill-rule', 'evenodd');
    Object.keys(style || {}).forEach(k => {
      svg.style.setProperty(k, style[k]);
    });
    if (onClick) svg.addEventListener('click', onClick);
    paths.forEach(([o, p]) => {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttributeNS(null, 'd', p);
      path.setAttributeNS(null, 'fill-opacity', `${o}`);
      svg.appendChild(path);
    });
    return mount(svg, r);
  }
}

const radio = (active: Stream<boolean>) => Div({
  width: '16px',
  height: '16px',
  borderRadius: '8px',
  margin: '16px',
  backgroundImage: map(active, x => x ? 'linear-gradient(#3367df, #255cc6)' : 'linear-gradient(#505152, #6b6c6c)'),
  boxShadow: '0 .5px 1px -.5px rgba(255, 255, 255, .4) inset, 0 0 1px rgba(0, 0, 0, .4), 0 .5px 1px rgba(0, 0, 0, .4)',
}, [
  Div({
    visibility: map(active, x => x ? 'visible' : 'hidden'),
    transform: 'translate(5.25px, 5.25px)',
    width: '5.5px',
    height: '5.5px',
    backgroundColor: '#ffffff',
    borderRadius: '2.75px',
  }),
]);

// TODO:
//   State: on, mixed, off
//   Disabled: yes, no
//   Blurred: yes, no
//   Highlighted: yes, no
const checkbox = (state: Stream<boolean>) => Div({
  width: '14px',
  height: '14px',
  borderRadius: '3px',
  margin: '16px',
  backgroundImage: map(state, x => x ? 'linear-gradient(#3367df, #255cc6)' : 'linear-gradient(#505152, #6b6c6c)'),
  boxShadow: '0 1px 1px -1px rgba(255, 255, 255, .4) inset, 0 0 1px rgba(0, 0, 0, .4), 0 1px 1px rgba(0, 0, 0, .2)',
}, [
  enable(state, checkmark()),
]);

const select = (label: string) => Div({
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
  position: 'relative',
}, [
  label,
  Div({
    backgroundImage: 'linear-gradient(#3367df, #255cc6)',
    width: '16px',
    alignSelf: 'stretch',
  }, [
    nsChevronIcon({
      transform: 'translate(1px, 2.5px)',
    }),
  ]),
  gloss,
]);

const menu = (contents: Component[]) => Div({
  padding: '4px 0',
  backgroundColor: '#323334',
  borderRadius: '5px',
  boxShadow: '0 0 0 .5px rgba(0, 0, 0, .8), 0 10px 20px rgba(0, 0, 0, .3)',
  position: 'relative',
}, [
  ...contents,
  borderOverlay,
]);

const menuItem = (label: string, highlight: boolean = false) => Div({
  height: '19px',
  fontSize: '14px',
  backgroundColor: highlight ? '#336dd9' : 'transparent',
  color: '#ffffff',
  display: 'flex',
  alignItems: 'center',
  padding: '0 21px',
}, [span({}, [label])]);

const menuSeparator = () => Div({
  height: '2px',
  backgroundColor: 'rgba(255, 255, 255, .15)',
  margin: '5px 0',
});

// TODO: Use a CSS pseudo-element for this?
const gloss = Div({
  position: 'absolute',
  top: '0',
  left:'0',
  width: '100%',
  height: '100%',
  boxShadow: 'inset 0 1px 1px -1px rgba(255, 255, 255, .6)',
  borderRadius: 'inherit',
  pointerEvents: 'none',
});

const streamComp = (s: Stream<Component>): Component => r => {
  let old: Unmounter | undefined
  const unsub = s(x => {
    old && old();
    old = x(r);
  });
  return () => (unsub(), old && old());
};

// Component that does nothing.
const empty: Component = () => () => {};

const enable = (s: Stream<boolean>, c: Component) => streamComp(map(s, x => x ? c : empty));

function App(...contents: Component[]) {
  return Div({
    backgroundColor: '#000000',
    width: '100vw',
    height: '100vh',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  }, contents, [
    ContextMenu(menu([
      menuItem('New Folder'),
      menuSeparator(),
      menuItem('Get Info'),
      menuSeparator(),
      menuItem('Import from iPhone or iPad'),
      menuSeparator(),
      menuItem('Change Desktop Background...'),
      menuItem('Use Stacks'),
      menuItem('Sort By'),
      menuItem('Clean Up'),
      menuItem('Clean Up By'),
      menuItem('Show View Options'),
    ])),
  ]);
}

function Event<Type extends keyof HTMLElementEventMap>(
  t: Type,
  h: Handler<HTMLElementEventMap[Type]>,
): Effect {
  return n => {
    n.addEventListener(t, h);
    return () => n.removeEventListener(t, h);
  };
}

function ContextMenu(menu: Component): Effect {
  return Event('contextmenu', e => {
    e.preventDefault();
    e.stopPropagation();

    // TODO: Send event to global context menu layer, 
    console.log('Right click');
    
    showContextMenu(e, menu);
  });
}

function showContextMenu(e: MouseEvent, menu: Component) {

  // Create an overlay.
  const o = elem('div');
  o.style.position = 'absolute';
  o.style.top = '0';
  o.style.left = '0';
  o.style.width = '100%';
  o.style.height = '100%';
  document.body.appendChild(o);

  // Create a container.
  const c = elem('div');
  c.style.position = 'absolute';
  c.style.top = `${e.clientY - 3}px`;
  c.style.left = `${e.clientX}px`;
  c.style.transition = 'opacity .25s ease-in';
  document.body.appendChild(c);
  const u = render(menu, c);

  o.addEventListener('mousedown', () => {
    o.remove();
    c.style.opacity = '0';
    setTimeout(() => (u(), c.remove()), 250);
  });
}

type DragEndHandler = (e: MouseEvent) => void;
type DragMoveHandler = (e: MouseEvent) => DragEndHandler | void;
type DragHandler = (e: MouseEvent) => DragMoveHandler | void;

function useDrag(h: DragHandler): Handler<MouseEvent> {
  return e => {
    if (e.button != 0) return;
    e.preventDefault();
    const moveHandler = h(e);
    if (moveHandler) {
      let endHandler: DragEndHandler | void;
      const onMouseMove = (e: MouseEvent) => {
        endHandler = moveHandler(e);
      };
      const onMouseUp = (e: MouseEvent) => {
        if (endHandler) endHandler(e);
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      }
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    }
  };
}

// I want a stream that produces deltas to add to x and y.

function useRelativeDrag(): [Stream<number>, Stream<number>, Handler<MouseEvent>] {
  const [dx, emitDx] = useStream<number>();
  const [dy, emitDy] = useStream<number>();

  const onMouseDown = useDrag(e => {
    let x = e.clientX;
    let y = e.clientY;
    return e => {
      emitDx(e.clientX - x);
      emitDy(e.clientY - y);
      x = e.clientX;
      y = e.clientY;
    };
  });

  return [dx, dy, onMouseDown];
};


function useHorizontalRelativeDrag(): [Stream<number>, Handler<MouseEvent>] {
  const [dx, emitDx] = useStream<number>();

  const onMouseDown = useDrag(e => {
    let x = e.clientX;
    return e => {
      emitDx(e.clientX - x);
      x = e.clientX;
    };
  });

  return [dx, onMouseDown];
};


function useVerticalRelativeDrag(): [Stream<number>, Handler<MouseEvent>] {
  const [dy, emitDy] = useStream<number>();

  const onMouseDown = useDrag(e => {
    let y = e.clientY;
    return e => {
      emitDy(e.clientY - y);
      y = e.clientY;
    };
  });

  return [dy, onMouseDown];
};

/**
 * I want a "frame stream".
 *
 * The output should be the frame stream. The input should be all the ways to
 * modify the frame. Let's try just returning 9 drag handlers.
 */


function useFrame(init: Frame): [Stream<Frame>, FrameHandles] {
  const [dX, dY, middle] = useRelativeDrag();
  const [dLeft, left] = useHorizontalRelativeDrag();
  const [dRight, right] = useHorizontalRelativeDrag();
  const [dTop, top] = useVerticalRelativeDrag();
  const [dBottom, bottom] = useVerticalRelativeDrag();
  const [dTopLeftX, dTopLeftY, topLeft] = useRelativeDrag();
  const [dTopRightX, dTopRightY, topRight] = useRelativeDrag();
  const [dBottomLeftX, dBottomLeftY, bottomLeft] = useRelativeDrag();
  const [dBottomRightX, dBottomRightY, bottomRight] = useRelativeDrag();

  const negate = (s: Stream<number>) => map(s, x => -x);

  const dAnyLeft = merge(dLeft, dTopLeftX, dBottomLeftX);
  const dAnyRight = merge(dRight, dTopRightX, dBottomRightX);
  const dAnyTop = merge(dTop, dTopLeftY, dTopRightY);
  const dAnyBottom = merge(dBottom, dBottomLeftY, dBottomRightY);
  const dx = merge(dX, dAnyLeft);
  const dy = merge(dY, dAnyTop);
  const dw = merge(dAnyRight, negate(dAnyLeft));
  const dh = merge(dAnyBottom, negate(dAnyTop));

  let c = {...init};
  const [frame, setFrame] = useState<Frame>(c);
  dx(d => (c.x += d, setFrame(c)));
  dy(d => (c.y += d, setFrame(c)));
  dw(d => (c.width += d, setFrame(c)));
  dh(d => (c.height += d, setFrame(c)));

  return [frame, {top, bottom, left, right, topLeft, topRight, bottomLeft, bottomRight, middle}];
}

const [frame, handles] = useFrame({x: 100, y: 200, width: 500, height: 400});
const [frame2, handles2] = useFrame({x: 200, y: 100, width: 500, height: 400});
const [expanded, setExpanded] = useState(false);

const app = App(finder(frame, expanded, setExpanded, handles), finder(frame2, expanded, setExpanded, handles2));
render(app, document.body);
