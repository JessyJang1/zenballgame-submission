import CourtMountainGate from './CourtMountainGate'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import BellWatercourse from './BellWatercourse'
import LotusPond from './LotusPond'
import { courtSlabShape } from './courtSlabShape'
import { courtPaving } from './assets/courtPaving'
import { gateRoute, RoughGateSteps } from './CaveGateStone'
import LotusPetal from './LotusPetal'
import ReviewGate from './ReviewGate'
import MountainTerrain from './MountainTerrain'
import CourtPines from './PaintedPine'
import { AssetSlot } from './assets/AssetSlots'
import { makeCaveStone } from './assets/caveStone'
import { makeCourtPigment, worldviewPalette } from './assets/pigment'
import { Line } from '@react-three/drei'
import { useSceneTexture } from './assets/useSceneTexture'
import { BufferGeometry, DoubleSide, Float32BufferAttribute, MathUtils, Shape, SRGBColorSpace, Vector2, type Group, type MeshBasicMaterial, type MeshStandardMaterial } from 'three'
import { COURT_TERRACE, BELL_SEGMENTS, GATE, LOTUS, LOTUS_BUD_SCALE, LOTUS_HEART, LOTUS_PETALS, STONE_BELL, BELL_MOUNT, lotusAimSurface } from './gardenLayout'
import { COURT, type Rally, type Ritual } from './rally'

const reviewWorld = new URLSearchParams(window.location.search).get('debug') !== 'court'
const stone = worldviewPalette.stoneGreen
const edge = '#83a095'
const cream = worldviewPalette.stoneWhite
const wood = worldviewPalette.brickRed
const roof = '#294e49'
const gold = '#ebba6f'
const bellEnvelope = [STONE_BELL.radius * 2, 1.10, STONE_BELL.radius * 2] as const
const bellProfile = STONE_BELL.profile.map(([radius, y]) => new Vector2(radius, y))

const terrace = COURT_TERRACE
const cliff = [[-7, 13.6], [7, 13], [10.2, 7.8], [9, -9.4], [7, -13.8], [-7.9, -13.1], [-10.6, -6.6], [-9.1, 8.6]]
const paving: [number, number, number][] = []
for (let z = -10; z <= 12; z += 1.85) {
  paving.push([-5.3, .014, z], [5.3, .014, z])
  for (let x = -5.3 + (Math.round(z / 1.85) % 2) * .53; x <= 5.3; x += 1.73) {
    if (z < 11) paving.push([x, .014, z], [x, .014, z + 1.85])
  }
}
// Woven cord sits between the posts. The band follows the actual collider top.
const netCords: [number, number, number][] = []
const halfNet = COURT.netHalfWidth
const cordRows = 8, cordColumns = 76
for (let i = 1; i < cordColumns; i++) {
  const x = halfNet * (2*i/cordColumns - 1)
  netCords.push([x,.055,0], [x,COURT.netHeight-.045,0])
}
for (let i = 0; i < cordRows; i++) {
  const y = .055 + i*(COURT.netHeight-.10)/cordRows
  netCords.push([-halfNet,y,0], [halfNet,y,0])
}

function Slab({ points, y, depth, color, pigment }: { points: readonly (readonly number[])[]; y: number; depth: number; color: string; pigment?: boolean }) {
  const shape = useMemo(() => {
    const polygon = new Shape()
    points.forEach(([x, z], i) => i === 0 ? polygon.moveTo(x, -z) : polygon.lineTo(x, -z))
    polygon.closePath()
    return polygon
  }, [points])
  const material = useMemo(() => pigment ? makeCourtPigment() : null, [pigment])
  useEffect(() => () => { material?.map?.dispose(); material?.dispose() }, [material])
  return (
    <mesh receiveShadow position-y={y - depth} rotation-x={-Math.PI / 2}>
      <extrudeGeometry args={[shape, { depth, bevelEnabled: false }]} />
      {material ? <primitive object={material} attach="material" /> : <meshStandardMaterial color={color} roughness={.96} />}
    </mesh>
  )
}

