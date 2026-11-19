import { useEffect, useMemo } from 'react'
import {
  BufferGeometry, Color, ExtrudeGeometry, Float32BufferAttribute, MathUtils, Path, Shape,
  type MeshStandardMaterial,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { moonGateSillRise } from './moonGateLayout'

type Point = readonly [number, number]

function trace(path: Path, points: readonly Point[]) {
  for (const [index, [x, y]] of points.entries()) {
    if (index === 0) path.moveTo(x, y)
    else path.lineTo(x, y)
  }
  path.closePath()
}

function stoneBody(
  outline: readonly Point[], depth: number, bevel: number, aperture?: readonly Point[],
) {
  const face = new Shape()
  trace(face, outline)
  if (aperture) {
    const opening = new Path()
    trace(opening, aperture)
    face.holes.push(opening)
  }
  return new ExtrudeGeometry(face, {
    depth: depth - 2 * bevel, steps: 1, bevelSegments: 2,
    bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel,
  }).translate(0, 0, bevel)
}

function shadeStone(piece: BufferGeometry, tint: string) {
  const position = piece.getAttribute('position')
  const normal = piece.getAttribute('normal')
  const colors = new Float32Array(position.count * 3)
  const stone = new Color(tint)
  const edge = new Color('#bfab83')
  const shade = new Color()
  for (let index = 0; index < position.count; index++) {
    const y = position.getY(index)
    const x = position.getX(index)
    const z = position.getZ(index)
    const bedding = .5 + .5 * Math.sin(y * 27 + x * 1.9 + Math.cos(x * 2.8 + z) * .88)
    const wornEdge = Math.max(0, normal.getY(index)) * (.09 + bedding * .07)
    shade.copy(stone).lerp(edge, wornEdge).multiplyScalar(.87 + .17 * bedding)
    colors.set([shade.r, shade.g, shade.b], index * 3)
  }
  piece.setAttribute('color', new Float32BufferAttribute(colors, 3))
  piece.deleteAttribute('uv')
  return piece
}

const ridgeProfile: readonly Point[] = [
  [-1, .16], [-.76, .29], [-.59, .54], [-.45, .39], [-.21, .48], [.01, .87],
  [.24, .57], [.40, .52], [.56, .69], [.68, .42], [.87, .28], [1, .15],
]

function ridgeAt(x: number) {
  for (let index = 1; index < ridgeProfile.length; index++) {
    const [left, low] = ridgeProfile[index - 1]
    const [right, high] = ridgeProfile[index]
    if (x <= right) return MathUtils.lerp(low, high, (x - left) / (right - left))
  }
  return ridgeProfile.at(-1)![1]
}

function mountainRelief(y: number) {
  const across = 65
  const height = 27
  const positions: number[] = []
  const colors: number[] = []
  const indices: number[] = []
  const ground = new Color('#768476')
  const exposed = new Color('#c4ae80')
  const incision = new Color('#536053')
  const shade = new Color()
  for (let row = 0; row <= height; row++) {
    const v = row / height
    for (let col = 0; col <= across; col++) {
      const u = 2 * col / across - 1
      const ridge = ridgeAt(u)
      const upperCut = 1 - MathUtils.smoothstep(Math.abs(v - ridge), .018, .069)
      const echo = .19 + ridge * .39 + .037 * Math.sin(u * 12)
      const lowerCut = 1 - MathUtils.smoothstep(Math.abs(v - echo), .015, .055)
      const bottomFalloff = MathUtils.smoothstep(v, .01, .11)
      const edgeFalloff = 1 - MathUtils.smoothstep(Math.abs(u), .87, 1)
      const amplitude = edgeFalloff * bottomFalloff
      const handCut = (.81 + .19 * Math.sin(u * 43 + v * 6))
      const relief = (v < ridge ? .016 * amplitude : 0) - (.025 * upperCut + .015 * lowerCut) * amplitude
      const polished = MathUtils.smoothstep(v - ridge, -.096, -.032) *
        (1 - MathUtils.smoothstep(v - ridge, -.034, .025))
      positions.push(u * 1.092, y + (v - .5) * .334, .463 + relief)
      shade.copy(ground).lerp(exposed, amplitude * (.25 + .34 * polished * handCut))
      shade.lerp(incision, amplitude * (.77 * upperCut + .50 * lowerCut))
      colors.push(shade.r, shade.g, shade.b)
      if (row < height && col < across) {
        const a = row * (across + 1) + col
        const b = a + across + 1
        indices.push(a, a + 1, b, a + 1, b + 1, b)
      }
    }
  }
  const relief = new BufferGeometry()
  relief.setAttribute('position', new Float32BufferAttribute(positions, 3))
  relief.setAttribute('color', new Float32BufferAttribute(colors, 3))
  relief.setIndex(indices)
  relief.computeVertexNormals()
  const unindexed = relief.toNonIndexed()
  relief.dispose()
  return unindexed
}

function makePlinth() {
  const parts: BufferGeometry[] = []
  const slab = (x: number, y: number, width: number, depth: number, thickness: number, hue: string, nudge: number) => {
    const w = width / 2 - .034
    const front = depth / 2 - .034
    const outline = [
      [-w, -front + .11], [-w + .10, -front], [w - .14, -front + .017 * nudge],
      [w, -front + .11], [w - .028, front - .14], [w - .15, front - .016 * nudge],
      [-w + .12, front], [-w, front - .10],
    ] as const
    const piece = stoneBody(outline, thickness, .028)
      .rotateX(-Math.PI / 2).translate(x, y - thickness / 2, 0)
    parts.push(shadeStone(piece, hue))
  }
  // Use staggered joints and generously beveled caps while leaving the
  // supporting footprints in the original Rapier stone courses.
  slab(-1.46, -2.437, 1.45, 1.38, .258, '#7d826e', -1)
  slab(.014, -2.443, 1.464, 1.36, .246, '#82836d', 1)
  slab(1.462, -2.438, 1.42, 1.37, .256, '#777c69', 0)
  slab(0, -2.303, 4.23, 1.22, .14, '#979176', 1)
  slab(-.99, -2.006, 1.98, 1.14, .433, '#6b7769', 1)
  slab(.994, -2.007, 1.96, 1.16, .432, '#717d6c', -1)
  slab(0, -1.806, 3.79, 1.15, .13, '#92917b', 0)

  const top = -1.221 + moonGateSillRise
  const panelY = (top - 1.777) / 2
  const frontFace: readonly Point[] = [[-1.37,-1.746], [1.37,-1.746], [1.41,top - .11],
    [1.27,top - .061], [-1.25,top - .061], [-1.40,top - .133]]
  parts.push(shadeStone(stoneBody(frontFace, .93, .036).translate(0, 0, -.52), '#738071'))

  // A real open bezel exposes the cut relief and casts a small shadow into it.
  const panelOutline: readonly Point[] = [
    [-1.40,panelY - .245], [1.39,panelY - .245], [1.44,panelY - .197],
    [1.423,panelY + .198], [1.35,panelY + .245], [-1.36,panelY + .245], [-1.43,panelY + .17], [-1.45,panelY - .17],
  ]
  const inset: readonly Point[] = [
    [-1.125,panelY - .155], [1.119,panelY - .155], [1.172,panelY - .102], [1.172,panelY + .110],
    [1.105,panelY + .155], [-1.12,panelY + .155], [-1.176,panelY + .092], [-1.176,panelY - .105],
  ]
  parts.push(shadeStone(stoneBody(panelOutline, .115, .021, inset).translate(0,0,.407), '#7a8170'))
  parts.push(mountainRelief(panelY))
  slab(0, top - .045, 2.60, 1.07, .093, '#8a8b72', 1)

  for (const side of [-1, 1]) {
    const knee: readonly Point[] = [
      [1.15,-1.598], [1.99,-1.605], [1.99,-1.32], [1.94,-1.14], [1.82,-.87],
      [1.66,-.65], [1.55,-.60], [1.41,-.65], [1.31,-.82], [1.18,-1.035],
    ]
    const path = knee.map(([x, y]) => [x * side, y] as const)
    parts.push(shadeStone(stoneBody(path, .99, .044).translate(0,0,-.545), side > 0 ? '#616e60' : '#6b796a'))
    const fillet: readonly Point[] = [
      [1.21,-1.61], [1.96,-1.61], [1.96,-1.50], [1.86,-1.46], [1.31,-1.46], [1.22,-1.50],
    ]
    parts.push(shadeStone(stoneBody(fillet.map(([x, y]) => [x * side, y]), .414, .027)
      .translate(0,0,.071), '#8a876e'))
  }
  const geometry = mergeGeometries(parts)
  parts.forEach(piece => piece.dispose())
  if (!geometry) throw new Error('Moon gate plinth parts must have consistent attributes')
  return geometry
}

export default function MoonGatePlinth({ material }: { material: MeshStandardMaterial }) {
  const geometry = useMemo(makePlinth, [])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh name="Cut stone moon gate plinth and inset mineral relief" geometry={geometry} material={material} castShadow receiveShadow />
}
