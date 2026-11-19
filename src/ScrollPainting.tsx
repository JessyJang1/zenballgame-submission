import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { CanvasTexture, Color, MathUtils, MeshStandardMaterial, SRGBColorSpace, Vector2, type Group, type MeshBasicMaterial, type ShaderMaterial } from 'three'
import { useSceneTexture } from './assets/useSceneTexture'
import { FOLIO } from './finaleLayout'
import { scrollSurfaceY } from './paintingLayout'

const artHeight = FOLIO.height - 14
const artWidth = artHeight * 550 / 727
const railWidth = artWidth + 13
const finial = [[0,-4.2],[1.8,-4.2],[2.25,-3.8],[2.48,-2.9],[2.38,-2.2],
  [2.12,-1.8],[2.53,-1.2],[2.57,1.4],[2.24,2.2],[1.96,2.8],[0,2.8]]
  .map(([r,y])=>new Vector2(r,y))

function wovenBorder() {
  const canvas = document.createElement('canvas')
  canvas.width = 384
  canvas.height = 544
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  const silk = ctx.createLinearGradient(0, 0, 384, 544)
  silk.addColorStop(0, '#2c4942')
  silk.addColorStop(.53, '#43594e')
  silk.addColorStop(1, '#203c34')
  ctx.fillStyle = silk
  ctx.fillRect(0, 0, 384, 544)
  ctx.strokeStyle = '#c4ad784b'
  ctx.lineWidth = 1
  for (let row = -1; row < 35; row++) {
    for (let col = -1; col < 24; col++) {
      const x = col * 18 + (row % 2) * 9, y = row * 17
      ctx.beginPath()
      ctx.moveTo(x, y + 5)
      ctx.quadraticCurveTo(x + 5, y + 5, x + 7, y)
      ctx.quadraticCurveTo(x + 10, y + 5, x + 16, y + 5)
      ctx.quadraticCurveTo(x + 10, y + 6, x + 7, y + 10)
      ctx.quadraticCurveTo(x + 5, y + 6, x, y + 5)
      ctx.stroke()
    }
  }
  const left = (1 - artWidth / railWidth) * 192
  const top = (1 - artHeight / FOLIO.height) * 272
  ctx.strokeStyle = '#ad9064'
  ctx.strokeRect(5.5, 5.5, 373, 533)
  ctx.strokeStyle = '#d8c495'
  ctx.lineWidth = 2
  ctx.strokeRect(left - 1, top - 1, 386 - 2 * left, 546 - 2 * top)
  ctx.clearRect(left, top, 384 - left * 2, 544 - top * 2)
  const border = new CanvasTexture(canvas)
  border.colorSpace = SRGBColorSpace
  return border
}

const vertex = `
  varying vec2 st;
  void main(){
    st=uv;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
  }`

const pigment = `
  uniform sampler2D original;
  uniform float reveal;
  varying vec2 st;
  float hash(vec2 p) {
    vec3 q=fract(vec3(p.xyx)*.1031);
    q+=dot(q,q.yzx+33.33);
    return fract((q.x+q.y)*q.z);
  }
  float grain(vec2 p) {
    vec2 cell=floor(p), f=fract(p);
    f=f*f*(3.-2.*f);
    return mix(mix(hash(cell),hash(cell+vec2(1.,0.)),f.x),
      mix(hash(cell+vec2(0.,1.)),hash(cell+1.),f.x),f.y);
  }
  void main(){
    vec2 scan=vec2(15.,20.)/vec2(576.,762.)+st*vec2(550.,727.)/vec2(576.,762.);
    vec3 paint=texture2D(original,scan).rgb;
    vec2 fibre=st*vec2(43.,65.);
    float weave=.63*grain(fibre)+.37*grain(fibre*3.1);
    float rise=(1.-st.y)*.18+weave*.19;
    float soak=smoothstep(rise-.04,rise+.44,reveal);
    float opacity=soak*smoothstep(0.,.25,reveal);
    // Lay a thin mineral ground over the lower relief before the scan's pale lines surface.
    float court=1.-smoothstep(.48,.63,st.y);
    float ground=court*smoothstep(.08,.33,reveal);
    float detail=mix(1.,smoothstep(.24,.62,reveal),court);
    paint=mix(vec3(.044,.091,.071),paint,detail);
    opacity=1.-(1.-opacity)*(1.-ground);
    gl_FragColor=vec4(paint,opacity);
    #include <colorspace_fragment>
  }`

