import { ArrayStream } from './array-stuff';
import { Component, render, renderAt } from './component';
import { Cleanup, cleanup, cleanupFrom, Temporary } from './temporary-stuff';

export function arrayChildren(c: ArrayStream<Component>): Temporary<Node> {
  return n => {
    const us: Cleanup[] = [];
    return cleanup(
      c({
        init(d) {
          us.forEach(u => u());
          const len = d.length;
          us.length = len;
          for (let i = 0; i < len; i += 1) {
            us[i] = render(d[i], n);
          }
        },
        insert(d, i) {
          us.splice(i, 0, renderAt(d[i], n, i));
        },
        remove(d, i) {
          const [u] = us.splice(i, 1);
          u();
        },
        move(d, i) {
          console.error('Move not supported!');
        },
      }),
      cleanupFrom(us),
    );
  };
}
