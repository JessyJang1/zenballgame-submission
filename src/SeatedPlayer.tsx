import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { createPortal, useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { Color, MathUtils, Matrix4, Quaternion, Vector3, type InstancedMesh } from 'three'
import type { Rally } from './rally'
import { createSeatedRig, solveArm } from './assets/seatedRig'

const modelUrl = new URL('../art/staging/rejected-8214196/racket-holder.glb', import.meta.url).href
const modelScale = 1.24
const racketCenter = .67
const up = new Vector3(0, 1, 0)
const bamboo = '#a47742'
const wrapping = '#c0a174'
type Point = readonly [number, number, number]

function BambooRod({ from, to, radius, color = bamboo }: { from: Point; to: Point; radius: number; color?: string }) {
  const start = new Vector3(...from)
  const end = new Vector3(...to)
  const axis = end.clone().sub(start)
  return (
    <mesh position={start.lerp(end, .5)} quaternion={new Quaternion().setFromUnitVectors(up, axis.clone().normalize())}>
      <cylinderGeometry args={[radius * .93, radius, axis.length(), 9]} />
      <meshStandardMaterial color={color} roughness={.86} />
    </mesh>
  )
}

type ChairRod = { from: Point; to: Point; radius: number; color?: string }

const chairRods: ChairRod[] = [
  ...[-.34, .34].flatMap((x): ChairRod[] => [
    { from: [x, .02, -.40], to: [x, .78, -.32], radius: .028 },
    { from: [x, .02, .42], to: [x, 1.08, .53], radius: .028 },
    { from: [x, .43, -.44], to: [x, .43, .49], radius: .028 },
    { from: [x, .72, -.43], to: [x, .75, .51], radius: .025 },
    { from: [x, .16, -.38], to: [x, .16, .44], radius: .018 },
    ...[.43, .72].map((y): ChairRod => ({
      from: [x, y - .026, -.34], to: [x, y + .026, -.34], radius: .032, color: wrapping,
    })),
  ]),
  ...Array.from({ length: 11 }, (_, i): ChairRod => {
    const z = -.39 + i * .083
    return { from: [-.35, .452, z], to: [.35, .452, z], radius: .013, color: i % 3 ? undefined : wrapping }
  }),
  ...Array.from({ length: 10 }, (_, i): ChairRod => {
    const y = .49 + i * .061
    const z = .45 + i * .008
    return { from: [-.35, y, z], to: [.35, y, z], radius: .016, color: i % 3 ? undefined : wrapping }
  }),
]

function BambooChair() {
  const mesh = useRef<InstancedMesh>(null)
  useLayoutEffect(() => {
    const chair = mesh.current!
    const transform = new Matrix4()
    const start = new Vector3()
    const end = new Vector3()
    const axis = new Vector3()
    const scale = new Vector3()
    const rotation = new Quaternion()
    const tint = new Color()
    chairRods.forEach(({ from, to, radius, color }, i) => {
      start.set(...from)
      end.set(...to)
      axis.subVectors(end, start)
      scale.set(radius, axis.length(), radius)
      rotation.setFromUnitVectors(up, axis.normalize())
      transform.compose(start.lerp(end, .5), rotation, scale)
      chair.setMatrixAt(i, transform)
      chair.setColorAt(i, tint.set(color ?? bamboo))
    })
    chair.instanceMatrix.needsUpdate = true
    chair.instanceColor!.needsUpdate = true
  }, [])
  return (
    <instancedMesh name="Bamboo chair" ref={mesh} args={[undefined, undefined, chairRods.length]}>
      <cylinderGeometry args={[.93, 1, 1, 9]} />
      <meshStandardMaterial roughness={.86} />
    </instancedMesh>
  )
}

const racketStrings = new Float32Array(
  [-.8, -.6, -.4, -.2, 0, .2, .4, .6, .8].flatMap((step) => {
    const halfChord = Math.sqrt(1 - step * step)
    return [
      step * .143, racketCenter - halfChord * .204, 0, step * .143, racketCenter + halfChord * .204, 0,
      -halfChord * .143, racketCenter + step * .204, 0, halfChord * .143, racketCenter + step * .204, 0,
    ]
  }),
)

function RattanRacket() {
  return (
    <group name="Racket mounted to right wrist">
      <BambooRod from={[0, -.075, 0]} to={[0, .19, 0]} radius={.029} color="#244941" />
      <BambooRod from={[0, .17, 0]} to={[-.105, .522, 0]} radius={.014} />
      <BambooRod from={[0, .17, 0]} to={[.105, .522, 0]} radius={.014} />
      <mesh position-y={racketCenter} scale={[1, 1.41, .78]}>
        <torusGeometry args={[.149, .012, 9, 38]} />
        <meshStandardMaterial color="#a75f39" roughness={.78} />
      </mesh>
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[racketStrings, 3]} />
        </bufferGeometry>
        <lineBasicMaterial color="#d5be8d" />
      </lineSegments>
    </group>
  )
}

