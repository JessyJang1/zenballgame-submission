import { useEffect, useMemo } from 'react'
import { useSceneTexture } from './assets/useSceneTexture'
import { BufferGeometry, Color, DoubleSide, Float32BufferAttribute, MathUtils, SRGBColorSpace } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { makeCaveStone } from './assets/caveStone'
import { makeBark, makeNeedles } from './ThresholdPine'

type Rock = {
  foot: readonly [number, number, number]
  span: readonly [number, number, number]
  turn: number
  seed: number
  // Positive X lean is toward the terrace on the western bank.
  lean: readonly [number, number]
}

const westButtress = { foot: [-8.97, 7.25, -62.5], span: [2.38, 7.6, 3.65], turn: .31, seed: 1.72, lean: [.35, -.49] } as const
const eastButtress = { foot: [6.4, 7.08, -60.3], span: [2.72, 8.52, 4.15], turn: -.29, seed: 5.73, lean: [.12, -.74] } as const
const rocks: readonly Rock[] = [
  westButtress, eastButtress,
  { foot: [-8.66, 9.1, -57.83], span: [1.98, 4.62, 2.58], turn: .66, seed: 3.56, lean: [-.24, -.41] },
  { foot: [-7.43, 10.35, -60.27], span: [.86, 2.85, 1.76], turn: .67, seed: .8, lean: [-.18, -.43] },
  { foot: [5.02, 10.08, -55.9], span: [1.30, 3.02, 1.69], turn: -.41, seed: 4.9, lean: [.12, -.29] },
  { foot: [6.66, 9.32, -65.44], span: [1.93, 5.83, 2.42], turn: .58, seed: 2.39, lean: [-.08, -.68] },
]

// The overhanging lips and cuts are set into the profile before the cliff
// receives its finer striations, so the strata also change its silhouette.
const profile = [
  [0, 1.00], [.13, .98], [.29, .90], [.33, .98], [.40, .94], [.44, .83],
  [.53, .79], [.59, .88], [.63, .84], [.69, .72], [.78, .67], [.82, .70],
  [.88, .63], [.93, .51], [.976, .37], [.995, .20], [1, .085],
] as const

function cliffGeometry({ foot, span, turn, seed, lean }: Rock) {
  const positions: number[] = [], colors: number[] = [], indices: number[] = []
  const dark = new Color('#264b47')
  const broken = new Color('#638780')
  const dry = new Color('#bca37c')
  const moss = new Color('#657147')
  const color = new Color()
  const [radiusX, height, radiusZ] = span
  const sides = Math.ceil(24 + radiusX * 8)
  const cosTurn = Math.cos(turn), sinTurn = Math.sin(turn)
  const rowCount = (profile.length - 1) * 2
  for (let row = 0; row <= rowCount; row++) {
    const p = Math.min(profile.length - 2, Math.floor(row / 2))
    const t = row / 2 - p
    const level = MathUtils.lerp(profile[p][0], profile[p + 1][0], t)
    const scale = MathUtils.lerp(profile[p][1], profile[p + 1][1], t)
    const crown = MathUtils.smoothstep(level, .8, 1)
    for (let side = 0; side < sides; side++) {
      const angle = side * Math.PI * 2 / sides
      const deformation = 1 + .095 * Math.sin(angle * 3 + seed) + .06 * Math.cos(angle * 5 - seed)
      const fracture = Math.pow(.5 + .5 * Math.cos(angle * 7.0 + level * 1.65 + seed), 8)
      const deepCut = Math.pow(.5 + .5 * Math.sin(angle * 4 - level * 1.2 - seed * .75), 11)
      const radial = scale * (deformation - fracture * .13 - deepCut * .12 + .025 * Math.cos(angle * 13 + level * 7))
      const sx = Math.cos(angle) * radial * radiusX
      const sz = Math.sin(angle) * radial * radiusZ
      const tilt = .14 * Math.sin(angle + seed) + .075 * Math.cos(angle * 3 - seed)
      const bed = (level + (1 - crown * .85) * tilt * (.18 + level * .22)) * height
      positions.push(foot[0] + sx * cosTurn - sz * sinTurn + lean[0] * level,
        foot[1] + bed - 7.8 * (1 - level) ** 3, foot[2] + sx * sinTurn + sz * cosTurn + lean[1] * level)

      const seam = Math.pow(.5 + .5 * Math.cos(level * 61 + Math.cos(angle) * 5.5 + seed), 7)
      const faceLight = .60 + Math.cos(angle - 1.13) * .25 - fracture * .22 - deepCut * .15
      const deposit = MathUtils.smoothstep(.50 + .32 * Math.sin(level * 19 + Math.sin(angle * 2) + seed), .33, .87)
      color.copy(dark).lerp(broken, faceLight)
        .lerp(dry, deposit * (.42 + .21 * faceLight))
        .lerp(moss, crown * (.10 + .28 * Math.pow(.5 + .5 * Math.cos(angle * 3.5), 2)))
        .multiplyScalar(1 - .17 * seam)
      colors.push(color.r, color.g, color.b)

      if (row > 0) {
        const a = (row - 1) * sides + side
        const b = (row - 1) * sides + (side + 1) % sides
        indices.push(a, a + sides, b, b, a + sides, b + sides)
      }
    }
  }
  const cap = positions.length / 3
  positions.push(foot[0] + lean[0], foot[1] + height, foot[2] + lean[1])
  colors.push(moss.r, moss.g, moss.b)
  for (let i = 0; i < sides; i++) indices.push(cap, rowCount * sides + (i + 1) % sides, rowCount * sides + i)

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function combine(pieces: BufferGeometry[]) {
  const result = mergeGeometries(pieces)
  pieces.forEach(piece => piece.dispose())
  return result
}

function windsweptPines(source: BufferGeometry) {
  const trees = [
    [[westButtress.foot[0] + westButtress.lean[0], 14.75, westButtress.foot[2] + westButtress.lean[1]], .52, -.32],
    [[5.62, 15.25, -61.66], .45, 2.88],
  ] as const
  const pieces = trees.map(([root, size, turn]) =>
    source.clone()
      .translate(8.4, -.16, -49.8)
      .scale(size, size, size)
      .rotateY(turn)
      .translate(root[0], root[1], root[2])
  )
  source.dispose()
  return combine(pieces)
}

export default function SummitCliffs() {
  const atlas = useSceneTexture(import.meta.env.BASE_URL + 'assets/art/stone-prologue-card.png')
  atlas.colorSpace = SRGBColorSpace
  const cliff = useMemo(() => combine(rocks.map(cliffGeometry)), [])
  const bark = useMemo(() => windsweptPines(makeBark()), [])
  const needles = useMemo(() => windsweptPines(makeNeedles()), [])
  const stone = useMemo(() => {
    const material = makeCaveStone(atlas, 'ridge', '#e8e0cf')
    material.vertexColors = true
    return material
  }, [atlas])
  useEffect(() => () => {
    cliff.dispose()
    bark.dispose()
    needles.dispose()
    stone.dispose()
  }, [cliff, bark, needles, stone])

  return <group name="Rock-cut summit shoulders">
    <mesh geometry={cliff} material={stone} castShadow receiveShadow/>
    <mesh geometry={bark} castShadow receiveShadow>
      <meshStandardMaterial side={DoubleSide} vertexColors roughness={1}/>
    </mesh>
    <mesh geometry={needles}>
      <meshStandardMaterial side={DoubleSide} vertexColors roughness={1} emissive="#283820" emissiveIntensity={.23}/>
    </mesh>
  </group>
}
