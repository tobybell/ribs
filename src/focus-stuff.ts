import { Effect, render } from "./component";
import { div } from "./div";
import { either, Stream } from "./stream-stuff";

// TODO: Add global responder system like macOS.

export const focusHighlight = (
    enable: Stream<boolean>,
    inheritCorners = true,
): Effect => n => render(div({
  position: "absolute",
  top: "0",
  left: "0",
  right: "0",
  bottom: "0",
  borderRadius: inheritCorners ? "inherit" : ".5px",
  transition: either(enable, ".25s", "0s"),
  boxShadow: either(enable, "0 0 0 3px #436f98", "0 0 0 12px transparent"),
  pointerEvents: "none",
}), n);
