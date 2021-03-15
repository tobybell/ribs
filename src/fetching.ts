
export function fetchLf32(url: string) {
  return fetch(url).then(
    r => r.arrayBuffer().then(b => new Float32Array(b)));
}

export function fetchLf64(url: string) {
  return fetch(url).then(
    r => r.arrayBuffer().then(b => new Float64Array(b)));
}