function CaveCourtSlab() {
  const atlas = useSceneTexture(import.meta.env.BASE_URL + 'assets/art/stone-prologue-card.png')
  atlas.colorSpace = SRGBColorSpace
  const shape = useMemo(courtSlabShape, [])
  const flagstone=useSceneTexture(import.meta.env.BASE_URL+'assets/art/gallery-flagstone.webp')
  flagstone.colorSpace=SRGBColorSpace
  const material=useMemo(()=>makeCaveStone(atlas,'court','#456e68',flagstone),[atlas,flagstone])
  const paving = useMemo(courtPaving,[])
  const caps = useMemo(() => {
    const stone = makeCaveStone(atlas,'court','#587c70',flagstone)
    stone.vertexColors=true
    stone.roughness=.93
    return stone
  },[atlas,flagstone])
  useEffect(()=>()=>{material.dispose();paving.dispose();caps.dispose()},[material,paving,caps])
  return <>
    <mesh receiveShadow position-y={-.53} rotation-x={-Math.PI/2} material={material}>
      <extrudeGeometry args={[shape,{depth:.53,bevelEnabled:false}]}/>
    </mesh>
    <mesh name="Individual split-edged flagstones" geometry={paving} material={caps} receiveShadow />
  </>
}

function Ridge({ x, z, width, height, color }: {
  x: number; z: number; width: number; height: number; color: string
}) {
  const geometry = useMemo(() => {
    const columns = 78
    const rows = 19
    const vertices: number[] = []
    const colors: number[] = []
    const indices: number[] = []
    for (let j = 0; j <= rows; j++) {
      for (let i = 0; i <= columns; i++) {
        const u = i / columns
        const v = j / rows
        const summit = .50 + .15 * Math.sin(14 * u + x * .032) + .10 * Math.cos(26 * u - z * .07)
        const grain = .035 * Math.cos(u * 145 + v * 76) + .014 * Math.sin(u * 253 - v * 115)
        const peak = Math.sin(Math.PI * u) ** .65 * Math.sin(Math.PI * v) ** 1.5
        const rise = height * peak * (summit + grain)
        vertices.push((u - .5) * width + 2 * Math.sin(v * 5), rise, (v - .54) * 17)
        const shade = .69 + .2 * v + grain * 1.8
        const seam = Math.sin((u * 22 + v * 11 + rise * .45) * Math.PI) ** 24
        colors.push(shade * (1 + seam * .39), shade * (1 + seam * .16), shade * (1 - seam * .15))
        if (i && j) {
          const a = j * (columns + 1) + i
          indices.push(a, a - columns - 1, a - 1, a - 1, a - columns - 1, a - columns - 2)
        }
      }
    }
    const mesh = new BufferGeometry()
    mesh.setAttribute('position', new Float32BufferAttribute(vertices, 3))
    mesh.setAttribute('color', new Float32BufferAttribute(colors, 3))
    mesh.setIndex(indices)
    mesh.computeVertexNormals()
    return mesh
  }, [width, height, x, z])
  useEffect(() => () => geometry.dispose(), [geometry])
  return (
    <mesh geometry={geometry} position={[x, -3.59, z]}>
      <meshStandardMaterial color={color} roughness={1} side={DoubleSide} vertexColors />
    </mesh>
  )
}

const ridges = [
  { x: -47, z: -89, width: 96, height: 37, color: '#849a8e' },
  { x: 43, z: -91, width: 101, height: 36, color: '#829685' },
  { x: -41, z: -68, width: 63, height: 33, color: '#507d71' },
  { x: 39, z: -70, width: 57, height: 31, color: '#78907b' },
  { x: -35, z: -50, width: 43, height: 21, color: '#4d705e' },
  { x: 34, z: -55, width: 35, height: 24, color: '#6e7956' },
]

