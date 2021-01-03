
export function bsearch<T>(a: T[], x: T, cmp: (a: T, b: T) => number): number {
  let lo = 0;
  let hi = a.length;
  while (hi > lo) {
    const mid = Math.floor((lo + hi) / 2);
    const t = a[mid];
    const c = cmp(x, t);
    if (c < 0) {
      hi = mid;
    } else if (c > 0) {
      lo = mid + 1;
    } else {
      lo = hi = mid;
    }
  }
  return lo;
}

export function binsert<T>(a: T[], x: T, cmp: (a: T, b: T) => number): number {
  let lo = 0;
  let hi = a.length;
  while (hi > lo) {
    const mid = Math.floor((lo + hi) / 2);
    const t = a[mid];
    const c = cmp(x, t);
    if (c < 0) {
      hi = mid;
    } else if (c > 0) {
      lo = mid + 1;
    } else {
      lo = hi = mid;
    }
  }
  a.splice(lo, 0, x);
  return lo;
}
