import { noop } from "./function-stuff";

export type Cleanup = () => void;
export type Temporary<T = void> = (x: T) => Cleanup;

export function cleanup(...debts: Cleanup[]) {
  return () => debts.forEach(x => x());
}

// Temporary that does nothing.
export const empty: Temporary<any> = () => noop;
