import { Suspense, useEffect, useMemo } from 'react'
import { useGLTF } from '@react-three/drei'
import { BufferGeometry, Float32BufferAttribute, MathUtils, Mesh, MeshStandardMaterial, type Texture } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { COURT_TERRACE } from './gardenLayout'
import { cutStone } from './assets/cutStone'
import { makeCaveStone } from './assets/caveStone'
import { ModelFallback } from './assets/AssetSlots'
import CourtVistaFalls from './CourtVistaFalls'

export const courtGalleryWings = [
  { side: -1, x: -11.8, y: .02, z: -4.9 },
  { side: 1, x: 9.95, y: -.25, z: -2.6 },
] as const


// Local X follows each aisle. Local Z measures the cut back into the hill.
const bedding = [
  [-1.55, -2.25], [-.68, -2.12], [-.24, -1.87], [.24, -1.44],
  [.57, .32], [.85, 3.57], [1.35, 3.88], [2.05, 3.78],
  [2.48, 3.88], [3.06, 3.74], [3.49, 3.85], [4.21, 3.68],
  [4.75, 3.56], [5.35, 3.31], [5.90, 2.71], [6.27, 2.47],
  [6.79, 2.32], [7.31, 2.51], [7.91, 2.88], [8.62, 3.50],
  [9.51, 4.04], [10.56, 4.21], [11.60, 4.91], [13.14, 5.31],
  [15.1, 6.63], [19.3, 8.1],
] as const

