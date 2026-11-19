import { ShapeUtils, Vector2 } from 'three'

// The narrow near end is the actual landing of the folding bridge. All coordinates
// are local to the summit, with the flat playing surface at y = 0.
export const summitLedge = [
  [-2.76, 6.02], [2.76, 6.02], [3.93, 5.64], [5.46, 4.69],
  [6.1, 3.2], [6.49, 1.76], [5.8, .18], [5.62, -1.28],
  [5.22, -3.03], [5.67, -4.12], [4.09, -5.63], [2.28, -5.91],
  [.61, -6.07], [-1.04, -6.13], [-2.86, -5.95], [-4.34, -5.33],
  [-5.63, -3.93], [-6.53, -2.91], [-6.24, -1.25], [-6.69, .29],
  [-6.04, 2.21], [-5.35, 3.18], [-4.45, 4.96], [-3.57, 5.44],
] as const

export function summitSurfaceMesh() {
  const vertices = Float32Array.from(summitLedge.flatMap(([x, z]) => [x, 0, z]))
  const faces = ShapeUtils.triangulateShape(summitLedge.map(([x, z]) => new Vector2(x, -z)), [])
  const indices = Uint32Array.from(faces.flatMap(([a, b, c]) => {
    const [ax, az] = summitLedge[a], [bx, bz] = summitLedge[b], [cx, cz] = summitLedge[c]
    const up = (bz - az) * (cx - ax) - (bx - ax) * (cz - az) > 0
    return up ? [a, b, c] : [a, c, b]
  }))
  return { vertices, indices }
}
