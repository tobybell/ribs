import { Component } from "./component";
import { div, style } from "./div";
import { row, space } from "./layout";

export function formSection(input: Component) {
  return div({ padding: "4px 16px", }, [input]);
}

export function labeledSection(label: string, input: Component) {
  return row([
    div({ color: "white", flex: "0 0 60px" }, [label]),
    space(10),
    div({ color: "white", flex: "1 0 0" }, [input]),
  ], [
    style({
      padding: "6px 16px",
    }),
  ]);
}

export function submitSection(...items: Component[]) {
  return row(items, [
    style({
      padding: "8px 16px",
      justifyContent: "flex-end",
    }),
  ]);
}

export function formSeparator() {
  return div({
    padding: "12px 16px",
  }, [
    div({ background: "#464646", height: "1px", width: "100%" }),
  ]);
}
