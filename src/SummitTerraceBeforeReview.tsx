import { useEffect, useMemo } from 'react'
import { useSceneTexture } from './assets/useSceneTexture'
import { BufferAttribute, BufferGeometry, Color, ExtrudeGeometry, MeshStandardMaterial, RepeatWrapping, Shape, SRGBColorSpace } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { makeCaveStone } from './assets/caveStone'
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

// Irregular coursing follows the bridge and turns towards the gate's stone base.
function buildPaving() {
  const slabs: ExtrudeGeometry[] = []
  const stones = ['#baab86', '#999b87', '#b9a784', '#8b9a8b', '#a3aa93', '#c0b18f'].map(value => new Color(value))
  for (let row = 0; row < 9; row++) {
    const z = 5.2 - row * 1.04
    const center = SUMMIT.tee.x - SUMMIT.x + (SUMMIT.aperture.x - SUMMIT.tee.x) * row / 8
    const count = row % 3 === 0 ? 4 : 5
    const width = row < 3 ? 1.41 : 1.17
    for (let column = 0; column < count; column++) {
      const seed = row * 7 + column
      const x = center + (column - (count - 1) / 2) * width + .16 * Math.sin(row * 1.24)
      const w = width / 2 - .036
      const h = .473
      const shape = new Shape()
      shape.moveTo(-w + .14, -h)
      shape.lineTo(w - .19 + .07 * Math.sin(seed), -h + .033)
      shape.lineTo(w, -h + .17)
      shape.lineTo(w - .025, h - .11)
      shape.lineTo(w - .16, h)
      shape.lineTo(-w + .11, h - .028)
      shape.lineTo(-w, h - .18)
      shape.lineTo(-w + .023, -h + .09)
      shape.closePath()

      const slab = new ExtrudeGeometry(shape, { depth: .05, bevelSize: .022, bevelThickness: .023, bevelSegments: 1 })
        .rotateX(-Math.PI / 2)
        .rotateY(.037 * Math.sin(seed * 1.6))
        .translate(x, -.047, z + .045 * Math.cos(seed * 1.6))
      const positions = slab.getAttribute('position')
      const colors = new Float32Array(positions.count * 3)
      const shade = stones[(row + column * 3) % stones.length]
      for (let i = 0; i < positions.count; i++) {
        const wear = .9 + .08 * Math.sin(positions.getX(i) * 5 + positions.getZ(i) * 8)
        colors.set([shade.r * wear, shade.g * wear, shade.b * wear], i * 3)
      }
      // Use local projected metres on every joint. The extrude helper's default cap UVs
      // follow the unit shape and would repeat an identical stain on each flag.
      const uv = slab.getAttribute('uv')
      for (let i = 0; i < positions.count; i++) {
        uv.setXY(i, positions.getX(i)*.46 + .19*column, positions.getZ(i)*.46 + .27*row)
      }
      slab.setAttribute('color', new BufferAttribute(colors, 3))
      slabs.push(slab)
    }
  }
  const paving = mergeGeometries(slabs)
  slabs.forEach(slab => slab.dispose())
  return paving
}

export default function SummitTerrace() {
  const atlas = useSceneTexture(import.meta.env.BASE_URL + 'assets/art/stone-prologue-card.png')
  atlas.colorSpace = SRGBColorSpace
  const source = useSceneTexture(import.meta.env.BASE_URL + 'assets/art/gallery-flagstone.webp')
  const dressed = useMemo(() => {
    const map = source.clone()
    map.wrapS = map.wrapT = RepeatWrapping
    map.colorSpace = SRGBColorSpace
    map.needsUpdate = true
    const material = new MeshStandardMaterial({map, vertexColors:true, roughness:.9})
    // Mineral wash sits over the dark joints baked into this shared masonry atlas.
    material.onBeforeCompile = shader => {
      shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>',
        '#include <color_fragment>\n diffuseColor.rgb = mix(vec3(.30,.29,.23), diffuseColor.rgb, .58);')
    }
    return material
  },[source])
  useEffect(() => () => { dressed.map?.dispose(); dressed.dispose() },[dressed])
  const { ledge, paving, stone } = useMemo(() => {
    const stone = makeCaveStone(atlas, 'bank', '#d2cfb7')
    stone.vertexColors = true
    return { ledge: buildLedge(), paving: buildPaving(), stone }
  }, [atlas])
  useEffect(() => () => { ledge.dispose(); paving.dispose(); stone.dispose() }, [ledge, paving, stone])
  return <group position={[SUMMIT.x, SUMMIT.y, SUMMIT.z]} name="Sculpted summit ledge">
    <mesh geometry={ledge} material={stone} receiveShadow />
    <mesh geometry={paving} material={dressed} receiveShadow />
  </group>
}
