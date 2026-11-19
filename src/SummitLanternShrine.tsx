import { useEffect, useMemo } from 'react'
import { BoxGeometry, BufferGeometry, DoubleSide, ExtrudeGeometry, Float32BufferAttribute, Shape, type Texture } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { AssetSlot } from './assets/AssetSlots'
import { makeCaveStone } from './assets/caveStone'

const roofFit = [5.88, 1.21, 2.64] as const

function merged(parts: BufferGeometry[]) {
  const geometry = mergeGeometries(parts)
  parts.forEach(part => part.dispose())
  return geometry
}

function frame(halfWidth: number, arch: number, spring: number, top: number) {
  const shape = new Shape()
  shape.moveTo(-halfWidth, 0)
  shape.lineTo(-arch, 0)
  shape.lineTo(-arch, spring)
  shape.absarc(0, spring, arch, Math.PI, 0, true)
  shape.lineTo(arch, 0)
  shape.lineTo(halfWidth, 0)
  shape.lineTo(halfWidth, top)
  shape.lineTo(-halfWidth, top)
  shape.closePath()
  return shape
}

function buildShrine() {
  const wall = new ExtrudeGeometry(frame(2.38, .94, 1.26, 2.74), {
    depth: .88, bevelThickness: .035, bevelSize: .034, bevelSegments: 2, curveSegments: 20,
  }).translate(0, 0, -.44)
  const arch = new Shape()
  arch.moveTo(-1.05, .03)
  arch.lineTo(-1.05, 1.26)
  arch.absarc(0, 1.26, 1.05, Math.PI, 0, true)
  arch.lineTo(1.05, .03)
  arch.lineTo(.94, .03)
  arch.lineTo(.94, 1.26)
  arch.absarc(0, 1.26, .94, 0, Math.PI, false)
  arch.lineTo(-.94, .03)
  arch.closePath()
  const surround = new ExtrudeGeometry(arch, { depth: .06, bevelEnabled: false, curveSegments: 24 })
  const foundation = merged([
    ...[
      new BoxGeometry(5.80, .39, 2.18).translate(0, -.18, 0),
      new BoxGeometry(5.25, .13, 1.91).translate(0, .065, -.028),
      new BoxGeometry(3.05, .10, .42).translate(0, -.015, 1.14),
    ].map(box => {
      const faces = box.toNonIndexed()
      box.dispose()
      return faces
    }),
    surround.clone().translate(0, 0, .46),
    surround.translate(0, 0, -.52),
  ])
  const timber = merged([-.50, .50].flatMap(z => [
    new BoxGeometry(4.99, .17, .34).translate(0, 2.53, z),
    new BoxGeometry(5.31, .12, .54).translate(0, 2.70, z),
    ...[-2.19, -1.22, 1.22, 2.19].flatMap(x => [
      new BoxGeometry(.16, 2.35, .21).translate(x, 1.28, z),
      new BoxGeometry(.36, .14, .38).translate(x, 2.39, z),
      new BoxGeometry(.54, .11, .46).translate(x, 2.56, z),
    ]),
  ]))
  const positions: number[] = [], indices: number[] = []
  const rows = 8, cols = 20
  for (let row = 0; row <= rows; row++) {
    const v = row / rows * 2 - 1
    for (let col = 0; col <= cols; col++) {
      const u = col / cols * 2 - 1
      const wing = Math.abs(u) ** 6
      const slope = Math.abs(v)
      positions.push(u * (2.48 + .43 * slope), .95 - .83 * slope + .30 * wing, v * (1.20 + .12 * wing))
      if (row && col) {
        const k = row * (cols + 1) + col
        indices.push(k - cols - 2, k, k - 1, k - cols - 2, k - cols - 1, k)
      }
    }
  }
  const fallbackRoof = new BufferGeometry()
  fallbackRoof.setAttribute('position', new Float32BufferAttribute(positions, 3))
  fallbackRoof.setIndex(indices)
  fallbackRoof.computeVertexNormals()
  return { wall, foundation, timber, fallbackRoof }
}

export default function SummitLanternShrine({ atlas }: { atlas: Texture }) {
  const geometry = useMemo(buildShrine, [])
  const plaster = useMemo(() => makeCaveStone(atlas, 'bank', '#956c58'), [atlas])
  const stone = useMemo(() => makeCaveStone(atlas, 'road', '#8a8270'), [atlas])
  useEffect(() => () => Object.values(geometry).forEach(mesh => mesh?.dispose()), [geometry])
  useEffect(() => () => { plaster.dispose(); stone.dispose() }, [plaster, stone])

  return <group name="Upper pass mineral shrine">
    <mesh geometry={geometry.wall} material={plaster} receiveShadow />
    {geometry.foundation && <mesh geometry={geometry.foundation} material={stone} receiveShadow />}
    {geometry.timber && <mesh geometry={geometry.timber} receiveShadow>
      <meshStandardMaterial color="#594337" roughness={.9} />
    </mesh>}
    <group position-y={2.72}>
      <AssetSlot slot="courtyardRoof" fit={roofFit}>
        <mesh geometry={geometry.fallbackRoof}>
          <meshStandardMaterial color="#385251" side={DoubleSide} roughness={.83} />
        </mesh>
      </AssetSlot>
    </group>
  </group>
}
