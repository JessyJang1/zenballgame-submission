import { BufferGeometry, Color, Float32BufferAttribute, MathUtils } from 'three'

type Peak = readonly [x: number, z: number, top: number, width: number, depth: number, drift: number]
const ranges: readonly (readonly Peak[])[] = [
  [[-25,-47,17.9,8.4,5.8,2.6],[-16.5,-51,18.3,6.1,6.0,-.7],
   [-9.2,-56,15.5,4.4,4.8,1.19],[-5.9,-59,12.3,3,4.1,-.34],
   [12.9,-54,14.5,4.6,3.8,1.1],[19.5,-57,20.6,6.3,6.1,-1.8],[25.7,-55,19.8,7.4,4.9,.7]],
  [[-36,-64,24,9.2,8,-2],[-26,-66,25.6,7.1,6.5,1.1],[-17,-72,24.5,6.1,5.5,-2.1],
   [-10,-76,21.2,5.1,7,1.8],[-5.1,-82,19.3,4.3,5.2,-.7],[.6,-85,15.5,4.6,5.7,-1.8],
   [13.3,-82,23.2,6,7,1.8],[21.6,-84,27.7,7.1,6,-1],[27,-81,24.1,8,8.8,2.3]],
  [[-44,-99,31,12,8,1.9],[-30,-104,31,8.4,8.5,4],[-18,-112,29,7.3,6.3,-2],
   [-10,-111,25.5,5.6,6.1,-2.4],[-2,-118,28,5.6,5.7,1.2],[6.7,-118,22.1,5.2,7,-1.2],
   [14,-122,27,7,6.6,2.7],[25,-114,29,9,7.4,-2.4],[37,-116,32,10,6,1.6]],
]

// Short, paired beds retain a hard scarp, while the longer spaces between
// the beds develop a talus slope. Each profile has its own summit shoulder.
const beds = [0,.13,.24,.30,.324,.39,.46,.487,.55,.61,.629,.694,.75,.775,.82,.87,.897,.946,1]
const crown = [
  [.83,.55,.19], [.76,.48,.32], [.69,.58,.27], [.80,.51,.12], [.74,.64,.37],
] as const

export function courtRidges() {
  const positions: number[] = [], colors: number[] = [], indices: number[] = []
  const color = new Color()
  const sides = 30
  for (const [layer, peaks] of ranges.entries()) {
    const shade = new Color(['#284941','#3a5c56','#577580'][layer])
    const silt = new Color(['#bca16e','#a59472','#98aaa1'][layer])
    const fissure = new Color(['#293f38','#374c47','#536d76'][layer])
    for (const [id,[x,z,top,width,depth,drift]] of peaks.entries()) {
      const start = positions.length / 3
      const seed = .87 + id * 1.386 + layer * .449
      const [shoulder, bench, tip] = crown[(id+layer*2)%crown.length]
      const base = -12 - layer * 3
      for (const [row, grade] of beds.entries()) {
        const upper = MathUtils.smoothstep(grade,shoulder,1)
        const scarp = MathUtils.smoothstep(grade,.20,shoulder)
        const ledge = ([0,.043,-.012,.034,-.020][row%5])
        for (let sector=0; sector<sides; sector++) {
          const a = sector/sides*2*Math.PI
          const fault = a + seed + grade * .46
          const split = Math.pow((1+Math.cos(5*fault + .54*Math.sin(grade*14)))/2,5)
          const slab = Math.sin(3*a+seed) * .17 + Math.cos(7*a+seed*2) * .092
          const dip = .62*Math.sin(2*a+seed) + .22*Math.cos(5*a-grade*8)
          const notch = MathUtils.smoothstep(grade,.72,1) * (.31 + .33*Math.cos(seed+2*a)) * split
          const bed = ledge * (1 + .52*Math.sin(fault*3)) + .035*Math.sin(grade*28+a*4)
          const roof = MathUtils.lerp(1.14 - (1.14-bench)*scarp,tip,upper)
          const radius = Math.max(.08, roof + bed - notch) * (1+slab-.24*split)
          const yaw = .13 * Math.sin(seed) + .13 * Math.sin(grade*4+seed)
          const lateral = width * Math.cos(a+yaw) * radius
          const cross = depth * Math.sin(a+yaw) * radius
          const breakTop = upper * (.089*Math.cos(2*a+seed) + .044*Math.sin(a*7+seed) - .135*split)
          const fall = -.112*Math.sin(a+seed)*scarp*(1-upper)
          positions.push(x+lateral+drift*grade*grade,base+(top-base)*(grade+breakTop+fall)+dip*scarp,z+cross+1.3*grade)
          const ridgeRock = .22 + .23*grade + .16*Math.max(0,Math.sin(3*a+seed)) + ledge*2.6
          color.copy(shade).lerp(silt,MathUtils.clamp(ridgeRock,0,1)).lerp(fissure,split*.57)
          colors.push(color.r,color.g,color.b)
          if (row > 0) {
            const prev = start + (row-1)*sides+sector
            const next = start + (row-1)*sides+(sector+1)%sides
            indices.push(prev,prev+sides,next+sides,prev,next+sides,next)
          }
        }
      }
      const cap = positions.length/3, rim = cap-sides
      positions.push(x+drift,top-.42,z+1.3)
      color.copy(shade).lerp(silt,.43)
      colors.push(color.r,color.g,color.b)
      for (let j=0;j<sides;j++) indices.push(cap,rim+(j+1)%sides,rim+j)
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3))
  geometry.setAttribute('color',new Float32BufferAttribute(colors,3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}