export default function SeatedPlayer({ rally }: { rally: Rally }) {
  const { scene } = useGLTF(modelUrl, false, false)
  const rig = useMemo(() => createSeatedRig(scene), [scene])
  const pose = useMemo(() => ({
    readiness: 0,
    gaze: new Vector3(),
    contact: new Vector3(),
    line: new Vector3(),
    across: new Vector3(),
    normal: new Vector3(),
    rightShoulder: new Vector3(),
    leftShoulder: new Vector3(),
    wristTarget: new Vector3(),
    leftTarget: new Vector3(),
    rightPole: new Vector3(.85, -.62, .36),
    leftPole: new Vector3(-.9, -.65, .12),
    mount: new Quaternion(),
    freeHand: new Quaternion(),
    basis: new Matrix4(),
  }), [])
  useEffect(() => () => {
    rig.mesh.geometry.dispose()
    rig.mesh.skeleton.dispose()
  }, [rig])

  useFrame((_, delta) => {
    const { mesh, pelvis, torso, head, thighs, shins, right, left } = rig
    const { phase } = rally.getStatus()
    const event = rally.playerContact
    const age = event ? rally.time - event.time : Infinity
    const hitting = age < .55
    const watch = phase === 'incoming' || phase === 'window'
    pose.readiness = age < .09 ? 0 : MathUtils.damp(pose.readiness, watch ? 1 : 0, 10, delta)
    const ready = pose.readiness
    const stretch = hitting ? 1 - MathUtils.smoothstep(age, .12, .45) : 0
    const follow = hitting ? MathUtils.smoothstep(age, .045, .19) : 0
    const ball = rally.position()
    mesh.worldToLocal(pose.gaze.set(ball.x, ball.y, ball.z))
    if (event && hitting) mesh.worldToLocal(pose.contact.set(event.position.x, event.position.y, event.position.z))

    pelvis.position.set(.01, .525 + .09 * ready + stretch * (.07 + .16 * MathUtils.smoothstep(pose.contact.y, 1.15, 1.95)), .055 - .12 * stretch)
    torso.rotation.set(.49 - .65 * ready - .60 * stretch, .13 - .15 * ready - .28 * stretch * follow, .23 * (1 - Math.max(ready, stretch)))
    thighs.rotation.x = 1.23 - .92 * stretch
    thighs.rotation.y = -.19 * (1 - stretch)
    shins.rotation.x = -1.18 + .87 * stretch
    head.rotation.set(-.18 - .15 * ready, -.14 + MathUtils.clamp(-pose.gaze.x * .28, -.52, .52) * ready, .11 * (1 - ready))
    right.shoulder.getWorldPosition(pose.rightShoulder)
    left.shoulder.getWorldPosition(pose.leftShoulder)
    mesh.localToWorld(pose.leftTarget.set(-.29 - .07 * ready, 1.02 - .24 * ready, .19 - .22 * ready))
    solveArm(left, pose.leftShoulder, pose.leftTarget, pose.leftPole, pose.freeHand)

    pose.line.set(.57 - .15 * ready, -.61 + 1.30 * ready, -.25 - .25 * ready).normalize()
    mesh.localToWorld(pose.wristTarget.set(.30 + .11 * ready, .64 + .31 * ready, -.26 - .03 * ready))
    if (event && hitting) {
      mesh.localToWorld(pose.contact)
      pose.contact.y += .30 * follow
      pose.contact.z -= .42 * follow
      pose.contact.x -= .22 * follow
      // Bias the handle to the racket side of the torso before aiming the string bed.
      pose.across.copy(pose.rightShoulder).add(pose.normal.set(.23, .04, -.17))
      if (pose.across.y > pose.contact.y - .18) pose.across.y = pose.contact.y - .18
      pose.across.subVectors(pose.contact, pose.across).normalize()
      pose.line.lerp(pose.across, stretch).normalize()
      pose.contact.addScaledVector(pose.line, -racketCenter * modelScale)
      pose.wristTarget.lerp(pose.contact, stretch)
    }
    // A full racket basis keeps the strings visible and the grip stable through follow-through.
    pose.across.crossVectors(pose.line, pose.normal.set(0, 0, 1)).normalize()
    pose.normal.crossVectors(pose.across, pose.line).normalize()
    pose.mount.setFromRotationMatrix(pose.basis.makeBasis(pose.across, pose.line, pose.normal))
    solveArm(right, pose.rightShoulder, pose.wristTarget, pose.rightPole, pose.mount)
  })

  return (
    <group name="Seated Racket Bearer" scale={modelScale}>
      <BambooChair />
      <primitive object={rig.mesh} dispose={null} />
      {createPortal(<RattanRacket />, rig.right.wrist)}
    </group>
  )
}
