import { Bone, Float32BufferAttribute, MathUtils, Mesh, Object3D, Quaternion, Skeleton, SkinnedMesh, Uint16BufferAttribute, Vector3 } from 'three'

function joint(parent: Object3D, name: string, x: number, y: number, z: number) {
  const bone = new Bone()
  bone.name = name
  bone.position.set(x, y, z)
  parent.add(bone)
  return bone
}

export function createSeatedRig(scene: Object3D) {
  const source = scene.getObjectByName('geometry_0')
  if (!(source instanceof Mesh)) throw new Error('持拍者 GLB 缺少源网格')
  scene.updateWorldMatrix(true, true)
  const geometry = source.geometry.clone().applyMatrix4(source.matrixWorld)
  const mesh = new SkinnedMesh(geometry, source.material)
  mesh.frustumCulled = false
  mesh.castShadow = true
  const pelvis = joint(mesh, 'Pelvis', 0, .71, 0)
  const torso = joint(pelvis, 'Torso', 0, .13, 0)
  const head = joint(torso, 'Head', 0, .345, 0)
  const thighs = joint(pelvis, 'Thighs', 0, 0, 0)
  const shins = joint(thighs, 'Shins', 0, -.33, 0)
  function arm(side: number, name: string) {
    const shoulder = joint(torso, name + 'Shoulder', side * .155, .265, .02)
    const elbow = joint(shoulder, name + 'Elbow', side * .11, -.205, -.01)
    const wrist = joint(elbow, name + 'Wrist', side * .09, -.165, -.03)
    return { shoulder, elbow, wrist }
  }
  const right = arm(1, 'Right')
  const left = arm(-1, 'Left')
  const skeleton = new Skeleton([
    pelvis, torso, head, thighs, shins,
    right.shoulder, right.elbow, right.wrist, left.shoulder, left.elbow, left.wrist,
  ])
  // Anatomical weights for the normalized Aholo mesh. The skirt stays together as it folds.
  const positions = geometry.getAttribute('position')
  const weights: number[] = []
  const indices: number[] = []
  const smooth = MathUtils.smoothstep
  for (let i = 0; i < positions.count; i++) {
    const sign = positions.getX(i)
    const x = Math.abs(sign)
    const y = positions.getY(i)
    const innerArm = MathUtils.lerp(.24, .12, MathUtils.clamp((y - .69) / .43, 0, 1))
    const sleeve = smooth(x, innerArm, innerArm + .10) * (1 - smooth(y, 1.08, 1.24))
    const elbow = 1 - smooth(y, .82, .96)
    const wrist = 1 - smooth(y, .68, .77)
    const headWeight = smooth(y, 1.14, 1.26)
    const torsoWeight = smooth(y, .72, .89)
    const legWeight = 1 - smooth(y, .60, .77)
    const shinWeight = 1 - smooth(y, .31, .47)
    const armIndex = sign >= 0 ? 5 : 8
    const influences = [
      [0, (1 - sleeve) * (1 - legWeight) * (1 - torsoWeight)],
      [1, (1 - sleeve) * torsoWeight * (1 - headWeight)],
      [2, (1 - sleeve) * headWeight],
      [3, (1 - sleeve) * legWeight * (1 - shinWeight)],
      [4, (1 - sleeve) * legWeight * shinWeight],
      [armIndex, sleeve * (1 - elbow)],
      [armIndex + 1, sleeve * elbow * (1 - wrist)],
      [armIndex + 2, sleeve * wrist],
    ].sort((a, b) => b[1] - a[1]).slice(0, 4)
    const total = influences.reduce((sum, [, weight]) => sum + weight, 0)
    for (const [index, weight] of influences) {
      indices.push(index)
      weights.push(weight / total)
    }
  }
  geometry.setAttribute('skinIndex', new Uint16BufferAttribute(indices, 4))
  geometry.setAttribute('skinWeight', new Float32BufferAttribute(weights, 4))
  mesh.bind(skeleton)
  return { mesh, pelvis, torso, head, thighs, shins, right, left }
}

export type Arm = ReturnType<typeof createSeatedRig>['right']

const direction = new Vector3()
const bend = new Vector3()
const elbowGoal = new Vector3()
const wristGoal = new Vector3()
const rest = new Vector3()
const boneAxis = new Vector3()
const parentRotation = new Quaternion()

function aimBone(bone: Bone, child: Bone, point: Vector3) {
  const parent = bone.parent!
  parent.worldToLocal(rest.copy(point))
  rest.sub(bone.position).normalize()
  bone.quaternion.setFromUnitVectors(boneAxis.copy(child.position).normalize(), rest)
}

export function solveArm(arm: Arm, shoulder: Vector3, target: Vector3, pole: Vector3, rotation: Quaternion) {
  const { elbow, wrist } = arm
  const upper = elbow.position.length()
  const lower = wrist.position.length()
  direction.subVectors(target, shoulder)
  const distance = MathUtils.clamp(direction.length(), Math.abs(upper - lower) + .001, upper + lower - .001)
  direction.normalize()
  bend.copy(pole).addScaledVector(direction, -pole.dot(direction)).normalize()
  const along = (upper * upper - lower * lower + distance * distance) / (2 * distance)
  elbowGoal.copy(shoulder).addScaledVector(direction, along).addScaledVector(bend, Math.sqrt(Math.max(0, upper * upper - along * along)))
  wristGoal.copy(shoulder).addScaledVector(direction, distance)
  aimBone(arm.shoulder, elbow, elbowGoal)
  aimBone(elbow, wrist, wristGoal)
  elbow.getWorldQuaternion(parentRotation)
  wrist.quaternion.copy(parentRotation.invert()).multiply(rotation)
}
