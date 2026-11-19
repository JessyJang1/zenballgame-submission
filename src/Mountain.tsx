import { AssetSlot } from './assets/AssetSlots'
import { mountainSealCollision } from './assets/mountainSealCollision'
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { Line } from '@react-three/drei'
import { useSceneTexture } from './assets/useSceneTexture'
import { useFrame } from '@react-three/fiber'
import { CylinderGeometry, ExtrudeGeometry, MathUtils, Shape, type Group, type MeshStandardMaterial } from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { cutStone } from './assets/cutStone'
import { makeCaveStone } from './assets/caveStone'
import { CLOUD_TERRACE, RIDGE_WALK, GATE_WALK, type MountainSeal } from './paintingLayout'
import { CloudLedge } from './CaveGateStone'
import MoonGate from './MoonGate'
import CloudEscarpment, { preloadCloudCliff } from './CloudEscarpment'
import SummitTerrace from './SummitTerrace'
import SummitCliffs from './SummitCliffs'
import SummitVista from './SummitVista'
import type { Rally, Ritual } from './rally'

function RidgeBridge() {
  const atlas = useSceneTexture(import.meta.env.BASE_URL + 'assets/art/stone-prologue-card.png')
  const stone = useMemo(() => makeCaveStone(atlas, 'road', '#8e9b87'), [atlas])
  const deck = useMemo(() => {
    const { width, length } = RIDGE_WALK
    const pieces = []
    const courses = 10, step = length / courses
    // Keyed full-depth ashlar courses make a built road, not a rectangular flap.
    for (let row = 0; row < courses; row++) {
      const half = width / 2 - .09 - .08 * Math.sin(row * 1.7) ** 2
      const divisions = row % 2 ? [-half, -1.34, .48, half] : [-half, -.48, 1.34, half]
      for (let col = 0; col < 3; col++) {
        const left = divisions[col], right = divisions[col + 1]
        pieces.push(cutStone(right - left - .04, .64, step - .035, .045)
          .translate((left + right) / 2, -.32, -(row + .5) * step))
      }
    }
    // Bearing rails and cross ties give the hinge sweep a finished underside.
    for (const side of [-1, 1]) {
      pieces.push(cutStone(.30, .14, length - .16, .03)
        .translate(side * (width / 2 - .24), -.66, -length / 2))
    }
    for (let row = 1; row < courses; row += 2) {
      pieces.push(cutStone(width - .46, .12, .28, .025)
        .translate(0, -.67, -row * step))
    }
    const geometry = mergeGeometries(pieces)
    pieces.forEach(piece => piece.dispose())
    if (!geometry) throw new Error('Folding road stone attributes differ')
    return geometry
  }, [])
  useEffect(() => () => { deck.dispose(); stone.dispose() }, [deck, stone])
  return <mesh geometry={deck} material={stone} receiveShadow name="Mineral-rock folding bridge"/>
}

function UphillStoneWalk() {
  const atlas = useSceneTexture(import.meta.env.BASE_URL + 'assets/art/stone-prologue-card.png')
  const material = useMemo(() => makeCaveStone(atlas, 'road', '#58654b'), [atlas])
  useEffect(() => () => material.dispose(), [material])
  const deck=useMemo(()=>{
    const rim=new Shape()
    const {width,length}=GATE_WALK
    rim.moveTo(-width/2, .03)
    rim.lineTo(-width*.51,length*.31); rim.lineTo(-width*.57,length*.69)
    rim.lineTo(-width*.51,length); rim.lineTo(width*.54,length)
    rim.lineTo(width*.61,length*.73); rim.lineTo(width*.49,length*.31)
    rim.lineTo(width/2,.03);rim.closePath()
    return new ExtrudeGeometry(rim,{depth:.43,bevelEnabled:true,bevelThickness:.09,bevelSize:.075,bevelSegments:2})
      .rotateX(-Math.PI/2).translate(0,-.515,0)
  },[])
  useEffect(()=>()=>deck.dispose(),[deck])
  return <mesh receiveShadow geometry={deck} material={material} name="Carved stone way behind the gate"/>
}

