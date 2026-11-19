import { Path, Shape } from 'three'
import { COURT_TERRACE, LOTUS_BASIN } from './gardenLayout.ts'

// Both polygons are in court coordinates. The extruded XY face is rotated
// onto the XZ court, so positive world Z maps to negative shape Y.
export function courtSlabShape() {
  const outline = new Shape()
  const basin = new Path()
  for (const [path, points] of [[outline, COURT_TERRACE], [basin, LOTUS_BASIN]] as const) {
    points.forEach(([x, z], i) => i ? path.lineTo(x, -z) : path.moveTo(x, -z))
    path.closePath()
  }
  outline.holes.push(basin)
  return outline
}