const outsideMount = `
  uniform vec2 halfFrame;
  uniform vec3 ground;
  uniform float draw;
  varying vec2 st;
  void main() {
    vec2 sheet=abs(st-.5);
    vec2 edge=smoothstep(halfFrame-vec2(.0015,.0052),halfFrame-vec2(.0007,.0044),sheet);
    gl_FragColor=vec4(ground,max(edge.x,edge.y)*draw);
    #include <colorspace_fragment>
  }`

export default function ScrollPainting({ folioTime }: { folioTime: RefObject<number> }) {
  const root = useRef<Group>(null)
  const painting = useRef<ShaderMaterial>(null)
  const matte = useRef<ShaderMaterial>(null)
  const border = useRef<MeshBasicMaterial>(null)
  const backing = useRef<MeshBasicMaterial>(null)
  const original = useSceneTexture(import.meta.env.BASE_URL + 'assets/art/shan-men.png')
  original.colorSpace = SRGBColorSpace
  const mount = useMemo(wovenBorder, [])
  const uniforms = useMemo(() => ({ original: { value: original }, reveal: { value: 0 } }), [original])
  const surround = useMemo(() => ({
    halfFrame: { value: new Vector2(railWidth / 1200, FOLIO.height / 1200) },
    ground: { value: new Color('#192f2a') },
    draw: { value: 0 },
  }), [])
  const wood = useMemo(() => new MeshStandardMaterial({
    color: '#583328', roughness: .58, transparent: true, depthTest: false, depthWrite: false,
  }), [])
  const fittings = useMemo(() => new MeshStandardMaterial({
    color: '#9e7447', roughness: .47, metalness: .23, transparent: true, depthTest: false, depthWrite: false,
  }), [])
  useEffect(() => () => { mount?.dispose(); wood.dispose(); fittings.dispose() }, [mount, wood, fittings])
  useFrame(() => {
    const now = folioTime.current
    if (root.current) root.current.visible = now >= FOLIO.survey
    const mounting = MathUtils.smoothstep(now, FOLIO.survey, FOLIO.upright)
    if (border.current) border.current.opacity = mounting
    if (backing.current) backing.current.opacity = mounting
    wood.opacity = fittings.opacity = mounting
    if (matte.current) matte.current.uniforms.draw.value = MathUtils.smoothstep(now, FOLIO.survey + .43, FOLIO.upright)
    if (!painting.current) return
    const progress = MathUtils.clamp((now - FOLIO.inkStart) / (FOLIO.inkEnd - FOLIO.inkStart), 0, 1)
    painting.current.visible = progress > 0
    painting.current.uniforms.reveal.value = progress
  })

  return <group ref={root} visible={false} position={[0, scrollSurfaceY, FOLIO.centerZ]}
    rotation-x={-Math.PI / 2} name="Standing silk mount for the live world map">
    <mesh position-z={-.08}>
      <planeGeometry args={[railWidth, FOLIO.height]} />
      <meshBasicMaterial ref={backing} color="#243b32" transparent depthWrite={false} />
    </mesh>
    <mesh renderOrder={45} position-z={-.02}>
      <planeGeometry args={[600,600]} />
      <shaderMaterial ref={matte} uniforms={surround} vertexShader={vertex} fragmentShader={outsideMount}
        transparent depthWrite={false} depthTest={false} toneMapped={false}/>
    </mesh>
    <mesh renderOrder={50}>
      <planeGeometry args={[railWidth, FOLIO.height]} />
      <meshBasicMaterial ref={border} map={mount} transparent depthWrite={false} depthTest={false} toneMapped={false} fog={false} />
    </mesh>
    <mesh renderOrder={51}>
      <planeGeometry args={[artWidth, artHeight]} />
      <shaderMaterial ref={painting} uniforms={uniforms} vertexShader={vertex} fragmentShader={pigment}
        transparent depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>
    {[-1,1].map(edge => <group key={edge} position-y={edge * FOLIO.height / 2} rotation-z={Math.PI / 2}>
      <mesh material={wood} renderOrder={53}>
        <cylinderGeometry args={[1.63,1.63,railWidth+5,28]}/>
      </mesh>
      {[-1,1].map(end => <mesh key={end} material={fittings} renderOrder={54} position-y={end * (railWidth / 2 + 1.7)} rotation-x={end < 0 ? Math.PI : 0}>
        <latheGeometry args={[finial,24]}/>
      </mesh>)}
    </group>)}
  </group>
}
