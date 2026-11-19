import { Suspense, useEffect, useMemo, type ReactNode } from 'react'
import { useThree } from '@react-three/fiber'
import type { Mesh } from 'three'
import { useGLTF } from '@react-three/drei'
import { AssetSlot } from './assets/AssetSlots'
const files={gateFrame:'gate-frame.glb',gateDoorLeft:'gate-door-left.glb',gateDoorRight:'gate-door-right.glb'} as const
function Candidate({file}:{file:string}) {
  const {scene}=useGLTF('/art/staging/overnight-gate/'+file,false,false)
  const clone=useMemo(()=>{const model=scene.clone(true);model.traverse(o=>{if((o as Mesh).isMesh){o.castShadow=true;o.receiveShadow=true}});return model},[scene])
  const gl=useThree(s=>s.gl)
  useEffect(()=>{gl.shadowMap.needsUpdate=true},[clone,gl])
  return <primitive object={clone} name={`Review ${file}`} dispose={null}/>
}
export default function ReviewGate({slot,children}:{slot:keyof typeof files;children:ReactNode}) {
  const review=import.meta.env.DEV && new URLSearchParams(location.search).get('review')==='world'
  return review ? <Suspense fallback={children}><Candidate file={files[slot]}/></Suspense> : <AssetSlot slot={slot}>{children}</AssetSlot>
}
