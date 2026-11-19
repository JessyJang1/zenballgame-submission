import { BufferGeometry, CatmullRomCurve3, Color, Float32BufferAttribute, TubeGeometry, Vector3 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { FIGURE_BIND, skinPart } from './rallyMesh.ts'

type Point = readonly [number, number, number]
type Sample = { p: Point; color: Color }
type CrossSection = readonly [height: number, width: number, front: number, back: number, center: number]
const fullTurn = Math.PI * 2
const [centerX, centerY, centerZ] = FIGURE_BIND.head

// The jaw, temples and occiput have separate profiles. A narrower chin leads
// into fairly broad cheekbones, while the back remains higher and rounder.
const faceProfile: CrossSection[] = [
  [-.167, .043, .070, .056, -.016],
  [-.145, .073, .082, .066, -.019],
  [-.115, .100, .103, .088, -.009],
  [-.076, .121, .115, .111, -.002],
  [-.035, .136, .107, .132, .006],
  [.012, .131, .112, .140, .012],
  [.053, .127, .113, .140, .010],
  [.086, .121, .112, .132, .006],
  [.121, .107, .101, .114, .005],
  [.152, .082, .073, .082, .009],
  [.175, .024, .023, .033, .009],
]

function fitFace(y: number): CrossSection {
  const i = faceProfile.findIndex(([height]) => height >= y)
  if (i < 0) return faceProfile[faceProfile.length - 1]
  if (i === 0) return faceProfile[0]
  const a = faceProfile[i - 1], b = faceProfile[i]
  const t = (y - a[0]) / (b[0] - a[0])
  return [y, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t, a[4] + (b[4] - a[4]) * t]
}

const soft = (x: number, radius: number) => Math.exp(-((x / radius) ** 2))

// A high bridge flows into the cheeks. The eyelids sit in a sculpted recess.
function facialRelief(x: number, y: number) {
  const cheek = Math.abs(x)
  const orbital = -.014 * soft(cheek - .052, .039) * soft(y - .005, .021)
  const upper = .014 * soft(cheek - .071, .038) * soft(y + .034, .024)
  const bridge = .033 * soft(x, .020) * soft(y + .014, .034)
  const tip = .043 * soft(x, .025) * soft(y + .046, .016)
  const wing = .019 * soft(cheek - .023, .013) * soft(y + .058, .015)
  const mouth = .013 * soft(x, .035) * soft(y + .095, .022)
  return orbital + upper + bridge + tip + wing + mouth
}

function facePoint(y: number, angle: number): Point {
  const [, width, front, back, shift] = fitFace(y)
  const forward = Math.cos(angle)
  const x = width * Math.sin(angle)
  const depth = forward * (forward > 0 ? front : back)
  const relief = facialRelief(x, y) * Math.max(0, forward) ** 1.7
  return [centerX + x, centerY + y, centerZ + shift - depth - relief]
}

function faceArt(x: number, y: number, lift = .004): Point {
  const a = Math.asin(Math.max(-.96, Math.min(.96, x / fitFace(y)[1])))
  const [px, py, pz] = facePoint(y, a)
  return [px, py, pz - lift]
}

function mesh(samples: Sample[], indices: number[]) {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(samples.flatMap(({p}) => [...p]), 3))
  geometry.setAttribute('color', new Float32BufferAttribute(samples.flatMap(({color}) => [color.r, color.g, color.b]), 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function rings(count: number, sides: number, sample: (v: number, angle: number) => Sample) {
  const samples: Sample[] = [], indices: number[] = []
  for (let row = 0; row < count; row++) {
    for (let side = 0; side < sides; side++) {
      samples.push(sample(row / (count - 1), fullTurn * side / sides))
      if (row === 0) continue
      const a = (row - 1) * sides + side, b = (row - 1) * sides + (side + 1) % sides
      indices.push(a, a + sides, b, b, a + sides, b + sides)
    }
  }
  // Cap the two small trim rings with opposite winding.
  const last = (count - 1) * sides
  for (let side = 1; side < sides - 1; side++) {
    indices.push(0, side, side + 1, last, last + side + 1, last + side)
  }
  return mesh(samples, indices)
}

function strip(color: Color, point: (t: number, edge: -1 | 1) => Point, steps = 10) {
  const samples: Sample[] = [], indices: number[] = []
  function face(a: number, b: number, c: number) {
    const [ax, ay] = samples[a].p, [bx, by] = samples[b].p, [cx, cy] = samples[c].p
    const signed = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
    if (signed < -1e-10) indices.push(a, b, c)
    else if (signed > 1e-10) indices.push(a, c, b)
  }
  for (let i = 0; i <= steps; i++) {
    samples.push({p: point(i / steps, -1), color}, {p: point(i / steps, 1), color})
    const k = i * 2
    if (i) {
      face(k - 2, k - 1, k)
      face(k, k - 1, k + 1)
    }
  }
  return mesh(samples, indices)
}

function ear(side: -1 | 1, base: Color, shadow: Color) {
  // Raised helix around a shaded cup, attached at an ordinary jaw height.
  const turns = 16
  const samples: Sample[] = [], indices: number[] = []
  const section = [
    [0.12, .120, .67], [.43, .145, .55], [.66, .151, .31],
    [.84, .159, .03], [1, .144, .07], [.86, .125, .31],
  ]
  section.forEach(([radius, outer, tone], row) => {
    for (let k = 0; k < turns; k++) {
      const a = fullTurn * k / turns
      const lobe = Math.max(0, -Math.cos(a))
      samples.push({
        p: [centerX + side * (outer - lobe * .014), centerY - .029 + radius * Math.cos(a) * .059,
          centerZ + .042 + radius * (.029 * Math.sin(a) + .014 * Math.cos(a))],
        color: base.clone().lerp(shadow, tone).multiplyScalar(.95 + .08 * Math.cos(a)),
      })
      if (row) {
        const a = (row - 1) * turns + k, b = (row - 1) * turns + (k + 1) % turns
        if (side === 1) indices.push(a, a + turns, b, b, a + turns, b + turns)
        else indices.push(a, b, a + turns, b, b + turns, a + turns)
      }
    }
  })
  return mesh(samples, indices)
}

function pigmentFace(away: boolean, base: Color, shade: Color) {
  const warmth = new Color(away ? '#938f6a' : '#c48764')
  return rings(27, 44, (v, angle) => {
    const y = v * .342 - .167
    const p = facePoint(y, angle)
    const forward = Math.max(0, Math.cos(angle))
    const cheek = soft(Math.abs(p[0] - centerX) - .079, .042) * soft(y + .050, .038) * forward
    const eye = soft(Math.abs(p[0] - centerX) - .050, .038) * soft(y - .008, .027) * forward
    const jawShadow = soft(y + .155, .044) * .24 + eye * .20 + (1 - forward) * .068
    return { p, color: base.clone().lerp(warmth, cheek * .27).lerp(shade, jawShadow) }
  })
}

function hairShell(away: boolean, ink: Color, gloss: Color) {
  return rings(12, 40, (v, angle) => {
    const front = Math.max(0, Math.cos(angle)), rear = Math.max(0, -Math.cos(angle))
    const part = soft(angle - .30, .19) + soft(angle - (fullTurn + .30), .19)
    const hairline = .008 + .071 * front ** 2 - .108 * rear ** 1.1 + .012 * part
    const y = hairline + (.174 - hairline) * v
    const [x, py, z] = facePoint(y, angle)
    const braid = Math.cos(angle * 23 + v * 9.8 + Math.sin(angle * 6) * 1.45)
    const comb = Math.cos(angle * 8 - v * 3.6 + .7)
    const shell = .008 + .009 * Math.sin(Math.PI * v) + .0018 * braid
    return {
      p: [x + Math.sin(angle) * shell, py + .008 * v, z - Math.cos(angle) * shell],
      color: ink.clone().lerp(gloss, .19 + .11 * comb + .17 * Math.max(0, braid) + (away ? .12 : .06) * v),
    }
  })
}

function knot(away: boolean, ink: Color, gloss: Color) {
  return rings(11, 22, (v, angle) => {
    const shoulder = .17 + .83 * Math.sin(Math.PI * v) ** .72
    const strands = Math.cos(angle * 9.0 + v * 6.5)
    const width = (away ? .048 : .055) * shoulder * (1 + .032 * strands)
    const z = (away ? .132 : .102) + .051 * v
    return {
      p: [centerX - .020 + v * .036 + Math.sin(angle) * width, centerY + (away ? .085 : .149) + (away ? .093 : .081) * v,
        centerZ + z - Math.cos(angle) * width * 1.01],
      color: ink.clone().lerp(gloss, .23 + .16 * Math.max(0, strands) + .16 * v),
    }
  })
}

function hairWrap(away: boolean) {
  const tone = new Color(away ? '#627367' : '#a27852')
  return rings(4, 20, (v, angle) => {
    const size = (away ? .036 : .041) + Math.sin(Math.PI * v) * .003
    return {
      p: [centerX - .008 + Math.sin(angle) * size, centerY + (away ? .102 : .164) + v * .013 - .014 * Math.cos(angle),
        centerZ + (away ? .143 : .120) - Math.cos(angle) * size],
      color: tone.clone().multiplyScalar(.87 + .19 * Math.sin(angle - .8) ** 2),
    }
  })
}

function neck(base: Color, shade: Color) {
  const [, shoulderY, shoulderZ] = FIGURE_BIND.chest
  const [, , jointZ] = FIGURE_BIND.neck
  const y0 = shoulderY + .18, y1 = centerY - .112
  return rings(8, 20, (v, a) => {
    const taper = v * (1 - v)
    const width = .076 - taper * .053 - v * .008
    const z = shoulderZ + (jointZ - shoulderZ) * v + .011 * v
    return {p: [centerX + Math.sin(a) * width, y0 + v * (y1 - y0), z - Math.cos(a) * (width + .005)],
      color: base.clone().lerp(shade, .16 + .24 * v + .13 * Math.sin(a) ** 2)}
  })
}

function eyeDetails(side: -1 | 1, away: boolean) {
  const pupil = new Color(away ? '#303833' : '#44362a')
  const lids = new Color(away ? '#4c5545' : '#762f22')
  const sclera = new Color(away ? '#b7af8e' : '#cbb99a')
  const brow = new Color(away ? '#31463f' : '#43382d')
  const x = (t: number) => side * (.022 + .081 * t)
  const y = (t: number) => .003 + t * .010 + .004 * Math.sin(Math.PI * t)
  const shape = (t: number) => Math.sin(Math.PI * t) ** .76
  const corners = strip(sclera, (t, edge) => faceArt(x(t), y(t) + edge * .007 * shape(t), .007), 12)
  const deepEye = strip(pupil, (t, edge) =>
    faceArt(x(.47 + .23 * t), y(.47 + .23 * t) + edge * .006 * shape(t), .011), 6)
  const line = strip(lids, (t, edge) => faceArt(x(t), y(t) + (.007 + edge * .0021) * shape(t), .012), 11)
  // The arch narrows toward the temple, kept low for the considered gaze.
  const browShape = strip(brow, (t, edge) =>
    faceArt(x(t) + side * .005, .041 + .009 * t + .008 * shape(t)
      + edge * (.005 * shape(t) * (1 - .57 * t)), .005), 12)
  return [corners, deepEye, line, browShape]
}

function lips(away: boolean) {
  const lip = new Color(away ? '#6c6251' : '#a66957')
  const join = new Color(away ? '#464a3d' : '#70493b')
  const width = .038
  const line = (t: number) => -.099 - .005 * Math.sin(Math.PI * t) + .002 * Math.cos(t * Math.PI * 4)
  return [
    strip(lip, (t, edge) => faceArt(width * (2 * t - 1), line(t) + edge * .005 * Math.sin(Math.PI * t), .0045)),
    strip(join, (t, edge) => faceArt(width * (2 * t - 1), line(t) + edge * .0017 * Math.sin(Math.PI * t), .006)),
  ]
}

function escapedLock(away: boolean) {
  const [x, y, z] = FIGURE_BIND.head
  const points = [
    new Vector3(x + .022, y + (away ? .128 : .191), z + .159),
    new Vector3(x + .019, y + .130, z + .149),
    new Vector3(x + .037, y + .061, z + .149),
    new Vector3(x + (away ? .031 : .054), y - .051, z + .139),
  ]
  return new TubeGeometry(new CatmullRomCurve3(points), 12, away ? .0087 : .0095, 5, false)
}

export function buildRallyHeads(away: boolean): BufferGeometry {
  const base = new Color(away ? '#8c9280' : '#cdab83')
  const shade = new Color(away ? '#4c635b' : '#936444')
  const ink = new Color(away ? '#283c39' : '#342f28')
  const gloss = new Color(away ? '#63766a' : '#776a50')
  const head = [
    pigmentFace(away, base, shade), ear(-1, base, shade), ear(1, base, shade),
    hairShell(away, ink, gloss), knot(away, ink, gloss), hairWrap(away),
    ...eyeDetails(-1, away), ...eyeDetails(1, away), ...lips(away),
  ]
  const parts = head.map(geometry => skinPart(geometry, null, [['head', 1]]))
  parts.push(skinPart(escapedLock(away), gloss, [['head', 1]]))
  parts.push(skinPart(neck(base, shade), null, (_x, y) => {
    const head = Math.max(0, Math.min(1, (y - 1.354) / .094))
    const chest = Math.max(0, Math.min(1, (1.342 - y) / .07)) * .78
    return [['neck', 1 - chest - head], ['head', head], ['chest', chest]]
  }))
  const geometry = mergeGeometries(parts)
  parts.forEach(part => part.dispose())
  return geometry
}
