/**
 * Simulations list. A window app for viewing simulations on the server.
 */

import { children, div, span, style, text } from "./div";
import { SimpleWindow } from "./simple-window";
import { exists, noop } from "./function-stuff";
import { delayedComponent, Effect } from "./component";
import { Handler, just, state, Stream } from "./stream-stuff";
import { hoverEffect } from "./click-control";
import { Cleanup, Temporary } from "./temporary-stuff";
import { contextMenu } from "./context-menu";
import { menu, menuItem } from "./menu";

type Simulation = string;
type SimulationIndexRecord = {
  name: Simulation,
  date: Date,
};

const fetchSimulations = (() => {

  const extractSimulation =
    ({ name, type, mtime }: any): SimulationIndexRecord | undefined =>
      typeof name === "string" &&
      typeof mtime === "string" &&
      type === "directory" ? { name, date: new Date(mtime) } : undefined;

  return () => fetch("http://localhost").then(
  x => x.json()).then((x: any[]) => x.map(extractSimulation).filter(exists));
})();

const ifHover = <T extends Element>(f: Temporary<T>): Temporary<T> => n => {
  let u: Cleanup | undefined;
  const mouseEnter = () => (u && u(), u = f(n));
  const mouseLeave = () => (u && u(), u = undefined);
  n.addEventListener('mouseenter', mouseEnter);
  n.addEventListener('mouseleave', mouseLeave);
  return () => {
    n.removeEventListener('mouseenter', mouseEnter);
    n.removeEventListener('mouseleave', mouseLeave);
  };
};

const simulationRow = (openTimeline: Handler<Simulation>) => (s: SimulationIndexRecord) => div({
  fontWeight: "bold",
  color: "white",
  margin: "8px",
  borderRadius: "4px",
  padding: "4px 8px",
  cursor: "default",
}, [
  s.name,
  span(
    style({
      display: "block",
      fontWeight: "normal",
      fontSize: ".9em",
      marginTop: ".4em",
      zIndex: '1',
    }),
    children(s.date.toDateString()),
  ),
], [
  ifHover(n => {
    n.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
    return () => n.style.backgroundColor = "transparent";
  }),
  contextMenu(menu([
    menuItem({ label: 'Timeline', action: () => openTimeline(s.name) }),
    menuItem({ label: 'Output' }),
  ])),
]);

export const SimulationsList = ({
  onOpenTimeline,
}: {
  onOpenTimeline: Handler<Simulation>,
}) => SimpleWindow("Simulations", r => {
  const makeRow = simulationRow(onOpenTimeline);
  const sims = fetchSimulations();
  const rows = sims.then(x => div({}, x.map(makeRow)));
  sims.then(console.log);
  const [selectedSimulation, setSelectedSimulation] = state<Simulation | undefined>(undefined);

  return div({}, [delayedComponent(rows)])(r);
});
