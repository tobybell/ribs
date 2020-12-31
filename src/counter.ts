/** Pull stream that counts up from 0. */
export function counter() {
  let x = -1;
  return () => {
    x += 1;
    return x;
  };
}
