import { BufferGeometry, CatmullRomCurve3, Color, Float32BufferAttribute, Vector3 } from 'three'

type Point = readonly [number, number, number]

const branches: readonly { points: readonly Point[]; root: number; tip: number }[] = [
  { points: [[-8.4,.1,49.8],[-8,2.45,49.5],[-7.1,4.4,49.6],[-5.64,6.03,49.9],[-4.27,6.9,50.4],[-3.2,7.42,49.9]], root: .62, tip: .09 },
  { points: [[-7.39,4,49.5],[-8.1,5.22,48.8],[-8.66,6.38,47.75],[-8.8,7.49,47.1]], root: .30, tip: .063 },
  { points: [[-6.21,5.55,49.8],[-6.6,7.31,49.0],[-6.24,8.26,48.36],[-5.8,8.92,48.95]], root: .27, tip: .047 },
  { points: [[-5.75,5.91,49.93],[-4.18,6.21,48.9],[-3.35,6.28,48.0],[-2.24,6.77,47.5]], root: .19, tip: .032 },
  { points: [[-4.26,6.9,50.4],[-2.85,7.22,50.1],[-1.87,7.1,49.3],[-1.05,7.31,48.3]], root: .15, tip: .022 },
  { points: [[-3.89,7.0,50.24],[-3.0,7.89,50.2],[-2.34,8.06,49.5]], root: .12, tip: .026 },
  { points: [[-7.90,2.70,49.5],[-7.42,3.18,50.65],[-6.19,3.38,51.15],[-5.8,3.62,51.05]], root: .145, tip: .027 },
  { points: [[-8.26,1.1,49.72],[-8.92,.45,50.57],[-9.85,.13,51.3]], root: .36, tip: .065 },
  { points: [[-5.12,6.5,50.22],[-5.01,7.24,49.12],[-4.42,7.76,48.68]], root:.10, tip:.021 },
  { points: [[-3.46,6.25,48.18],[-2.86,6.78,47.87],[-2.19,6.95,47.33]], root:.085, tip:.018 },
  { points: [[-6.48,7.48,48.89],[-7.42,8.10,47.79],[-7.92,8.56,47.16]], root:.10, tip:.024 },
  { points: [[-7.8,3.01,50.38],[-6.99,3.70,50.39],[-6.48,4.03,50.57]], root:.09, tip:.019 },
  { points: [[-8.27,1.32,49.73],[-7.59,.63,50.19],[-6.78,.16,50.01]], root: .32, tip: .056 },
]

const crowns: readonly (readonly [Point, Point, number])[] = [
  [[-8.8,7.56,47.05],[2.42,.48,1.6],42],
  [[-7.6,7.92,48.1],[1.47,.38,.99],32],
  [[-5.95,8.91,48.9],[1.94,.46,1.2],48],
  [[-5,8.78,48.2],[1.17,.42,1.1],26],
  [[-3.58,7.81,50],[1.67,.45,1.06],39],
  [[-2.25,8.09,49.35],[1.45,.43,.92],42],
  [[-2.13,6.81,47.51],[1.60,.45,.97],45],
  [[-1.13,7.38,48.29],[1.11,.38,.75],32],
  [[-5.88,3.66,51.03],[1.34,.44,.88],48],
  [[-4.61,7.81,48.72],[1.39,.49,1.06],47],
  [[-7.55,8.52,47.31],[1.52,.47,1.04],40],
  [[-6.51,4.08,50.64],[1.16,.41,.82],37],
]

export function makeBark() {
  const positions: number[] = [], colors: number[] = [], indices: number[] = []
  const dark = new Color('#26281c'), lit = new Color('#8b6940'), color = new Color()
  for (const [branchIndex, branch] of branches.entries()) {
    const curve = new CatmullRomCurve3(branch.points.map(p => new Vector3(...p)))
    const segments = 18, sides = 12
    const frames = curve.computeFrenetFrames(segments, false)
    const offset = positions.length / 3
    for (let row=0;row<=segments;row++) {
      const t = row/segments
      const axis = curve.getPointAt(t)
      const radius = branch.tip + (branch.root-branch.tip)*Math.pow(1-t,1.02)
      for (let side=0;side<sides;side++) {
        const angle = side/sides*Math.PI*2
        const groove = .72 + .22*Math.sin(side*2.9+branchIndex)*Math.sin(t*14+side) + .15*Math.cos(angle*4+t*4)
        const point = axis.clone().addScaledVector(frames.normals[row],Math.cos(angle)*radius*groove)
          .addScaledVector(frames.binormals[row],Math.sin(angle)*radius*groove)
        positions.push(point.x,point.y,point.z)
        color.copy(dark).lerp(lit,.28 + .20*Math.sin(angle*3+t*19+branchIndex) + .14*Math.cos(angle*2))
        colors.push(color.r,color.g,color.b)
        if (row) {
          const a = offset+(row-1)*sides+side
          const b = offset+(row-1)*sides+(side+1)%sides
          indices.push(a,b,a+sides,b,b+sides,a+sides)
        }
      }
    }
  }
  const bark = new BufferGeometry()
  bark.setAttribute('position',new Float32BufferAttribute(positions,3))
  bark.setAttribute('color',new Float32BufferAttribute(colors,3))
  bark.setIndex(indices)
  bark.computeVertexNormals()
  return bark
}

export function makeNeedles(distant=false) {
  const positions: number[] = [], colors: number[] = []
  const shadow = new Color('#34492c'), gold = new Color('#8a8345'), tint = new Color()
  let seed = 19313
  function random() {
    seed = (Math.imul(seed,1664525)+1013904223) >>> 0
    return seed / 4294967296
  }
  for (const [[x,y,z],[width,height,depth],tufts] of crowns) {
    for (let i=0;i<Math.ceil(tufts*(distant?.85:2.15));i++) {
      const azimuth = i*2.39996, reach = Math.sqrt(random())
      const origin = new Vector3(x+Math.cos(azimuth)*width*reach,
        y+(random()-.52)*height*1.16, z+Math.sin(azimuth)*depth*reach)
      for (let blade=0;blade<(distant?14:30);blade++) {
        const angle = blade*.49 + azimuth, length = .145 + random()*.39
        const dx=Math.cos(angle), dz=Math.sin(angle), base=.038+random()*.042
        const spread=.032+random()*.084
        positions.push(origin.x-dz*base,origin.y,origin.z+dx*base,
          origin.x+dz*base,origin.y,origin.z-dx*base,
          origin.x+dx*length,origin.y+spread+random()*.094,origin.z+dz*length)
        tint.copy(shadow).lerp(gold,.02+random()*.20)
        for(let j=0;j<2;j++) colors.push(tint.r,tint.g,tint.b)
        tint.lerp(gold,.23+random()*.24)
        colors.push(tint.r,tint.g,tint.b)
      }
    }
  }
  const needles = new BufferGeometry()
  needles.setAttribute('position',new Float32BufferAttribute(positions,3))
  needles.setAttribute('color',new Float32BufferAttribute(colors,3))
  needles.computeVertexNormals()
  return needles
}

