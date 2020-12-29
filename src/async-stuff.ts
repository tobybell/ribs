
export function wait(dt: number) {
  return new Promise(r => setTimeout(r, dt * 1000));
}
