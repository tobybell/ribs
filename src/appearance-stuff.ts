import { children, divr, style } from './div';

export const borderOverlay = divr(
  style({
    position: 'absolute',
    top: '0',
    left: '0',
    width: '100%',
    height: '100%',
    borderRadius: '5px',
    boxShadow: '0 .5px 0 rgba(255, 255, 255, .2) inset',
    pointerEvents: 'none',
  }),
  children(
    divr(style({
      width: '100%',
      height: '100%',
      border: '1px solid rgba(255, 255, 255, .15)',
      borderRadius: '5px',
      boxSizing: 'border-box',
    })),
  ),
);