function escarpments() {
  const position: number[] = [], indices: number[] = []
  const divisions = 58
  for (const wing of courtGalleryWings) {
    const offset = position.length / 3
    for (const [row, [height, depth]] of bedding.entries()) {
      for (let col = 0; col <= divisions; col++) {
        const s = col / divisions
        const along = MathUtils.lerp(-15.7, 15.3, s)
        const split = Math.tanh(5 * Math.sin(along * .47 + wing.side * 1.6))
        const shelf = Math.sin(along * .53 + row * .43) * .18
        const fracture = Math.sin(along * 1.47 + row * .39) * Math.cos(along * 2.7 - row * .64)
        const coarse = Math.sin(along * .29 + wing.side) * .28
        const amplitude = row < 6 ? .40 : 1
        const end = Math.max(0, Math.abs(along) - 12.9)
        // Natural rock reaches over the cut roof only behind the front of
        // the carved parapet. The western beds pull back across the fresco.
        const lintel = MathUtils.smoothstep(height,4.85,6.30)*(1-MathUtils.smoothstep(height,7.03,10.02))
        const saddles = .5+.5*Math.sin(along*.46+wing.side*1.18)
        const endSeat = MathUtils.smoothstep(Math.abs(along),8,14)
        const apron = lintel*(.67+.58*saddles*saddles+.47*endSeat)
        const muralClearance = wing.side < 0 ? 2.4*MathUtils.smoothstep(height,6.14,8.21) : 0
        const chippedLedge = row > 12 ? .31*Math.sin(along*1.77+row*1.66) : 0
        const thickness = Math.max(row < 6 ? -4 : .69,
          depth-apron+(coarse+shelf+fracture*.21+split*.25+chippedLedge)*amplitude+end*.18+muralClearance)
        const elevation = height + (coarse*.66+shelf*.50-split*.26)*amplitude
        position.push(wing.x + wing.side*thickness, wing.y + elevation*.82, wing.z - wing.side*along)
        if (!row || !col) continue
        const corner = offset + row * (divisions + 1) + col
        const below = corner - divisions - 1
        indices.push(below - 1, corner - 1, corner, below - 1, corner, below)
      }
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position',new Float32BufferAttribute(position,3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function terraceFoot() {
  const pieces: BufferGeometry[] = []
  for (const [i, [ax, az]] of COURT_TERRACE.entries()) {
    const [bx, bz] = COURT_TERRACE[(i + 1) % COURT_TERRACE.length]
    const dx = bx - ax, dz = bz - az, length = Math.hypot(dx, dz)
    const direction = -Math.atan2(dz, dx)
    const count = Math.ceil(length / 1.32), gap = length / count
    for (const [course, y, wallDepth] of [[0,-.20,.44],[1,-.54,.69]] as const) {
      for (let part = 0; part <= count; part++) {
        const from = Math.max(0,(part - course * .46) * gap)
        const to = Math.min(length,(part + 1 - course * .46) * gap)
        if (to - from < .085) continue
        const t = (from + to) / (2 * length)
        const knuckle = .14 + course * .11 + .033 * Math.sin(part * 4.43 + i)
        pieces.push(cutStone(to - from - .023,.38,wallDepth,.032).rotateY(direction)
          .translate(ax + dx * t - dz / length * knuckle, y, az + dz * t + dx / length * knuckle))
      }
    }
  }
  // The broad bottom apron of each stair rests on the same construction as
  // the court. It bridges the outer channel only at the two existing stairs.
  for (const wing of courtGalleryWings) {
    for (const localX of [-7.8,7.8]) {
      const x = (wing.x + wing.side * 7.95) / 2, z = wing.z - wing.side * localX
      const width = Math.abs(wing.x - wing.side * 7.95) + .2
      for (let section = -1; section <= 1; section++) {
        pieces.push(cutStone(width,.42,1.17,.043).translate(x,-.235,z + section * 1.19))
        pieces.push(cutStone(width * .95,.17,1.151,.025).translate(x,-.08,z + section * 1.19))
      }
    }
  }
  // Short wing walls visibly join the gate landing and the court head.
  // Stop outside the central passage and below each existing stair nosing.
  for (const [side, rootX] of [[-1,-4.35],[1,2.62]] as const) {
    for (let tier=0; tier<3; tier++) {
      for (let block=0; block<3; block++) {
        const x=rootX+side*(.44+block*.88+tier*.06)
        pieces.push(cutStone(.854,.30,1.29,.042).rotateY(side*.18)
          .translate(x,.11+.30*tier,-13.55-block*.34-tier*.14))
      }
    }
  }
  const geometry = mergeGeometries(pieces)
  pieces.forEach(piece => piece.dispose())
  return geometry
}

const cliff = import.meta.env.BASE_URL + 'assets/models/third-party/polyhaven-rock-face-01.glb'

function WardScans({ vista }: { vista: boolean }) {
  const { scene } = useGLTF(cliff, false, false)
  const { geometry, material } = useMemo(() => {
    const mesh = scene.children.find((child): child is Mesh<BufferGeometry, MeshStandardMaterial> =>
      child instanceof Mesh && child.material instanceof MeshStandardMaterial)
    if (!mesh) throw new Error('Rock Face 01 is missing its rock mesh')
    const material = mesh.material.clone()
    material.color.set('#a4b2a1')
    material.normalScale.set(.71,.71)
    return { geometry: mesh.geometry, material }
  }, [scene])
  useEffect(() => () => material.dispose(),[material])
  return <group name="Rock Face 01 · quarry faces around the near gate" dispose={null}>
    <mesh geometry={geometry} material={material} position={[-6.23,-.23,-10.89]} scale={[.64,.82,.51]} rotation-y={.12} receiveShadow />
    <mesh geometry={geometry} material={material} position={[5.78,-.19,-10.96]} scale={[.73,.87,.72]} rotation-y={-.22} receiveShadow />
    <group visible={vista} name="High cliffs above the court">
      <mesh geometry={geometry} material={material} position={[-10.10,2.2,-39.94]} scale={[2.31,4.23,1.55]} rotation-y={.21} />
      <mesh geometry={geometry} material={material} position={[12.82,5.98,-54.89]} scale={[2.11,4.60,1.51]} rotation-y={-.44} />
      <CourtVistaFalls />
    </group>
  </group>
}

export default function CourtExcavation({ atlas, caveWall, vista }: { atlas: Texture; caveWall: MeshStandardMaterial; vista: boolean }) {
  const wall = useMemo(escarpments, [])
  const foot = useMemo(terraceFoot, [])
  const dressed = useMemo(() => makeCaveStone(atlas,'road','#6c7461'),[atlas])
  useEffect(() => () => { wall.dispose(); foot.dispose(); dressed.dispose() },[wall,foot,dressed])
  return <group name="Excavated cloister walls and continuous court footings">
    <mesh geometry={wall} material={caveWall} receiveShadow />
    <mesh geometry={foot} material={dressed} receiveShadow />
    <ModelFallback slot="court-ravine" fallback={null}>
      <Suspense fallback={null}><WardScans vista={vista} /></Suspense>
    </ModelFallback>
  </group>
}
