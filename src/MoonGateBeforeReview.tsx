import { useEffect, useMemo, useRef } from 'react'
import { AssetSlot } from './assets/AssetSlots'
import { useSceneTexture } from './assets/useSceneTexture'
import { useFrame } from '@react-three/fiber'
import {
  BufferGeometry, Color, Float32BufferAttribute, MathUtils, SRGBColorSpace,
  type MeshStandardMaterial,
} from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'
import { makeCaveStone } from './assets/caveStone'
import { cutStone } from './assets/cutStone'
import { MOON_GATE, MOON_GATE_RIM_PROFILE, moonGateSillRise } from './moonGateLayout'
import type { Rally } from './rally'

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

function gateStonework() {
  const pieces: BufferGeometry[] = []
  const stone = (x: number, y: number, z: number, w: number, h: number, d: number, tint: string, turn = 0) => {
    const piece = cutStone(w, h, d, .064).rotateY(turn).translate(x, y, z)
    const vertices = piece.getAttribute('position')
    const colors = new Float32Array(vertices.count * 3)
    const color = new Color(tint)
    for (let i = 0; i < vertices.count; i++) {
      const vein = Math.sin(vertices.getX(i) * 3.4 + vertices.getY(i) * 8 + vertices.getZ(i) * 2.9)
      const value = .90 + .15 * vein ** 2
      colors.set([color.r * value, color.g * value, color.b * value], i * 3)
    }
    piece.setAttribute('color', new Float32BufferAttribute(colors, 3))
    piece.deleteAttribute('uv')
    pieces.push(piece)
  }

  // Overlap the bed joints and sink the front bench into the summit.
  stone(0, -2.42, .015, 4.42, .35, 1.38, '#797e68', .022)
  stone(.05, -2.07, -.035, 3.96, .48, 1.22, '#65766a', -.031)
  stone(-.065, -1.51 + moonGateSillRise / 2, -.07, 3.65, .59 + moonGateSillRise, 1.09, '#81907a', .028)
  for (const side of [-1, 1]) {
    stone(side * 1.62, -1.22, -.016, 1.10, .93, 1.04, '#62776b', side * .055)
    stone(side * 1.54, -.61, -.056, .94, .46, 1.01, '#556e64', -side * .09)
  }
  const geometry = mergeGeometries(pieces)
  pieces.forEach(piece => piece.dispose())
  if (!geometry) throw new Error('Moon gate stonework attributes differ')
  return geometry
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

export default function MoonGate({ rally }: { rally: Rally }) {
  const atlas = useSceneTexture(import.meta.env.BASE_URL + 'assets/art/stone-prologue-card.png')
  const stone = useMemo(() => {
    atlas.colorSpace = SRGBColorSpace
    const material = makeCaveStone(atlas, 'ridge', '#e8e1ce')
    material.vertexColors = true
    return material
  }, [atlas])
  const stones = useMemo(gateStonework, [])
  const rim = useMemo(carvedRim, [])
  const bronze = useMemo(cutBronze, [])
  const bronzeMaterial = useRef<MeshStandardMaterial>(null)

  useEffect(() => () => {
    stone.dispose()
    stones.dispose()
    rim.dispose()
    bronze.dispose()
  }, [stone, stones, rim, bronze])

  useFrame((_, delta) => {
    if (!bronzeMaterial.current) return
    const status = rally.getStatus()
    const aligned = status.ritual === 'summit' && status.phase === 'ready' && rally.skyAimCentered()
    const released = status.ritual === 'moonrise' ? 1 - rally.moonProgress() : 0
    const brightness = aligned ? .62 : .18 + released * .65
    bronzeMaterial.current.emissiveIntensity = MathUtils.damp(bronzeMaterial.current.emissiveIntensity, brightness, 9.5, delta)
  })

  return (
    <group name="Mineral-stone moon gate" position={[MOON_GATE.x, MOON_GATE.y, MOON_GATE.z]}>
      <mesh geometry={stones} material={stone} castShadow receiveShadow />
      <AssetSlot slot="moonGate">
        <mesh geometry={rim} material={stone} castShadow receiveShadow />
      </AssetSlot>
      <mesh geometry={bronze}>
        <meshStandardMaterial ref={bronzeMaterial} color="#b39b61" roughness={.67} metalness={.18}
          emissive="#d5a44c" emissiveIntensity={.18} />
      </mesh>
    </group>
  )
}
