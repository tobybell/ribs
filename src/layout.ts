import { children, divr, ElementThing, style } from './div';
import { Temporary } from './temporary-stuff';

export const row = (kids: ElementThing[], fx?: Temporary<HTMLDivElement>[]) => divr(style({
  display: 'flex',
  flexFlow: 'row nowrap',
  alignItems: 'center',
}), children(...kids), ...fx || []);

export const rowF = style({
  display: 'flex',
});

export const space = (size: number) => divr(style({ flex: `0 0 ${size}px` }));
