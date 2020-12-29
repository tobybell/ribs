import { win } from "./window-stuff";
import { Handler, just, map, state, Stream } from "./stream-stuff";
import { oneHot } from "./one-hot";
import { checkbox, radio, select, slider } from "./controls";
import { windowPane } from "./window-stuff";
import { div } from "./div";
import { contextMenu } from "./context-menu";
import { menu, menuItem, menuSeparator } from "./menu";
import { toolbarBar } from "./toolbar-bar";
import { Component, mount, streamComp } from "./component";
import { caretDownIcon, caretRightIcon, sidebarDesktopFolderIcon, sidebarDocumentsFolderIcon, sidebarGenericFolderIcon, sidebariCloudIcon, sidebarMoviesFolderIcon } from "./icons";

function space(size: number) {
  const div = document.createElement('div');
  div.style.flex = `0 0 ${size}px`;
  return div;
}

function section(title: string, items: Component[]) {
  return div({
    padding: '6px 0',
    overflow: 'auto',
  }, [
    sidebarHeading(title),
    ...items,
  ]);
}

function sidebarHeading(name: string) {
  return div({
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
  const openCaret = caretDownIcon({ onClick: onCollapse });
  const closedCaret = caretRightIcon({ onClick: onExpand });
  const carets = map(expanded, x => hasChildren
    ? x ? openCaret : closedCaret : (r: Node) => mount(space(18), r));

  return div({
    paddingTop: '2px',
    boxSizing: 'border-box',
  }, [
    div({
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
    div({
      overflow: 'hidden',
      transition: 'height .2s cubic-bezier(.4,1,.75,.9)',
      height: map(expanded, x => x ? 'auto' : '0'),
    }, children),
  ]);
}

function sidebar(expanded: Stream<boolean>, setExpanded: any) {
  return div({
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

export const Finder = win(c => {
  const [expanded, setExpanded] = state(false);
  const [which, setWhich] = state(0);
  const a = oneHot(which);
  const content = windowPane([
    toolbarBar(c.handles.middle, c.close),
    div({
      flex: '1 0 0',
      display: 'flex',
      alignItems: 'stretch',
    }, [
      sidebar(expanded, setExpanded),
      div({ flex: '1 0 auto' }, [
        radio(a(0), () => setWhich(0)),
        radio(a(1), () => setWhich(1)),
        radio(a(2), () => setWhich(2)),
        checkbox(...state(false)),
        checkbox(...state(true)),
        select(),
        slider(...state(.5)),
      ]),
    ]),
  ], [
    contextMenu(menu([
      menuItem({ label: 'Back' }),
      menuItem({ label: 'Reload Page' }),
      menuSeparator,
      menuItem({ label: 'Show Page Source' }),
      menuItem({ label: 'Save Page As...' }),
      menuItem({ label: 'Print Page...' }),
      menuSeparator,
      menuItem({ label: 'Inspect Element' }),
    ])),
  ]);
  return content;
});
