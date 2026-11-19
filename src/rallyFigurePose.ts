import { Euler, MathUtils, Matrix4, Quaternion, Vector3 } from 'three'
import { FIGURE_BIND, FIGURE_JOINTS, type FigureJoint } from './assets/rallyMesh.ts'
import type { Rally } from './rally'

export const RACKET_REACH = .575
type Joints<T> = Record<FigureJoint, T>
const bind = Object.fromEntries(FIGURE_JOINTS.map(name => [name, new Vector3(...FIGURE_BIND[name])])) as Joints<Vector3>
const yAxis = new Vector3(0, 1, 0)
const neutralFace = new Vector3(.17, .12, -1)
const neutralHandle = new Vector3(.41, .90, -.23).normalize()
const loadHandle = new Vector3(.68, .59, .44).normalize()
const shadowLoadHandle = new Vector3(.88, .47, .30).normalize()
const releaseHandle = new Vector3(-.59, .64, -.36).normalize()
const followCenter = new Vector3(-.48, 1.63, -.45)
const rightPole = new Vector3(.80, -.46, .16)
const leftPole = new Vector3(-.76, -.40, .22)
const rightKneePole = new Vector3(.26, 0, -1)
const leftKneePole = new Vector3(-.42, 0, -1)
const smooth = MathUtils.smoothstep

