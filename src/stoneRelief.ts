import { BufferGeometry, Float32BufferAttribute, MathUtils, Vector3 } from 'three'
import { STONE_PROLOGUE } from './stonePrologueLayout'

type Point = readonly [number, number]
type Relief = {
  outline: readonly Point[]
  center: Point
  depth: number
  thickness: number
  relief: number
}

// These rings form a closed rock volume. UVs use only the corresponding patch of the approved card.
// The rear rings pull into the same patch, so surfaces remain textured during the fly-through.
export function buildRelief({ outline, center, depth, thickness, relief }: Relief) {
  const eye = new Vector3(...STONE_PROLOGUE.eye)
  const forward = new Vector3(...STONE_PROLOGUE.look).sub(eye).normalize()
  const up = new Vector3(0, -forward.z, forward.y)
  const zoom = Math.tan(MathUtils.degToRad(STONE_PROLOGUE.fov / 2))
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [], colors: number[] = []
  const rings = [
    { radius: .01, z: -relief, uv: .01, shade: 1 },
    { radius: .42, z: -relief * .9, uv: .42, shade: 1 },
    { radius: .78, z: -relief * .52, uv: .78, shade: 1 },
    { radius: 1, z: 0, uv: 1, shade: 1 },
    { radius: .98, z: thickness * .23, uv: .92, shade: .63 },
    { radius: .87, z: thickness * .76, uv: .72, shade: .47 },
    { radius: .72, z: thickness, uv: .56, shade: .54 },
    { radius: .01, z: thickness * 1.05, uv: .01, shade: .6 },
  ]
  const contour = outline.flatMap((point, i) => {
    const next = outline[(i + 1) % outline.length]
    return [point, [(point[0] + next[0]) / 2, (point[1] + next[1]) / 2] as const]
  })
  const n = contour.length
  for (let row = 0; row < rings.length; row++) {
    const ring = rings[row]
    contour.forEach(([x, y], i) => {
      const px = MathUtils.lerp(center[0], x, ring.radius)
      const py = MathUtils.lerp(center[1], y, ring.radius)
      const ripple = Math.sin(i * 1.72 + row * .9) * .33 * ring.radius
      const distance = depth + ring.z + ripple
      const point = eye.clone().addScaledVector(forward, distance)
        .addScaledVector(up, (1 - (py - 40) / 379) * zoom * distance)
      point.x += ((px - 674) / 379) * zoom * distance
      positions.push(point.x, point.y, point.z)
      uvs.push(MathUtils.lerp(center[0], x, ring.uv) / 1672, 1 - MathUtils.lerp(center[1], y, ring.uv) / 941)
      colors.push(ring.shade, ring.shade, ring.shade)
      if (row) {
        const a = (row - 1) * n + i, b = (row - 1) * n + (i + 1) % n
        indices.push(a, b, a + n, b, b + n, a + n)
      }
    })
  }
  for (let i = 1; i < n - 1; i++) {
    const back = (rings.length - 1) * n
    indices.push(0, i + 1, i, back, back + i, back + i + 1)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

export const thresholdReliefs: Record<string, Relief> = {
  left: { center: [330, 395], depth: 18, thickness: 10, relief: 2.5, outline: [
    [0,202],[110,159],[251,149],[416,153],[486,193],[541,238],[598,273],[626,318],
    [619,363],[601,403],[606,436],[580,485],[569,537],[550,592],[527,647],[492,682],
    [356,705],[190,726],[0,730],
  ] },
  right: { center: [1134, 355], depth: 19.4, thickness: 10, relief: 3, outline: [
    [895,233],[916,166],[950,111],[1002,78],[1100,76],[1224,84],[1345,114],[1346,704],
    [1160,710],[1017,687],[966,655],[940,616],[947,558],[932,495],[929,446],[911,390],
    [903,342],[892,290],
  ] },
  crown: { center: [739,146], depth: 18.6, thickness: 10, relief: 2, outline: [
    [425,136],[481,98],[559,58],[668,41],[867,41],[1017,42],[1092,82],[1030,137],
    [970,190],[909,240],[844,255],[786,249],[740,257],[661,261],[597,276],[548,252],
    [500,206],[458,174],
  ] },
  bankLeft: { center: [145, 664], depth: 9.2, thickness: 4.6, relief: 1, outline: [
    [0,560],[61,549],[116,556],[168,576],[209,612],[239,666],[253,729],[273,796],[0,796],
  ] },
  bankRight: { center: [1240, 764], depth: 10.5, thickness: 4.4, relief: 1, outline: [
    [1102,795],[1129,753],[1172,720],[1216,718],[1260,705],[1310,701],[1345,715],[1345,796],
  ] },
}
