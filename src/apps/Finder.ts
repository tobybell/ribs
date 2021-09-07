import { Component, mount } from '../component';
import { contextMenu } from '../context-menu';
import { checkbox, radio, select, slider } from '../controls';
import { divr, style, children } from '../div';
import { formSection, formSeparator } from '../form';
import { caretDownIcon, caretRightIcon, sidebarDesktopFolderIcon, sidebarDocumentsFolderIcon, sidebarGenericFolderIcon, sidebariCloudIcon, sidebarMoviesFolderIcon } from '../icons';
import { menu, menuItem, menuSeparator } from '../menu';
import { oneHot } from '../one-hot';
import { state, Sync } from '../state';
import { Handler, just, map, Stream, latest } from '../stream-stuff';
import { toolbarBar } from '../toolbar-bar';
import { win, windowPane } from '../window-stuff';

function space(size: number) {
  const div = document.createElement('div');
  div.style.flex = `0 0 ${size}px`;
  return div;
}

function section(title: string, items: Component[]) {
  return divr(style({
    padding: '6px 0',
    overflow: 'auto',
  }), children(
    sidebarHeading(title),
    ...items,
  ));
}

function sidebarHeading(name: string) {
  return divr(style({
    display: 'flex',
    alignItems: 'center',
    height: '17px',
    paddingLeft: '9px',
    color: 'rgba(255, 255, 255, 0.62)',
    fontSize: '11px',
  }), children(
    name,
  ));
}

function item({ title, icon, level = 0, active = false, expanded = just(false), onExpand, onCollapse, children: kids }: {
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
  const hasChildren = kids && kids.length > 0;
  const openCaret = caretDownIcon({ onClick: onCollapse });
  const closedCaret = caretRightIcon({ onClick: onExpand });
  const carets: Stream<Component> = map(expanded, x => hasChildren
    ? x ? openCaret : closedCaret : r => r(space(18)));

  return divr(style({
    paddingTop: '2px',
    boxSizing: 'border-box',
  }), children(
    divr(style({
      display: 'flex',
      alignItems: 'center',
      height: '24px',
      paddingLeft: indent,
      color: '#ffffff',
      backgroundColor: active ? 'rgba(255, 255, 255, .17)' : 'transparent',
    }), children(
      latest(carets),
      icon,
      space(5),
      title,
    )),
    divr(style({
      overflow: 'hidden',
      transition: 'height .2s cubic-bezier(.4,1,.75,.9)',
      height: map(expanded, x => x ? 'auto' : '0'),
    }), kids && children(...kids)),
  ));
}

function sidebar(expanded: Sync<boolean>) {
  return divr(style({
    backgroundColor: '#29282a',
    width: '150px',
    borderRight: '1px solid #000000',
    overflow: 'scroll',
  }), children(
    section('iCloud', [
      item({
        title: 'iCloud Drive',
        icon: sidebariCloudIcon(),
        active: true,
        expanded: expanded.stream,
        onExpand: () => expanded.set(true),
        onCollapse: () => expanded.set(false),
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
  ));
}

export const Finder = win(c => {
  const expanded = state(false);
  const which = state(0);
  const a = oneHot(which.stream);
  const content = windowPane([
    toolbarBar(c.handles.middle, c.close),
    divr(style({
      flex: '1 0 0',
      display: 'flex',
      alignItems: 'stretch',
    }), children(
      sidebar(expanded),
      divr(style({ flex: '1 0 0' }), children(
        formSection(radio(a(0), () => which.set(0))),
        formSection(radio(a(1), () => which.set(1))),
        formSection(radio(a(2), () => which.set(2))),
        formSeparator(),
        formSection(checkbox(state(false))),
        formSection(checkbox(state(true))),
        select(),
        slider(state(.5)),
      )),
    )),
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
