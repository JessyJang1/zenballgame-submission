import { BufferGeometry, Color, Float32BufferAttribute } from 'three'
import { COURT_TERRACE, LOTUS_BASIN } from '../gardenLayout.ts'

type Point = readonly [number, number]

function clipPolygon(subject: Point[], edge: Point, next: Point, winding: number) {
  const result: Point[] = []
  const distance = ([x,z]: Point) => winding * ((next[0]-edge[0])*(z-edge[1]) - (next[1]-edge[1])*(x-edge[0]))
  let previous = subject[subject.length-1]
  for (const current of subject) {
    const from = distance(previous), to = distance(current)
    if ((from < 0) !== (to < 0)) {
      const at = from / (from - to)
      result.push([previous[0]+(current[0]-previous[0])*at,previous[1]+(current[1]-previous[1])*at])
    }
    if (to >= 0) result.push(current)
    previous = current
  }
  return result
}

// The shallow stone caps sit within the existing court outline and leave the
// original basin untouched. Only the dressings are raised by three millimetres.
export function courtPaving() {
  const positions: number[] = [], colors: number[] = [], indices: number[] = []
  const mineral = new Color(), worn = new Color('#e9e1cd'), basalt = new Color('#b9c6b9')
  const basinX = LOTUS_BASIN.map(([x]) => x), basinZ = LOTUS_BASIN.map(([,z]) => z)
  const basin = [Math.min(...basinX), Math.max(...basinX), Math.min(...basinZ), Math.max(...basinZ)]
  const clockwise = -1
  for (let row = -8; row <= 7; row++) {
    const stagger = Math.abs(row % 2) * .48
    for (let col = -5; col <= 5; col++) {
      const variation = Math.sin(row * 13.01 + col * 7.71)
      const left = col * 1.95 - stagger + .019, right = left + 1.91
      const back = row * 1.54 + .018, front = back + 1.502
      if (left < basin[1] && right > basin[0] && back < basin[3] && front > basin[2]) continue
      const nick = .075 + .039 * variation
      let points: Point[] = [
        [left+nick,back],[right-.062,back],[right,back+.062],[right,front-.07],
        [right-.07,front],[left+nick,front],[left,front-nick],[left,back+nick],
      ]
      for (const [index, edge] of COURT_TERRACE.entries()) {
        if (!points.length) break
        points = clipPolygon(points,edge,COURT_TERRACE[(index+1)%COURT_TERRACE.length],clockwise)
      }
      if (points.length < 3) continue
      const center = points.reduce(([x,z],[dx,dz]) => [x+dx/points.length,z+dz/points.length],[0,0])
      const offset = positions.length / 3
      mineral.copy(basalt).lerp(worn,.43+.40*variation)
      positions.push(center[0],.003,center[1])
      colors.push(mineral.r,mineral.g,mineral.b)
      for (const [x,z] of points) {
        positions.push(x,.0013,z)
        colors.push(mineral.r*.88,mineral.g*.88,mineral.b*.88)
      }
      for (let side=0;side<points.length;side++) indices.push(offset,offset+1+(side+1)%points.length,offset+1+side)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions,3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors,3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}