function TerraceSeal({ side, rally }: { side: MountainSeal; rally: Rally }) {
  const { x, z } = CLOUD_TERRACE.seals[side]
  const { y, sealHeight, sealRadius } = CLOUD_TERRACE
  const slab = useRef<MeshStandardMaterial>(null)
  const atlas = useSceneTexture(import.meta.env.BASE_URL + 'assets/art/stone-prologue-card.png')
  const sealStone = useMemo(() => {
    const material = makeCaveStone(atlas, 'road', '#7c9183')
    material.emissive.set('#b57032')
    material.emissiveIntensity = .02
    return material
  }, [atlas])
  useEffect(() => () => sealStone.dispose(), [sealStone])
  const cut = useMemo(() => {
    const geometry = new CylinderGeometry(sealRadius, sealRadius * .96, sealHeight, 32, 2)
    const positions = geometry.attributes.position
    const handedness = side === 'left' ? 1 : -1
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), z = positions.getZ(i)
      if (Math.hypot(x,z) < .1) continue
      const edge = Math.atan2(z,x)
      const thickness = .93 + .06 * Math.sin(edge * 5 + handedness)
        + .029 * Math.sin(edge * 9 + handedness * 2)
      const top = positions.getY(i) >= sealHeight / 2 - .001
      positions.setXYZ(i,x * thickness,positions.getY(i) + (top ? .012 * Math.cos(5 * edge) : 0),z * thickness)
    }
    geometry.computeVertexNormals()
    return geometry
  }, [sealHeight, sealRadius, side])
  useEffect(() => () => cut.dispose(), [cut])
  const inlay = useRef<MeshStandardMaterial>(null)
  const relief = useRef<Group>(null)
  const crest = useMemo(() => {
    // Inlaid silhouette follows two different ridgelines. In three-quarter
    // view the lit ridge rises out of its bed as the shadow returns the ball.
    const outline = new Shape()
    const sign = side === 'left' ? 1 : -1
    const profile = [[-.68,-.24],[-.46,-.02],[-.32,.08],[-.17,.44],[.03,.18],
      [.20,.28],[.37,.04],[.52,-.03],[.66,-.24],[.34,-.15],[.12,-.06],[-.17,.14],[-.34,-.12]]
    profile.forEach(([x,z],i) => i ? outline.lineTo(x*sign,z) : outline.moveTo(x*sign,z))
    outline.closePath()
    return new ExtrudeGeometry(outline,{depth:.09,bevelEnabled:true,bevelThickness:.025,
      bevelSize:.012,bevelSegments:1}).rotateX(-Math.PI/2)
  },[side])
  useEffect(() => () => crest.dispose(),[crest])
  useFrame((_, delta) => {
    const status = rally.getStatus()
    const lit = status.ritual === 'mountain' && status.mountainSeal === side
    const complete = status.ritual === 'unfolding' ||
      (status.ritual === 'mountain' && status.mountainHits === 1 && !lit)
    const soft = lit && status.sealContact === 'soft'
    const wrong = !lit && status.sealContact === 'wrong'
    if (slab.current) slab.current.emissiveIntensity = MathUtils.damp(slab.current.emissiveIntensity, lit ? .32 : .02, 11, delta)
    if (inlay.current) {
      inlay.current.emissive.setHex(wrong ? 0xa44b36 : complete ? 0x63a49b : 0xe8a640)
      inlay.current.color.setHex(complete ? 0x48786d : lit ? 0xc3a26a : 0x514f40)
      const breath = .13 * Math.sin(rally.time * 7)
      inlay.current.emissiveIntensity = MathUtils.damp(inlay.current.emissiveIntensity,
        wrong ? .55 : soft ? .62 : lit ? 1.45 + breath : complete ? .25 : .009, 13, delta)
    }
    if (relief.current) relief.current.position.y = MathUtils.damp(relief.current.position.y,
      sealHeight + (lit ? .14 : complete ? .012 : -.034), 10, delta)
  })
  return (
    <group position={[x, y, z]} name={`Mountain seal · ${side}`}>
      <AssetSlot slot="mountainSeal" fit={mountainSealCollision?.fit}>
        <mesh position-y={sealHeight / 2} geometry={cut} receiveShadow>
          <primitive attach="material" object={sealStone} ref={slab} />
        </mesh>
      </AssetSlot>
      <group ref={relief} position-y={sealHeight - .034}>
        <mesh geometry={crest}>
          <meshStandardMaterial ref={inlay} color="#514f40" roughness={.74}
            emissive="#e8a640" emissiveIntensity={.009} />
        </mesh>
      </group>
    </group>
  )
}

export default function Mountain({ ritual, foldProgress, rally }: { ritual: Ritual; foldProgress: RefObject<number>; rally: Rally }) {
  const ridge = useRef<Group>(null)
  const summit = useRef<Group>(null)
  const { x, z } = CLOUD_TERRACE
  useEffect(() => { if (ritual === 'passage') preloadCloudCliff() }, [ritual])

  useFrame(() => {
    const t = foldProgress.current
    if (ridge.current) {
      ridge.current.visible = t > .08
      ridge.current.rotation.x = MathUtils.lerp(1.46, RIDGE_WALK.angle, MathUtils.smootherstep(t, 0, .69))
      ridge.current.scale.y = MathUtils.lerp(.05, 1, MathUtils.smoothstep(t, .08, .69))
    }
    if (summit.current) summit.current.visible = t >= .28 || ritual === 'mountain' || ritual === 'cleared'

  })

  return (
    <group name="Painted mountain">
      <SummitVista ritual={ritual} rally={rally} />
      <group position={[GATE_WALK.x,GATE_WALK.startY,GATE_WALK.startZ]} name="Gate mountain walk">
        <AssetSlot slot="gateAscent"><group rotation-x={GATE_WALK.angle}><UphillStoneWalk /></group></AssetSlot>
      </group>
      <CloudLedge ritual={ritual}/>
      {['cleared','mountain','unfolding','summit','moonrise','ending'].includes(ritual) && <CloudEscarpment/>}
      <group visible={ritual !== 'lotus' && ritual !== 'bell' && ritual !== 'passage'}>
        <TerraceSeal side="left" rally={rally} />
        <TerraceSeal side="right" rally={rally} />
      </group>
      <group ref={ridge} visible={false} name="Folding ridge" position={[RIDGE_WALK.x, RIDGE_WALK.y, RIDGE_WALK.z]} rotation-x={1.46}>
        <RidgeBridge />
        <Line points={[[0, .029, 0], [.36, .029, -3], [-.6, .029, -6], [-.2, .029, -9], [0, .029, -RIDGE_WALK.length]]}
          name="Mineral trail" color="#cbb996" lineWidth={1.3} transparent opacity={.62}/>
      </group>
      <group ref={summit} visible={false} name="Moon terrace">
        <SummitTerrace />
        <SummitCliffs />
        <MoonGate rally={rally} stage={ritual} />
      </group>
      <pointLight position={[x - 3, 3.8, z - 4.5]} intensity={24} distance={15} color="#e8bc7d" decay={2} />
    </group>
  )
}
