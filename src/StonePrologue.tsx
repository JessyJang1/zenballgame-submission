import CourtLanterns from "./CourtLanterns"
import { useEffect, useMemo, useRef, type RefObject } from 'react'
import { useSceneTexture } from './assets/useSceneTexture'
import { useFrame, useThree } from '@react-three/fiber'
import { BackSide, BufferGeometry, DoubleSide, ExtrudeGeometry, MeshBasicMaterial, Shape, ShapeGeometry, SRGBColorSpace, Float32BufferAttribute, MathUtils, Raycaster, Vector3, Vector2, type Group, type PointLight } from 'three'
import { buildRelief, thresholdReliefs } from './stoneRelief'
import StoneWater from './StoneWater'
import StoneBlossoms from './StoneBlossoms'
import ThresholdPine from './ThresholdPine'
import ThresholdVault from './ThresholdVault'
import CaveStonework from './CaveStonework'
import CaveRidges from './CaveRidges'
import CaveCourtBanks from './CaveCourtBanks'
import { makeCaveStone } from './assets/caveStone'
import { AssetSlot } from './assets/AssetSlots'
import { ThresholdStoneAsset, ThresholdStoneBoundary } from './assets/ThresholdStoneSet'

function cutRidge(seed: number) {
  const profile = [1.20,1.12,1.06,.90,.84,.73,.65,.55,.46,.34,.27,.14,.095,.015]
  const sides = 54
  const positions: number[] = [], indices: number[] = []
  for (let row=0;row<profile.length;row++) {
    const y=row/(profile.length-1)
    for(let side=0;side<sides;side++) {
      const a=side/sides*Math.PI*2
      const strata=.12*Math.sin(a*4+seed+y*4.8)+.08*Math.cos(a*11-y*6)
      const ribs=.15*Math.pow(Math.abs(Math.sin(a*6+seed+y*2)),6)
      const shelf=.05*Math.sin(row*2.1+a*6+seed)
      const r=profile[row]*(1+strata+ribs+shelf)*(1+.22*Math.sin(seed*1.23+y*5.2)*y)
      const lean=(Math.sin(seed)*.29)*y*y
      const crest=y+(.065*Math.sin(a*3+seed+row*.38)*Math.sin(y*Math.PI))
      positions.push(Math.cos(a)*r + lean, crest, Math.sin(a)*r-.23*y*y)
      if(row){
        const i=(row-1)*sides+side, j=(row-1)*sides+(side+1)%sides
        indices.push(i,i+sides,j,j,i+sides,j+sides)
      }
    }
  }
  const geometry=new BufferGeometry()
  for (let side=1;side<sides-1;side++) {
    const summit=(profile.length-1)*sides
    indices.push(summit,summit+side+1,summit+side)
  }
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

const cloudBanks = [[-11,.8,33],[13,1.6,26],[-22,1.1,-7],[23,2.2,-13],[-17,5.1,-32],[13,4.8,-26],[0,8.6,-49],[-13,4.8,-56],[25,6.3,-69]]
const drift = new Float32Array(Array.from({length: 210}, (_, i) => {
  const seed = Math.sin(i * 79.131 + 4.3) * 43758.54
  const unit = seed - Math.floor(seed)
  return i % 3 === 0 ? (unit - .5) * 32 : i % 3 === 1 ? unit * 9 : 30 + unit * 26
}))
const peaks = [
  [-24,-5,27,11,27,10,2.1,'#29483a'], [27,-6,23,12,28,13,.8,'#354d42'],
] as const

const folioBanks = [
  [-6.5, 59.7], [2.4, 60], [8.2, 55], [9.2, 46], [10.2, 36.8],
  [8.8, 25.3], [7.5, 13.4], [-7.4, 13.4], [-9.7, 24.5], [-10.4, 36.5], [-9.2, 48.9], [-8.5, 55.8],
] as const

export default function StonePrologue({ progress, onTouch, ready, openingServe, onServeSound, wakeLamp, folioView = false }: {
  openingServe?: RefObject<(() => void) | null>; onServeSound?: () => void
  progress: RefObject<number>; onTouch: () => void; ready: boolean
  wakeLamp: RefObject<PointLight | null>
  folioView?: boolean
}) {
  const rock = useRef<Group>(null), door = useRef<Group>(null), spirit = useRef<Group>(null)
  const flightStroke=useRef<Group>(null)
  const sigil = useRef<Group>(null), seam = useRef<MeshBasicMaterial>(null)
  const card = useSceneTexture(import.meta.env.BASE_URL + 'assets/art/stone-prologue-card.png')
  card.colorSpace = SRGBColorSpace
  const ridges = useMemo(()=>folioView ? [] : peaks.map((peak,i)=>({
    geometry: cutRidge(i*2.48),
    material: makeCaveStone(card,'ridge',peak[7]),
  })),[card,folioView])
  useEffect(()=>()=>ridges.forEach(({geometry,material})=>{geometry.dispose();material.dispose()}),[ridges])
  // Keep the real approach levels legible on the scroll without a reflection pass.
  const folioWater = useMemo(() => folioView
    ? new ShapeGeometry(new Shape(folioBanks.map(([x, z]) => new Vector2(x, -z))))
    : null, [folioView])
  useEffect(() => () => folioWater?.dispose(), [folioWater])
  const relief = useMemo(() => ({
    bankLeft:buildRelief(thresholdReliefs.bankLeft),
    bankRight:buildRelief(thresholdReliefs.bankRight),
  }), [])
  const doorGeometry=useMemo(()=>{
    const profile=new Shape()
    profile.moveTo(-2.2,-.58);profile.lineTo(-2.14,.25);profile.lineTo(-1.77,1.08)
    profile.lineTo(-1.07,1.57);profile.lineTo(-.37,1.69);profile.lineTo(.16,1.51)
    profile.lineTo(.95,1.63);profile.lineTo(1.55,1.28);profile.lineTo(1.85,.69)
    profile.lineTo(2.15,.17);profile.lineTo(2.03,-.60);profile.closePath()
    return new ExtrudeGeometry(profile,{depth:1.04,bevelEnabled:true,bevelThickness:.26,bevelSize:.24,bevelSegments:3})
      .translate(0,0,-.52)
  },[])
  const doorMaterial=useMemo(()=>makeCaveStone(card,'vault','#486356'),[card])
  useEffect(()=>()=>{doorGeometry.dispose();doorMaterial.dispose()},[doorGeometry,doorMaterial])
  const wakeLight = useMemo(() => ({value: 0}), [])
  const pigment = useMemo(() => {
    const material = new MeshBasicMaterial({map: card, vertexColors: true, side: DoubleSide})
    material.onBeforeCompile = shader => {
      shader.uniforms.wakeLight = wakeLight
      shader.vertexShader = 'varying vec3 stonePosition;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>', '#include <begin_vertex>\nstonePosition = position;')
      shader.fragmentShader = 'uniform float wakeLight;varying vec3 stonePosition;\n' + shader.fragmentShader.replace(
        '#include <color_fragment>', `#include <color_fragment>
        float wall = 1. - smoothstep(.69,.99,vColor.r);
        vec3 p = stonePosition;
        // Use the same bare rock swatch on the mural's bevel and on the vault.
        // The figure UVs are confined to the outward-facing surface.
        vec2 swatch=vec2(.426,.829);
        vec2 extent=vec2(.071,.107);
        vec2 rockUV=swatch+extent*(1.-abs(fract(p.xy*.55)*2.-1.));
        vec2 crossUV=swatch+extent*(1.-abs(fract(p.zy*.61+vec2(.21,.08))*2.-1.));
        vec3 layers=mix(texture2D(map,rockUV).rgb,texture2D(map,crossUV).rgb,.52);
        float rock=clamp(dot(layers,vec3(.35,.54,.11))*2.5,0.,1.);
        float seam=sin(p.y*3.8+sin(p.x*1.1+p.z*.67)*1.4);
        vec3 mineral=mix(vec3(.041,.076,.063),vec3(.26,.169,.079),rock*.65);
        mineral *= .88 + rock*.37 + seam*.035;
        diffuseColor.rgb = mix(diffuseColor.rgb, mineral, wall);
        float band=.35+rock*.65;
        float edge = exp(-abs(p.x-1.3)*.45) * exp(-abs(p.z-40.)*.075);
        diffuseColor.rgb += vec3(.73,.39,.105)*edge*wakeLight*(.25+.75*band);
        `)
    }
    return material
  }, [card, wakeLight])
  useEffect(() => () => {
    Object.values(relief).forEach(mesh => mesh.dispose())
    pigment.dispose()
  }, [relief, pigment])

  const { camera, gl, invalidate } = useThree()
  const shot=useMemo(()=>({
    active:false, arrived:false, elapsed:0, duration:1,
    surface:'', taskId:'',
    origin:new Vector3(.64,2.25,46.5), impact:new Vector3(), guide:new Vector3(),
    wave:{value:-1},
  }),[])
  const shadowStep=useRef(-1)
  useEffect(() => {
    if (!ready || folioView) return
    const ray = new Raycaster()
    const pointer = new Vector2()
    const canvas = gl.domElement
    shot.active=false
    shot.arrived=false
    shot.wave.value=-1
    delete canvas.dataset.wakeSurface
    delete canvas.dataset.wakeTask
    function serve(point:Vector3){
      if(shot.active || shot.arrived || !door.current || !rock.current) return
      ray.set(shot.origin,point.clone().sub(shot.origin).normalize())
      const hit=ray.intersectObjects([door.current,rock.current],true)[0]
      if(!hit) return
      shot.surface = hit.object.name
      shot.taskId = String(hit.object.userData.AholoTaskId ?? '')
      shot.impact.copy(hit.point)
      shot.duration=MathUtils.clamp(hit.distance/17,.34,.95)
      shot.elapsed=0
      shot.active=true
      onServeSound?.()
      invalidate()
    }
    const centerServe=()=>serve(new Vector3(.66,.95,43.15))
    if(openingServe) openingServe.current=centerServe
    const touch = (event: MouseEvent) => {
      if (!rock.current || !door.current || !spirit.current) return
      const bounds = canvas.getBoundingClientRect()
      pointer.set(2*(event.clientX-bounds.left)/bounds.width-1,1-2*(event.clientY-bounds.top)/bounds.height)
      ray.setFromCamera(pointer,camera)
      const hit=ray.intersectObjects([rock.current,door.current,spirit.current],true)[0]
      if(hit && hit.object.parent===spirit.current) centerServe()
      else if(hit) serve(hit.point)
    }
    canvas.addEventListener('click',touch)
    return ()=>{
      canvas.removeEventListener('click',touch)
      if(openingServe) openingServe.current=null
    }
  }, [camera,folioView,gl,invalidate,openingServe,onServeSound,ready,shot])

  useFrame((_,delta) => {
    const t = progress.current
    wakeLight.value = MathUtils.smoothstep(t, .015, .19) * (1 - MathUtils.smoothstep(t, .28, .65))
    const opening = MathUtils.smootherstep(t, .09, .42)
    if(door.current){
      door.current.position.y=-2.35*opening
      door.current.position.z=43.15-.26*opening
      const step=Math.floor(opening*8)
      if(!folioView && step!==shadowStep.current){
        shadowStep.current=step
        gl.shadowMap.needsUpdate=true
      }
    }
    if (sigil.current) {
      sigil.current.visible = t < .28
      sigil.current.rotation.z = t * 2.4
      sigil.current.scale.setScalar(1 + MathUtils.smoothstep(t, 0, .24) * .7)
    }
    if (seam.current) seam.current.opacity = (.47 + .53 * MathUtils.smoothstep(t, 0, .12)) * (1 - MathUtils.smoothstep(opening, .12, .75))
    if (!folioView && wakeLamp.current) {
      wakeLamp.current.intensity=(11+125*MathUtils.smoothstep(t,0,.18))*(1-MathUtils.smoothstep(t,.30,.73))
      wakeLamp.current.position.z=MathUtils.lerp(44,36,MathUtils.smoothstep(t,.2,.57))
      wakeLamp.current.position.y=MathUtils.lerp(3.4,5.5,MathUtils.smoothstep(t,.2,.62))
    }
    if (spirit.current) {
      const lead = MathUtils.smootherstep(t, .16, .84)
      if(shot.active){
        shot.elapsed+=Math.min(delta,.05)
        const travel=Math.min(1,shot.elapsed/shot.duration)
        spirit.current.position.lerpVectors(shot.origin,shot.impact,travel)
        if(travel===1){
          shot.active=false
          shot.arrived=true
          gl.domElement.dataset.wakeSurface = shot.surface
          gl.domElement.dataset.wakeTask = shot.taskId
          onTouch()
        }else invalidate()
      }else if(shot.arrived){
        const rebound=MathUtils.smootherstep(t,0,.38)
        shot.guide.set(.64,2.25+Math.sin(lead*Math.PI)*2.65,46.5-lead*35)
        spirit.current.position.lerpVectors(shot.impact,shot.guide,rebound)
        spirit.current.position.y+=1.5*Math.sin(rebound*Math.PI)
      }else spirit.current.position.copy(shot.origin)
      shot.wave.value=shot.arrived?t*68:-1
      if(flightStroke.current){
        const length=shot.active ? Math.min(1,shot.elapsed*6) : shot.arrived ? 1-MathUtils.smoothstep(t,0,.05) : 0
        flightStroke.current.visible=length>.01
        if(length>.01){
          flightStroke.current.lookAt(shot.origin)
          flightStroke.current.scale.z=length
        }
      }
      spirit.current.visible = t < .88
    }
  })

  return <group name="Stone threshold">
    <ThresholdVault atlas={card} rock={rock} wake={wakeLight} impact={shot.impact} wave={shot.wave} folioView={folioView}/>
    <group dispose={null}>
      <mesh geometry={relief.bankLeft} material={pigment}/>
      <mesh geometry={relief.bankRight} material={pigment}/>
    </group>
    <group ref={door} position={[.66,0,43.15]} name="Single threshold stone">
      <group position-y={-.68}>
        <AssetSlot slot="thresholdPlug" fit={[5.07,2.47,1.93]}>
          <group position-y={.68}>
            <ThresholdStoneBoundary fallback={<mesh geometry={doorGeometry} material={doorMaterial}/>}>
              <ThresholdStoneAsset name="HeroGateStone"/>
            </ThresholdStoneBoundary>
          </group>
        </AssetSlot>
      </group>
    </group>
    {!folioView && peaks.map(([x,y,z,w,h,d,yaw],i) => <mesh key={x+z}
      geometry={ridges[i].geometry} material={ridges[i].material}
      position={[x,y,z]} scale={[w,h,d]} rotation-y={yaw}/>)}
    <ThresholdPine/>
    {!folioView && <CaveRidges atlas={card}/>}
    <CourtLanterns atlas={card}/>
    <CaveStonework atlas={card}/>
    <CaveCourtBanks atlas={card}/>
    {!folioView && <StoneWater progress={progress}/>}
    <StoneBlossoms/>

    {folioWater && <mesh name="Threshold pool in the raised map" geometry={folioWater} position-y={.035} rotation-x={-Math.PI / 2}>
      <meshStandardMaterial color="#305d51" roughness={.81}/>
    </mesh>}
    {!folioView && <>
    <mesh name="Valley daylight dome" position={[0,3,0]} renderOrder={-10}>
      <sphereGeometry args={[175,48,24]}/>
      <shaderMaterial side={BackSide} depthWrite={false}
        vertexShader="varying vec3 sight;void main(){vec4 world=modelMatrix*vec4(position,1.);sight=world.xyz-cameraPosition;gl_Position=projectionMatrix*viewMatrix*world;gl_Position.z=gl_Position.w*.99999;}"
        fragmentShader={`varying vec3 sight;
          float hash(vec2 p){return fract(sin(dot(p,vec2(43.17,71.39)))*37139.13);}
          float mist(vec2 p){
            vec2 cell=floor(p),f=fract(p);f=f*f*(3.-2.*f);
            return mix(mix(hash(cell),hash(cell+vec2(1,0)),f.x),
              mix(hash(cell+vec2(0,1)),hash(cell+1.),f.x),f.y);
          }
          void main(){
            vec3 d=normalize(sight);
            vec2 clouds=d.xz/max(.14,d.y+.19)*vec2(2.1,3.4);
            float vapor=.56*mist(clouds)+.29*mist(clouds*2.2)+.15*mist(clouds*5.3);
            float sun=max(dot(d,normalize(vec3(.07,.15,-1.))),0.);
            vec3 sky=mix(vec3(.69,.63,.47),vec3(.13,.30,.34),smoothstep(-.08,.66,d.y));
            sky=mix(sky,vec3(.88,.79,.64),smoothstep(.32,.78,vapor)*.75);
            sky+=vec3(.33,.19,.06)*pow(sun,42.);
            gl_FragColor=vec4(sky,1.);
            #include <colorspace_fragment>
          }`}/>
    </mesh>
    <mesh position={[0,-2.05,4]} rotation-x={-Math.PI/2}>
      <planeGeometry args={[126,119]}/><meshStandardMaterial color="#293d35" roughness={1}/>
    </mesh>
    <group name="Opening tennis ball" ref={spirit} position={[.64,2.25,46.5]}>
      <mesh rotation={[.26,.45,-.62]}>
        <sphereGeometry args={[.245,32,24]}/>
        <shaderMaterial toneMapped={false}
          vertexShader="varying vec3 ballNormal;void main(){ballNormal=normal;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}"
          fragmentShader={`varying vec3 ballNormal;
            void main(){
              vec3 n=normalize(ballNormal);
              float seam=abs(n.y-.58*(n.x*n.x-n.z*n.z));
              float band=1.-smoothstep(.038,.065+fwidth(seam),seam);
              float sun=.62+.46*max(dot(n,normalize(vec3(-.5,.85,.6))),0.);
              gl_FragColor=vec4(mix(vec3(.72,.45,.09),vec3(1.,.91,.61),band)*sun,1.);
              #include <colorspace_fragment>
            }`}/>
      </mesh>
      <group ref={flightStroke} visible={false}>
        <mesh position-z={.83} scale={[.075,.075,.86]}>
          <sphereGeometry args={[1,12,8]}/>
          <meshBasicMaterial color="#f5d68b" transparent opacity={.49} depthWrite={false}/>
        </mesh>
      </group>
    </group>
    <group ref={sigil} position={[.64,2.25,46.45]}>
      <mesh><ringGeometry args={[.40,.418,48,1,.35,4.95]}/><meshBasicMaterial ref={seam} color="#fbc878" transparent opacity={.47} depthWrite={false} toneMapped={false}/></mesh>

    </group>
    {cloudBanks.map(([x,y,z]) => <mesh key={z} position={[x,y,z]}>
      <planeGeometry args={[23,2.1]}/>
      <shaderMaterial transparent depthWrite={false}
        vertexShader="varying vec2 mistUV;void main(){mistUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}"
        fragmentShader={`varying vec2 mistUV;void main(){
          vec2 p=mistUV*2.-1.;
          float bank=sin(p.x*6.+sin(p.x*11.)*.51)*.13+sin(p.x*22.)*.033;
          float height=p.y+bank;
          float veil=exp(-height*height*5.)*(1.-smoothstep(.0,1.,abs(p.x)))*(1.-smoothstep(.6,1.,abs(p.y)));
          gl_FragColor=vec4(.54,.65,.59,veil*.29);
          #include <colorspace_fragment>
        }`}/>
    </mesh>)}
    <points>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[drift,3]}/></bufferGeometry>
      <pointsMaterial color="#f7d29a" transparent opacity={.48} size={.064} depthWrite={false}/>
    </points>
    </>}
  </group>
}
