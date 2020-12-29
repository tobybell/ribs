import { div } from "./div";

export const borderOverlay = div({
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