function Landscape() {
  return (
    <>
      <mesh rotation-x={-Math.PI / 2} position-y={-3.6}>
        <planeGeometry args={[400, 440]} />
        <meshBasicMaterial color="#344f48" />
      </mesh>
      {ridges.map((props) => <Ridge key={props.z} {...props} />)}
      {Array.from({ length: 27 }, (_, i) => {
        const z = -37 + i * 2.17
        const x = Math.sin(i * 2.37) * 17 + (i % 2 ? 11 : -11)
        return <Line key={i} points={[[x - 1.5, -3.57, z], [x + .8, -3.57, z + .04], [x + 2.7, -3.57, z + .13]]}
          color="#b4c6a6" lineWidth={1} transparent opacity={.34} />
      })}
    </>
  )
}

function Block({ at, size, color }: { at: [number, number, number]; size: [number, number, number]; color: string }) {
  return (
    <mesh receiveShadow position={at}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={color} roughness={.87} />
    </mesh>
  )
}

function Lantern({ at, awake }: { at: [number, number, number]; awake: boolean }) {
  return (
    <group position={at}>
      <AssetSlot slot="lantern">
        <Block at={[0, .12, 0]} size={[.66, .24, .64]} color="#4b6c63" />
        <Block at={[0, .41, 0]} size={[.31, .58, .31]} color="#6a8474" />
        <mesh position-y={.85}>
          <boxGeometry args={[.39, .37, .39]} />
          <meshStandardMaterial color={awake ? '#f1bb79' : '#6a613e'} emissive="#bc7133" emissiveIntensity={awake ? .63 : 0} />
        </mesh>
        <mesh position-y={1.125} rotation-y={Math.PI / 4}>
          <coneGeometry args={[.50, .27, 4]} />
          <meshStandardMaterial color="#324e48" />
        </mesh>
      </AssetSlot>
    </group>
  )
}

const foliage: [number, number, number, number, number, number][] = [
  [-.72, 2.25, .12, 1.55, .41, .78],
  [.42, 2.66, -.32, 1.34, .42, .93],
  [-.15, 3.13, .07, 1.32, .48, .86],
  [.53, 3.52, -.10, .94, .36, .57],
]
function Pine({ at, size, turn }: { at: [number, number, number]; size: number; turn: number }) {
  return (
    <group position={at} scale={size} rotation-y={turn}>
      <AssetSlot slot="pine">
        <mesh position={[-.18, 1.18, 0]} rotation-z={.15}>
          <cylinderGeometry args={[.10, .22, 2.6, 6]} />
          <meshStandardMaterial color="#5e5742" flatShading />
        </mesh>
        <mesh position={[.02, 2.48, -.02]} rotation-z={-.44}>
          <cylinderGeometry args={[.055, .115, 1.8, 6]} />
          <meshStandardMaterial color="#6c5e45" flatShading />
        </mesh>
        {foliage.map(([x, y, z, sx, sy, sz], i) => (
          <mesh key={i} position={[x, y, z]} scale={[sx, sy, sz]}>
            <icosahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color={['#365e4b', '#416751', '#4d7559', '#59836a'][i]} flatShading roughness={.98} />
          </mesh>
        ))}
      </AssetSlot>
    </group>
  )
}

function Eave({ y, width, depth }: { y: number; width: number; depth: number }) {
  const outline: [number, number, number][] = [
    [-width / 2, y + .3, depth / 2], [-width * .42, y, depth / 2], [-width * .25, y - .06, depth / 2],
    [width * .25, y - .06, depth / 2], [width * .42, y, depth / 2], [width / 2, y + .3, depth / 2],
  ]
  const skin = useMemo(() => {
    const xs = [-.5, -.42, -.25, .25, .42, .5]
    const geometry = new BufferGeometry()
    const positions = xs.flatMap((x) => {
      const rise = Math.pow(Math.abs(x) * 2, 6) * .32
      return [x * width, y + rise - .05, depth / 2, x * width * .78, y + .67, 0,
        x * width, y + rise - .05, -depth / 2]
    })
    const triangles: number[] = []
    for (let i = 0; i < xs.length - 1; i += 1) {
      const a = i * 3
      const b = a + 3
      triangles.push(a, b, a + 1, b, b + 1, a + 1, a + 1, b + 1, a + 2, b + 1, b + 2, a + 2)
    }
    geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    geometry.setIndex(triangles)
    geometry.computeVertexNormals()
    return geometry
  }, [y, width, depth])
  useEffect(() => () => skin.dispose(), [skin])
  return (
    <group>
      <mesh geometry={skin}><meshStandardMaterial color={roof} flatShading side={DoubleSide} /></mesh>
      <Line points={outline} color="#d0a868" lineWidth={1.5} />
      <Line points={[[-width * .4, y + .68, 0], [width * .4, y + .68, 0]]} color="#c09b66" lineWidth={1.4} />
    </group>
  )
}

