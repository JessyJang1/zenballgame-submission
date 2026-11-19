import { moonGateCollision } from './assets/moonGateCollision.ts'

// World placement and the stone opening shared by the visible gate and Rapier.
export const MOON_GATE = {
  x: -2.55, y: 14.55, z: -64.7,
  radius: .72, sensorRadius: .46, depth: 1.1, boreHalfDepth: .36, outerRadius: 1.235,
} as const

// Cross-section ordered from the front lip through the bore around the masonry.
export const MOON_GATE_RIM_PROFILE = [
  [.81, .55], [MOON_GATE.radius, MOON_GATE.boreHalfDepth], [MOON_GATE.radius, -MOON_GATE.boreHalfDepth], [.81, -.55],
  [1.17, -.55], [MOON_GATE.outerRadius, -.43], [MOON_GATE.outerRadius, .43], [1.17, .55],
] as const

export const moonGateSillRise = Math.max(0, Math.min(.23, moonGateCollision.bounds.min[1] + 1.27))

// Interior proxies of the chamfered footings and the shoulders that support the rim.
export const MOON_GATE_FOOTINGS = [
  { x: 0, y: -2.39, halfWidth: 2.15, halfHeight: .16, halfDepth: .63 },
  { x: 0, y: -1.98, halfWidth: 1.89, halfHeight: .25, halfDepth: .55 },
  { x: 0, y: -1.48 + moonGateSillRise / 2, halfWidth: 1.74, halfHeight: .25 + moonGateSillRise / 2, halfDepth: .47 },
  { x: -1.6, y: -1.08, halfWidth: .40, halfHeight: .61, halfDepth: .43 },
  { x: 1.6, y: -1.08, halfWidth: .40, halfHeight: .61, halfDepth: .43 },
] as const

const masonrySegments = 48

export function moonGateColliderMesh() {
  if (moonGateCollision) {
    return {
      vertices: new Float32Array(moonGateCollision.vertices),
      indices: new Uint32Array(moonGateCollision.indices),
    }
  }

  const points: number[] = []
  const indices: number[] = []
  const rows = MOON_GATE_RIM_PROFILE.length
  for (let i = 0; i < masonrySegments; i++) {
    const angle = i * Math.PI * 2 / masonrySegments
    for (const [radius, z] of MOON_GATE_RIM_PROFILE) {
      points.push(radius * Math.cos(angle), radius * Math.sin(angle), z)
    }
    for (let j = 0; j < rows; j++) {
      const a = i * rows + j
      const b = i * rows + (j + 1) % rows
      const c = (i + 1) % masonrySegments * rows + j
      const d = (i + 1) % masonrySegments * rows + (j + 1) % rows
      indices.push(a, c, b, c, d, b)
    }
  }
  return { vertices: new Float32Array(points), indices: new Uint32Array(indices) }
}
