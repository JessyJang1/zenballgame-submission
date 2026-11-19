import { useEffect, useMemo } from 'react'
import { useSceneTexture } from './assets/useSceneTexture'
import { BufferAttribute, BufferGeometry, Color, SRGBColorSpace } from 'three'
import { makeCaveStone } from './assets/caveStone'
import { buildSummitFlags } from './assets/summitFlags'
import { SUMMIT } from './paintingLayout'
import { summitLedge, summitSurfaceMesh } from './summitTerraceLayout'

function mineralMesh(positions: number[] | Float32Array, indices: number[] | Uint32Array, colors: number[]) {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(Float32Array.from(positions), 3))
  geometry.setAttribute('color', new BufferAttribute(Float32Array.from(colors), 3))
  geometry.setIndex(new BufferAttribute(Uint32Array.from(indices), 1))
  geometry.computeVertexNormals()
  return geometry
}

function buildLedge() {
  const surface = summitSurfaceMesh()
  const positions = Array.from(surface.vertices)
  const indices = Array.from(surface.indices)
  const colors: number[] = []
  const crown = new Color('#8b9481')
  const strata = ['#8b8970', '#7e7b63', '#575e4a', '#727967', '#45554a', '#34443d'].map(color => new Color(color))
  const deposits = [0, -.23, -.92, -1.79, -3.04, -5.6]
  summitLedge.forEach(([x, z]) => colors.push(...crown.clone().multiplyScalar(.89 + .15 * Math.sin(x * .22 + z * .65) ** 2).toArray()))
  const start = positions.length / 3
  const outline = summitLedge.flatMap(([x,z],edge) => {
    const [nextX,nextZ]=summitLedge[(edge+1)%summitLedge.length]
    return [0,1/3,2/3].map(t => [x+(nextX-x)*t,z+(nextZ-z)*t])
  })
  const count = outline.length
  deposits.forEach((depth, row) => {
    outline.forEach(([x, z], edge) => {
      const seam = Math.sin(x * 1.62 + z * .45 + row * .71)
      const flare = row === 0 ? 1 : 1 + [.0, .023, -.016, .065, .11, .14][row] + seam * .027
      const heave = row === 0 ? 0 : .29 * Math.cos(x * .52 + z * .31) + .11 * seam
      const approach = Math.max(0,z/6.02)
      const fall = row / (deposits.length - 1)
      // The landing lip is a bed that rolls back underneath the approach,
      // leaving the outer cliff layers to meet the lower mountain bank.
      positions.push(x * flare + .14 * row, depth + heave, z * flare - 2.1 * approach * fall)
      const shade = strata[row].clone().multiplyScalar(.79 + .22 * seam ** 2)
      colors.push(...shade.toArray())
      if (row > 0) {
        const a = start + (row - 1) * count + edge
        const b = start + (row - 1) * count + (edge + 1) % count
        indices.push(a, a + count, b, b, a + count, b + count)
      }
    })
  })
  return mineralMesh(positions, indices, colors)
}

export default function SummitTerrace() {
  const atlas = useSceneTexture(import.meta.env.BASE_URL + 'assets/art/stone-prologue-card.png')
  atlas.colorSpace = SRGBColorSpace
  const { ledge, paving, stone, dressed } = useMemo(() => {
    const stone = makeCaveStone(atlas, 'bank', '#d2cfb7')
    stone.vertexColors = true
    const dressed = makeCaveStone(atlas, 'road', '#f0e7ce')
    dressed.vertexColors = true
    return { ledge: buildLedge(), paving: buildSummitFlags(), stone, dressed }
  }, [atlas])
  useEffect(() => () => { ledge.dispose(); paving.dispose(); stone.dispose(); dressed.dispose() }, [ledge, paving, stone, dressed])
  return <group position={[SUMMIT.x, SUMMIT.y, SUMMIT.z]} name="Sculpted summit ledge">
    <mesh geometry={ledge} material={stone} receiveShadow />
    <mesh geometry={paving} material={dressed} receiveShadow />
  </group>
}
