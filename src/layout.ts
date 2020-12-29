import { div, ElementThing, style } from "./div";
import { Temporary } from "./temporary-stuff";

export const row = (children: ElementThing[], fx?: Temporary<HTMLDivElement>[]) => div({
  display: "flex",
  flexFlow: "row nowrap",
  alignItems: "center",
}, children, fx);

export const rowF = style({
  display: "flex",
});

export const space = (size: number) => div({ flex: `0 0 ${size}px` });
