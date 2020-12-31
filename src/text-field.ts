import { Component, inputType, inputValue, domEvent } from "./component";
import { upDownButton } from "./controls";
import { div, rawInput, style } from "./div";
import { focusHighlight } from "./focus-stuff";
import { Thunk } from "./function-stuff";
import { row, space } from "./layout";
import { Stream, state } from "./stream-stuff";

export function textField(value: Stream<string>, size = 13): Component {
  const [highlight, setHighlight] = state(false);
  return div({
    boxSizing: "border-box",
    padding: '0 4px',
    height: `${size + 6}px`,
    width: '100%',
    backgroundColor: '#404040',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'start',
    color: '#ffffff',
    borderRadius: '.5px',
    boxShadow: "0 2px 2px -2px rgba(0, 0, 0, .3) inset, 0 -.5px 0 0 rgba(255, 255, 255, .08) inset, 0 0 0 .5px rgba(255, 255, 255, .2)",
  }, [
    rawInput(
      style({
        background: "none",
        border: "none",
        outline: "none",
        color: "#ffffff",
        fontSize: `${size}px`,
        padding: "0",
        margin: "0",
        width: "100%",
      }),
      inputType("text"),
      inputValue(value),
      domEvent("focus", () => setHighlight(true)),
      domEvent("blur", () => setHighlight(false)),
    ),
  ], [
    focusHighlight(highlight),
  ]);
}

export function upDownField(value: Stream<string>, onUp: Thunk, onDown: Thunk) {
  return row([
    div({ flex: "1 0 50px" }, [textField(value, 12)]),
    space(5),
    div({ flex: "0 0 11px" }, [upDownButton(onUp, onDown)]),
  ]);
}