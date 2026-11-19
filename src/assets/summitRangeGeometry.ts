import {BufferGeometry,Color,Float32BufferAttribute,MathUtils} from 'three'
// x, z, base, height, width, depth, lean, seed. The ravine beyond the aperture stays open.
type Crag = readonly [number, number, number, number, number, number, number, number]
const near: Crag[] = [
  [-42, -109, -13, 44, 11, 8, -2, 3],
  [-33, -100, -14, 49, 8, 8, 1.8, 8],
  [-25, -93, -16, 34, 6.2, 6, -1.7, 14],
  [-24, -107, -9, 36, 5, 4.8, 1.8, 12],
  [-16, -106, -13, 30, 5.2, 7, -2.1, 4],
  [-12.5, -99, -12, 21, 4.2, 5.6, -1, 16],
  [3.9, -99, -13, 22, 4.8, 7.8, 1.5, 2],
  [11, -110, -14, 43, 6.5, 6.4, -2.5, 19],
  [18.4, -100, -15, 42, 8, 7.6, .8, 7],
  [26, -105, -14, 49, 9, 8.7, -1.2, 6],
  [35, -101, -13, 38, 10, 9, -2.2, 9],
  [45, -108, -12, 46, 11, 8.9, 1.6, 5],
]
const far: Crag[] = [
  [-66, -145, -17, 63, 15, 7, 2, 21],
  [-52, -142, -15, 63, 11, 8, -2, 22],
  [-42, -135, -15, 50, 11, 7.5, 2, 27],
  [-30, -145, -14, 52, 9, 9.3, -2, 24],
  [-22, -133, -17, 44, 9, 7, 1.3, 29],
  [-14, -148, -18, 44, 7, 7, -2, 35],
  [-6, -143, -18, 28, 10.5, 8.4, 1.2, 26],
  [5, -150, -16, 50, 8, 10.4, 2.8, 42],
  [15, -139, -17, 57, 11, 9, -2, 40],
  [28, -144, -14, 50, 8.6, 7, -2, 32],
  [36, -136, -14, 54, 10, 7.6, 2.8, 38],
  [48, -147, -13, 68, 11.5, 8.4, 2, 39],
  [62, -140, -13, 56, 13, 9, -2.2, 28],
]

function mountainRange(crags: Crag[], distant: boolean) {
  const sectors = distant ? 22 : 36, tiers = distant ? 18 : 27
  const positions: number[] = [], colors: number[] = [], indices: number[] = []
  const shale = new Color(distant ? '#42736d' : '#284e51')
  const celadon = new Color(distant ? '#7eafa0' : '#618678')
  const mica = new Color(distant ? '#9c9b76' : '#b59c63')
  const tint = new Color()

  for (const [x, z, base, height, width, depth, lean, seed] of crags) {
    const crest = seed % 5
    const crestStart = [.72, .76, .81, .86, .67][crest]
    const crestWidth = [.49, .32, .11, .23, .42][crest]
    const first = positions.length / 3
    for (let row = 0; row <= tiers; row++) {
      const h = row / tiers
      // The body rises as a bluff, with broken shoulders and either a tooth or a broad cap.
      const shoulderWidth = 1.07 - .45 * h - .11 * MathUtils.smoothstep(h, .35, .55)
      const profile = MathUtils.lerp(shoulderWidth, crestWidth, MathUtils.smoothstep(h, crestStart, 1))
      for (let col = 0; col < sectors; col++) {
        const theta = col * Math.PI * 2 / sectors
        const fracture = theta + .07 * Math.sin(h * 7 + seed) + h * .15
        const cleft = Math.pow(Math.abs(Math.cos(fracture * 4 + seed * .7)), 2.8)
        const ribs = Math.abs(Math.sin(fracture * 10 + seed * 1.27))
        const shoulder = .07 * Math.sin(h * 27 + theta * 2 + seed) + .03 * Math.cos(h * 67 + theta * 4.1 + seed)
        const lobe = .99 + .12 * Math.sin(theta * 2 - seed) + .12 * Math.cos(theta * 3.1 + seed)
        // Asymmetric scree fans join the base of each crag to the valley. Keep
        // the aperture's sightline open above the mist while burying the flat feet.
        const foot = 1 - MathUtils.smoothstep(h, 0, .38)
        const fan = foot * (.34 + .26 * Math.cos(theta - seed))
        const shoulderDip = MathUtils.smoothstep(h,.38,.78)
          * Math.max(0,Math.cos(theta-seed*.72)) ** 4 * (.08 + crest*.025)
        const radius = profile * (lobe + .14 * cleft + .055 * ribs + shoulder - shoulderDip) + fan
        const topWane = MathUtils.smoothstep(h, crestStart - .15, 1)
        const tilt = Math.cos(theta - seed * .8) * (crest % 2 ? .56 : .32)
        const notch = Math.abs(Math.sin(theta * (2 + crest % 3) + seed)) ** 3
        const broken = tilt + .27 * Math.sin(theta * 3 + seed) - .30 * notch
        positions.push(
          x + lean * h * h + width * Math.cos(theta) * radius * (1 + .18 * Math.sin(seed * 1.4)) + .09 * width * Math.sin(seed + h * 5) * h,
          base - foot * 44 + height * (.81 + .05 * Math.cos(seed)) * (h + (.077 + crest * .016) * topWane * broken),
          z + depth * Math.sin(theta) * radius * (1 - topWane * (crest === 1 ? .42 : .12)) + h * depth * .13 * Math.sin(seed * .8),
        )
        const wash = MathUtils.clamp(.23 + .29 * h + cleft * .25 + shoulder * 1.2, 0, 1)
        const seam = Math.pow(Math.max(0, Math.cos(theta * 5.1 - h * 18 + seed)), 4)
        tint.copy(shale).lerp(celadon, wash).lerp(mica, seam * (distant ? .22 : .32) * h)
        colors.push(tint.r, tint.g, tint.b)
        if (row > 0) {
          const a = first + (row - 1) * sectors + col
          const b = first + (row - 1) * sectors + (col + 1) % sectors
          indices.push(a, a + sectors, b, b, a + sectors, b + sectors)
        }
      }
    }
    const tip = positions.length / 3
    positions.push(x + lean + .09 * width * Math.sin(seed + 5), base + height * (.81 + .05 * Math.cos(seed)) * .987, z + depth * .13 * Math.sin(seed * .8))
    positions.push(x, base - 44, z)
    colors.push(tint.r, tint.g, tint.b, shale.r, shale.g, shale.b)
    const rim = first + tiers * sectors
    for (let col = 0; col < sectors; col++) {
      const next = (col + 1) % sectors
      indices.push(rim + col, tip, rim + next, first + col, first + next, tip + 1)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export const nearRange = () => mountainRange(near,false)
export const farRange = () => mountainRange(far,true)