export function createRallyFigurePose() {
  const joint = Object.fromEntries(FIGURE_JOINTS.map(name => [name, bind[name].clone()])) as Joints<Vector3>
  const rotation = Object.fromEntries(FIGURE_JOINTS.map(name => [name, new Quaternion()])) as Joints<Quaternion>
  const racket = new Quaternion()
  const lastOrigin = new Vector3()
  const traveled = new Vector3()
  const ball = new Vector3()
  const impact = new Vector3()
  const headAim = new Vector3()
  const racketAxis = new Vector3()
  const racketCenter = new Vector3()
  const face = new Vector3()
  const right = new Vector3()
  const a = new Vector3()
  const b = new Vector3()
  const hingeAxis = new Vector3()
  const hingeBend = new Vector3()
  const matrix = new Matrix4()
  const angles = new Euler(0, 0, 0, 'YXZ')
  let step = 0
  let movement = 0
  let ready = 0
  let initialized = false

  const relative = (output: FigureJoint, parent: FigureJoint, turn: Quaternion) => {
    joint[output].copy(bind[output]).sub(bind[parent]).applyQuaternion(turn).add(joint[parent])
  }
  const orient = (start: FigureJoint, end: FigureJoint) => {
    a.copy(bind[end]).sub(bind[start]).normalize()
    b.copy(joint[end]).sub(joint[start]).normalize()
    rotation[start].setFromUnitVectors(a,b)
  }
  // Controlling where the elbow/knee bends keeps cloth and wrists continuous.
  const hinge = (start: FigureJoint, mid: FigureJoint, end: FigureJoint, pole: Vector3) => {
    const origin = joint[start]
    const upper = bind[start].distanceTo(bind[mid])
    const lower = bind[mid].distanceTo(bind[end])
    hingeAxis.copy(joint[end]).sub(origin)
    const distance = Math.max(.001, hingeAxis.length())
    hingeAxis.multiplyScalar(1 / distance)
    hingeBend.copy(pole).addScaledVector(hingeAxis, -pole.dot(hingeAxis)).normalize()
    const reach = Math.min(distance, upper + lower - .003)
    const along = (upper * upper - lower * lower + reach * reach) / (2 * reach)
    joint[mid].copy(origin).addScaledVector(hingeAxis, along)
      .addScaledVector(hingeBend, Math.sqrt(Math.max(0, upper * upper - along * along)))
    orient(start,mid)
    orient(mid,end)
  }

  function sample(rally: Rally, origin: Vector3, away: boolean, delta: number) {
    const sign = away ? -1 : 1
    const local = (output: Vector3, point: {x: number; y: number; z: number}) => output.set(
      (point.x - origin.x) * sign, point.y - origin.y, (point.z - origin.z) * sign,
    )
    const contact = away ? rally.shadowContact : rally.playerContact
    const age = contact ? rally.time - contact.time : Infinity
    const {phase, ritual} = rally.getStatus()
    const shadowOnCloud = away && ritual === 'mountain'
    const shot = age >= 0 && age < .74
    const follow = shot ? smooth(age, .012, shadowOnCloud ? .24 : .33) : 0
    const recover = shot ? smooth(age, shadowOnCloud ? .35 : .25, .74) : 1
    const arc = (1 - recover) * follow
    local(ball, rally.position())
    if (!initialized || lastOrigin.distanceToSquared(origin) > 16) {
      lastOrigin.copy(origin)
      initialized = true
      movement = 0
      step = 0
      ready = 0
      traveled.set(0,0,0)
    }
    const dx = (origin.x - lastOrigin.x) * sign
    const dz = (origin.z - lastOrigin.z) * sign
    const distance = Math.hypot(dx,dz)
    lastOrigin.copy(origin)
    step += distance * 6.4
    const dt = Math.min(delta, .065)
    movement = MathUtils.damp(movement, Math.min(.96, distance / Math.max(.01,dt) * .29), 15, dt)
    if (distance > .001) traveled.set(dx,0,dz).normalize()
    const receiving = away ? phase === 'outbound' : phase === 'incoming' || phase === 'window'
    const watch = receiving ? 1 - smooth(-ball.z, 1.0, shadowOnCloud ? 9.4 : away ? 6.7 : 8.4) : 0
    ready = MathUtils.damp(ready, shot ? 0 : watch, shot ? 17 : 10, dt)
    const curve = shot ? 1 - recover : 0
    const anticipation = ready * (shot ? recover : 1)
    const stride = Math.sin(step)
    if (contact && shot) local(impact,contact.position)

    const load = anticipation * .12
    const reachX = shot ? MathUtils.clamp(impact.x - .54, -.46, .46) * curve : 0
    const reachZ = shot ? MathUtils.clamp(impact.z + .37, -.32, .24) * curve : 0
    // The front foot catches the weight before the torso and sleeve finish travelling.
    const plant = shot ? smooth(age,.016,.14) * (1-smooth(age,.32,.70)) : 0
    const hipYaw = (shadowOnCloud ? -.53 : -.34) * anticipation + arc * .51 + plant*.09
    const chestYaw = hipYaw + arc * .29 - load
    const breath = Math.sin(rally.time*2.6) * .009
    joint.hips.set(-load + .56*reachX - arc*.11 - plant*.075, .79 - .11*anticipation - arc*.073 - plant*.035 + breath,
      .13*load + .63*reachZ - arc*.106)
    rotation.hips.setFromEuler(angles.set(.055*anticipation, hipYaw, arc*.11))
    relative('chest','hips',rotation.hips)
    joint.chest.x += reachX * .48 - arc*.022
    joint.chest.z += reachZ * .41 - anticipation*.035
    rotation.chest.setFromEuler(angles.set(-.19*anticipation - arc*.23, chestYaw, -.095*anticipation + arc*.23))
    relative('rightShoulder','chest',rotation.chest)
    relative('leftShoulder','chest',rotation.chest)
    joint.rightShoulder.y -= .028*anticipation
    relative('neck','chest',rotation.chest)
    headAim.copy(ball).sub(joint.neck)
    const yaw = MathUtils.clamp(-Math.atan2(headAim.x, Math.max(.10,-headAim.z)), -.62,.62)
    const pitch = MathUtils.clamp(Math.atan2(headAim.y, Math.hypot(headAim.x,headAim.z)), -.54,.41)
    rotation.neck.setFromEuler(angles.set(pitch*.44,chestYaw*.18+yaw*.31,arc*.10))
    relative('head','neck',rotation.neck)
    rotation.head.setFromEuler(angles.set(pitch*.64,yaw*.67+chestYaw*.21,arc*.12))

    racketAxis.copy(neutralHandle).lerp(shadowOnCloud ? shadowLoadHandle : loadHandle, anticipation*.92).normalize()
    face.copy(neutralFace)
    relative('rightWrist','chest',rotation.chest)
    joint.rightWrist.addScaledVector(traveled, movement*.035)
    joint.rightWrist.z += anticipation*.34
    joint.rightWrist.y -= anticipation*.13
    if (shadowOnCloud) joint.rightWrist.x += anticipation * .13
    if (contact && shot) {
      racketCenter.copy(impact).lerp(followCenter,follow)
      if (shadowOnCloud) racketCenter.y += .18 * follow * (1 - recover)
      // Pull a very wide miss into a plausible follow-through after the actual strike frame.
      racketCenter.lerpVectors(racketCenter, b.copy(joint.rightWrist).addScaledVector(racketAxis,RACKET_REACH), recover)
      racketAxis.lerp(releaseHandle, follow * (1 - recover)).normalize()
      a.copy(racketCenter).sub(joint.rightShoulder)
      if (a.length() > .78) racketAxis.lerp(a.normalize(), (1 - recover) * (.83 - .45*follow)).normalize()
      joint.rightWrist.copy(racketCenter).addScaledVector(racketAxis,-RACKET_REACH)
      face.x -= arc * 1.0
    }
    right.crossVectors(racketAxis,face).normalize()
    face.crossVectors(right,racketAxis).normalize()
    racket.setFromRotationMatrix(matrix.makeBasis(right,racketAxis,face))
    hinge('rightShoulder','rightElbow','rightWrist',rightPole)
    rotation.rightWrist.copy(rotation.rightElbow)

    relative('leftWrist','chest',rotation.chest)
    joint.leftWrist.x -= .21*anticipation + .18*arc
    joint.leftWrist.z -= .092*anticipation - .09*arc
    joint.leftWrist.y -= .041*arc
    hinge('leftShoulder','leftElbow','leftWrist',leftPole)
    rotation.leftWrist.copy(rotation.leftElbow)

    relative('rightHip','hips',rotation.hips)
    relative('leftHip','hips',rotation.hips)
    joint.rightAnkle.copy(bind.rightAnkle).addScaledVector(traveled,stride*movement*.219)
    joint.leftAnkle.copy(bind.leftAnkle).addScaledVector(traveled,-stride*movement*.219)
    joint.rightAnkle.y += Math.max(0,stride)*movement*.102
    joint.leftAnkle.y += Math.max(0,-stride)*movement*.102
    joint.leftAnkle.z -= .13*anticipation + .12*plant
    joint.rightAnkle.y += .065*plant
    joint.rightAnkle.z += .075*plant
    hinge('rightHip','rightKnee','rightAnkle',rightKneePole)
    hinge('leftHip','leftKnee','leftAnkle',leftKneePole)
    rotation.rightAnkle.setFromAxisAngle(yAxis, -arc*.25)
    rotation.leftAnkle.setFromAxisAngle(yAxis, arc*.14)

    const lag = shot ? Math.sin(smooth(age,.025,.68)*Math.PI) * (1 - recover*.45) : 0
    for (const name of ['hemBack','hemLeft','hemRight'] as const) {
      relative(name,'hips',rotation.hips)
      joint[name].x -= lag * .088
      joint[name].z += lag * .117 + movement * stride * .06
      rotation[name].setFromEuler(angles.set(.17*lag,hipYaw-.38*lag,-.15*lag+movement*stride*.13))
    }
  }
  return { joint, rotation, racket, sample }
}