function Gate({ open, awake }: { open: boolean; awake: boolean }) {
  const left = useRef<Group>(null)
  const right = useRef<Group>(null)
  useFrame((_, delta) => {
    if (left.current) left.current.position.x = open ? MathUtils.damp(left.current.position.x, -2.1, 3.8, delta) : -.67
    if (right.current) right.current.position.x = open ? MathUtils.damp(right.current.position.x, 2.1, 3.8, delta) : .67
  })
  return (
    <>
      {reviewWorld && <group name="East gate bedrock" position={[5.13,-.92,-14.6]} rotation-y={-.36}>
        <AssetSlot slot="gateShoulder" fit={[6.1,3.25,4.15]}>{null}</AssetSlot>
      </group>}
      <AssetSlot slot="path">
        {reviewWorld ? <RoughGateSteps/> : gateRoute.map(([x, y, z], i) => (
          <group key={z} rotation-y={Math.atan2((gateRoute[i - 1]?.[0] ?? x) - x, .73)} position={[x, y - .12, z]}>
            <Block at={[0, -.14, 0]} size={[3.2, .48, 1.03]} color={i % 2 ? '#a28f6a' : '#b7a17c'} />
          </group>
        ))}
      </AssetSlot>
      <group position={[GATE.x, GATE.y, GATE.z]}>
        {reviewWorld ? <CourtMountainGate/> : <ReviewGate slot="gateFrame">
          <Block at={[0, -.29, 0]} size={[6.7, .56, 2.55]} color="#7b8f78" />
          {[-1, 1].map(side => <Block key={side} at={[side * 1.93, 1.225, -.025]}
            size={[1.44, 2.45, .48]} color={wood} />)}
          {[-2.55, -1.38, 1.38, 2.55].map((x) => (
            <group key={x} position-x={x}>
              <Block at={[0, .14, 0]} size={[.53, .28, .58]} color="#a0a38e" />
              <Block at={[0, 1.47, 0]} size={[.31, 2.62, .38]} color={wood} />
              <Block at={[0, 2.70, 0]} size={[.49, .15, .62]} color="#c58d61" />
            </group>
          ))}
          <Block at={[0, 2.68, 0]} size={[5.2, .46, .56]} color={wood} />
          <Block at={[0, 2.92, -.07]} size={[5.84, .30, 1.15]} color="#915d42" />
          <Eave y={3.14} width={7.0} depth={2.15} />
          <Block at={[0, 3.72, 0]} size={[3.14, .29, 1.0]} color="#6f4a34" />
          <Eave y={3.93} width={4.54} depth={1.83} />
          <Block at={[0, 2.79, .67]} size={[1.47, .38, .15]} color="#444b37" />
          <Line points={[[-.57, 2.80, .751], [.57, 2.80, .751]]} color={gold} lineWidth={1} />
        </ReviewGate>}
        <group ref={left} position={[-.67, 0, .14]}>
          <ReviewGate slot="gateDoorLeft">
            <Block at={[0, 1.28, 0]} size={[1.3, 2.48, .18]} color="#754933" />
            <Block at={[.38, 1.16, .11]} size={[.095, .24, .08]} color={gold} />
          </ReviewGate>
        </group>
        <group ref={right} position={[.67, 0, .14]}>
          <ReviewGate slot="gateDoorRight">
            <Block at={[0, 1.28, 0]} size={[1.3, 2.48, .18]} color="#754933" />
            <Block at={[-.38, 1.16, .11]} size={[.095, .24, .08]} color={gold} />
          </ReviewGate>
        </group>
        {!reviewWorld && <Lantern at={[-3.55, 0, .85]} awake={awake} />}
        {!reviewWorld && <Lantern at={[3.55, 0, .85]} awake={awake} />}
      </group>
    </>
  )
}

