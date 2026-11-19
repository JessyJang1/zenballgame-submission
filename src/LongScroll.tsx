import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { MathUtils, Quaternion, Vector3, type Mesh, type ShaderMaterial } from 'three'
import { FOLIO } from './finaleLayout'
import { scrollSurfaceY, SUMMIT } from './paintingLayout'
import type { Rally } from './rally'
import ScrollPainting from './ScrollPainting'

const flat = new Quaternion().setFromAxisAngle(new Vector3(1, 0, 0), -Math.PI / 2)
const raised = new Quaternion()

export default function LongScroll({ rally, folioTime }: { rally: Rally; folioTime: RefObject<number> }) {
  const moon = useRef<Mesh>(null)
  const halo = useRef<Mesh>(null)
  const moonInk = useRef<ShaderMaterial>(null)
  const haloInk = useRef<ShaderMaterial>(null)
  const pigment = useMemo(() => ({ onSilk: { value: 0 } }), [])
  const glow = useMemo(() => ({ strength: { value: 0 } }), [])
  const moonMark = useMemo(() => new Vector3(), [])
  const orientation = useMemo(() => new Quaternion(), [])
  const fromWorld = useMemo(() => new Quaternion(), [])
  useFrame(({ camera }) => {
    if (!moon.current || !halo.current || !moonInk.current || !haloInk.current) return
    const t = folioTime.current
    const ascent = t > 0 ? rally.moonProgress() : 0
    const flatten = MathUtils.smootherstep(t, FOLIO.inkStart + .32, FOLIO.inkEnd)
    moon.current.visible = ascent >= .34
    halo.current.visible = ascent > .35 && flatten < .99
    if (!moon.current.visible) return
    const ball = rally.position()
    const radius = MathUtils.lerp(.17, SUMMIT.moon.radius, MathUtils.smoothstep(ascent,.34,1))
    moon.current.position.set(ball.x,ball.y,ball.z)
    moon.current.scale.setScalar(radius)
    moon.current.quaternion.copy(raised).slerp(flat, flatten)
    if (flatten > 0) {
      const screenStretch = (FOLIO.portraitEye[1] - scrollSurfaceY) / (FOLIO.portraitEye[1] - ball.y)
      const projectedX = FOLIO.portraitEye[0] + (ball.x - FOLIO.portraitEye[0]) * screenStretch
      const projectedZ = FOLIO.portraitEye[2] + (ball.z - FOLIO.portraitEye[2]) * screenStretch
      const markX = MathUtils.lerp(projectedX, 25, flatten)
      const markZ = MathUtils.lerp(projectedZ, -75.8, flatten)
      moonMark.set(markX, scrollSurfaceY + .1, markZ)
      moon.current.position.lerp(moonMark, flatten)
      moon.current.scale.setScalar(MathUtils.lerp(radius, 4.7, flatten))
      moon.current.scale.z *= MathUtils.lerp(1, .018, flatten)
    }
    moon.current.renderOrder = t >= FOLIO.survey ? 57 : 2
    const onPage = flatten > 0
    moonInk.current.depthTest = !onPage
    moonInk.current.depthWrite = !onPage
    moonInk.current.uniforms.onSilk.value = flatten
    halo.current.position.copy(moon.current.position)
    orientation.copy(camera.quaternion)
    if (moon.current.parent) {
      // The painting group stands while the glow still faces the viewing lens.
      orientation.premultiply(fromWorld.copy(moon.current.parent.quaternion).invert())
    }
    halo.current.quaternion.copy(orientation)
    haloInk.current.uniforms.strength.value = MathUtils.smoothstep(ascent, .35, 1) * (1 - flatten)
  })
  return <>
    <ScrollPainting folioTime={folioTime} />
    <mesh ref={moon} visible={false} name="Lunar tennis ball becomes a seal on the original painting">
      <sphereGeometry args={[1,48,32]}/>
      <shaderMaterial ref={moonInk} toneMapped={false} uniforms={pigment} transparent
        vertexShader="varying vec3 globe;void main(){globe=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}"
        fragmentShader={`varying vec3 globe;
          uniform float onSilk;
          float grain(vec3 p){
            return sin(p.x+sin(p.z*.83))*sin(p.y+cos(p.x*.71));
          }
          void main(){
            vec3 n=normalize(globe);
            float wash=grain(n*4.6)+.47*grain(n.zxy*9.8)+.19*grain(n.yzx*21.);
            float maria=smoothstep(-.45,.81,wash+n.y*.25);
            float relief=.018*grain(n*43.)+.008*grain(n.yzx*89.);
            vec3 pigment=mix(vec3(.98,.77,.43),vec3(.61,.43,.23),maria*.73);
            float seam=abs(n.y-.58*(n.x*n.x-n.z*n.z));
            float felt=(1.-smoothstep(.016,.041+fwidth(seam),seam))*.24;
            float light=.72+.29*max(0.,dot(n,normalize(vec3(-.52,.75,.66))));
            vec3 inSky = (pigment+relief+felt)*light;
            float inkGrain = .93 + .07 * grain(n*74.) + .04 * grain(n*121.);
            vec3 onPage = (pigment*.82 + felt*.80) * inkGrain;
            gl_FragColor=vec4(mix(inSky,onPage,onSilk),1.);
            #include <colorspace_fragment>
          }`}/>
    </mesh>
    <mesh ref={halo} visible={false} name="Moon halo">
      <planeGeometry args={[SUMMIT.moon.radius * 5.7, SUMMIT.moon.radius * 5.7]} />
      <shaderMaterial ref={haloInk} transparent depthWrite={false} uniforms={glow}
        vertexShader={`
          varying vec2 st;
          void main() {
            st = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
          }
        `}
        fragmentShader={`
          uniform float strength;
          varying vec2 st;
          void main() {
            float radius = length(st - .5);
            float rim = 1. - smoothstep(.13, .49, radius);
            gl_FragColor = vec4(.73, .55, .29, rim * rim * .24 * strength);
            #include <colorspace_fragment>
          }`}
      />
    </mesh>
  </>
}
