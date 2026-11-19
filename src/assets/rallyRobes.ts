import { BufferGeometry, Color, Float32BufferAttribute, MathUtils, Vector3 } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { FIGURE_BIND, skinPart } from './rallyMesh.ts'

type Joint = keyof typeof FIGURE_BIND
type Point = readonly [number, number, number]
type Binding = readonly [Joint, number][]
type Ring = readonly [Point, number, number]
type Sample = { point: Point; color: Color }

const tau = Math.PI * 2
const ink = {
  silk: '#405c57', mantle: '#536d62', recess: '#233f3c', edge: '#b2ac8d',
  understitch: '#c2b596', pants: '#777963', sole: '#262b29', skin: '#998364',
}
const cinnabar = {
  silk: '#852f1f', mantle: '#99412e', recess: '#582a24', edge: '#b89a71',
  understitch: '#e1c696', pants: '#bbaa87', sole: '#312622', skin: '#bd966a',
}

function patch(rows: number, columns: number, sample: (v: number, u: number) => Sample, wrap = false, reverse = false) {
  const positions: number[] = [], colors: number[] = [], indices: number[] = []
  const stride = columns + (wrap ? 0 : 1)
  for (let row = 0; row <= rows; row++) {
    for (let column = 0; column < stride; column++) {
      const { point, color } = sample(row / rows, column / columns)
      positions.push(...point)
      colors.push(color.r, color.g, color.b)
      if (row === rows || (!wrap && column === columns)) continue
      const a = row * stride + column
      const b = row * stride + (column + 1) % stride
      if (reverse) indices.push(a, b, a + stride, b, b + stride, a + stride)
      else indices.push(a, a + stride, b, b, a + stride, b + stride)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function sweep(rings: Ring[], sides: number, color: Color, fold = 0, edge?: Color, hang = 0) {
  const spine = rings.map(([point]) => new Vector3(...point))
  const frames = spine.map((center, row) => {
    const tangent = spine[Math.min(row + 1, rings.length - 1)].clone()
      .sub(spine[Math.max(0, row - 1)]).normalize()
    const width = new Vector3(1, 0, 0).addScaledVector(tangent, -tangent.x).normalize()
    const depth = new Vector3().crossVectors(width, tangent)
    return { center, width, depth }
  })
  return patch(rings.length - 1, sides, (v, u) => {
    const row = Math.round(v * (rings.length - 1))
    const { center, width, depth } = frames[row]
    const a = tau * u
    const pleat = Math.cos(a * 5 + .79 * v) * .68 + Math.sin(a * 3 - .69 * v) * .32
    const fullness = 1 + fold * pleat
    const point = center.clone().addScaledVector(width, rings[row][1] * Math.cos(a) * fullness)
      .addScaledVector(depth, rings[row][2] * Math.sin(a) * fullness)
    point.y -= Math.max(0, center.y - point.y) * hang * Math.sin(Math.PI * v)
    const tint = color.clone().multiplyScalar(.95 + pleat * fold * 1.3)
    if (edge && row >= rings.length - 4) tint.lerp(edge, row === rings.length - 3 ? .78 : .54)
    return { point: point.toArray(), color: tint }
  }, true)
}

const torsoSection = [
  // height, width, depth, centre z
  [.71, .249, .177, .027], [.79, .248, .173, .021], [.88, .214, .167, .006],
  [.97, .209, .171, -.018], [1.07, .228, .183, -.03], [1.16, .249, .181, -.037],
  [1.235, .239, .153, -.040], [1.278, .224, .133, -.044],
  [1.315, .169, .111, -.041], [1.352, .080, .087, -.04],
] as const

function torsoSurface(y: number, a: number, lift = 0) {
  const next = Math.max(1, torsoSection.findIndex(([height]) => height >= y))
  const bottom = y > 1.352 ? torsoSection[torsoSection.length - 2] : torsoSection[next - 1]
  const top = y > 1.352 ? torsoSection[torsoSection.length - 1] : torsoSection[next]
  const t = MathUtils.clamp((y - bottom[0]) / (top[0] - bottom[0]), 0, 1)
  const fold = .012 * Math.cos(a * 7 - y * 9) + .005 * Math.cos(a * 12 + y * 11)
  const rx = MathUtils.lerp(bottom[1], top[1], t) + fold + lift
  const rz = MathUtils.lerp(bottom[2], top[2], t) + fold * .63 + lift
  return [
    rx * Math.cos(a), y + .009 * Math.cos(a * 2 + y),
    MathUtils.lerp(bottom[3], top[3], t) + rz * Math.sin(a),
  ] as const
}

function torsoBinding(_x: number, y: number): Binding {
  const chest = MathUtils.smoothstep(y, .74, 1.14)
  return [['hips', 1 - chest], ['chest', chest]]
}

const blendAlong = (a: Point, b: Point, t: number): Point => [
  MathUtils.lerp(a[0], b[0], t), MathUtils.lerp(a[1], b[1], t), MathUtils.lerp(a[2], b[2], t),
]

export function buildRallyRobes(away: boolean) {
  const scheme = away ? ink : cinnabar
  const colors = Object.fromEntries(Object.entries(scheme).map(([key, hex]) => [key, new Color(hex)])) as Record<keyof typeof ink, Color>
  const parts: BufferGeometry[] = []
  function add(geometry: BufferGeometry, weights: Parameters<typeof skinPart>[2]) {
    parts.push(skinPart(geometry, null, weights))
  }

  add(patch(20, 32, (v, u) => {
    const y = MathUtils.lerp(.71, 1.352, v), a = tau * u
    const line = .5 + .5 * Math.cos(a * 7 - y * 9)
    const face = MathUtils.smoothstep(v, .70, .98) * (1 - MathUtils.smoothstep(Math.sin(a), -.94, -.56))
    return {
      point: torsoSurface(y, a),
      color: colors.silk.clone().lerp(colors.recess, .16 * line + .23 * face)
        .lerp(colors.mantle, .22 * MathUtils.smoothstep(v, .52, 1)),
    }
  }, true), torsoBinding)

  // Crossed robe facings keep separate narrow pale edges and open away from the neck.
  for (const side of [-1, 1]) add(patch(16, 12, (v, u) => {
    const y = MathUtils.lerp(.93, 1.354, v)
    const turn = -Math.PI / 2 + side * MathUtils.lerp(-.38, .92, v)
    const a = turn + side * (.23 + .14 * Math.sin(v * Math.PI)) * (u - .5)
    const tint = colors.mantle.clone().lerp(colors.understitch, u < .23 ? .82 : .08)
    return { point: torsoSurface(y, a, side > 0 ? .032 : .018), color: tint }
  }, false, side < 0), torsoBinding)

  // The shoulder drape follows the body and wraps over one hip. It reads from behind
  // as a broad red fold with a fine silk facing and low-contrast weave.
  add(patch(24, 22, (v, u) => {
    const y = 1.312 - .557 * v + .033 * Math.sin(u * Math.PI)
    const middle = .13 + 2.61 * v
    const width = .74 + .49 * Math.sin(v * 2.49)
    const a = middle + (u - .5) * width
    const pleat = .018 * Math.sin(u * Math.PI * 5 + v * 4) + .012 * Math.cos(u * Math.PI * 9 - v * 6)
    const selvage = u < .035 || u > .972 ? .58 : .0
    const tint = colors.mantle.clone().lerp(colors.recess, .18 + .18 * Math.sin(u * Math.PI * 5 + v * 4))
      .lerp(colors.edge, selvage)
    return { point: torsoSurface(y, a, .035 + pleat), color: tint }
  }, false, true), torsoBinding)

  add(patch(6, 36, (v, u) => {
    const a = tau * u
    const y = .765 + v * .071 - .017 * Math.sin(a + .6) + .007 * Math.cos(5 * a)
    return { point: torsoSurface(y, a, .022 + .008 * Math.sin(Math.PI * v)),
      color: colors.recess.clone().lerp(colors.edge, v > .77 || v < .20 ? .59 : .2) }
  }, true), torsoBinding)

  const skirtBinding = (x: number, y: number, z: number): Binding => {
    const loose = 1 - MathUtils.smoothstep(y, .40, .77)
    const back = loose * MathUtils.smoothstep(z, -.06, .25) * .9
    const right = MathUtils.smoothstep(x, -.18, .18) * (loose - back)
    return [['hips', 1 - loose], ['hemBack', back], ['hemLeft', loose - back - right], ['hemRight', right]]
  }
  for (const lining of [true, false]) add(patch(13, 30, (v, u) => {
    const a = -1.13 + (tau - .92) * u
    const swell = v ** .84
    const fold = Math.cos(7 * a - v * 1.18) * (.009 + .035 * v)
      + Math.sin(4 * a + v * .7) * .018 * v
    const y = .823 - v * (.505 + .14 * Math.sin(a + .27) + .056 * Math.cos(3 * a + .2))
      - (lining ? .032 * v : 0)
      + .19 * Math.max(0,Math.cos(a)) * v*v
      + .13 * Math.pow(Math.abs(Math.cos(a)),12) * v*v*v
    const rx = .228 + .180 * swell + fold + (lining ? -.021 : 0)
    const rz = .171 + .162 * swell + fold + (lining ? -.019 : 0)
    const color = (lining ? colors.pants : colors.silk).clone().lerp(colors.recess, .18 + fold * 2.6)
      .lerp(lining ? colors.understitch : colors.edge, v > .953 || u < .025 || u > .975 ? .40 : 0)
    return { point: [rx * Math.cos(a) - .126 * swell, y, .01 + rz * Math.sin(a) + .056 * swell], color }
  }, false, true), skirtBinding)

  for (const side of ['right', 'left'] as const) {
    const sign = side === 'right' ? 1 : -1
    const shoulder = FIGURE_BIND[`${side}Shoulder`], elbow = FIGURE_BIND[`${side}Elbow`], wrist = FIGURE_BIND[`${side}Wrist`]
    const upper: Joint = `${side}Shoulder`, fore: Joint = `${side}Elbow`, palm: Joint = `${side}Wrist`
    const start = blendAlong(shoulder, elbow, -.12)
    const sleeves: Ring[] = [
      [start, .066, .061], [shoulder, .086, .082], [blendAlong(shoulder, elbow, .32), .093, .085],
      [blendAlong(shoulder, elbow, .63), .116, .111], [elbow, .121, .123],
      [blendAlong(elbow, wrist, .2), .121, .136], [blendAlong(elbow, wrist, .41), .134, .150],
      [blendAlong(elbow, wrist, .62), .142, .162], [blendAlong(elbow, wrist, .66), .140, .158],
      [blendAlong(elbow, wrist, .69), .132, .149], [blendAlong(elbow, wrist, .71), .111, .121],
      [blendAlong(elbow, wrist, .735), .101, .105],
    ]
    add(sweep(sleeves, 20, colors.silk, .13, colors.edge, .32), (x, y, z) => {
      const bent = MathUtils.smoothstep(-z - y * .38 + x * sign * .22,
        -elbow[2] - elbow[1] * .38 + elbow[0] * sign * .22 - .06,
        -elbow[2] - elbow[1] * .38 + elbow[0] * sign * .22 + .07)
      return [[upper, 1 - bent], [fore, bent]]
    })
    add(sweep([
      [blendAlong(elbow, wrist, .40), .068, .065],
      [blendAlong(elbow, wrist, .61), .061, .056],
      [blendAlong(elbow, wrist, .79), .052, .046], [wrist, .040, .036],
      [blendAlong(elbow, wrist, 1.07), .003, .003],
    ], 14, colors.skin, .038), [[fore, 1]])
    add(sweep([
      [blendAlong(elbow, wrist, .98), .036, .033],
      [blendAlong(elbow, wrist, 1.10), .045, .037],
      [blendAlong(elbow, wrist, 1.21), .042, .033],
      [blendAlong(elbow, wrist, 1.28), .026, .024],
      [blendAlong(elbow, wrist, 1.32), .003, .004],
    ], 14, colors.skin, .10), [[palm, 1]])

    const hip = FIGURE_BIND[`${side}Hip`], knee = FIGURE_BIND[`${side}Knee`], ankle = FIGURE_BIND[`${side}Ankle`]
    const thigh: Joint = `${side}Hip`, shin: Joint = `${side}Knee`, foot: Joint = `${side}Ankle`
    add(sweep([
      [blendAlong(hip, knee, -.06), .136, .131], [blendAlong(hip, knee, .23), .153, .141],
      [blendAlong(hip, knee, .57), .145, .138], [knee, .124, .125],
      [blendAlong(knee, ankle, .28), .109, .106], [blendAlong(knee, ankle, .54), .100, .089],
      [blendAlong(knee, ankle, .70), .095, .082], [blendAlong(knee, ankle, .82), .081, .062],
      [blendAlong(knee, ankle, .90), .066, .060], [ankle, .064, .057],
    ], 18, colors.pants, .14, colors.understitch), (_x, y) => {
      const thighWeight = MathUtils.smoothstep(y, knee[1] - .095, knee[1] + .105)
      return [[thigh, thighWeight], [shin, 1 - thighWeight]]
    })
    add(sweep([
      [[ankle[0] - sign * .018, .045, ankle[2] + .077], .018, .018],
      [[ankle[0] - sign * .013, .049, ankle[2] + .060], .065, .039],
      [[ankle[0], .049, ankle[2] + .008], .074, .042],
      [[ankle[0] + sign * .032, .047, ankle[2] - .081], .071, .039],
      [[ankle[0] + sign * .057, .042, ankle[2] - .142], .062, .028],
      [[ankle[0] + sign * .064, .037, ankle[2] - .157], .011, .011],
    ], 16, colors.sole, .036), [[foot, 1]])
  }

  const geometry = mergeGeometries(parts)
  parts.forEach(part => part.dispose())
  return geometry
}