function Inlay({ awake }: { awake: boolean }) {
  const { halfWidth: w, halfLength: l, netHalfWidth, netHeight } = COURT
  return (
    <>
      {!reviewWorld && <Line points={paving} segments color="#a6b3a0" lineWidth={.85} transparent opacity={.24} />}
      {/* Singles layout. The service lines end at the singles sidelines;
          only the service boxes share a center stripe. */}
      <group name="Singles tennis court markings">
        {[
          [-w,0,.055,2*l],[w,0,.055,2*l],
          [0,-l,2*w,.083],[0,l,2*w,.083],
          [0,-COURT.serviceLine,2*w,.055],[0,COURT.serviceLine,2*w,.055],
          [0,0,.055,2*COURT.serviceLine],
          [0,-l+.053,.055,.106],[0,l-.053,.055,.106],
        ].map(([x,z,width,depth]) => (
          <mesh key={`${x}:${z}`} position={[x,.019,z]} rotation-x={-Math.PI/2}>
            <planeGeometry args={[width,depth]}/>
            <meshStandardMaterial color={cream} roughness={.83}/>
          </mesh>
        ))}
      </group>
      <AssetSlot slot="screen">
        <Line points={netCords} segments color="#302e24" lineWidth={1.05} transparent opacity={.76} depthWrite={false}/>
        <Block at={[0,netHeight-.032,0]} size={[netHalfWidth*2,.064,.044]} color="#e0cda3"/>
        <Block at={[0,netHeight/2,.027]} size={[.045,netHeight,.018]} color="#cfbb94"/>
        {[-1, 1].map(side => (
          <group key={side} position={[side*netHalfWidth,0,0]}>
            <mesh position-y={.56}><cylinderGeometry args={[.050,.064,1.12,12]}/><meshStandardMaterial color="#674831" roughness={.8}/></mesh>
            <mesh position-y={1.071}><cylinderGeometry args={[.063,.063,.085,12]}/><meshStandardMaterial color="#ad8650" roughness={.55} metalness={.23}/></mesh>
          </group>
        ))}
      </AssetSlot>
      {!reviewWorld && [-1, 1].map((side) => (
        <group key={side}>
          <Lantern at={[side * 6.34, 0, -5.6]} awake={awake} />
          <Lantern at={[side * 6.34, 0, 5.5]} awake={awake} />
        </group>
      ))}
    </>
  )
}

