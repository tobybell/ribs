import { Component } from './component';
import { divr, children, style } from './div';
import { row, space } from './layout';

export function formSection(input: Component) {
  return divr(style({ padding: '4px 16px', }), children(input));
}

export function labeledSection(label: string, input: Component) {
  return row([
    divr(style({ color: 'white', flex: '0 0 60px' }), children(label)),
    space(10),
    divr(style({ color: 'white', flex: '1 0 0' }), children(input)),
  ], [
    style({
      padding: '6px 16px',
    }),
  ]);
}

export function submitSection(...items: Component[]) {
  return row(items, [
    style({
      padding: '8px 16px',
      justifyContent: 'flex-end',
    }),
  ]);
}

export function formSeparator() {
  return divr(style({
    padding: '12px 16px',
  }), children(
    divr(style({ background: '#464646', height: '1px', width: '100%' })),
  ));
}
