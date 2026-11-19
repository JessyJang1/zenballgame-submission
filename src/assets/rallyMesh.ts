import { BufferAttribute, BufferGeometry, Color } from 'three'

// Art and animation share this model-space bind stance. Facing is -Z.
export const FIGURE_BIND = {
  hips: [0, .79, 0], chest: [0, 1.09, -.035], neck: [0, 1.355, -.04], head: [0, 1.53, -.045],
  rightShoulder: [.225, 1.29, -.02], rightElbow: [.40, 1.07, -.10], rightWrist: [.52, 1.02, -.36],
  leftShoulder: [-.225, 1.285, -.02], leftElbow: [-.43, 1.06, -.025], leftWrist: [-.51, .95, -.24],
  rightHip: [.125, .80, .025], rightKnee: [.33, .40, -.21], rightAnkle: [.42, .088, -.215],
  leftHip: [-.125, .80, .025], leftKnee: [-.34, .43, .15], leftAnkle: [-.47, .088, .31],
  hemBack: [-.09, .65, .16], hemLeft: [-.23, .63, .01], hemRight: [.23, .63, .025],
} as const

export type FigureJoint = keyof typeof FIGURE_BIND
export const FIGURE_JOINTS = Object.keys(FIGURE_BIND) as FigureJoint[]
const indicesByJoint = Object.fromEntries(FIGURE_JOINTS.map((joint, i) => [joint, i])) as Record<FigureJoint, number>
type Weights = readonly (readonly [FigureJoint, number])[]

export function skinPart(source: BufferGeometry, tone: Color | string | null, weights: Weights | ((x: number, y: number, z: number) => Weights)) {
  const geometry = source.index ? source.toNonIndexed() : source
  if (geometry !== source) source.dispose()
  geometry.deleteAttribute('uv')
  if (!geometry.getAttribute('normal')) geometry.computeVertexNormals()
  const points = geometry.getAttribute('position')
  if (tone !== null || !geometry.getAttribute('color')) {
    const tint = new Color(tone ?? '#ffffff')
    const pigment = new Float32Array(points.count * 3)
    for (let i = 0; i < points.count; i++) pigment.set([tint.r, tint.g, tint.b], i * 3)
    geometry.setAttribute('color', new BufferAttribute(pigment, 3))
  }
  const ids = new Uint16Array(points.count * 4)
  const mix = new Float32Array(points.count * 4)
  for (let i = 0; i < points.count; i++) {
    const links = typeof weights === 'function' ? weights(points.getX(i), points.getY(i), points.getZ(i)) : weights
    const sum = links.reduce((total, [, weight]) => total + weight, 0)
    links.forEach(([joint, weight], j) => {
      ids[i * 4 + j] = indicesByJoint[joint]
      mix[i * 4 + j] = weight / sum
    })
  }
  geometry.setAttribute('skinIndex', new BufferAttribute(ids, 4))
  geometry.setAttribute('skinWeight', new BufferAttribute(mix, 4))
  return geometry
}
