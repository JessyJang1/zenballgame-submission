import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { AdditiveBlending, Color, MathUtils, type Group, type Mesh, type MeshBasicMaterial } from 'three'
import type { Rally, Ritual } from './rally'

const vertex = `
  varying vec2 sheet;
  void main() {
    sheet = uv - .5;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  }`
const air = `
  varying vec2 sheet;
  uniform float clock, charge, release, depth;
  uniform vec3 pearl, jade;
  void main() {
    float sway = .047 * sin(sheet.x * 10.0 - clock * .77 + depth);
    float centre = -.19 + depth * .13 + sway + .028 * sin(clock * .47);
    float fold = (sheet.y - centre) / (.047 + depth * .018);
    float wake = (sheet.y + .08 - centre) / .14;
    float ribbon = exp(-fold * fold);
    float tail = exp(-wake * wake);
    float reach = 1. - smoothstep(.13, .48, abs(sheet.x));
    float threads = .74 + .26 * sin(sheet.x * 24. + clock * .65 + depth);
    float split = 1. - .58 * charge * exp(-sheet.x*sheet.x*19.);
    float alpha = reach * split * ((.24 + .22 * charge) * ribbon + .065 * tail);
    alpha *= threads * (1. - release * .70);
    gl_FragColor = vec4(mix(jade, pearl, .35 + .30 * ribbon), alpha);
  }`
const stone = `
  varying vec2 sheet;
  uniform float clock, charge, release;
  uniform vec3 pearl;
  void main() {
    float width = mix(.16, .35, sheet.y + .5);
    float centre = .033 * (sheet.y+.42) + .015 * sin(sheet.y*20. + clock*.56);
    float span = (sheet.x - centre) / width;
    float edges = exp(-span * span * 1.45) * (1.-smoothstep(.33,.49,abs(sheet.x)));
    float lengthFade = smoothstep(-.48,-.28,sheet.y) * (1.-smoothstep(.24,.49,sheet.y));
    float crossing = (1.-smoothstep(.020,.14,abs(sheet.y + .37 - release*.76)))
      * smoothstep(.01,.16,release) * (1.-smoothstep(.40,.90,release));
    gl_FragColor = vec4(pearl, edges * lengthFade * (.085 + .09*charge + .18*crossing));
  }`

export default function MoonGateRite({ rally, stage }: { rally: Rally; stage?: Ritual }) {
  const group = useRef<Group>(null)
  const echo = useRef<Mesh>(null)
  const echoInk = useRef<MeshBasicMaterial>(null)
  const focus = useRef(0)
  const values = useMemo(() => ({
    clock:{value:0}, charge:{value:0}, release:{value:0},
    pearl:{value:new Color('#fff0ca')}, jade:{value:new Color('#789cac')},
  }), [])
  const upperAir = useMemo(() => ({...values, depth:{value:.22}}), [values])
  const lowerAir = useMemo(() => ({...values, depth:{value:.68}}), [values])

  useFrame((_, frame) => {
    if (!group.current) return
    const status = rally.getStatus()
    const live = status.ritual === 'summit' || status.ritual === 'moonrise'
    group.current.visible = live
    if (!live) { focus.current = 0; return }
    const aimed = status.ritual === 'summit' && status.phase === 'ready' && rally.skyAimCentered()
    const flight = status.ritual === 'summit' && status.phase === 'outbound'
    const release = status.ritual === 'moonrise' ? rally.moonProgress() : 0
    focus.current = MathUtils.damp(focus.current, aimed || flight ? 1 : 0, 3.8, Math.min(frame,.05))
    values.clock.value = rally.time
    values.charge.value = focus.current
    values.release.value = release
    if (echo.current && echoInk.current) {
      const t = MathUtils.smoothstep(release, 0, .54)
      echo.current.visible = release > .015 && t < 1
      echo.current.scale.setScalar(.95 + t * 1.35)
      echoInk.current.opacity = .36 * Math.sin(Math.PI*t) * (1 - t)
    }
  })

  if (stage !== 'summit' && stage !== 'moonrise') return null
  return <group ref={group} name="Lunar light in the air and on the stone">
    <mesh position={[0, -.10, -1.10]} renderOrder={5}>
      <planeGeometry args={[2.30, 1.48]} />
      <shaderMaterial vertexShader={vertex} fragmentShader={air} uniforms={upperAir}
        transparent depthWrite={false} blending={AdditiveBlending} />
    </mesh>
    <mesh position={[-.19, -.31, -2.10]} renderOrder={4}>
      <planeGeometry args={[3.02, 1.83]} />
      <shaderMaterial vertexShader={vertex} fragmentShader={air} uniforms={lowerAir}
        transparent depthWrite={false} blending={AdditiveBlending} />
    </mesh>
    <mesh position={[.31, -2.519, 4.28]} rotation-x={-Math.PI / 2} renderOrder={6}>
      <planeGeometry args={[3.42, 7.38]} />
      <shaderMaterial vertexShader={vertex} fragmentShader={stone} uniforms={values}
        transparent depthWrite={false} blending={AdditiveBlending} />
    </mesh>
    <mesh ref={echo} visible={false} position={[0, 0, -.64]} renderOrder={7}>
      <ringGeometry args={[.55, .583, 64]} />
      <meshBasicMaterial ref={echoInk} color="#eddfb3" transparent depthWrite={false}
        blending={AdditiveBlending} opacity={0} toneMapped={false} />
    </mesh>
  </group>
}
