import { BufferGeometry, Color, Float32BufferAttribute } from 'three'
import { summitLedge } from '../summitTerraceLayout.ts'

type Point = readonly [number, number]

const stoneColors = ['#779184', '#8b9887', '#90977f', '#a89877', '#b2a079', '#818d7e'].map(value => new Color(value))
const courseEdges = [5.96, 5.06, 3.96, 2.97, 1.76, .70, -.29, -1.44, -2.49, -3.68, -4.63, -5.62]

function grain(seed: number) {
  const value = Math.sin(seed * 57.31 + 4.61) * 43758.5453
  return value - Math.floor(value)
}

function terraceSpan(z: number) {
  const crossings: number[] = []
  for (let edge = 0; edge < summitLedge.length; edge++) {
    const [x1, z1] = summitLedge[edge]
    const [x2, z2] = summitLedge[(edge + 1) % summitLedge.length]
    if ((z >= z1 && z < z2) || (z >= z2 && z < z1)) {
      crossings.push(x1 + (x2 - x1) * (z - z1) / (z2 - z1))
    }
  }
  return [Math.min(...crossings), Math.max(...crossings)]
}

// Shallow stone caps key into the terrace. The original level deck remains the
// collision surface and the unpaved rock remains visible along the cliff edge.
export function buildSummitFlags() {
  const positions: number[] = []
  const colors: number[] = []

  for (let row = 0; row < courseEdges.length - 1; row++) {
    const near = courseEdges[row], far = courseEdges[row + 1]
    const spans = [near, (near + far) * .5, far].map(terraceSpan)
    const left = Math.max(...spans.map(span => span[0])) + .35 + .43 * grain(row * 9)
    const right = Math.min(...spans.map(span => span[1])) - .35 - .40 * grain(row * 7)
    const count = Math.round((right - left) / 1.48)
    const widths = Array.from({ length: count }, (_, column) => .68 + .68 * grain(row * 71 + column * 9 + 3))
    const run = widths.reduce((total, width) => total + width, 0)
    let start = left

    for (const [column, proportion] of widths.entries()) {
      const seed = row * 123 + column * 17 + 1
      const end = start + (right - left) * proportion / run
      const x0 = start + .017 + .017 * grain(seed + 1)
      const x1 = end - .018 - .018 * grain(seed + 2)
      const z0 = far + .018 + .047 * grain(seed + 5)
      const z1 = near - .019 - .042 * grain(seed + 6)
      start = end

      const width = x1 - x0
      const depth = z1 - z0
      const chip = Math.min(width, depth) * (.096 + .085 * grain(seed + 7))
      const outline: Point[] = [
        [x0, z0 + chip], [x0 + chip * 1.28, z0], [x1 - chip, z0 + chip * .16],
        [x1, z0 + chip * .92], [x1 - chip * .12, z1 - chip * 1.31], [x1 - chip * 1.44, z1],
        [x0 + chip, z1 - chip * .09], [x0 + chip * .15, z1 - chip * .75],
      ]
      const x = (x0 + x1) * .5
      const z = (z0 + z1) * .5
      const stone = stoneColors[Math.floor(grain(seed + 16) * stoneColors.length)]
      const crown = .013 + .0045 * grain(seed + 8)
      const bevel = .051 + .031 * grain(seed + 10)

      function rim(point: Point, fraction: number): Point {
        return [point[0] + (x - point[0]) * fraction, point[1] + (z - point[1]) * fraction]
      }

      function vertex(point: Point, level: number, shade: number) {
        positions.push(point[0], level, point[1])
        colors.push(stone.r * shade, stone.g * shade, stone.b * shade)
      }

      for (const [edge, a] of outline.entries()) {
        const next = (edge + 1) % outline.length
        const b = outline[next]
        const capA = rim(a, bevel), capB = rim(b, bevel)
        const shadeA = .89 + .17 * grain(seed + edge * .21)
        const shadeB = .89 + .17 * grain(seed + next * .21)
        const levelA = crown - .006 * grain(seed + edge)
        const levelB = crown - .006 * grain(seed + next)

        // Top relief is anchored by wide fractured facets and a low chamfer.
        vertex([x, z], crown + .002, 1.02)
        vertex(capB, levelB, shadeB)
        vertex(capA, levelA, shadeA)
        vertex(capA, levelA, shadeA)
        vertex(capB, levelB, shadeB)
        vertex(b, -.004, .74)
        vertex(capA, levelA, shadeA)
        vertex(b, -.004, .74)
        vertex(a, -.004, .74)
      }
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}
