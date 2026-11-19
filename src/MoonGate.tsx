import { useEffect, useMemo, useRef } from 'react'
import { useGLTF } from '@react-three/drei'
import MoonGatePlinth from './MoonGatePlinth'
import MoonGateRite from './MoonGateRite'
import { AssetSlot } from './assets/AssetSlots'
import { useSceneTexture } from './assets/useSceneTexture'
import { useFrame } from '@react-three/fiber'
import {
  BufferGeometry, Color, Float32BufferAttribute, MathUtils, SRGBColorSpace,
  type Mesh, MeshStandardMaterial,
} from 'three'
import { makeCaveStone } from './assets/caveStone'
import { MOON_GATE, MOON_GATE_RIM_PROFILE } from './moonGateLayout'
import type { Rally, Ritual } from './rally'

type Point = readonly [number, number, number]
type Profile = readonly (readonly [number, number])[]

function radial(radius: number, angle: number, z: number): Point {
  return [Math.cos(angle) * radius, Math.sin(angle) * radius, z]
}

function mineralGeometry(positions: number[], colors: number[]) {
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

// The tool-cut bore shares the collision profile. Weathering stays on the
// perimeter, where fracture planes cross the solid mineral stone.
function carvedRim() {
  const positions: number[] = []
  const colors: number[] = []
  const shade = new Color()
  const rock = new Color('#456761'), warm = new Color('#ac9265'), cut = new Color('#b6a582')
  const count = 72
  const profile = MOON_GATE_RIM_PROFILE
  function point(edge: number, angle: number): Point {
    const [r, z] = profile[edge]
    const skin = MathUtils.smoothstep(r, .89, 1.2)
    const chipped = .052 * Math.sin(angle * 3 + .4) + .024 * Math.cos(angle * 7)
      + .012 * Math.cos(angle * 17 + z)
    return radial(r + skin * chipped, angle, z + skin * .065 * Math.sin(angle * 9 + z * 3))
  }
  function add(...points: Point[]) {
    for (const p of points) {
      positions.push(...p)
      colors.push(shade.r, shade.g, shade.b)
    }
  }
  for (let step = 0; step < count; step++) {
    const a = step / count * Math.PI * 2, b = (step + 1) / count * Math.PI * 2
    for (let edge = 0; edge < profile.length; edge++) {
      const next = (edge + 1) % profile.length
      const bed = .5 + .5 * Math.sin((Math.sin(a) + Math.cos(a) * .56) * 13 + edge * .36)
      shade.copy(rock).lerp(warm, .22 + .50 * bed ** 3)
      if (edge < 3) shade.lerp(cut, edge === 1 ? .73 : .46)
      add(point(edge, a), point(edge, b), point(next, b))
      add(point(edge, a), point(next, b), point(next, a))
    }
  }
  return mineralGeometry(positions, colors)
}

function cutBronze() {
  const positions: number[] = []
  const profile: Profile = [[.843, .554], [.85, .562], [.871, .562], [.88, .553]]
  const quad = (a: Point, b: Point, c: Point, d: Point) => positions.push(...a, ...b, ...c, ...a, ...c, ...d)
  const pieces = 80
  for (let i = 0; i < pieces; i++) {
    const a = i / pieces * Math.PI * 2
    const b = (i + 1) / pieces * Math.PI * 2
    for (let j = 0; j < profile.length - 1; j++) {
      const [inner, inside] = profile[j]
      const [outer, outside] = profile[j + 1]
      quad(radial(inner, a, inside), radial(outer, a, outside), radial(outer, b, outside), radial(inner, b, inside))
    }
  }

  // Four faint witness marks sit outside the ring, on the surfaces that
  // masons would have used to align the bore.
  for (const angle of [0, Math.PI / 2, Math.PI, Math.PI * 1.5]) {
    for (const offset of [-.044, .044]) {
      const a = angle + offset
      quad(radial(.917, a - .008, .555), radial(1.024, a - .004, .555),
        radial(1.024, a + .004, .555), radial(.917, a + .008, .555))
    }
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.computeVertexNormals()
  return geometry
}

type TraceRef = React.RefObject<MeshStandardMaterial | null>

type Lumen = { value: number }

function HandCutRim({ trace, lumen }: { trace: TraceRef; lumen: Lumen }) {
  const { nodes } = useGLTF(import.meta.env.BASE_URL + 'assets/models/moon-rim-handcut-relief.glb', false, false)
  const chiselBed = nodes.ChiseledStone as Mesh
  const inlay = nodes.WeatheredInlay as Mesh
  const stone = useMemo(() => new MeshStandardMaterial({ vertexColors: true, roughness: .88, metalness: .045 }), [])
  const pigment = useMemo(() => {
    const material = new MeshStandardMaterial({ vertexColors: true, roughness: .82, metalness: .08,
      color: '#a8956b', emissive: '#ecd9a3', emissiveIntensity: .08 })
    material.onBeforeCompile = shader => {
      shader.uniforms.lunarLight = lumen
      shader.vertexShader = 'varying vec2 chiselPoint;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>', '#include <begin_vertex>\nchiselPoint=position.xy;',
      )
      shader.fragmentShader = 'varying vec2 chiselPoint; uniform float lunarLight;\n' + shader.fragmentShader.replace(
        '#include <emissivemap_fragment>', `#include <emissivemap_fragment>
          float heightOnRim = 0.5 + asin(clamp(normalize(chiselPoint).y,-1.0,1.0)) / 3.14159265;
          float revealed = 1.0 - smoothstep(lunarLight-.11,lunarLight+.035,heightOnRim);
          float shoulder = smoothstep(.035, .22, lunarLight);
          totalEmissiveRadiance *= 0.11 + 1.01*revealed*shoulder;
        `,
      )
    }
    material.customProgramCacheKey = () => 'moon-rim-rising-trace'
    return material
  }, [lumen])
  useEffect(() => {
    trace.current = pigment
    return () => {
      trace.current = null
      stone.dispose()
      pigment.dispose()
    }
  }, [trace, stone, pigment])
  return <group name="Stone courses carved against the Aholo face">
    <mesh geometry={chiselBed.geometry} material={stone} castShadow receiveShadow dispose={null} />
    <mesh geometry={inlay.geometry} material={pigment} dispose={null} />

  </group>
}

export default function MoonGate({ rally, stage }: { rally: Rally; stage?: Ritual }) {
  const atlas = useSceneTexture(import.meta.env.BASE_URL + 'assets/art/stone-prologue-card.png')
  const stone = useMemo(() => {
    atlas.colorSpace = SRGBColorSpace
    const material = makeCaveStone(atlas, 'ridge', '#e8e1ce')
    material.vertexColors = true
    return material
  }, [atlas])
  const rim = useMemo(carvedRim, [])
  const bronze = useMemo(cutBronze, [])
  const bronzeMaterial = useRef<MeshStandardMaterial>(null)
  const lumen = useMemo(() => ({value:0}), [])

  useEffect(() => () => {
    stone.dispose()
    rim.dispose()
    bronze.dispose()
  }, [stone, rim, bronze])

  useFrame((_, delta) => {
    if (!bronzeMaterial.current) return
    const status = rally.getStatus()
    const aligned = status.ritual === 'summit' && status.phase === 'ready' && rally.skyAimCentered()
    const released = status.ritual === 'moonrise' ? 1 - rally.moonProgress() : 0
    const flying = status.ritual === 'summit' && status.phase === 'outbound'
    lumen.value = MathUtils.damp(lumen.value, aligned || flying ? 1.065 : released, 3.8, Math.min(delta,.05))
    const brightness = aligned || flying ? 2.35 : .18 + released * 1.40
    bronzeMaterial.current.emissiveIntensity = MathUtils.damp(bronzeMaterial.current.emissiveIntensity, brightness, 9.5, delta)
  })

  return (
    <group name="Mineral-stone moon gate" position={[MOON_GATE.x, MOON_GATE.y, MOON_GATE.z]}>
      <MoonGatePlinth material={stone} />
      <AssetSlot slot="moonGate" detail={<HandCutRim trace={bronzeMaterial} lumen={lumen} />}>
        <mesh geometry={rim} material={stone} castShadow receiveShadow />
        <mesh geometry={bronze}>
          <meshStandardMaterial ref={bronzeMaterial} color="#b39b61" roughness={.67} metalness={.18}
            emissive="#d5a44c" emissiveIntensity={.18} />
        </mesh>
      </AssetSlot>
      <MoonGateRite rally={rally} stage={stage} />
    </group>
  )
}