function Lotus({ opened, rally }: { opened: boolean; rally: Rally }) {
  const light = useRef<MeshStandardMaterial>(null)
  const petals = useRef<Group>(null)
  const bloom = useRef(0)
  useFrame((_, delta) => {
    if (light.current && reviewWorld) {
      const aligned = !opened && rally.getStatus().phase === 'ready' && lotusAimSurface(rally.aim,rally.aimZ) === 'heart'
      light.current.emissiveIntensity = MathUtils.damp(light.current.emissiveIntensity, opened ? .38 : aligned ? 1.15 : .73, 12, delta)
    }
    bloom.current = opened ? Math.min(1, bloom.current + delta / .52) : 0
    if (!petals.current) return
    const progress = bloom.current * bloom.current * (3 - 2 * bloom.current)
    petals.current.scale.setScalar(MathUtils.lerp(LOTUS_BUD_SCALE, 1, progress))
    petals.current.children.forEach((spoke,i) => {
      const { closedPitch, openPitch } = LOTUS_PETALS[i]
      spoke.children[0].rotation.x = MathUtils.lerp(closedPitch, openPitch, progress)
    })
  })
  return (
    <group position={[LOTUS.x, 0, LOTUS.z]}>
      {reviewWorld && <LotusPond opened={opened}/>}
      <AssetSlot slot="lotus" requiredClip="Bloom" motion={() => ({ clip: 'Bloom', seconds: bloom.current * .52 })}>
        {!reviewWorld && <>
        <mesh position-y={.01}>
          <cylinderGeometry args={[1.08, 1.13, .04, 36]} />
          <meshStandardMaterial color="#a2b394" />
        </mesh>
        <mesh position-y={.036} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[.98, 36]} />
          <meshStandardMaterial color={opened ? '#438b88' : '#244f54'} metalness={.2} roughness={.28} />
        </mesh>
        </>}
        <mesh position-y={LOTUS.height / 2} scale={reviewWorld ? [1,.48,1] : 1}>
          <cylinderGeometry args={[opened ? LOTUS.openedRadius : LOTUS.radius, reviewWorld ? .32 : LOTUS.radius, LOTUS.height, 36]} />
          <meshStandardMaterial color={reviewWorld ? '#526844' : opened ? '#79997a' : '#426d64'} roughness={.82} />
        </mesh>
        {!reviewWorld && <>
        <mesh rotation-x={-Math.PI / 2} position-y={.041}>
          <ringGeometry args={[.87, .93, 40]} />
          <meshBasicMaterial color={reviewWorld ? '#ad9062' : opened ? '#b8edde' : '#e9bc73'} />
        </mesh>
        </>}
        <group ref={petals} position-y={LOTUS.height} scale={LOTUS_BUD_SCALE}>
          {LOTUS_PETALS.map(({ yaw, closedPitch, scale }, i) => (
            <group rotation-y={yaw} key={i}>
              <group rotation-x={closedPitch} scale={scale}>
                {reviewWorld ? <AssetSlot slot="lotusPetal"><LotusPetal index={i}/></AssetSlot> : <mesh position={[0, .03, .40]} scale={[.21, .10, .50]}>
                  <sphereGeometry args={[1, 12, 8]} />
                  <meshStandardMaterial color={i % 2 === 0 ? '#f6c8b1' : '#cf8486'} emissive="#ab6455" emissiveIntensity={opened ? .25 : .05} />
                </mesh>}
              </group>
            </group>
          ))}
        </group>
        <mesh position-y={LOTUS_HEART.y} scale={[LOTUS_HEART.radius, LOTUS_HEART.halfHeight, LOTUS_HEART.radius]}>
          <sphereGeometry args={[1, 14, 8]} />
          <meshStandardMaterial ref={light} color="#ffc877" emissive="#a16b31" emissiveIntensity={reviewWorld ? opened ? .42 : .24 : opened ? .8 : .1} />
        </mesh>
      </AssetSlot>
    </group>
  )
}

