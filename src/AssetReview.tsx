import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, useGLTF } from '@react-three/drei'
import { Box3, Vector3, type Mesh } from 'three'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'

const assets={gate:'/art/staging/overnight-gate/gate-frame.glb',bellBefore:'/art/staging/overnight-bell/runtime-before.glb',bellAfter:'/art/staging/overnight-bell/stone-bell.glb'}
type AssetKey=keyof typeof assets
const options=new URLSearchParams(location.search)
const raw=options.get('asset')??'gate'
const candidate=options.get('file')??''
const runtimeFile=/^assets\/models\/(?:stone-bell|bell-mount|entrance-aholo-8295863|gate-roof-aholo-8295884|lotus-petal-aholo-8295893|mountain-gate-(?:frame|left|right)|threshold-stone-set)\.glb$/.test(candidate)
const validCandidate=(raw==='runtime' && runtimeFile) || raw==='lux3d' && /^(?:art\/lux3d\/raw\/\d+-[a-z-]+\.glb|art\/staging\/lux3d\/[a-z-]+-runtime\.glb)$/.test(candidate)
const kind:AssetKey=raw in assets?raw as AssetKey:'gate'
const shortView=validCandidate || kind!=='gate'
const centerY=validCandidate?1.08:shortView?1.1:2.3
function Model() {
  const {scene}=useGLTF(validCandidate?'/'+candidate:assets[kind],false,false)
  const {model,position,scale}=useMemo(()=>{
    const model=scene.clone(true),box=new Box3().setFromObject(model),size=box.getSize(new Vector3()),center=box.getCenter(new Vector3())
    model.traverse(o=>{if((o as Mesh).isMesh){o.castShadow=true;o.receiveShadow=true}})
    const scale=validCandidate?2.6/Math.max(size.x,size.y,size.z):kind==='gate'?1:2.2/size.y
    return{model,scale,position:[-center.x*scale,-box.min.y*scale,-center.z*scale] as [number,number,number]}
  },[scene])
  return <group scale={scale} position={position}><primitive object={model} dispose={null}/></group>
}
const labels=['正面','侧面','背面','游戏角度']
function Controls({view}:{view:number}) {
  const {camera,invalidate}=useThree(),controls=useRef<OrbitControlsType>(null)
  useEffect(()=>{
    const views=!shortView?[[0,2.4,11],[11,2.4,.01],[0,2.4,-11],[7,7,10]]:[[0,1.5,5.6],[5.6,1.5,.01],[0,1.5,-5.6],[4,4,5]]
    camera.position.set(...views[view] as [number,number,number]);camera.lookAt(0,centerY,0)
    controls.current?.target.set(0,centerY,0);controls.current?.update();camera.updateMatrixWorld();invalidate()
  },[camera,invalidate,view])
  return <OrbitControls ref={controls} enableDamping={false} target={[0,centerY,0]}/>
}
export default function AssetReview() {
  const [view,setView]=useState(0)
  return <main className="asset-review">
    <header><strong>{validCandidate?(raw==='runtime'?'运行模型 · ':'Lux3D · ')+candidate.split('/').at(-1):kind==='gate'?'山门 · Blender手工候选':kind==='bellBefore'?'石钟 · 原运行件 / Aholo8211698':'石钟 · Blender处理候选 / Aholo8211698'}</strong>
      <span>隔离审阅 · 不代表用户美术验收通过</span><nav>{labels.map((label,i)=><button key={label} aria-pressed={view===i} onClick={()=>setView(i)}>{label}</button>)}</nav>
    </header>
    <div className="asset-review-stage"><Canvas frameloop="demand" shadows dpr={1} camera={{position:[0,2.4,11],fov:43,near:.1,far:100}} gl={{antialias:true,powerPreference:'low-power'}}>
      <color attach="background" args={['#18372f']}/><hemisphereLight args={['#f0e7d2','#274a3d',1.6]}/>
      <directionalLight position={[-5,10,7]} color="#ffecd0" intensity={2.7} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9} shadow-normalBias={.015}/>
      <mesh receiveShadow rotation-x={-Math.PI/2} position-y={-.01}><planeGeometry args={[30,30]}/><meshStandardMaterial color="#304d40" roughness={1}/></mesh>
      <Suspense fallback={null}><Model/></Suspense><Controls view={view}/>
    </Canvas></div>
  </main>
}