function StoneBell({ struck, opened, reveal, paused }: {
  struck: boolean; opened: boolean; reveal?: RefObject<number>; paused: boolean
}) {
  const housing=useRef<Group>(null)
  const rise=useRef(0)
  const bell = useRef<Group>(null)
  const age = useRef(0)
  const rim = useRef<MeshBasicMaterial>(null)
  useFrame((_, delta) => {
    if (!bell.current || !housing.current) return
    if (!opened) rise.current = 0
    else if (!paused) rise.current = Math.min(2, rise.current + Math.min(delta, .05))
    const lifted=MathUtils.smootherstep(rise.current,.64,1.12)
    if (reveal) reveal.current = lifted
    housing.current.visible=lifted>0
    housing.current.position.y=-2.15*(1-lifted)
    if (!struck) age.current = 0
    else if (!paused) age.current += Math.min(delta, .05)
    bell.current.rotation.z = Math.sin(age.current * 19) * Math.exp(-4 * age.current) * .19
    if (rim.current) {
      const attention = lifted * (.24 + .41 * (1 - MathUtils.smoothstep(rise.current, 1.20, 1.75)))
      rim.current.opacity = struck ? .18 * Math.exp(-4 * age.current) : attention
    }
  })
  const { x, z, height, radius } = STONE_BELL
  return (
    <group position={[x, 0, z]}><group ref={housing} visible={false}>
      <AssetSlot slot="bellMount">
        <mesh position-y={.08}>
          <cylinderGeometry args={[radius + .095, radius + .18, .16, 28]} />
          <meshStandardMaterial color="#698278" />
        </mesh>
      </AssetSlot>
      <group ref={bell} position-y={bellEnvelope[1]+BELL_MOUNT.bellHangY}>
        <group position-y={-bellEnvelope[1]}>
          <AssetSlot slot="bell" fit={bellEnvelope}>
            <mesh>
              <latheGeometry args={[bellProfile, BELL_SEGMENTS]} />
              <meshStandardMaterial color={struck ? '#c3b170' : '#ad8752'} roughness={.66} metalness={.14} />
            </mesh>
            <mesh position-y={height} rotation-x={-Math.PI / 2}>
              <circleGeometry args={[.22, BELL_SEGMENTS]} />
              <meshStandardMaterial color="#b9955c" />
            </mesh>
            {[.18, .65].map((y) => (
              <mesh key={y} rotation-x={Math.PI / 2} position-y={y}>
                <torusGeometry args={[y < .5 ? radius : .49, .027, 7, 32]} />
                <meshStandardMaterial color="#f3c678" emissive="#b27938" emissiveIntensity={struck ? .55 : .18} />
              </mesh>
            ))}
            <mesh position-y={height + .085}>
              <torusGeometry args={[.123, .047, 8, 22]} />
              <meshStandardMaterial color={gold} />
            </mesh>
          </AssetSlot>
          <mesh position-y={.028} rotation-x={-Math.PI / 2} name="Warm edge on the bell mouth">
            <ringGeometry args={[radius * .947, radius * 1.008, 40, 1, Math.PI * .83, Math.PI * 1.18]} />
            <meshBasicMaterial ref={rim} color="#efce91" transparent opacity={0}
              depthWrite={false} toneMapped={false} polygonOffset polygonOffsetFactor={-1} />
          </mesh>
        </group>
      </group>
    </group></group>
  )
}

export default function Garden({ ritual, awake, rally, bellReveal, paused = false }: {
  ritual: Ritual; awake: boolean; rally: Rally; bellReveal?: RefObject<number>; paused?: boolean
}) {
  const gateOpen = ritual !== 'lotus' && ritual !== 'bell'
  return (
    <>
      <AssetSlot slot="landscape">{reviewWorld ? <MountainTerrain/> : <Landscape />}</AssetSlot>
      <AssetSlot slot="court">
          {!reviewWorld && <Slab points={cliff} y={-.33} depth={3.75} color="#3c574f" />}
          {reviewWorld ? <CaveCourtSlab/> : <Slab points={terrace} y={0} depth={.57} color={stone} pigment/>}
      </AssetSlot>
      <Line points={[...terrace, terrace[0]].map(([x, z]) => [x * .96, .011, z * .965])}
        color={edge} lineWidth={1.2} transparent opacity={.63} />
      <Gate open={gateOpen} awake={awake} />
      <Inlay awake={awake} />
      {reviewWorld ? <CourtPines/> : <Pine at={[-6.95,-.16,-8.85]} size={1.2} turn={.1}/>}
      {!reviewWorld && <Pine at={[7,-.16,-8.2]} size={1.04} turn={Math.PI}/>}
      {!reviewWorld && <Pine at={[6.95,0,7.6]} size={.84} turn={.8}/>}
      <Lotus opened={ritual !== 'lotus'} rally={rally} />
      <BellWatercourse opened={ritual !== 'lotus'} struck={gateOpen} paused={paused} />
      <StoneBell struck={gateOpen} opened={ritual !== 'lotus'} reveal={bellReveal} paused={paused} />
    </>
  )
}
